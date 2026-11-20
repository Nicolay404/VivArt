import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as identidadPruebas from '../../services/identidad/test/helpers.js';
import * as programacionPruebas from '../../services/programacion/test/helpers.js';
import { createEdge } from '../server.js';

// Recorrido real del spec 002 por HTTP: entrada común -> servicio de programación -> servicio de identidad (permisos).
// Sin simulaciones: la programación pregunta los permisos al servicio de identidad con su credencial de servicio.
const ORIGEN = 'http://localhost:8080';
const CLAVE = 'clave-de-prueba-solo-para-tests';
const CLAVE_VALIDA = 'una clave larga de prueba 123';
let identidad;
let identidadDeps;
let programacion;
let edge;
let base;

const escuchar = (servidor) => new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(servidor.address().port)));
const puerto = async (app) => {
  await app.listen({ port: 0, host: '127.0.0.1' });
  return app.server.address().port;
};

function navegador() {
  let cookie = '';
  return async (ruta, { metodo = 'GET', cuerpo } = {}) => {
    const r = await fetch(base + ruta, {
      method: metodo,
      headers: { origin: ORIGEN, ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
    const sesion = r.headers.getSetCookie().find((c) => c.startsWith('vivart_sid='));
    if (sesion) cookie = sesion.split(';')[0];
    const texto = await r.text();
    return { status: r.status, json: texto ? JSON.parse(texto) : null };
  };
}

before(async () => {
  ({ app: identidad, deps: identidadDeps } = await identidadPruebas.abrirApp(
    identidadPruebas.configPrueba({ SERVICE_KEYS: `programacion:${CLAVE}` }, { allowedOrigins: [ORIGEN] }),
  ));
  const urlIdentidad = `http://127.0.0.1:${await puerto(identidad)}`;
  ({ app: programacion } = await programacionPruebas.abrirApp(
    programacionPruebas.configPrueba({ IDENTIDAD_URL: urlIdentidad, IDENTIDAD_SERVICE_KEY: CLAVE, ALLOWED_ORIGINS: ORIGEN }),
  ));
  const urlProgramacion = `http://127.0.0.1:${await puerto(programacion)}`;
  edge = createEdge({
    routes: [
      { prefix: '/api/identidad', target: urlIdentidad },
      { prefix: '/api/programacion', target: urlProgramacion },
    ],
  });
  base = `http://127.0.0.1:${await escuchar(edge)}`;
});

after(() => edge.close());

async function cuenta(nombre) {
  const nav = navegador();
  const email = `${nombre}@vivart.test`;
  await nav('/api/identidad/auth/register', { metodo: 'POST', cuerpo: { email, password: CLAVE_VALIDA } });
  const buzon = await nav('/api/identidad/dev/mailbox');
  const verificacion = buzon.json.messages.filter((m) => m.to === email && m.kind === 'verify').at(-1);
  await nav('/api/identidad/auth/verify-email', { metodo: 'POST', cuerpo: { token: new URL(verificacion.link).searchParams.get('token') } });
  const login = await nav('/api/identidad/auth/login', { metodo: 'POST', cuerpo: { email, password: CLAVE_VALIDA } });
  return { nav, id: login.json.id };
}

test('de punta a punta: el editor envía, el publicador publica y la Agenda lo muestra; permisos reales de identidad', async () => {
  // Primer administrador por el procedimiento interno del spec 001
  await identidadDeps.accounts.createFirstAdmin('admin@vivart.test', { allowAdditional: true });
  const admin = navegador();
  const correo = (await admin('/api/identidad/dev/mailbox')).json.messages.filter((m) => m.kind === 'activate').at(-1);
  await admin('/api/identidad/auth/activate', { metodo: 'POST', cuerpo: { token: new URL(correo.link).searchParams.get('token'), password: CLAVE_VALIDA } });
  assert.equal((await admin('/api/identidad/auth/login', { metodo: 'POST', cuerpo: { email: 'admin@vivart.test', password: CLAVE_VALIDA } })).status, 200);

  const editor = await cuenta('editora');
  const publicador = await cuenta('publicador');
  await admin(`/api/identidad/users/${editor.id}/roles/editor`, { metodo: 'PUT' });
  await admin(`/api/identidad/users/${publicador.id}/roles/publicador`, { metodo: 'PUT' });

  // Catálogos (solo administrador)
  const categoria = (await admin('/api/programacion/panel/categories', { metodo: 'POST', cuerpo: { name: 'Teatro' } })).json;
  const sede = (await admin('/api/programacion/panel/venues', { metodo: 'POST', cuerpo: { name: 'Sala de Ejemplo', kind: 'place' } })).json;
  assert.equal((await editor.nav('/api/programacion/panel/categories', { metodo: 'POST', cuerpo: { name: 'X' } })).status, 403);

  // El editor crea y envía; no puede publicar
  const creada = (
    await editor.nav('/api/programacion/panel/activities', {
      metodo: 'POST',
      cuerpo: { content: { title: 'Obra de punta a punta', categoryId: categoria.id, functions: [{ date: '2026-11-21', startTime: '19:00', venueId: sede.id }] } },
    })
  ).json;
  const enviada = await editor.nav(`/api/programacion/panel/activities/${creada.id}/submit`, { metodo: 'POST', cuerpo: { version: creada.version } });
  assert.equal(enviada.status, 200);
  const intento = await editor.nav(`/api/programacion/panel/activities/${creada.id}/publish`, { metodo: 'POST', cuerpo: { version: enviada.json.version } });
  assert.equal(intento.status, 403);
  assert.equal(intento.json.missingRole, 'publicador');
  assert.deepEqual((await navegador()('/api/programacion/agenda')).json.items, []);

  // El publicador publica y el público lo ve sin sesión
  const publicada = await publicador.nav(`/api/programacion/panel/activities/${creada.id}/publish`, { metodo: 'POST', cuerpo: { version: enviada.json.version } });
  assert.equal(publicada.status, 200);
  const agenda = await navegador()('/api/programacion/agenda');
  assert.deepEqual(agenda.json.items.map((i) => i.title), ['Obra de punta a punta']);

  // Revocar el rol se nota en la siguiente acción (sin caché de permisos)
  await admin(`/api/identidad/users/${publicador.id}/roles/publicador`, { metodo: 'DELETE' });
  const sinRol = await publicador.nav(`/api/programacion/panel/functions/${publicada.json.functions[0].id}/cancel`, {
    metodo: 'POST',
    cuerpo: { reason: 'x', notice: 'y' },
  });
  assert.equal(sinRol.status, 403);
});
