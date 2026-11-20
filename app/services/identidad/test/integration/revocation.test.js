import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, crearUsuario, crearAdmin, json } from '../helpers.js';

const valor = (cookie) => cookie.split('=')[1];

function consulta(ctx, ruta, cuerpo) {
  return ctx.app.inject({
    method: 'POST',
    url: ruta,
    headers: { 'content-type': 'application/json', 'x-service-key': ctx.claveServicio },
    payload: JSON.stringify(cuerpo),
  });
}

test('SC-004 y SC-005: revocar un rol quita solo sus acciones, en la siguiente consulta, sin cerrar la sesión', async () => {
  const ctx = await crearApp();
  const admin = await crearAdmin(ctx);
  const u = await crearUsuario(ctx, 'doble@vivart.test');
  await ctx.app.inject(json('PUT', `/users/${u.id}/roles/editor`, undefined, admin.cookie));
  await ctx.app.inject(json('PUT', `/users/${u.id}/roles/publicador`, undefined, admin.cookie));

  const antes = (await consulta(ctx, '/internal/authorize', { sessionToken: valor(u.cookie), action: 'draft.submit' })).json();
  assert.equal(antes.allowed, true);

  const revocar = await ctx.app.inject(json('DELETE', `/users/${u.id}/roles/editor`, undefined, admin.cookie));
  assert.equal(revocar.statusCode, 204);

  // la misma sesión, ya sin las acciones de editor y con las de publicador
  const sinEditor = (await consulta(ctx, '/internal/authorize', { sessionToken: valor(u.cookie), action: 'draft.submit' })).json();
  const conPublicador = (await consulta(ctx, '/internal/authorize', { sessionToken: valor(u.cookie), action: 'publish' })).json();
  assert.equal(sinEditor.allowed, false);
  assert.equal(conPublicador.allowed, true);
  const intro = (await consulta(ctx, '/internal/introspect', { sessionToken: valor(u.cookie) })).json();
  assert.deepEqual(intro.roles, ['usuario_registrado', 'publicador']);
  assert.equal((await ctx.app.inject({ method: 'GET', url: '/me', headers: { cookie: u.cookie } })).statusCode, 200); // no se cierra la sesión
});

test('FR-018: revocar personal de acceso quita también sus funciones asignadas', async () => {
  const ctx = await crearApp();
  const admin = await crearAdmin(ctx);
  const u = await crearUsuario(ctx, 'acceso@vivart.test');
  await ctx.app.inject(json('PUT', `/users/${u.id}/roles/personal_acceso`, undefined, admin.cookie));
  await ctx.app.inject(json('PUT', `/users/${u.id}/functions/f1`, undefined, admin.cookie));
  await ctx.app.inject(json('DELETE', `/users/${u.id}/roles/personal_acceso`, undefined, admin.cookie));
  const intro = (await consulta(ctx, '/internal/introspect', { sessionToken: valor(u.cookie) })).json();
  assert.deepEqual(intro.functionIds, []);
  const valida = (await consulta(ctx, '/internal/authorize', { sessionToken: valor(u.cookie), action: 'access.validate', context: { functionId: 'f1' } })).json();
  assert.equal(valida.allowed, false);
});

test('revocar un rol que la cuenta no tiene no falla ni repite el historial', async () => {
  const ctx = await crearApp();
  const admin = await crearAdmin(ctx);
  const u = await crearUsuario(ctx, 'sinrol@vivart.test');
  const r = await ctx.app.inject(json('DELETE', `/users/${u.id}/roles/editor`, undefined, admin.cookie));
  assert.equal(r.statusCode, 204);
  assert.equal((await ctx.deps.repos.audit.list()).filter((e) => e.action === 'role.revoked').length, 0);
});

test('FR-019 a FR-021: el servicio solo conoce sus propias tablas; no hay nada de contenido que borrar o despublicar', async () => {
  const ctx = await crearApp();
  const tablas = (await ctx.deps.db.query("SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'")).map((t) => t.name).sort();
  assert.deepEqual(tablas, ['audit_log', 'email_tokens', 'function_assignments', 'pending_actions', 'role_assignments', 'sessions', 'users']);
});

test('revocar y volver a asignar un rol deja la cuenta como estaba y todo queda en el historial', async () => {
  const ctx = await crearApp();
  const admin = await crearAdmin(ctx);
  const u = await crearUsuario(ctx, 'vuelve@vivart.test');
  await ctx.app.inject(json('PUT', `/users/${u.id}/roles/publicador`, undefined, admin.cookie));
  await ctx.app.inject(json('DELETE', `/users/${u.id}/roles/publicador`, undefined, admin.cookie));
  await ctx.app.inject(json('PUT', `/users/${u.id}/roles/publicador`, undefined, admin.cookie));
  const acciones = (await ctx.deps.repos.audit.list()).filter((e) => e.target_id === u.id).map((e) => e.action).reverse();
  assert.deepEqual(acciones, ['role.assigned', 'role.revoked', 'role.assigned']);
});
