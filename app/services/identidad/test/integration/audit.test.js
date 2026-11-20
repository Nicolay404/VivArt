import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, crearUsuario, crearAdmin, json } from '../helpers.js';

test('SC-007: cada asignación, revocación y activación queda con quién, cuándo y sobre qué registro', async () => {
  const ctx = await crearApp();
  const admin = await crearAdmin(ctx, 'admin@vivart.test');
  const u = await crearUsuario(ctx, 'sujeto@vivart.test');
  await ctx.app.inject(json('PUT', `/users/${u.id}/roles/personal_acceso`, undefined, admin.cookie));
  await ctx.app.inject(json('PUT', `/users/${u.id}/functions/f1`, undefined, admin.cookie));
  await ctx.app.inject(json('DELETE', `/users/${u.id}/roles/personal_acceso`, undefined, admin.cookie));

  const r = await ctx.app.inject({ method: 'GET', url: '/audit?limit=50', headers: { cookie: admin.cookie } });
  assert.equal(r.statusCode, 200);
  const entradas = r.json().entries;
  const acciones = entradas.map((e) => e.action);
  for (const esperada of ['admin.bootstrap', 'account.activated', 'role.assigned', 'function.assigned', 'role.revoked', 'function.revoked']) {
    assert.ok(acciones.includes(esperada), esperada);
  }
  const asignacion = entradas.find((e) => e.action === 'role.assigned');
  assert.equal(asignacion.actor_id, admin.id); // quién
  assert.equal(asignacion.target_id, u.id); // sobre qué registro
  assert.match(asignacion.at, /^\d{4}-\d{2}-\d{2}T/); // cuándo
  assert.deepEqual(asignacion.details, { role: 'personal_acceso' });
});

test('FR-025: solo el administrador consulta el historial', async () => {
  const ctx = await crearApp();
  await crearAdmin(ctx);
  const u = await crearUsuario(ctx, 'curioso@vivart.test');
  assert.equal((await ctx.app.inject({ method: 'GET', url: '/audit' })).statusCode, 401);
  assert.equal((await ctx.app.inject({ method: 'GET', url: '/audit', headers: { cookie: u.cookie } })).statusCode, 403);
});

test('FR-026: el historial nunca guarda contraseñas, tokens ni claves', async () => {
  const ctx = await crearApp();
  const admin = await crearAdmin(ctx);
  ctx.deps.audit(admin.id, 'prueba', 'user', 'x', { password: 'secreto123', token: 'abc', clave: 'x', passwordHash: 'h', role: 'editor' });
  const ultimo = ctx.deps.repos.audit.list(1)[0];
  assert.deepEqual(ultimo.details, { role: 'editor' });
  assert.ok(!JSON.stringify(ctx.deps.repos.audit.list(200)).includes('secreto123'));
});

test('el historial es de solo anexar: no se puede modificar ni borrar', async () => {
  const ctx = await crearApp();
  await crearAdmin(ctx);
  assert.throws(() => ctx.deps.db.exec("UPDATE audit_log SET action = 'x'"), /solo anexar/);
  assert.throws(() => ctx.deps.db.exec('DELETE FROM audit_log'), /solo anexar/);
});

test('el límite del historial se acota', async () => {
  const ctx = await crearApp();
  const admin = await crearAdmin(ctx);
  const r = await ctx.app.inject({ method: 'GET', url: '/audit?limit=100000', headers: { cookie: admin.cookie } });
  assert.equal(r.statusCode, 200);
  assert.ok(r.json().entries.length <= 200);
});
