import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir } from '../helpers.js';

// Historia 7: el administrador gestiona ediciones, categorías y sedes sin revisión editorial (FR-025).

test('FR-025: el administrador crea y corrige categorías y sedes; queda en el historial y sin aviso público', async () => {
  const ctx = await crearApp();
  const cat = await pedir(ctx, 'admin', 'POST', '/panel/categories', { name: 'Teatro' });
  assert.equal(cat.status, 201);
  const sede = await pedir(ctx, 'admin', 'POST', '/panel/venues', { name: 'Sala de Ejemplo', kind: 'place', address: 'Calle 1' });
  assert.equal(sede.status, 201);
  const corregida = await pedir(ctx, 'admin', 'PUT', `/panel/venues/${sede.json.id}`, { address: 'Calle 2' });
  assert.equal(corregida.status, 200);
  assert.equal(corregida.json.address, 'Calle 2');
  assert.equal(corregida.json.name, 'Sala de Ejemplo');

  const publicas = await pedir(ctx, null, 'GET', '/venues');
  assert.equal(publicas.json.items[0].address, 'Calle 2');
  const historial = await ctx.services.db.query("SELECT action FROM history WHERE entity_type IN ('category', 'venue') ORDER BY id");
  assert.deepEqual(historial.map((h) => h.action), ['catalog.category.created', 'catalog.venue.created', 'catalog.venue.updated']);
  assert.equal((await ctx.services.db.query('SELECT COUNT(*) AS n FROM notices'))[0].n, '0');
});

test('FR-025: solo el administrador gestiona catálogos, también con solicitudes directas', async () => {
  const ctx = await crearApp();
  for (const quien of ['editor', 'publicador', 'usuario', 'acceso']) {
    const r = await pedir(ctx, quien, 'POST', '/panel/categories', { name: `Intento de ${quien}` });
    assert.equal(r.status, 403, quien);
    assert.equal(r.json.missingRole, 'administrador');
  }
  assert.equal((await pedir(ctx, null, 'POST', '/panel/categories', { name: 'X' })).status, 401);
});

test('los nombres son únicos sin distinguir mayúsculas ni tildes, y una sede puede ser un recorrido', async () => {
  const ctx = await crearApp();
  await pedir(ctx, 'admin', 'POST', '/panel/categories', { name: 'Música' });
  const repetida = await pedir(ctx, 'admin', 'POST', '/panel/categories', { name: 'musica' });
  assert.equal(repetida.status, 409);
  const recorrido = await pedir(ctx, 'admin', 'POST', '/panel/venues', { name: 'Recorrido', kind: 'route', routeDescription: 'Tramo A–B' });
  assert.equal(recorrido.json.kind, 'route');
  assert.equal((await pedir(ctx, 'admin', 'POST', '/panel/venues', { name: 'Mal', kind: 'barco' })).status, 422);
  assert.equal((await pedir(ctx, 'admin', 'POST', '/panel/editions', { name: 'Edición 2026', year: 2026 })).status, 201);
  assert.equal((await pedir(ctx, null, 'GET', '/editions')).json.items[0].name, 'Edición 2026');
});

test('fallo cerrado: si identidad no responde, el panel no hace nada y la consulta pública sigue', async () => {
  const ctx = await crearApp();
  ctx.identidad.estado.caida = true;
  const r = await pedir(ctx, 'admin', 'POST', '/panel/categories', { name: 'Teatro' });
  assert.equal(r.status, 503);
  assert.equal(r.json.error, 'identity_unavailable');
  assert.equal((await pedir(ctx, null, 'GET', '/agenda')).status, 200);
  assert.equal((await pedir(ctx, null, 'GET', '/categories')).json.items.length, 0);
});
