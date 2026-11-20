import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, crearUsuario, crearAdmin, json } from '../helpers.js';

const PROHIBIDOS = ['title', 'titulo', 'text', 'texto', 'author', 'autor', 'draft', 'borrador', 'content', 'contenido'];

test('SC-006: el rechazo por permisos indica el rol que falta y no revela contenido', async () => {
  const ctx = await crearApp();
  const admin = await crearAdmin(ctx);
  const editor = await crearUsuario(ctx, 'ed@vivart.test');
  await ctx.app.inject(json('PUT', `/users/${editor.id}/roles/editor`, undefined, admin.cookie));

  const r = await ctx.app.inject({ method: 'GET', url: '/users', headers: { cookie: editor.cookie } });
  assert.equal(r.statusCode, 403);
  const cuerpo = r.json();
  assert.deepEqual(Object.keys(cuerpo).sort(), ['acceptedRoles', 'error', 'message', 'missingRole', 'reason']);
  assert.equal(cuerpo.error, 'forbidden');
  assert.equal(cuerpo.missingRole, 'administrador');
  assert.deepEqual(cuerpo.acceptedRoles, ['administrador']);
  assert.match(cuerpo.message, /falta el rol de administrador/i);
  for (const clave of PROHIBIDOS) assert.ok(!(clave in cuerpo), clave);
});

test('FR-023: authorize sobre un borrador ajeno no devuelve ningún dato del borrador', async () => {
  const ctx = await crearApp();
  const admin = await crearAdmin(ctx);
  const editor = await crearUsuario(ctx, 'dueno@vivart.test');
  await ctx.app.inject(json('PUT', `/users/${editor.id}/roles/editor`, undefined, admin.cookie));
  const r = await ctx.app.inject({
    method: 'POST',
    url: '/internal/authorize',
    headers: { 'content-type': 'application/json', 'x-service-key': ctx.claveServicio },
    payload: JSON.stringify({
      sessionToken: editor.cookie.split('=')[1],
      action: 'draft.edit_own',
      context: { ownerId: 'otra-persona', titulo: 'Título secreto', texto: 'Texto secreto', autor: 'Autora' },
    }),
  });
  const texto = JSON.stringify(r.json());
  assert.equal(r.json().allowed, false);
  assert.ok(!/secreto|Autora/.test(texto));
  assert.deepEqual(Object.keys(r.json()).sort(), ['acceptedRoles', 'allowed', 'missingRole', 'reason']);
});

test('un usuario registrado sin roles internos recibe el rol que falta, no un error genérico', async () => {
  const ctx = await crearApp();
  const u = await crearUsuario(ctx, 'normal@vivart.test');
  const r = await ctx.app.inject({ method: 'GET', url: '/audit', headers: { cookie: u.cookie } });
  assert.equal(r.statusCode, 403);
  assert.equal(r.json().missingRole, 'administrador');
});

test('los errores 500 no filtran detalles internos', async () => {
  const ctx = await crearApp();
  ctx.deps.repos.users.findByEmail = () => { throw new Error('detalle interno secreto de la base de datos'); };
  const r = await ctx.app.inject(json('POST', '/auth/login', { email: 'a@b.co', password: 'una clave larga de prueba' }));
  assert.equal(r.statusCode, 500);
  assert.ok(!/secreto|base de datos/.test(r.body));
});
