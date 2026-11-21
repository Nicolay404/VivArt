import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as identidadPruebas from '../../services/identidad/test/helpers.js';
import * as programacionPruebas from '../../services/programacion/test/helpers.js';
import * as participacionPruebas from '../../services/participacion/test/helpers.js';
import { createEdge } from '../server.js';

// Recorrido real del spec 006 por HTTP con los tres servicios detrás de la entrada común, sin simulaciones:
// participación pregunta permisos a identidad y la función vigente a programación. Datos FICTICIOS.
const ORIGEN = 'http://localhost:8080';
const CLAVE_PROGRAMACION = 'clave-programacion-solo-para-pruebas';
const CLAVE_PARTICIPACION = 'clave-participacion-solo-para-pruebas';
const CLAVE_VALIDA = 'una clave larga de prueba 123';
let identidadDeps;
let edge;
let base;
const apps = [];

const escuchar = (servidor) => new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(servidor.address().port)));
async function url(app) {
  apps.push(app);
  await app.listen({ port: 0, host: '127.0.0.1' });
  return `http://127.0.0.1:${app.server.address().port}`;
}

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
  let app;
  ({ app, deps: identidadDeps } = await identidadPruebas.abrirApp(
    identidadPruebas.configPrueba(
      { SERVICE_KEYS: `programacion:${CLAVE_PROGRAMACION},participacion:${CLAVE_PARTICIPACION}` },
      { allowedOrigins: [ORIGEN] },
    ),
  ));
  const urlIdentidad = await url(app);

  // Programación necesita la dirección de participación y participación la de programación: se reserva el
  // puerto de participación arrancándola primero con programación apuntando a ella después.
  const participacionConfig = participacionPruebas.configPrueba({
    IDENTIDAD_URL: urlIdentidad,
    IDENTIDAD_SERVICE_KEY: CLAVE_PARTICIPACION,
    SERVICE_KEYS: `programacion:${CLAVE_PROGRAMACION}`,
    ALLOWED_ORIGINS: ORIGEN,
    PROGRAMACION_URL: 'http://127.0.0.1:1',
  });
  const { app: participacion, services: servParticipacion } = await participacionPruebas.abrirApp(participacionConfig);
  const urlParticipacion = await url(participacion);

  ({ app } = await programacionPruebas.abrirApp(
    programacionPruebas.configPrueba({
      IDENTIDAD_URL: urlIdentidad,
      IDENTIDAD_SERVICE_KEY: CLAVE_PROGRAMACION,
      SERVICE_KEYS: `participacion:${CLAVE_PARTICIPACION}`,
      PARTICIPACION_URL: urlParticipacion,
      ALLOWED_ORIGINS: ORIGEN,
    }),
  ));
  const urlProgramacion = await url(app);
  // Ahora participación conoce la dirección real de programación.
  const { createProgramacionClient } = await import('../../services/participacion/src/clients/programacion.js');
  Object.assign(servParticipacion.programacion, createProgramacionClient({ url: urlProgramacion, serviceKey: CLAVE_PARTICIPACION }));

  edge = createEdge({
    routes: [
      { prefix: '/api/identidad', target: urlIdentidad },
      { prefix: '/api/programacion', target: urlProgramacion },
      { prefix: '/api/participacion', target: urlParticipacion },
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

test('de punta a punta: el administrador activa el QR, una persona verificada reclama el sello y lo repite', async () => {
  await identidadDeps.accounts.createFirstAdmin('admin-pasaporte@vivart.test', { allowAdditional: true });
  const admin = navegador();
  const correo = (await admin('/api/identidad/dev/mailbox')).json.messages.filter((m) => m.kind === 'activate' && m.to === 'admin-pasaporte@vivart.test').at(-1);
  await admin('/api/identidad/auth/activate', { metodo: 'POST', cuerpo: { token: new URL(correo.link).searchParams.get('token'), password: CLAVE_VALIDA } });
  await admin('/api/identidad/auth/login', { metodo: 'POST', cuerpo: { email: 'admin-pasaporte@vivart.test', password: CLAVE_VALIDA } });
  const publicador = await cuenta('publica-pasaporte');
  const visitante = await cuenta('visitante-pasaporte');
  await admin(`/api/identidad/users/${publicador.id}/roles/publicador`, { metodo: 'PUT' });

  // Una actividad gratuita publicada (el sello no exige entrada).
  const categoria = (await admin('/api/programacion/panel/categories', { metodo: 'POST', cuerpo: { name: 'Danza' } })).json;
  const sede = (await admin('/api/programacion/panel/venues', { metodo: 'POST', cuerpo: { name: 'Sala del Pasaporte', kind: 'place' } })).json;
  const creada = (
    await admin('/api/programacion/panel/activities', {
      metodo: 'POST',
      cuerpo: { content: { title: 'Danza de ejemplo con sello', categoryId: categoria.id, access: { mode: 'free' }, functions: [{ date: '2030-12-06', startTime: '19:00', venueId: sede.id }] } },
    })
  ).json;
  const enviada = (await admin(`/api/programacion/panel/activities/${creada.id}/submit`, { metodo: 'POST', cuerpo: { version: creada.version } })).json;
  const publicada = (await admin(`/api/programacion/panel/activities/${creada.id}/publish`, { metodo: 'POST', cuerpo: { version: enviada.version } })).json;
  const fid = publicada.functions[0].id;

  // Solo el administrador gestiona el QR (permiso real de identidad).
  assert.equal((await publicador.nav(`/api/participacion/panel/functions/${fid}/passport/qr`, { metodo: 'POST' })).status, 403);
  assert.equal((await admin(`/api/participacion/panel/functions/${fid}/passport/qr`, { metodo: 'POST' })).status, 201);
  await admin(`/api/participacion/panel/functions/${fid}/passport/window`, { metodo: 'PUT', cuerpo: { start: '2026-01-01 00:00', end: '2035-12-31 23:00' } });
  const activo = await admin(`/api/participacion/panel/functions/${fid}/passport/activate`, { metodo: 'POST' });
  assert.equal(activo.json.qr.status, 'active');
  const ref = activo.json.qr.url.split('/pasaporte/canje/')[1];

  // Sin sesión se pide identificarse; con sesión verificada se obtiene el sello, con los datos vigentes de programación.
  assert.equal((await navegador()('/api/participacion/passport/claims', { metodo: 'POST', cuerpo: { ref } })).status, 401);
  const sello = await visitante.nav('/api/participacion/passport/claims', { metodo: 'POST', cuerpo: { ref } });
  assert.equal(sello.status, 201);
  assert.deepEqual([sello.json.stamp.title, sello.json.stamp.venueName, sello.json.stamp.date], ['Danza de ejemplo con sello', 'Sala del Pasaporte', '2030-12-06']);
  const otra = await visitante.nav('/api/participacion/passport/claims', { metodo: 'POST', cuerpo: { ref } });
  assert.deepEqual([otra.status, otra.json.stamp.id], [200, sello.json.stamp.id]);
  assert.equal((await visitante.nav('/api/participacion/passport')).json.total, 1);

  // Reprogramar en programación desactiva el canje en participación (P-03), sin avisos entre servicios.
  const reprogramada = await admin(`/api/programacion/panel/functions/${fid}/reschedule`, {
    metodo: 'POST',
    cuerpo: { date: '2030-12-07', startTime: '19:00', venueId: sede.id, reason: 'Cambio de sala', notice: 'La función pasa al 7 de diciembre.' },
  });
  assert.equal(reprogramada.status, 200);
  const nueva = await cuenta('otra-visitante-pasaporte');
  const rechazo = await nueva.nav('/api/participacion/passport/claims', { metodo: 'POST', cuerpo: { ref } });
  assert.deepEqual([rechazo.status, rechazo.json.error, rechazo.json.cause], [409, 'qr_inactive', 'function_changed']);
  // El sello obtenido antes se conserva y muestra la fecha vigente con el aviso.
  const mio = (await visitante.nav('/api/participacion/passport')).json.items[0];
  assert.equal(mio.date, '2030-12-07');
  assert.equal(mio.notice.text, 'La función pasa al 7 de diciembre.');
});
