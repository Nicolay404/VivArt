import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, crearUsuario, crearAdmin, json, tokenDe, CLAVE_VALIDA } from '../helpers.js';

// Decisiones del equipo del 2026-11-20 (P-10 y P-11): FR-039 a FR-042 y SC-021 a SC-023.

const HORA = 3600 * 1000;

function relojMovible(inicio = '2026-11-20T10:00:00Z') {
  let ahora = new Date(inicio);
  const reloj = () => new Date(ahora);
  reloj.avanzar = (ms) => { ahora = new Date(ahora.getTime() + ms); };
  return reloj;
}

const me = (ctx, cookie) => ctx.app.inject({ method: 'GET', url: '/me', headers: { cookie } });

test('FR-039, SC-021: no se puede quitar el rol de administrador a la última cuenta administradora', async () => {
  const ctx = await crearApp();
  const admin = await crearAdmin(ctx, 'unico@vivart.test');
  const r = await ctx.app.inject(json('DELETE', `/users/${admin.id}/roles/administrador`, undefined, admin.cookie));
  assert.equal(r.statusCode, 409);
  assert.equal(r.json().error, 'last_admin');
  assert.deepEqual((await me(ctx, admin.cookie)).json().roles, ['usuario_registrado', 'administrador']);
  assert.equal((await ctx.deps.repos.audit.list()).filter((e) => e.action === 'role.revoked').length, 0);
});

test('FR-039: con otro administrador activo, sí se puede quitar el rol (también a uno mismo)', async () => {
  const ctx = await crearApp();
  const uno = await crearAdmin(ctx, 'uno@vivart.test');
  const dos = await crearAdmin(ctx, 'dos@vivart.test');
  const r = await ctx.app.inject(json('DELETE', `/users/${uno.id}/roles/administrador`, undefined, uno.cookie));
  assert.equal(r.statusCode, 204);
  assert.deepEqual((await me(ctx, uno.cookie)).json().roles, ['usuario_registrado']);
  // ahora «dos» es el último: no puede quitárselo
  const ultimo = await ctx.app.inject(json('DELETE', `/users/${dos.id}/roles/administrador`, undefined, dos.cookie));
  assert.equal(ultimo.statusCode, 409);
});

test('FR-039: un administrador sí puede quitarse sus otros roles', async () => {
  const ctx = await crearApp();
  const uno = await crearAdmin(ctx, 'uno@vivart.test');
  const dos = await crearAdmin(ctx, 'dos@vivart.test');
  await ctx.app.inject(json('PUT', `/users/${uno.id}/roles/editor`, undefined, dos.cookie));
  const r = await ctx.app.inject(json('DELETE', `/users/${uno.id}/roles/editor`, undefined, uno.cookie));
  assert.equal(r.statusCode, 204);
  assert.deepEqual((await me(ctx, uno.cookie)).json().roles, ['usuario_registrado', 'administrador']);
});

test('FR-039: una cuenta pendiente de activación no cuenta como administrador activo', async () => {
  const ctx = await crearApp();
  const activo = await crearAdmin(ctx, 'activo@vivart.test');
  await ctx.deps.accounts.createFirstAdmin('pendiente@vivart.test', { allowAdditional: true }); // sin activar
  const r = await ctx.app.inject(json('DELETE', `/users/${activo.id}/roles/administrador`, undefined, activo.cookie));
  assert.equal(r.statusCode, 409);
  assert.equal(r.json().error, 'last_admin');
});

test('FR-039: dos revocaciones simultáneas no dejan el sistema sin administradores', async () => {
  const ctx = await crearApp();
  const uno = await crearAdmin(ctx, 'uno@vivart.test');
  const dos = await crearAdmin(ctx, 'dos@vivart.test');
  const [a, b] = await Promise.all([
    ctx.app.inject(json('DELETE', `/users/${dos.id}/roles/administrador`, undefined, uno.cookie)),
    ctx.app.inject(json('DELETE', `/users/${uno.id}/roles/administrador`, undefined, dos.cookie)),
  ]);
  assert.deepEqual([a.statusCode, b.statusCode].sort(), [204, 409]);
  const quedan = await ctx.deps.repos.users.countActiveAdmins();
  assert.equal(quedan, 1);
});

