import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, json, tokenDe, cookieDe, CLAVE_VALIDA } from '../helpers.js';

test('SC-010: el registro pide solo correo y contraseña y no guarda datos extra', async () => {
  const ctx = await crearApp();
  const r = await ctx.app.inject(json('POST', '/auth/register', {
    email: 'Ana@Vivart.test ', password: CLAVE_VALIDA, cedula: '1100000000', telefono: '0999999999', direccion: 'Loja',
  }));
  assert.equal(r.statusCode, 202);
  const columnas = ctx.deps.db.prepare("SELECT name FROM pragma_table_info('users')").all().map((c) => c.name).sort();
  assert.deepEqual(columnas, ['created_at', 'email', 'email_verified_at', 'id', 'password_hash', 'status', 'updated_at']);
  const usuario = ctx.deps.repos.users.findByEmail('ana@vivart.test'); // el correo se normaliza
  assert.ok(usuario);
  assert.equal(usuario.status, 'active');
});

test('el registro falta de datos o con datos inválidos indica el campo', async () => {
  const { app } = await crearApp();
  let r = await app.inject(json('POST', '/auth/register', { email: 'a@b.co' }));
  assert.equal(r.statusCode, 422);
  assert.equal(r.json().field, 'password');
  r = await app.inject(json('POST', '/auth/register', { email: 'no-es-correo', password: CLAVE_VALIDA }));
  assert.equal(r.statusCode, 422);
  assert.equal(r.json().field, 'email');
  r = await app.inject(json('POST', '/auth/register', { email: 'a@b.co', password: 'a'.repeat(14) }));
  assert.equal(r.statusCode, 422);
  assert.equal(r.json().field, 'password');
});

test('SC-013: correo nuevo y repetido reciben exactamente la misma respuesta y no se crea una segunda cuenta', async () => {
  const ctx = await crearApp();
  const a = await ctx.app.inject(json('POST', '/auth/register', { email: 'luz@vivart.test', password: CLAVE_VALIDA }));
  const b = await ctx.app.inject(json('POST', '/auth/register', { email: 'luz@vivart.test', password: 'otra clave larga de prueba' }));
  assert.equal(a.statusCode, b.statusCode);
  assert.deepEqual(a.json(), b.json());
  assert.equal(ctx.deps.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
  assert.equal(ctx.correos.count('luz@vivart.test', 'already_registered'), 1);
  // la clave de la segunda solicitud no sustituye a la de la cuenta
  const login = await ctx.app.inject(json('POST', '/auth/login', { email: 'luz@vivart.test', password: 'otra clave larga de prueba' }));
  assert.equal(login.statusCode, 401);
});

test('SC-014 y SC-016: el enlace de verificación llega al buzón de pruebas, es de un solo uso y no se guarda en claro', async () => {
  const ctx = await crearApp();
  await ctx.app.inject(json('POST', '/auth/register', { email: 'mia@vivart.test', password: CLAVE_VALIDA }));
  const token = tokenDe(ctx.correos.last('mia@vivart.test', 'verify'));
  assert.ok(token);
  const guardado = ctx.deps.db.prepare('SELECT token_hash FROM email_tokens').all().map((f) => f.token_hash);
  assert.ok(!guardado.includes(token));

  const login1 = await ctx.app.inject(json('POST', '/auth/login', { email: 'mia@vivart.test', password: CLAVE_VALIDA }));
  assert.equal(login1.json().emailVerified, false);

  const ok = await ctx.app.inject(json('POST', '/auth/verify-email', { token }));
  assert.equal(ok.statusCode, 200);
  const segundo = await ctx.app.inject(json('POST', '/auth/verify-email', { token }));
  assert.equal(segundo.statusCode, 400);
  assert.equal(segundo.json().error, 'invalid_token');
  assert.equal(segundo.json().canRequestNew, true);

  const login2 = await ctx.app.inject(json('POST', '/auth/login', { email: 'mia@vivart.test', password: CLAVE_VALIDA }));
  assert.equal(login2.json().emailVerified, true);
});

test('SC-014: un enlace de verificación vencido se rechaza y se puede pedir uno nuevo con respuesta neutra', async () => {
  let ahora = new Date('2026-11-20T10:00:00Z');
  const ctx = await crearApp({ reloj: () => ahora });
  await ctx.app.inject(json('POST', '/auth/register', { email: 'sol@vivart.test', password: CLAVE_VALIDA }));
  const viejo = tokenDe(ctx.correos.last('sol@vivart.test', 'verify'));
  ahora = new Date('2026-11-21T11:00:00Z'); // pasaron más de 24 horas
  assert.equal((await ctx.app.inject(json('POST', '/auth/verify-email', { token: viejo }))).statusCode, 400);

  const a = await ctx.app.inject(json('POST', '/auth/resend-verification', { email: 'sol@vivart.test' }));
  const b = await ctx.app.inject(json('POST', '/auth/resend-verification', { email: 'nadie@vivart.test' }));
  assert.equal(a.statusCode, 202);
  assert.deepEqual(a.json(), b.json()); // mismo mensaje exista o no
  assert.equal(ctx.correos.count('nadie@vivart.test'), 0);
  const nuevo = tokenDe(ctx.correos.last('sol@vivart.test', 'verify'));
  assert.notEqual(nuevo, viejo);
  assert.equal((await ctx.app.inject(json('POST', '/auth/verify-email', { token: nuevo }))).statusCode, 200);
});

test('SC-015: el registro público nunca otorga permisos internos', async () => {
  const ctx = await crearApp();
  await ctx.app.inject(json('POST', '/auth/register', { email: 'pub@vivart.test', password: CLAVE_VALIDA }));
  const login = await ctx.app.inject(json('POST', '/auth/login', { email: 'pub@vivart.test', password: CLAVE_VALIDA }));
  assert.deepEqual(login.json().roles, ['usuario_registrado']);
  assert.equal(ctx.deps.db.prepare('SELECT COUNT(*) AS n FROM role_assignments').get().n, 0);
  // intentar colar roles en el cuerpo no tiene efecto
  await ctx.app.inject(json('POST', '/auth/register', { email: 'pub2@vivart.test', password: CLAVE_VALIDA, roles: ['administrador'], role: 'administrador' }));
  assert.equal(ctx.deps.db.prepare('SELECT COUNT(*) AS n FROM role_assignments').get().n, 0);
});

test('un token inexistente o vacío se rechaza igual', async () => {
  const { app } = await crearApp();
  for (const token of ['', 'inventado', undefined]) {
    const r = await app.inject(json('POST', '/auth/verify-email', { token }));
    assert.equal(r.statusCode, 400);
  }
  assert.ok(cookieDe({ cookies: [] }) === undefined);
});
