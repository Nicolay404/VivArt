import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as identidadPruebas from '../../services/identidad/test/helpers.js';
import * as programacionPruebas from '../../services/programacion/test/helpers.js';
import * as participacionPruebas from '../../services/participacion/test/helpers.js';
import { createEdge } from '../server.js';

// Recorrido real del spec 005 por HTTP con los tres servicios detrás de la entrada común, sin simulaciones:
// participación pregunta permisos a identidad y el estado de la función a programación; programación pregunta
// a participación cuántas entradas hay antes de cancelar.
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

test('de punta a punta: configurar, comprar, recibir, validar y cancelar con ventas', async () => {
  await identidadDeps.accounts.createFirstAdmin('admin@vivart.test', { allowAdditional: true });
  const admin = navegador();
  const correo = (await admin('/api/identidad/dev/mailbox')).json.messages.filter((m) => m.kind === 'activate').at(-1);
  await admin('/api/identidad/auth/activate', { metodo: 'POST', cuerpo: { token: new URL(correo.link).searchParams.get('token'), password: CLAVE_VALIDA } });
  await admin('/api/identidad/auth/login', { metodo: 'POST', cuerpo: { email: 'admin@vivart.test', password: CLAVE_VALIDA } });

  const publicador = await cuenta('publica');
  const compradora = await cuenta('compradora');
  const acceso = await cuenta('portero');
  await admin(`/api/identidad/users/${publicador.id}/roles/publicador`, { metodo: 'PUT' });
  await admin(`/api/identidad/users/${acceso.id}/roles/personal_acceso`, { metodo: 'PUT' });

  // Una actividad de pago publicada por el administrador (datos ficticios)
  const categoria = (await admin('/api/programacion/panel/categories', { metodo: 'POST', cuerpo: { name: 'Teatro' } })).json;
  const sede = (await admin('/api/programacion/panel/venues', { metodo: 'POST', cuerpo: { name: 'Sala de Ejemplo', kind: 'place' } })).json;
  const creada = (
    await admin('/api/programacion/panel/activities', {
      metodo: 'POST',
      cuerpo: {
        content: {
          title: 'Obra de ejemplo con venta',
          categoryId: categoria.id,
          access: { mode: 'paid', priceUsd: 4 },
          functions: [{ date: '2030-12-05', startTime: '19:00', venueId: sede.id }],
        },
      },
    })
  ).json;
  const enviada = (await admin(`/api/programacion/panel/activities/${creada.id}/submit`, { metodo: 'POST', cuerpo: { version: creada.version } })).json;
  const publicada = (await admin(`/api/programacion/panel/activities/${creada.id}/publish`, { metodo: 'POST', cuerpo: { version: enviada.version } })).json;
  const fid = publicada.functions[0].id;

  // Publicar no activa ventas; el publicador no puede habilitarla, el administrador sí
  assert.deepEqual((await navegador()(`/api/participacion/sale-status?functionIds=${fid}`)).json.items, []);
  assert.equal((await publicador.nav(`/api/participacion/panel/functions/${fid}/sale`, { metodo: 'PUT', cuerpo: { capacity: 2, enabled: true } })).status, 403);
  const venta = await admin(`/api/participacion/panel/functions/${fid}/sale`, { metodo: 'PUT', cuerpo: { capacity: 2, enabled: true } });
  assert.equal(venta.status, 200);
  assert.equal(venta.json.priceUsd, 4);

  // Compra con el simulador de prueba
  const items = [{ functionId: fid, quantity: 2 }];
  const cot = (await navegador()('/api/participacion/cart/quote', { metodo: 'POST', cuerpo: { items } })).json;
  assert.equal(cot.totalCents, 800);
  const pedido = await compradora.nav('/api/participacion/orders', { metodo: 'POST', cuerpo: { items, acceptedTotalCents: 800 } });
  assert.equal(pedido.status, 201);
  const pago = await compradora.nav(`/api/participacion/orders/${pedido.json.id}/simulate-payment`, { metodo: 'POST', cuerpo: { result: 'confirmed' } });
  assert.equal(pago.json.status, 'confirmed');
  const mias = (await compradora.nav('/api/participacion/tickets')).json.items;
  assert.equal(mias.length, 2);
  assert.deepEqual((await navegador()(`/api/participacion/sale-status?functionIds=${fid}`)).json.items, [{ functionId: fid, state: 'sold_out' }]);

  // Control de acceso: solo con la función asignada
  assert.equal((await acceso.nav(`/api/participacion/access/functions/${fid}/open`, { metodo: 'POST' })).status, 403);
  await admin(`/api/identidad/users/${acceso.id}/functions/${fid}`, { metodo: 'PUT' });
  assert.equal((await acceso.nav(`/api/participacion/access/functions/${fid}/open`, { metodo: 'POST' })).status, 200);
  const primera = await acceso.nav(`/api/participacion/access/functions/${fid}/validate`, { metodo: 'POST', cuerpo: { code: mias[0].code } });
  assert.equal(primera.json.admitted, true);
  const repetida = await acceso.nav(`/api/participacion/access/functions/${fid}/validate`, { metodo: 'POST', cuerpo: { code: mias[0].code } });
  assert.equal(repetida.json.reason, 'already_used');

  // Programación ve el impacto real y, con ventas, solo el administrador cancela
  const impacto = (await admin(`/api/programacion/panel/functions/${fid}/impact`)).json;
  assert.deepEqual([impacto.available, impacto.soldTickets, impacto.pendingOrders], [true, 1, 0]);
  const intento = await publicador.nav(`/api/programacion/panel/functions/${fid}/cancel`, { metodo: 'POST', cuerpo: { reason: 'x', notice: 'Cancelada.' } });
  assert.equal(intento.status, 403);
  const cancelada = await admin(`/api/programacion/panel/functions/${fid}/cancel`, { metodo: 'POST', cuerpo: { reason: 'Lluvia', notice: 'Se cancela por lluvia.' } });
  assert.equal(cancelada.status, 200);

  // Tras cancelar: Mis entradas lo muestra con el aviso y el acceso rechaza la otra entrada
  const despues = (await compradora.nav('/api/participacion/tickets')).json.items;
  const sinUsar = despues.find((t) => t.state !== 'used');
  assert.equal(sinUsar.state, 'function_cancelled');
  assert.equal(sinUsar.notice.text, 'Se cancela por lluvia.');
  const rechazo = await acceso.nav(`/api/participacion/access/functions/${fid}/validate`, { metodo: 'POST', cuerpo: { code: sinUsar.code } });
  assert.equal(rechazo.json.reason, 'function_cancelled');
});
