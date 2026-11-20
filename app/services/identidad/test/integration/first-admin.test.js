import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearApp, json, tokenDe, CLAVE_VALIDA } from '../helpers.js';

test('FR-027: el procedimiento interno crea una cuenta pendiente, sin contraseña y con el rol de administrador', async () => {
  const ctx = await crearApp();
  await ctx.deps.accounts.createFirstAdmin('Primera@Vivart.test');
  const u = ctx.deps.repos.users.findByEmail('primera@vivart.test');
  assert.equal(u.status, 'pending_activation');
  assert.equal(u.password_hash, null); // no hay credenciales predeterminadas
  assert.deepEqual(ctx.deps.repos.roles.listRoles(u.id), ['administrador']);
  // aún no se puede iniciar sesión
  const intento = await ctx.app.inject(json('POST', '/auth/login', { email: 'primera@vivart.test', password: CLAVE_VALIDA }));
  assert.equal(intento.statusCode, 401);
});

test('SC-015: el titular activa con el enlace, fija su contraseña y el enlace sirve una sola vez', async () => {
  const ctx = await crearApp();
  await ctx.deps.accounts.createFirstAdmin('titular@vivart.test');
  const token = tokenDe(ctx.correos.last('titular@vivart.test', 'activate'));

  const corta = await ctx.app.inject(json('POST', '/auth/activate', { token, password: 'corta' }));
  assert.equal(corta.statusCode, 422);

  const ok = await ctx.app.inject(json('POST', '/auth/activate', { token, password: CLAVE_VALIDA }));
  assert.equal(ok.statusCode, 204);
  const login = await ctx.app.inject(json('POST', '/auth/login', { email: 'titular@vivart.test', password: CLAVE_VALIDA }));
  assert.equal(login.statusCode, 200);
  assert.ok(login.json().roles.includes('administrador'));
  assert.equal(login.json().emailVerified, true);

  const otra = await ctx.app.inject(json('POST', '/auth/activate', { token, password: 'otra contraseña larga de prueba' }));
  assert.equal(otra.statusCode, 400);
});

test('el registro público con el correo designado no da permisos ni toma la cuenta', async () => {
  const ctx = await crearApp();
  await ctx.deps.accounts.createFirstAdmin('designado@vivart.test');
  const intento = await ctx.app.inject(json('POST', '/auth/register', { email: 'designado@vivart.test', password: 'una clave de quien intenta registrarse' }));
  assert.equal(intento.statusCode, 202);
  const login = await ctx.app.inject(json('POST', '/auth/login', { email: 'designado@vivart.test', password: 'una clave de quien intenta registrarse' }));
  assert.equal(login.statusCode, 401); // la cuenta sigue pendiente de activación por su titular
  assert.equal(ctx.deps.repos.users.findByEmail('designado@vivart.test').password_hash, null);
});

test('no se crea otro primer administrador si ya existe uno activo, salvo que se pida expresamente', async () => {
  const ctx = await crearApp();
  await ctx.deps.accounts.createFirstAdmin('uno@vivart.test');
  const token = tokenDe(ctx.correos.last('uno@vivart.test', 'activate'));
  await ctx.app.inject(json('POST', '/auth/activate', { token, password: CLAVE_VALIDA }));
  await assert.rejects(() => ctx.deps.accounts.createFirstAdmin('dos@vivart.test'), { code: 'admin_exists' });
  await assert.doesNotReject(() => ctx.deps.accounts.createFirstAdmin('dos@vivart.test', { allowAdditional: true }));
});

test('el script interno emite el enlace de activación por consola y no define contraseñas', () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'vivart-script-'));
  try {
    const script = fileURLToPath(new URL('../../bin/crear-primer-administrador.js', import.meta.url));
    const entorno = { ...process.env, MAIL_TRANSPORT: 'console', DB_FILE: join(carpeta, 'prueba.sqlite'), PUBLIC_BASE_URL: 'http://localhost:8080' };
    const ok = spawnSync(process.execPath, [script, '--email', 'script@vivart.test'], { env: entorno, encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /http:\/\/localhost:8080\/activar\?token=/);
    assert.ok(!/contraseña:/i.test(ok.stdout));

    const sinCorreo = spawnSync(process.execPath, [script], { env: entorno, encoding: 'utf8' });
    assert.equal(sinCorreo.status, 2);
    const conTest = spawnSync(process.execPath, [script, '--email', 'x@vivart.test'], { env: { ...entorno, MAIL_TRANSPORT: 'test' }, encoding: 'utf8' });
    assert.equal(conTest.status, 2); // el buzón en memoria perdería el enlace
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
});
