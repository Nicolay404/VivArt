import { after } from 'node:test';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';
import { createServices } from '../src/services.js';
import { identityUnavailable } from '../src/http/errors.js';
// La identidad simulada usa la MISMA política de permisos del servicio de identidad, para que las pruebas
// reflejen las reglas reales (spec 001) sin levantar ese servicio.
import { authorize } from '../../identidad/src/domain/policy.js';

/** Base de pruebas: TEST_DATABASE_URL o, en local, `programacion_pruebas` del contenedor con la contraseña de app/.env. */
export function urlPruebas(env = process.env) {
  if (env.TEST_DATABASE_URL) return env.TEST_DATABASE_URL;
  if (env.PROGRAMACION_DB_PASSWORD) {
    const puerto = env.DB_PUERTO_LOCAL || '55432';
    return `postgres://programacion:${encodeURIComponent(env.PROGRAMACION_DB_PASSWORD)}@127.0.0.1:${puerto}/programacion_pruebas`;
  }
  throw new Error('Las pruebas necesitan PostgreSQL: `docker compose up -d db db-preparar` desde app/ (usa app/.env) o define TEST_DATABASE_URL.');
}

const abiertas = [];
after(async () => {
  for (const { app } of abiertas) await app.close().catch(() => {});
  if (abiertas.length === 0) return;
  const pool = new pg.Pool({ connectionString: urlPruebas(), max: 1 });
  for (const { esquema } of abiertas) await pool.query(`DROP SCHEMA IF EXISTS ${esquema} CASCADE`);
  await pool.end();
});

export const ROLES = {
  visitante: null,
  usuario: [],
  editor: ['editor'],
  editora2: ['editor'],
  publicador: ['publicador'],
  admin: ['administrador'],
  acceso: ['personal_acceso'],
  editorPublicador: ['editor', 'publicador'],
};

/** Identidad simulada: cada persona tiene la cookie `vivart_sid=tok-<nombre>`. Se puede «caer» para probar el fallo cerrado. */
export function identidadSimulada() {
  const personas = new Map(
    Object.entries(ROLES)
      .filter(([, roles]) => roles)
      .map(([nombre, roles]) => [`tok-${nombre}`, { userId: `u-${nombre}`, roles: ['usuario_registrado', ...roles], functionIds: [] }]),
  );
  const estado = { caida: false, llamadas: 0 };
  return {
    estado,
    personas,
    async introspect(token) {
      estado.llamadas += 1;
      if (estado.caida) throw identityUnavailable();
      const p = personas.get(token);
      return p ? { active: true, ...p } : null;
    },
    async authorize(token, accion, contexto = {}) {
      estado.llamadas += 1;
      if (estado.caida) throw identityUnavailable();
      return authorize(personas.get(token) ?? null, accion, contexto);
    },
  };
}

export const nuevoEsquema = () => `pruebas_${randomBytes(6).toString('hex')}`;

export function configPrueba(variables = {}, overrides = {}) {
  return loadConfig(
    { DATABASE_URL: urlPruebas(), DB_SCHEMA: nuevoEsquema(), SERVICE_KEYS: 'participacion:clave-de-prueba-solo-para-tests', ...variables },
    overrides,
  );
}

/** Reloj que se puede mover. Empieza el 2026-11-21 a las 18:00 en Loja (23:00 UTC). */
export function relojMovible(inicio = '2026-11-21T18:00:00-05:00') {
  let ahora = new Date(inicio);
  const reloj = () => new Date(ahora);
  reloj.fijar = (iso) => {
    ahora = new Date(iso);
  };
  return reloj;
}

/** Construye la aplicación con su configuración real (por ejemplo, contra un servicio de identidad real) y la registra para limpiarla. */
export async function abrirApp(config) {
  const resultado = await buildApp({ config });
  abiertas.push({ app: resultado.app, esquema: config.dbSchema });
  return resultado;
}

/** Participación simulada sin ventas: la función no tiene entradas ni pedidos (spec 005). */
export const participacionSinVentas = () => ({
  impact: async () => ({ available: true, soldTickets: 0, pendingOrders: 0, issuedTickets: 0, message: 'Datos del servicio de entradas.' }),
});

/** Aplicación de pruebas con base propia, identidad simulada y reloj opcional. Por defecto, participación sin ventas. */
export async function crearApp({ reloj, participacion = participacionSinVentas(), variables = {} } = {}) {
  const config = configPrueba(variables, reloj ? { clock: reloj, clockFixed: true } : {});
  const identidad = identidadSimulada();
  const services = await createServices({ config, identidad, participacion });
  const { app } = await buildApp({ config, services });
  abiertas.push({ app, esquema: config.dbSchema });
  return { app, services, identidad, config, reloj };
}

/** Solicitud como una persona (`null` = visitante sin sesión). */
export async function pedir(ctx, quien, metodo, url, cuerpo) {
  const r = await ctx.app.inject({
    method: metodo,
    url,
    headers: {
      ...(quien ? { cookie: `vivart_sid=tok-${quien}` } : {}),
      ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    payload: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  let json = null;
  try {
    json = r.body ? JSON.parse(r.body) : null;
  } catch {
    json = null;
  }
  return { status: r.statusCode, json, body: r.body, headers: r.headers };
}

/** Catálogos básicos creados por el administrador. */
export async function catalogos(ctx) {
  const cat = async (ruta, cuerpo) => (await pedir(ctx, 'admin', 'POST', `/panel/${ruta}`, cuerpo)).json;
  return {
    teatro: await cat('categories', { name: 'Teatro' }),
    danza: await cat('categories', { name: 'Danza' }),
    museo: await cat('venues', { name: 'Museo de Ejemplo', kind: 'place', address: 'Calle Ficticia 1' }),
    plaza: await cat('venues', { name: 'Plaza de Ejemplo', kind: 'place' }),
    desfile: await cat('venues', { name: 'Recorrido de Ejemplo', kind: 'route', routeDescription: 'Desde la plaza A hasta la plaza B' }),
    edicion: await cat('editions', { name: 'Edición de prueba', year: 2026 }),
  };
}

/** Contenido completo y válido para enviar a revisión. */
export function contenido(c, extra = {}) {
  return {
    title: 'Obra de ejemplo',
    artists: ['Compañía Ficticia'],
    organization: 'Colectivo de Prueba',
    description: 'Descripción de ejemplo.',
    categoryId: c.teatro.id,
    access: { mode: 'paid', priceUsd: 5 },
    functions: [{ date: '2026-11-21', startTime: '19:00', venueId: c.museo.id }],
    ...extra,
  };
}

/** Crea una actividad como `autor` y la deja publicada por el publicador. Devuelve el detalle del panel. */
export async function publicada(ctx, c, extra = {}, autor = 'editor') {
  const creada = (await pedir(ctx, autor, 'POST', '/panel/activities', { content: contenido(c, extra) })).json;
  const enviada = (await pedir(ctx, autor, 'POST', `/panel/activities/${creada.id}/submit`, { version: creada.version })).json;
  const r = await pedir(ctx, 'publicador', 'POST', `/panel/activities/${creada.id}/publish`, { version: enviada.version });
  if (r.status !== 200) throw new Error(`No se pudo publicar: ${r.status} ${r.body}`);
  return r.json;
}
