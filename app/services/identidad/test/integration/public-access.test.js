import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../helpers.js';

test('FR-001: la consulta pública no exige sesión: /health responde sin identificarse', async () => {
  const { app } = await crearApp();
  const r = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().status, 'ok');
});

test('FR-003: se pide identificación solo cuando la acción lo requiere (rutas protegidas dan 401)', async () => {
  const { app } = await crearApp();
  for (const url of ['/me', '/users', '/audit', '/auth/resume']) {
    const r = await app.inject({ method: 'GET', url });
    assert.equal(r.statusCode, 401, url);
    assert.equal(r.json().error, 'unauthenticated');
  }
});

test('una ruta que no existe responde 404 en JSON, sin detalles internos', async () => {
  const { app } = await crearApp();
  const r = await app.inject({ method: 'GET', url: '/no-existe' });
  assert.equal(r.statusCode, 404);
  assert.equal(r.json().error, 'not_found');
});

test('las rutas internas entre servicios no sirven con una cookie de sesión', async () => {
  const { app } = await crearApp();
  const r = await app.inject({ method: 'POST', url: '/internal/introspect', headers: { 'content-type': 'application/json' }, payload: '{}' });
  assert.equal(r.statusCode, 401);
});
