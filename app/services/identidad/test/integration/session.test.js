import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, crearUsuario, json, cookieDe, CLAVE_VALIDA } from '../helpers.js';

test('FR-004 y SC-008: inicia sesión con cookie HttpOnly, consulta solo la propia cuenta y cierra sesión', async () => {
  const ctx = await crearApp();
  const a = await crearUsuario(ctx, 'a@vivart.test');
  const b = await crearUsuario(ctx, 'b@vivart.test');

  const r = await ctx.app.inject({ method: 'GET', url: '/me', headers: { cookie: a.cookie } });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().email, 'a@vivart.test');
  assert.equal(r.json().emailVerified, true);
  const rb = await ctx.app.inject({ method: 'GET', url: '/me', headers: { cookie: b.cookie } });
  assert.equal(rb.json().email, 'b@vivart.test'); // cada persona ve solo lo suyo

  const salir = await ctx.app.inject(json('POST', '/auth/logout', undefined, a.cookie));
  assert.equal(salir.statusCode, 204);
  assert.equal((await ctx.app.inject({ method: 'GET', url: '/me', headers: { cookie: a.cookie } })).statusCode, 401);
  assert.equal((await ctx.app.inject({ method: 'GET', url: '/me', headers: { cookie: b.cookie } })).statusCode, 200);
});

test('la cookie de sesión es HttpOnly y SameSite=Lax, y la base solo guarda su hash', async () => {
  const ctx = await crearApp();
  await crearUsuario(ctx, 'c@vivart.test');
  const r = await ctx.app.inject(json('POST', '/auth/login', { email: 'c@vivart.test', password: CLAVE_VALIDA }));
  const cookie = r.cookies.find((x) => x.name === 'vivart_sid');
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.sameSite, 'Lax');
  const ids = ctx.deps.db.prepare('SELECT id FROM sessions').all().map((f) => f.id);
  assert.ok(!ids.includes(cookie.value));
});

test('credenciales inválidas: mismo error para cuenta inexistente y contraseña incorrecta', async () => {
  const ctx = await crearApp();
  await crearUsuario(ctx, 'd@vivart.test');
  const mala = await ctx.app.inject(json('POST', '/auth/login', { email: 'd@vivart.test', password: 'una clave incorrecta larga' }));
  const nadie = await ctx.app.inject(json('POST', '/auth/login', { email: 'nadie@vivart.test', password: 'una clave incorrecta larga' }));
  assert.equal(mala.statusCode, 401);
  assert.equal(nadie.statusCode, 401);
  assert.deepEqual(mala.json(), nadie.json());
  assert.equal(cookieDe(mala), undefined);
});

test('se puede iniciar sesión con el correo sin verificar, y el estado se informa', async () => {
  const ctx = await crearApp();
  const u = await crearUsuario(ctx, 'e@vivart.test', { verificar: false });
  const r = await ctx.app.inject({ method: 'GET', url: '/me', headers: { cookie: u.cookie } });
  assert.equal(r.json().emailVerified, false);
});

test('el limitador bloquea intentos repetidos de inicio de sesión', async () => {
  const ctx = await crearApp({ overrides: { limits: { login: { max: 3, windowMs: 60_000 } } } });
  const intento = () => ctx.app.inject(json('POST', '/auth/login', { email: 'f@vivart.test', password: 'una clave incorrecta larga' }));
  for (let i = 0; i < 3; i += 1) assert.equal((await intento()).statusCode, 401);
  const bloqueado = await intento();
  assert.equal(bloqueado.statusCode, 429);
  assert.equal(bloqueado.json().error, 'too_many_requests');
});

test('una sesión vencida deja de valer', async () => {
  let ahora = new Date('2026-11-20T10:00:00Z');
  const ctx = await crearApp({ reloj: () => ahora });
  const u = await crearUsuario(ctx, 'g@vivart.test');
  assert.equal((await ctx.app.inject({ method: 'GET', url: '/me', headers: { cookie: u.cookie } })).statusCode, 200);
  ahora = new Date('2026-11-28T10:00:00Z'); // más de 7 días
  assert.equal((await ctx.app.inject({ method: 'GET', url: '/me', headers: { cookie: u.cookie } })).statusCode, 401);
});

test('un token de sesión inventado no autentica', async () => {
  const { app } = await crearApp();
  const r = await app.inject({ method: 'GET', url: '/me', headers: { cookie: 'vivart_sid=inventado' } });
  assert.equal(r.statusCode, 401);
});
