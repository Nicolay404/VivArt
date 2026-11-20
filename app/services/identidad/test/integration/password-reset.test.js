import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, crearUsuario, json, tokenDe, CLAVE_VALIDA } from '../helpers.js';

const NUEVA = 'una contraseña nueva y larga';

test('SC-013: pedir recuperación da la misma respuesta exista o no el correo, y solo el existente recibe mensaje', async () => {
  const ctx = await crearApp();
  await crearUsuario(ctx, 'ana@vivart.test');
  const a = await ctx.app.inject(json('POST', '/auth/password-reset/request', { email: 'ana@vivart.test' }));
  const b = await ctx.app.inject(json('POST', '/auth/password-reset/request', { email: 'nadie@vivart.test' }));
  assert.equal(a.statusCode, 202);
  assert.equal(b.statusCode, 202);
  assert.deepEqual(a.json(), b.json());
  assert.equal(ctx.correos.count('ana@vivart.test', 'reset'), 1);
  assert.equal(ctx.correos.count('nadie@vivart.test'), 0);
});

test('SC-014 y SC-016: el enlace restablece la contraseña una sola vez y cierra las demás sesiones', async () => {
  const ctx = await crearApp();
  const u = await crearUsuario(ctx, 'luis@vivart.test');
  await ctx.app.inject(json('POST', '/auth/password-reset/request', { email: 'luis@vivart.test' }));
  const token = tokenDe(ctx.correos.last('luis@vivart.test', 'reset'));

  const ok = await ctx.app.inject(json('POST', '/auth/password-reset/confirm', { token, password: NUEVA }));
  assert.equal(ok.statusCode, 204);
  // la sesión anterior ya no vale y la contraseña vieja tampoco
  assert.equal((await ctx.app.inject({ method: 'GET', url: '/me', headers: { cookie: u.cookie } })).statusCode, 401);
  assert.equal((await ctx.app.inject(json('POST', '/auth/login', { email: 'luis@vivart.test', password: CLAVE_VALIDA }))).statusCode, 401);
  assert.equal((await ctx.app.inject(json('POST', '/auth/login', { email: 'luis@vivart.test', password: NUEVA }))).statusCode, 200);

  const segundo = await ctx.app.inject(json('POST', '/auth/password-reset/confirm', { token, password: 'otra contraseña distinta larga' }));
  assert.equal(segundo.statusCode, 400);
  assert.equal(segundo.json().error, 'invalid_token');
});

test('SC-014: un enlace de recuperación vencido se rechaza', async () => {
  let ahora = new Date('2026-11-20T10:00:00Z');
  const ctx = await crearApp({ reloj: () => ahora });
  await crearUsuario(ctx, 'vera@vivart.test');
  await ctx.app.inject(json('POST', '/auth/password-reset/request', { email: 'vera@vivart.test' }));
  const token = tokenDe(ctx.correos.last('vera@vivart.test', 'reset'));
  ahora = new Date('2026-11-20T11:30:00Z'); // pasó 1 hora
  const r = await ctx.app.inject(json('POST', '/auth/password-reset/confirm', { token, password: NUEVA }));
  assert.equal(r.statusCode, 400);
});

test('una contraseña nueva inválida se rechaza junto al campo sin gastar el enlace', async () => {
  const ctx = await crearApp();
  await crearUsuario(ctx, 'ines@vivart.test');
  await ctx.app.inject(json('POST', '/auth/password-reset/request', { email: 'ines@vivart.test' }));
  const token = tokenDe(ctx.correos.last('ines@vivart.test', 'reset'));
  const mala = await ctx.app.inject(json('POST', '/auth/password-reset/confirm', { token, password: 'corta' }));
  assert.equal(mala.statusCode, 422);
  assert.equal(mala.json().field, 'password');
  const buena = await ctx.app.inject(json('POST', '/auth/password-reset/confirm', { token, password: NUEVA }));
  assert.equal(buena.statusCode, 204);
});

test('un segundo pedido de recuperación invalida el enlace anterior', async () => {
  const ctx = await crearApp();
  await crearUsuario(ctx, 'tomas@vivart.test');
  await ctx.app.inject(json('POST', '/auth/password-reset/request', { email: 'tomas@vivart.test' }));
  const primero = tokenDe(ctx.correos.last('tomas@vivart.test', 'reset'));
  await ctx.app.inject(json('POST', '/auth/password-reset/request', { email: 'tomas@vivart.test' }));
  const segundo = tokenDe(ctx.correos.last('tomas@vivart.test', 'reset'));
  assert.equal((await ctx.app.inject(json('POST', '/auth/password-reset/confirm', { token: primero, password: NUEVA }))).statusCode, 400);
  assert.equal((await ctx.app.inject(json('POST', '/auth/password-reset/confirm', { token: segundo, password: NUEVA }))).statusCode, 204);
});

test('restablecer deja constancia en el historial sin contraseñas ni enlaces', async () => {
  const ctx = await crearApp();
  const u = await crearUsuario(ctx, 'rosa@vivart.test');
  await ctx.app.inject(json('POST', '/auth/password-reset/request', { email: 'rosa@vivart.test' }));
  const token = tokenDe(ctx.correos.last('rosa@vivart.test', 'reset'));
  await ctx.app.inject(json('POST', '/auth/password-reset/confirm', { token, password: NUEVA }));
  const entradas = ctx.deps.repos.audit.list();
  assert.ok(entradas.some((e) => e.action === 'password.reset' && e.target_id === u.id));
  const texto = JSON.stringify(entradas);
  assert.ok(!texto.includes(NUEVA) && !texto.includes(token));
});
