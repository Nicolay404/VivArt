import { after } from 'node:test';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';
import { createServices } from '../src/services.js';
import { identityUnavailable } from '../src/http/errors.js';
import { noVerificable } from '../src/clients/programacion.js';
// La identidad simulada usa la MISMA política del servicio de identidad, para que las pruebas reflejen las reglas reales.
import { authorize } from '../../identidad/src/domain/policy.js';

/** Base de pruebas: TEST_DATABASE_URL o, en local, `participacion_pruebas` del contenedor con la contraseña de app/.env. */
export function urlPruebas(env = process.env) {
  if (env.TEST_DATABASE_URL) return env.TEST_DATABASE_URL;
  if (env.PARTICIPACION_DB_PASSWORD) {
    const puerto = env.DB_PUERTO_LOCAL || '55432';
    return `postgres://participacion:${encodeURIComponent(env.PARTICIPACION_DB_PASSWORD)}@127.0.0.1:${puerto}/participacion_pruebas`;
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
  usuaria: [],
  usuario2: [],
  sinVerificar: [],
  editor: ['editor'],
  publicador: ['publicador'],
  admin: ['administrador'],
  acceso: ['personal_acceso'],
  acceso2: ['personal_acceso'],
};

/** Identidad simulada: cookie `vivart_sid=tok-<nombre>`. `acceso` tiene asignada la función f-obra. */
export function identidadSimulada() {
  const personas = new Map(
    Object.entries(ROLES)
      .filter(([, roles]) => roles)
      .map(([nombre, roles]) => [
        `tok-${nombre}`,
        {
          userId: `u-${nombre}`,
          roles: ['usuario_registrado', ...roles],
          functionIds: nombre === 'acceso' ? ['f-obra', 'f-cancelable'] : [],
          emailVerified: nombre !== 'sinVerificar',
        },
      ]),
  );
  const estado = { caida: false };
  return {
    estado,
    personas,
    async introspect(token) {
      if (estado.caida) throw identityUnavailable();
      const p = personas.get(token);
      return p ? { active: true, ...p } : null;
    },
    async authorize(token, accion, contexto = {}) {
      if (estado.caida) throw identityUnavailable();
      return authorize(personas.get(token) ?? null, accion, contexto);
    },
  };
}

/** Funciones ficticias de programación. Se pueden cancelar, reprogramar o «caer» en cada prueba. */
export function funcionesDeEjemplo() {
  const base = (id, extra = {}) => ({
    id,
    activityId: `a-${id}`,
    title: `Función ${id}`,
    date: '2026-11-22',
    startTime: '19:00',
    endTime: null,
    durationMinutes: null,
    venueId: 'v-teatro',
    venueName: 'Teatro de Ejemplo',
    status: 'scheduled',
    activityStatus: 'active',
    access: { mode: 'paid', priceUsd: 5 },
    latestNotice: null,
    ...extra,
  });
  return new Map(
    [
      base('f-obra', { endTime: '20:30' }),
      base('f-danza', { startTime: '20:00', endTime: '21:00', access: { mode: 'paid', priceUsd: 7.5 } }),
      base('f-sin-fin', { startTime: '19:30' }),
      base('f-gratis', { access: { mode: 'free', priceUsd: null } }),
      base('f-sin-precio', { access: { mode: 'paid', priceUsd: null } }),
      base('f-pendiente', { access: { mode: 'unconfirmed', priceUsd: null } }),
      base('f-cancelable'),
      base('f-pronto', { date: '2026-11-21', startTime: '18:20' }),
    ].map((f) => [f.id, f]),
  );
}

export function programacionSimulada() {
  const funciones = funcionesDeEjemplo();
  const estado = { caida: false };
  return {
    estado,
    funciones,
    async function(id) {
      if (estado.caida) throw noVerificable();
      return structuredClone(funciones.get(id) ?? null);
    },
    async functions(ids) {
      if (estado.caida) throw noVerificable();
      return new Map(ids.filter((id) => funciones.has(id)).map((id) => [id, structuredClone(funciones.get(id))]));
    },
  };
}

export const nuevoEsquema = () => `pruebas_${randomBytes(6).toString('hex')}`;

/** Reloj que se puede mover. Empieza el 2026-11-21 a las 18:00 en Loja. */
export function relojMovible(inicio = '2026-11-21T18:00:00-05:00') {
  let ahora = new Date(inicio);
  const reloj = () => new Date(ahora);
  reloj.fijar = (iso) => {
    ahora = new Date(iso);
  };
  reloj.avanzar = (minutos) => {
    ahora = new Date(ahora.getTime() + minutos * 60000);
  };
  return reloj;
}

export function configPrueba(variables = {}, overrides = {}) {
  return loadConfig(
    {
      DATABASE_URL: urlPruebas(),
      DB_SCHEMA: nuevoEsquema(),
      SERVICE_KEYS: 'programacion:clave-de-prueba-solo-para-tests',
      TICKET_KEY: 'clave-de-entradas-solo-para-pruebas-0123456789',
      PAYMENT_SIMULATOR: 'on',
      ...variables,
    },
    overrides,
  );
}

/** Construye la aplicación con su configuración real (servicios reales) y la registra para limpiarla. */
export async function abrirApp(config) {
  const resultado = await buildApp({ config });
  abiertas.push({ app: resultado.app, esquema: config.dbSchema });
  return resultado;
}

/** Aplicación de pruebas con base propia, identidad y programación simuladas y reloj movible. */
export async function crearApp({ variables = {} } = {}) {
  const reloj = relojMovible();
  const config = configPrueba(variables, { clock: reloj, clockFixed: true });
  const identidad = identidadSimulada();
  const programacion = programacionSimulada();
  const services = await createServices({ config, identidad, programacion });
  const { app } = await buildApp({ config, services });
  abiertas.push({ app, esquema: config.dbSchema });
  return { app, services, identidad, programacion, config, reloj };
}

/** Solicitud como una persona (`null` = visitante). */
export async function pedir(ctx, quien, metodo, url, cuerpo, cabeceras = {}) {
  const r = await ctx.app.inject({
    method: metodo,
    url,
    headers: {
      ...(quien ? { cookie: `vivart_sid=tok-${quien}` } : {}),
      ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}),
      ...cabeceras,
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

/** El administrador habilita la venta de una función con un cupo. */
export async function habilitar(ctx, functionId, capacity = 10) {
  const r = await pedir(ctx, 'admin', 'PUT', `/panel/functions/${functionId}/sale`, { capacity, enabled: true });
  if (r.status !== 200) throw new Error(`No se pudo habilitar ${functionId}: ${r.status} ${r.body}`);
  return r.json;
}

/** Cotiza y crea un pedido aceptando el total cotizado. */
export async function comprar(ctx, quien, items) {
  const cot = await pedir(ctx, null, 'POST', '/cart/quote', { items });
  return pedir(ctx, quien, 'POST', '/orders', { items, acceptedTotalCents: cot.json.totalCents });
}

/** Compra y confirma con el simulador; devuelve el pedido confirmado. */
export async function comprarYConfirmar(ctx, quien, items) {
  const pedido = await comprar(ctx, quien, items);
  if (pedido.status !== 201) throw new Error(`No se pudo crear el pedido: ${pedido.status} ${pedido.body}`);
  const r = await pedir(ctx, quien, 'POST', `/orders/${pedido.json.id}/simulate-payment`, { result: 'confirmed' });
  if (r.status !== 200) throw new Error(`No se pudo confirmar: ${r.status} ${r.body}`);
  return r.json;
}

/** Mis entradas de una persona. */
export async function entradas(ctx, quien) {
  return (await pedir(ctx, quien, 'GET', '/tickets')).json.items;
}
