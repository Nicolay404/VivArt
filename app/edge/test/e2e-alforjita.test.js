import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as identidadPruebas from '../../services/identidad/test/helpers.js';
import * as programacionPruebas from '../../services/programacion/test/helpers.js';
import { createEdge } from '../server.js';

// Spec 008 por HTTP real: entrada común -> programación (Alforjita) y la Agenda, sin sesión. Datos FICTICIOS.
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
    return { status: r.status, json, texto };
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

test('SC-001, SC-002: sin sesión, Alforjita responde por la entrada común con lo mismo que la Agenda', async () => {
  await identidadDeps.accounts.createFirstAdmin('admin-alforjita@vivart.test', { allowAdditional: true });
  const admin = navegador();
  const correo = (await admin('/api/identidad/dev/mailbox')).json.messages.filter((m) => m.kind === 'activate' && m.to === 'admin-alforjita@vivart.test').at(-1);
  await admin('/api/identidad/auth/activate', { metodo: 'POST', cuerpo: { token: new URL(correo.link).searchParams.get('token'), password: CLAVE_VALIDA } });
  assert.equal((await admin('/api/identidad/auth/login', { metodo: 'POST', cuerpo: { email: 'admin-alforjita@vivart.test', password: CLAVE_VALIDA } })).status, 200);

  const p = (ruta, cuerpo) => admin(`/api/programacion/panel/${ruta}`, { metodo: 'POST', cuerpo });
  const danza = (await p('categories', { name: 'Danza' })).json;
  const sede = (await p('venues', { name: 'Sala de Alforjita', kind: 'place' })).json;
  const creada = (
    await p('activities', {
      content: {
        title: 'Danza de punta a punta',
        artists: ['Compañía Ficticia'],
        organization: 'Colectivo de Prueba',
        description: 'Descripción de ejemplo.',
        categoryId: danza.id,
        access: { mode: 'free', priceUsd: null },
        functions: [{ date: '2099-12-05', startTime: '19:00', venueId: sede.id }],
      },
    })
  ).json;
  const enviada = (await p(`activities/${creada.id}/submit`, { version: creada.version })).json;
  assert.equal((await p(`activities/${creada.id}/publish`, { version: enviada.version })).status, 200);

  const publico = navegador();
  const r = await publico('/api/programacion/assistant/answers', { metodo: 'POST', cuerpo: { text: '¿qué hay de danza gratis el 2099-12-05?' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.kind, 'matches');
  const agenda = await publico(`/api/programacion/agenda?date=2099-12-05&categoryId=${danza.id}&access=free`);
  assert.deepEqual(
    r.json.items.map((i) => i.activityId),
    agenda.json.items.map((i) => i.id),
  );
  assert.equal(r.json.agendaUrl, `/agenda?date=2099-12-05&categoryId=${danza.id}&access=free`);
});

test('SC-008, RNF-07: con programación caída la web y la Agenda se sirven; Alforjita se carga aparte y da 502', async () => {
  const caida = createEdge({ routes: [{ prefix: '/api/programacion', target: 'http://127.0.0.1:9' }] });
  const puertoCaida = await escuchar(caida);
  try {
    const nav = navegador(() => `http://127.0.0.1:${puertoCaida}`);
    for (const ruta of ['/agenda', '/pasaporte', '/app.js', '/js/alforjita.js']) assert.equal((await nav(ruta)).status, 200, ruta);
    assert.equal((await nav('/api/programacion/assistant/answers', { metodo: 'POST', cuerpo: { quick: 'today' } })).status, 502);
  } finally {
    caida.close();
  }
  // La Agenda no espera a Alforjita: solo se importa con import() al pulsar el botón flotante (app.js).
  const publico = readFileSync(new URL('../../web/js/publico.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../../web/app.js', import.meta.url), 'utf8');
  assert.ok(!/^import .*alforjita\.js/m.test(publico + app), 'nadie importa alforjita.js de forma estática');
  assert.match(app, /import\('\.\/js\/alforjita\.js'\)/);
  // RNF-05: el panel no guarda la conversación en el navegador.
  const modulo = readFileSync(new URL('../../web/js/alforjita.js', import.meta.url), 'utf8');
  assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(modulo));
});
