import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';

const CLAVE_SERVICIO = 'clave-de-prueba-solo-para-tests';

/** Aplicación de pruebas: base en memoria, scrypt rápido, buzón de pruebas y límites amplios. */
export async function crearApp({ overrides = {}, reloj } = {}) {
  const config = loadConfig(
    { SERVICE_KEYS: `programacion:${CLAVE_SERVICIO}`, MAIL_TRANSPORT: 'test', DB_FILE: ':memory:' },
    {
      scrypt: { N: 1024, r: 8, p: 1 },
      limits: {
        login: { max: 1000, windowMs: 1000 },
        register: { max: 1000, windowMs: 1000 },
        reset: { max: 1000, windowMs: 1000 },
        resend: { max: 1000, windowMs: 1000 },
      },
      ...(reloj ? { clock: reloj } : {}),
      ...overrides,
    },
  );
  const { app, deps } = await buildApp({ config });
  return { app, deps, config, claveServicio: CLAVE_SERVICIO, correos: deps.mailer };
}

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
