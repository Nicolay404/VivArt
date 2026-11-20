import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, crearUsuario, crearAdmin, json } from '../helpers.js';

const valor = (cookie) => cookie.split('=')[1];

function interno(ctx, ruta, cuerpo, clave = ctx.claveServicio) {
  return ctx.app.inject({
    method: 'POST',
    url: ruta,
    headers: { 'content-type': 'application/json', ...(clave ? { 'x-service-key': clave } : {}) },
    payload: JSON.stringify(cuerpo),
  });
}

async function conRoles(ctx, email, roles, funciones = []) {
  const admin = ctx.admin ?? (ctx.admin = await crearAdmin(ctx));
  const u = await crearUsuario(ctx, email);
  for (const rol of roles) {
    await ctx.app.inject(json('PUT', `/users/${u.id}/roles/${rol}`, undefined, admin.cookie));
  }
  for (const f of funciones) {
    await ctx.app.inject(json('PUT', `/users/${u.id}/functions/${f}`, undefined, admin.cookie));
  }
  return u;
}

test('las rutas internas exigen la credencial de servicio', async () => {
  const ctx = await crearApp();
  const u = await crearUsuario(ctx, 'a@vivart.test');
  for (const ruta of ['/internal/introspect', '/internal/authorize']) {
    assert.equal((await interno(ctx, ruta, { sessionToken: valor(u.cookie), action: 'panel.access' }, null)).statusCode, 401);
    assert.equal((await interno(ctx, ruta, { sessionToken: valor(u.cookie), action: 'panel.access' }, 'clave-equivocada')).statusCode, 401);
  }
});

test('introspect devuelve persona, roles, correo verificado y funciones vigentes', async () => {
  const ctx = await crearApp();
  const staff = await conRoles(ctx, 'staff@vivart.test', ['personal_acceso'], ['func-1']);
  const r = await interno(ctx, '/internal/introspect', { sessionToken: valor(staff.cookie) });
  assert.equal(r.statusCode, 200);
  const c = r.json();
  assert.equal(c.active, true);
  assert.equal(c.userId, staff.id);
  assert.equal(c.emailVerified, true);
  assert.deepEqual(c.roles, ['usuario_registrado', 'personal_acceso']);
  assert.deepEqual(c.functionIds, ['func-1']);

  const inactiva = await interno(ctx, '/internal/introspect', { sessionToken: 'inventado' });
  assert.deepEqual(inactiva.json(), { active: false });
});

test('SC-001: la matriz se cumple en solicitudes directas, sin pasar por la web', async () => {
  const ctx = await crearApp();
  const editor = await conRoles(ctx, 'ed@vivart.test', ['editor']);
  const publicador = await conRoles(ctx, 'pu@vivart.test', ['publicador']);
  const admin = ctx.admin;
  const normal = await crearUsuario(ctx, 'normal@vivart.test');

  const pregunta = async (u, action, context) =>
    (await interno(ctx, '/internal/authorize', { sessionToken: valor(u.cookie), action, context })).json();

  assert.equal((await pregunta(editor, 'publish')).allowed, false);
  assert.equal((await pregunta(editor, 'draft.edit_own', { ownerId: editor.id })).allowed, true);
  const ajeno = await pregunta(editor, 'draft.edit_own', { ownerId: publicador.id });
  assert.equal(ajeno.allowed, false);
  assert.equal(ajeno.reason, 'not_owner');

  assert.equal((await pregunta(publicador, 'publish')).allowed, true);
  assert.equal((await pregunta(publicador, 'draft.edit_any')).allowed, true);
  assert.equal((await pregunta(publicador, 'sales.configure')).allowed, false); // publicar no activa ventas
  assert.equal((await pregunta(admin, 'sales.configure')).allowed, true);
  assert.equal((await pregunta(admin, 'publish')).allowed, true);
  assert.equal((await pregunta(normal, 'panel.access')).allowed, false);

  const sinSesion = (await interno(ctx, '/internal/authorize', { sessionToken: 'inventado', action: 'publish' })).json();
  assert.deepEqual([sinSesion.allowed, sinSesion.reason], [false, 'no_session']);
});

test('SC-009: el personal de acceso valida exactamente las funciones que se le asignaron', async () => {
  const ctx = await crearApp();
  const staff = await conRoles(ctx, 'acceso@vivart.test', ['personal_acceso'], ['f1', 'f2']);
  const pregunta = async (funcion) =>
    (await interno(ctx, '/internal/authorize', { sessionToken: valor(staff.cookie), action: 'access.validate', context: { functionId: funcion } })).json();
  assert.equal((await pregunta('f1')).allowed, true);
  assert.equal((await pregunta('f2')).allowed, true);
  const ajena = await pregunta('f3');
  assert.equal(ajena.allowed, false);
  assert.equal(ajena.reason, 'function_not_assigned');
});

test('authorize rechaza acciones que no existen con un error de validación', async () => {
  const ctx = await crearApp();
  const u = await crearUsuario(ctx, 'v@vivart.test');
  const r = await interno(ctx, '/internal/authorize', { sessionToken: valor(u.cookie), action: 'borrar.todo' });
  assert.equal(r.statusCode, 422);
});

test('las rutas protegidas públicas también verifican el rol en el servidor (solicitud directa de un editor)', async () => {
  const ctx = await crearApp();
  const editor = await conRoles(ctx, 'directo@vivart.test', ['editor']);
  const r = await ctx.app.inject({ method: 'GET', url: '/users', headers: { cookie: editor.cookie } });
  assert.equal(r.statusCode, 403);
  const asignar = await ctx.app.inject(json('PUT', `/users/${editor.id}/roles/administrador`, undefined, editor.cookie));
  assert.equal(asignar.statusCode, 403); // no puede darse a sí mismo un rol
});
