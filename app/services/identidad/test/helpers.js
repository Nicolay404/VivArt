import { after } from 'node:test';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';

const CLAVE_SERVICIO = 'clave-de-prueba-solo-para-tests';

/**
 * Base de datos de pruebas (PostgreSQL). Se toma de TEST_DATABASE_URL o, en local, se arma con la contraseña
 * de app/.env (IDENTIDAD_DB_PASSWORD) apuntando a la base `identidad_pruebas` del contenedor de la demo.
 * Ver specs/001-identidad-y-permisos/quickstart.md, «Ejecutar las pruebas».
 */
export function urlPruebas(env = process.env) {
  if (env.TEST_DATABASE_URL) return env.TEST_DATABASE_URL;
  if (env.IDENTIDAD_DB_PASSWORD) {
    const puerto = env.DB_PUERTO_LOCAL || '55432';
    return `postgres://identidad:${encodeURIComponent(env.IDENTIDAD_DB_PASSWORD)}@127.0.0.1:${puerto}/identidad_pruebas`;
  }
  throw new Error(
    'Las pruebas necesitan PostgreSQL. Levanta la base con `docker compose up -d db` desde app/ (usa app/.env) o define TEST_DATABASE_URL.',
  );
}

// Cada aplicación de prueba usa un esquema propio y se borra al terminar el archivo de pruebas.
const abiertas = [];
after(async () => {
  for (const { app } of abiertas) await app.close().catch(() => {});
  if (abiertas.length === 0) return;
  const pool = new pg.Pool({ connectionString: urlPruebas(), max: 1 });
  for (const { esquema } of abiertas) await pool.query(`DROP SCHEMA IF EXISTS ${esquema} CASCADE`);
  await pool.end();
});

export const nuevoEsquema = () => `pruebas_${randomBytes(6).toString('hex')}`;

/** Configuración de pruebas: base propia, scrypt rápido, buzón de pruebas y límites amplios. */
export function configPrueba(variables = {}, overrides = {}) {
  return loadConfig(
    { MAIL_TRANSPORT: 'test', DATABASE_URL: urlPruebas(), DB_SCHEMA: nuevoEsquema(), ...variables },
    {
      scrypt: { N: 1024, r: 8, p: 1 },
      limits: {
        login: { max: 1000, windowMs: 1000 },
        register: { max: 1000, windowMs: 1000 },
        reset: { max: 1000, windowMs: 1000 },
        resend: { max: 1000, windowMs: 1000 },
      },
      ...overrides,
    },
  );
}

/** Construye la aplicación de pruebas y la registra para cerrarla y borrar su esquema al final. */
export async function abrirApp(config) {
  const resultado = await buildApp({ config });
  abiertas.push({ app: resultado.app, esquema: config.dbSchema });
  return resultado;
}

/** Aplicación de pruebas lista para usar con `inject`. */
export async function crearApp({ overrides = {}, reloj } = {}) {
  const config = configPrueba({ SERVICE_KEYS: `programacion:${CLAVE_SERVICIO}` }, { ...(reloj ? { clock: reloj } : {}), ...overrides });
  const { app, deps } = await abrirApp(config);
  return { app, deps, config, claveServicio: CLAVE_SERVICIO, correos: deps.mailer };
}

/** Primera fila de una consulta directa a la base de la aplicación de pruebas. */
export const fila = async (ctx, sql, params) => (await ctx.deps.db.query(sql, params))[0];

export const CLAVE_VALIDA = 'una clave larga de prueba 123';

export const json = (metodo, url, cuerpo, cookies) => ({
  method: metodo,
  url,
  headers: { 'content-type': 'application/json', ...(cookies ? { cookie: cookies } : {}) },
  payload: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
});

/** Extrae el token de un enlace del buzón de pruebas. */
export const tokenDe = (mensaje) => new URL(mensaje.link).searchParams.get('token');

export function cookieDe(respuesta, nombre = 'vivart_sid') {
  const c = respuesta.cookies.find((x) => x.name === nombre);
  return c ? `${nombre}=${c.value}` : undefined;
}

/** Registra, verifica (opcional) e inicia sesión; devuelve la cookie de sesión. */
export async function crearUsuario(ctx, email, { verificar = true, password = CLAVE_VALIDA } = {}) {
  await ctx.app.inject(json('POST', '/auth/register', { email, password }));
  if (verificar) {
    const token = tokenDe(ctx.correos.last(email, 'verify'));
    await ctx.app.inject(json('POST', '/auth/verify-email', { token }));
  }
  const r = await ctx.app.inject(json('POST', '/auth/login', { email, password }));
  return { cookie: cookieDe(r), id: r.json().id, email };
}

/** Crea un administrador activo por el procedimiento interno. */
export async function crearAdmin(ctx, email = 'admin@vivart.test') {
  await ctx.deps.accounts.createFirstAdmin(email, { allowAdditional: true });
  const token = tokenDe(ctx.correos.last(email, 'activate'));
  await ctx.app.inject(json('POST', '/auth/activate', { token, password: CLAVE_VALIDA }));
  const r = await ctx.app.inject(json('POST', '/auth/login', { email, password: CLAVE_VALIDA }));
  return { cookie: cookieDe(r), id: r.json().id, email };
}
