import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, crearUsuario, crearAdmin, json } from '../helpers.js';

const get = (ctx, url, cookie) => ctx.app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} });

test('SC-004: el administrador asigna varios roles y los permisos son la suma', async () => {
  const ctx = await crearApp();
  const admin = await crearAdmin(ctx);
  const u = await crearUsuario(ctx, 'dos@vivart.test');
  assert.equal((await ctx.app.inject(json('PUT', `/users/${u.id}/roles/editor`, undefined, admin.cookie))).statusCode, 204);
  assert.equal((await ctx.app.inject(json('PUT', `/users/${u.id}/roles/publicador`, undefined, admin.cookie))).statusCode, 204);
  const me = (await get(ctx, '/me', u.cookie)).json();
  assert.deepEqual(me.roles, ['usuario_registrado', 'editor', 'publicador']);
});

test('FR-011: solo el administrador asigna y revoca; sin sesión pide identificarse', async () => {
  const ctx = await crearApp();
  const admin = await crearAdmin(ctx);
  const u = await crearUsuario(ctx, 'normal@vivart.test');
  const otro = await crearUsuario(ctx, 'otro@vivart.test');

  const sinSesion = await ctx.app.inject(json('PUT', `/users/${otro.id}/roles/editor`));
  assert.equal(sinSesion.statusCode, 401);
  const sinRol = await ctx.app.inject(json('PUT', `/users/${otro.id}/roles/editor`, undefined, u.cookie));
  assert.equal(sinRol.statusCode, 403);
  assert.equal(sinRol.json().missingRole, 'administrador');
  assert.equal((await ctx.app.inject(json('DELETE', `/users/${otro.id}/roles/editor`, undefined, u.cookie))).statusCode, 403);
  assert.equal((await get(ctx, '/users', u.cookie)).statusCode, 403);
  assert.equal((await get(ctx, '/users', admin.cookie)).statusCode, 200);
});

test('buscar y consultar cuentas por correo (solo administrador)', async () => {
  const ctx = await crearApp();
  const admin = await crearAdmin(ctx);
  const u = await crearUsuario(ctx, 'buscada@vivart.test');
  const lista = (await get(ctx, '/users?email=busc', admin.cookie)).json().users;
  assert.equal(lista.length, 1);
  assert.equal(lista[0].id, u.id);
  assert.equal(lista[0].email, 'buscada@vivart.test');
  assert.ok(!('password_hash' in lista[0]) && !('passwordHash' in lista[0]));
  assert.equal((await get(ctx, `/users/${u.id}`, admin.cookie)).json().email, 'buscada@vivart.test');
  assert.equal((await get(ctx, '/users/no-existe', admin.cookie)).statusCode, 404);
});

test('un rol inexistente o una cuenta inexistente se rechazan', async () => {
  const ctx = await crearApp();
  const admin = await crearAdmin(ctx);
  const u = await crearUsuario(ctx, 'x@vivart.test');
  const rol = await ctx.app.inject(json('PUT', `/users/${u.id}/roles/superusuario`, undefined, admin.cookie));
  assert.equal(rol.statusCode, 422);
  assert.equal(rol.json().field, 'role');
  const visitante = await ctx.app.inject(json('PUT', `/users/${u.id}/roles/usuario_registrado`, undefined, admin.cookie));
  assert.equal(visitante.statusCode, 422); // los roles implícitos no se asignan
  assert.equal((await ctx.app.inject(json('PUT', '/users/no-existe/roles/editor', undefined, admin.cookie))).statusCode, 404);
});

test('las funciones solo se asignan a cuentas con rol de personal de acceso', async () => {
  const ctx = await crearApp();
  const admin = await crearAdmin(ctx);
  const u = await crearUsuario(ctx, 'staff@vivart.test');
  const sinRol = await ctx.app.inject(json('PUT', `/users/${u.id}/functions/f1`, undefined, admin.cookie));
  assert.equal(sinRol.statusCode, 409);
  assert.equal(sinRol.json().error, 'not_access_staff');

  await ctx.app.inject(json('PUT', `/users/${u.id}/roles/personal_acceso`, undefined, admin.cookie));
  assert.equal((await ctx.app.inject(json('PUT', `/users/${u.id}/functions/f1`, undefined, admin.cookie))).statusCode, 204);
  assert.equal((await ctx.app.inject(json('PUT', `/users/${u.id}/functions/f2`, undefined, admin.cookie))).statusCode, 204);
  assert.deepEqual((await get(ctx, `/users/${u.id}`, admin.cookie)).json().functionIds, ['f1', 'f2']);

  const mala = await ctx.app.inject(json('PUT', `/users/${u.id}/functions/${encodeURIComponent('no valida!')}`, undefined, admin.cookie));
  assert.equal(mala.statusCode, 422);
  assert.equal((await ctx.app.inject(json('DELETE', `/users/${u.id}/functions/f1`, undefined, admin.cookie))).statusCode, 204);
  assert.deepEqual((await get(ctx, `/users/${u.id}`, admin.cookie)).json().functionIds, ['f2']);
});

test('FR-016: no hay alcance por organización; el cuerpo no cambia el rol asignado', async () => {
  const ctx = await crearApp();
  const admin = await crearAdmin(ctx);
  const u = await crearUsuario(ctx, 'org@vivart.test');
  await ctx.app.inject(json('PUT', `/users/${u.id}/roles/editor`, { organizacion: 'Teatro Bolívar' }, admin.cookie));
  const cuenta = (await get(ctx, `/users/${u.id}`, admin.cookie)).json();
  assert.deepEqual(cuenta.roles, ['usuario_registrado', 'editor']);
  const columnas = (await ctx.deps.db.query("SELECT column_name AS name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'role_assignments'")).map((c) => c.name);
  assert.ok(!columnas.some((c) => /org/i.test(c)));
});

test('asignar el mismo rol dos veces es idempotente y no duplica el historial', async () => {
  const ctx = await crearApp();
  const admin = await crearAdmin(ctx);
  const u = await crearUsuario(ctx, 'idem@vivart.test');
  await ctx.app.inject(json('PUT', `/users/${u.id}/roles/editor`, undefined, admin.cookie));
  await ctx.app.inject(json('PUT', `/users/${u.id}/roles/editor`, undefined, admin.cookie));
  const asignaciones = (await ctx.deps.repos.audit.list()).filter((e) => e.action === 'role.assigned' && e.target_id === u.id);
  assert.equal(asignaciones.length, 1);
});
