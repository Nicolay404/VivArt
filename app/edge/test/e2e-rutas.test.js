import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as identidadPruebas from '../../services/identidad/test/helpers.js';
import * as programacionPruebas from '../../services/programacion/test/helpers.js';
import * as participacionPruebas from '../../services/participacion/test/helpers.js';
import { createEdge } from '../server.js';

// Recorrido real del spec 007 (rutas culturales e insignias) por HTTP con los tres servicios detrás de la entrada común:
// Administrador crea y publica ruta con meta 2, usuario canjea 2 sellos, desbloquea la insignia y consulta su progreso.
const ORIGEN = 'http://localhost:8080';
const CLAVE_PROGRAMACION = 'clave-programacion-solo-para-pruebas-rutas';
const CLAVE_PARTICIPACION = 'clave-participacion-solo-para-pruebas-rutas';
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

test('E2E: de punta a punta rutas culturales e insignias a través de la entrada común', async () => {
  await identidadDeps.accounts.createFirstAdmin('admin-rutas@vivart.test', { allowAdditional: true });
  const admin = navegador();
  const correo = (await admin('/api/identidad/dev/mailbox')).json.messages.filter((m) => m.kind === 'activate' && m.to === 'admin-rutas@vivart.test').at(-1);
  await admin('/api/identidad/auth/activate', { metodo: 'POST', cuerpo: { token: new URL(correo.link).searchParams.get('token'), password: CLAVE_VALIDA } });
  await admin('/api/identidad/auth/login', { metodo: 'POST', cuerpo: { email: 'admin-rutas@vivart.test', password: CLAVE_VALIDA } });

  const usuario = await cuenta('explorador-rutas');

  // 1. Crear dos actividades con una función cada una en programación
  const catRes = await admin('/api/programacion/panel/categories', { metodo: 'POST', cuerpo: { name: 'Teatro' } });
  assert.equal(catRes.status, 201);
  const categoria = catRes.json;

  const sedeRes = await admin('/api/programacion/panel/venues', { metodo: 'POST', cuerpo: { name: 'Teatro Bolívar', kind: 'place' } });
  assert.equal(sedeRes.status, 201);
  const sede = sedeRes.json;

  async function crearYPublicarFuncion(titulo, fecha) {
    const actRes = await admin('/api/programacion/panel/activities', {
      metodo: 'POST',
      cuerpo: { content: { title: titulo, categoryId: categoria.id, access: { mode: 'free' }, functions: [{ date: fecha, startTime: '18:00', venueId: sede.id }] } },
    });
    if (actRes.status >= 300) throw new Error(`Error creando actividad: ${actRes.status} ${JSON.stringify(actRes.json)}`);
    const act = actRes.json;

    const envRes = await admin(`/api/programacion/panel/activities/${act.id}/submit`, { metodo: 'POST', cuerpo: { version: act.version } });
    if (envRes.status >= 300) throw new Error(`Error enviando actividad: ${envRes.status} ${JSON.stringify(envRes.json)}`);
    const env = envRes.json;

    const pubRes = await admin(`/api/programacion/panel/activities/${act.id}/publish`, { metodo: 'POST', cuerpo: { version: env.version } });
    if (pubRes.status >= 300) throw new Error(`Error publicando actividad: ${pubRes.status} ${JSON.stringify(pubRes.json)}`);
    const pub = pubRes.json;

    return pub.functions[0].id;
  }

  const fid1 = await crearYPublicarFuncion('Obra de Luces', '2030-11-20');
  const fid2 = await crearYPublicarFuncion('Danza de Sombras', '2030-11-21');

  // Activar Pasaporte para ambas funciones
  async function activarQr(fid) {
    await admin(`/api/participacion/panel/functions/${fid}/passport/qr`, { metodo: 'POST' });
    await admin(`/api/participacion/panel/functions/${fid}/passport/window`, { metodo: 'PUT', cuerpo: { start: '2026-01-01 00:00', end: '2035-12-31 23:00' } });
    const activo = await admin(`/api/participacion/panel/functions/${fid}/passport/activate`, { metodo: 'POST' });
    return activo.json.qr.url.split('/pasaporte/canje/')[1];
  }

  const ref1 = await activarQr(fid1);
  const ref2 = await activarQr(fid2);

  // 2. Administrador crea y publica una ruta cultural
  const resCrearRuta = await admin('/api/participacion/panel/routes', {
    metodo: 'POST',
    cuerpo: {
      title: 'Ruta Teatral Nocturna',
      description: 'Recorrido por dos grandes obras escénicas del festival.',
      goal: 2,
      badgeTitle: 'Caballero Escénico',
      badgeDescription: 'Completaste la Ruta Teatral Nocturna.',
      badgeIcon: 'teatro',
      badgeColor: 'violeta',
      functionIds: [fid1, fid2],
      publish: true,
    },
  });
  assert.equal(resCrearRuta.status, 201);
  const rutaId = resCrearRuta.json.id;

  // 3. Visitante anónimo consulta rutas públicas
  const resPublica = await navegador()('/api/participacion/passport/routes');
  assert.equal(resPublica.status, 200);
  assert.equal(resPublica.json.items.length, 1);
  assert.equal(resPublica.json.items[0].id, rutaId);
  assert.equal(resPublica.json.items[0].progress, null, 'Sin sesión no hay bloque progress');

  // 4. Usuario autenticado ve progreso inicial 0 de 2
  const resUsuario0 = await usuario.nav('/api/participacion/passport/routes');
  assert.equal(resUsuario0.status, 200);
  assert.equal(resUsuario0.json.items[0].progress.formatted, '0 de 2');
  assert.equal(resUsuario0.json.items[0].progress.unlockedBadge, false);

  // 5. Usuario canjea primer sello
  const c1 = await usuario.nav('/api/participacion/passport/claims', { metodo: 'POST', cuerpo: { ref: ref1 } });
  assert.equal(c1.status, 201);
  assert.equal(c1.json.badgeUnlocked, null);

  const resUsuario1 = await usuario.nav(`/api/participacion/passport/routes/${rutaId}`);
  assert.equal(resUsuario1.json.progress.formatted, '1 de 2');
  assert.equal(resUsuario1.json.progress.completed, false);
  assert.equal(resUsuario1.json.functions.find((f) => f.functionId === fid1).hasStamp, true);
  assert.equal(resUsuario1.json.functions.find((f) => f.functionId === fid2).hasStamp, false);

  // 6. Usuario canjea segundo sello y desbloquea la insignia
  const c2 = await usuario.nav('/api/participacion/passport/claims', { metodo: 'POST', cuerpo: { ref: ref2 } });
  assert.equal(c2.status, 201);
  assert.ok(c2.json.badgeUnlocked, 'Debe devolver el objeto badgeUnlocked');
  assert.equal(c2.json.badgeUnlocked.routeId, rutaId);
  assert.equal(c2.json.badgeUnlocked.title, 'Caballero Escénico');

  // 7. Usuario consulta sus insignias
  const resBadges = await usuario.nav('/api/participacion/passport/badges');
  assert.equal(resBadges.status, 200);
  assert.equal(resBadges.json.items.length, 1);
  assert.equal(resBadges.json.items[0].title, 'Caballero Escénico');

  // 8. Consulta final de ruta: 2 de 2 y unlockedBadge: true
  const resFinal = await usuario.nav(`/api/participacion/passport/routes/${rutaId}`);
  assert.equal(resFinal.json.progress.formatted, '2 de 2');
  assert.equal(resFinal.json.progress.completed, true);
  assert.equal(resFinal.json.progress.unlockedBadge, true);
});