test('FR-040, SC-022: nadie se asigna roles ni funciones a sí mismo', async () => {
  const ctx = await crearApp();
  const admin = await crearAdmin(ctx);
  const rol = await ctx.app.inject(json('PUT', `/users/${admin.id}/roles/publicador`, undefined, admin.cookie));
  assert.equal(rol.statusCode, 409);
  assert.equal(rol.json().error, 'self_assignment');
  assert.deepEqual((await me(ctx, admin.cookie)).json().roles, ['usuario_registrado', 'administrador']);

  // tampoco funciones del personal de acceso, aunque otro administrador le dé ese rol
  const otro = await crearAdmin(ctx, 'otro@vivart.test');
  await ctx.app.inject(json('PUT', `/users/${admin.id}/roles/personal_acceso`, undefined, otro.cookie));
  const fn = await ctx.app.inject(json('PUT', `/users/${admin.id}/functions/f1`, undefined, admin.cookie));
  assert.equal(fn.statusCode, 409);
  assert.equal(fn.json().error, 'self_assignment');
  // otro administrador sí puede
  const bien = await ctx.app.inject(json('PUT', `/users/${admin.id}/functions/f1`, undefined, otro.cookie));
  assert.equal(bien.statusCode, 204);
});

test('FR-041, SC-023: una cuenta con rol interno cierra sesión tras 2 h sin actividad', async () => {
  const reloj = relojMovible();
  const ctx = await crearApp({ reloj });
  const admin = await crearAdmin(ctx);
  reloj.avanzar(HORA + 59 * 60 * 1000); // 1 h 59 min: sigue abierta y se anota la actividad
  assert.equal((await me(ctx, admin.cookie)).statusCode, 200);
  reloj.avanzar(HORA + 59 * 60 * 1000); // otra 1 h 59 min desde la última actividad: sigue abierta
  assert.equal((await me(ctx, admin.cookie)).statusCode, 200);
  reloj.avanzar(2 * HORA + 60 * 1000); // más de 2 h sin uso: se cierra
  assert.equal((await me(ctx, admin.cookie)).statusCode, 401);
});

test('FR-041, SC-023: una cuenta sin rol interno sigue abierta tras horas sin uso y cierra tras 7 días', async () => {
  const reloj = relojMovible();
  const ctx = await crearApp({ reloj });
  const u = await crearUsuario(ctx, 'publico@vivart.test');
  reloj.avanzar(10 * HORA);
  assert.equal((await me(ctx, u.cookie)).statusCode, 200);
  reloj.avanzar(7 * 24 * HORA + 60 * 1000);
  assert.equal((await me(ctx, u.cookie)).statusCode, 401);
});

test('FR-041: el máximo absoluto de 7 días se aplica aunque haya actividad', async () => {
  const reloj = relojMovible();
  const ctx = await crearApp({ reloj });
  const u = await crearUsuario(ctx, 'activo@vivart.test');
  for (let i = 0; i < 7; i += 1) {
    reloj.avanzar(23 * HORA);
    assert.equal((await me(ctx, u.cookie)).statusCode, 200);
  }
  reloj.avanzar(8 * HORA); // 7 días y 1 h desde el inicio de sesión
  assert.equal((await me(ctx, u.cookie)).statusCode, 401);
});

test('FR-042: la acción pendiente dura 24 h y la activación del administrador cuenta como correo verificado', async () => {
  const reloj = relojMovible();
  const ctx = await crearApp({ reloj });
  const guardada = await ctx.app.inject(json('POST', '/auth/pending-actions', { type: 'canje', ref: 'qr1' }));
  const vence = new Date(guardada.json().expiresAt).getTime() - reloj().getTime();
  assert.equal(vence, 24 * HORA);

  await ctx.deps.accounts.createFirstAdmin('verificado@vivart.test');
  const token = tokenDe(ctx.correos.last('verificado@vivart.test', 'activate'));
  await ctx.app.inject(json('POST', '/auth/activate', { token, password: CLAVE_VALIDA }));
  const login = await ctx.app.inject(json('POST', '/auth/login', { email: 'verificado@vivart.test', password: CLAVE_VALIDA }));
  assert.equal(login.json().emailVerified, true);
});
