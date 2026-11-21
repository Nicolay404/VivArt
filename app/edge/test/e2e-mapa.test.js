import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as identidadPruebas from '../../services/identidad/test/helpers.js';
import * as programacionPruebas from '../../services/programacion/test/helpers.js';
import { createEdge } from '../server.js';

// Recorrido real del spec 003 por HTTP: entrada común -> programación -> identidad (permisos), sin simulaciones.
// Datos FICTICIOS.
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

function navegador(raiz = () => base) {
  let cookie = '';
  return async (ruta, { metodo = 'GET', cuerpo } = {}) => {
    const r = await fetch(raiz() + ruta, {
      method: metodo,
      headers: { origin: ORIGEN, ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
    const sesion = r.headers.getSetCookie().find((c) => c.startsWith('vivart_sid='));
    if (sesion) cookie = sesion.split(';')[0];
    const texto = await r.text();
    let json = null;
    try {
      json = texto ? JSON.parse(texto) : null;
    } catch {
      json = null;
    }
    return { status: r.status, json, texto, headers: r.headers };
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

test('de punta a punta: el administrador registra destino y accesibilidad con permisos reales; el público lo ve sin sesión', async () => {
  await identidadDeps.accounts.createFirstAdmin('admin-mapa@vivart.test', { allowAdditional: true });
  const admin = navegador();
  const correo = (await admin('/api/identidad/dev/mailbox')).json.messages.filter((m) => m.kind === 'activate' && m.to === 'admin-mapa@vivart.test').at(-1);
  await admin('/api/identidad/auth/activate', { metodo: 'POST', cuerpo: { token: new URL(correo.link).searchParams.get('token'), password: CLAVE_VALIDA } });
  assert.equal((await admin('/api/identidad/auth/login', { metodo: 'POST', cuerpo: { email: 'admin-mapa@vivart.test', password: CLAVE_VALIDA } })).status, 200);

  const sede = (await admin('/api/programacion/panel/venues', { metodo: 'POST', cuerpo: { name: 'Sala del mapa de ejemplo', kind: 'place' } })).json;
  const destino = await admin(`/api/programacion/panel/venues/${sede.id}/destination`, {
    metodo: 'PUT',
    cuerpo: { lat: -3.5, lng: -78.25, source: 'Prueba automática', verifiedOn: '2026-11-01' },
  });
  assert.equal(destino.status, 200);
  const acc = await admin(`/api/programacion/panel/venues/${sede.id}/accessibility/step_free`, {
    metodo: 'PUT',
    cuerpo: { status: 'confirmed', source: 'Prueba automática', verifiedOn: '2026-11-01' },
  });
  assert.equal(acc.status, 200);

  // Una persona registrada sin rol de administrador no puede tocar la sede.
  const visitante = navegador();
  const email = 'visitante-mapa@vivart.test';
  await visitante('/api/identidad/auth/register', { metodo: 'POST', cuerpo: { email, password: CLAVE_VALIDA } });
  const buzon = await visitante('/api/identidad/dev/mailbox');
  const verificacion = buzon.json.messages.filter((m) => m.to === email && m.kind === 'verify').at(-1);
  await visitante('/api/identidad/auth/verify-email', { metodo: 'POST', cuerpo: { token: new URL(verificacion.link).searchParams.get('token') } });
  await visitante('/api/identidad/auth/login', { metodo: 'POST', cuerpo: { email, password: CLAVE_VALIDA } });
  const intento = await visitante(`/api/programacion/panel/venues/${sede.id}/destination`, { metodo: 'DELETE' });
  assert.equal(intento.status, 403);

  // El público, sin sesión, ve el enlace de «Cómo llegar» y el filtro de accesibilidad.
  const publico = navegador();
  const lista = await publico('/api/programacion/map/venues?stepFree=true');
  assert.equal(lista.status, 200);
  assert.deepEqual(
    lista.json.items.map((s) => [s.name, s.directionsUrl]),
    [['Sala del mapa de ejemplo', 'https://www.google.com/maps/search/?api=1&query=-3.500000,-78.250000']],
  );
});

test('SC-010: si el servicio de programación no responde, la web y la Agenda se sirven; el mapa se carga aparte', async () => {
  const caida = createEdge({ routes: [{ prefix: '/api/programacion', target: 'http://127.0.0.1:9' }] });
  const puertoCaida = await escuchar(caida);
  try {
    const nav = navegador(() => `http://127.0.0.1:${puertoCaida}`);
    for (const ruta of ['/agenda', '/mapa', '/app.js', '/js/mapa.js', '/img/mapa-provisional.svg']) {
      assert.equal((await nav(ruta)).status, 200, ruta);
    }
    assert.equal((await nav('/api/programacion/map')).status, 502);
  } finally {
    caida.close();
  }
  // FR-004: la Agenda no espera al mapa: app.js no importa mapa.js de forma estática, solo con import().
  const app = readFileSync(new URL('../../web/app.js', import.meta.url), 'utf8');
  assert.ok(!/^import .*mapa\.js/m.test(app), 'app.js no debe importar mapa.js de forma estática');
  assert.match(app, /import\('\.\/js\/mapa\.js'\)/);
});
