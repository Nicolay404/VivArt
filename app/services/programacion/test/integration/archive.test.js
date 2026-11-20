import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir, catalogos, contenido, publicada, relojMovible } from '../helpers.js';

// Historia 8: archivar (FR-027 a FR-029; SC-011).

test('FR-027, FR-028: archivar exige cancelar antes las funciones vigentes; sale de la Agenda y conserva el historial', async () => {
  const ctx = await crearApp({ reloj: relojMovible('2026-11-20T09:00:00-05:00') });
  const c = await catalogos(ctx);
  const a = await publicada(ctx, c);
  const fid = a.publishedContent.functions[0].id;

  const conVigentes = await pedir(ctx, 'admin', 'POST', `/panel/activities/${a.id}/archive`);
  assert.equal(conVigentes.status, 409);
  assert.equal(conVigentes.json.error, 'has_scheduled_functions');
  assert.deepEqual(conVigentes.json.functionIds, [fid]);

  await pedir(ctx, 'admin', 'POST', `/panel/functions/${fid}/cancel`, { reason: 'Se retira', notice: 'Función cancelada.' });
  const archivada = await pedir(ctx, 'admin', 'POST', `/panel/activities/${a.id}/archive`);
  assert.equal(archivada.status, 200);
  assert.equal(archivada.json.status, 'archived');
  assert.deepEqual((await pedir(ctx, null, 'GET', '/agenda')).json.items, []);
  assert.equal((await pedir(ctx, null, 'GET', `/activities/${a.id}`)).status, 404);

  // SC-011: se conservan la actividad, sus funciones, avisos e historial
  const panel = (await pedir(ctx, 'admin', 'GET', `/panel/activities/${a.id}`)).json;
  assert.equal(panel.functions.length, 1);
  assert.equal(panel.notices.length, 1);
  const acciones = (await pedir(ctx, 'admin', 'GET', `/panel/activities/${a.id}/history`)).json.entries.map((e) => e.action);
  assert.ok(acciones.includes('activity.archived') && acciones.includes('function.cancelled'));
  // una archivada ya no se edita
  assert.equal((await pedir(ctx, 'admin', 'PUT', `/panel/activities/${a.id}/draft`, { version: panel.version, content: {} })).status, 409);
});

test('FR-028: solo el administrador archiva', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const a = await publicada(ctx, c);
  for (const quien of ['editor', 'publicador', 'usuario']) {
    assert.equal((await pedir(ctx, quien, 'POST', `/panel/activities/${a.id}/archive`)).status, 403, quien);
  }
});

test('FR-029, SC-011: nunca se borra una actividad publicada; un borrador nunca publicado sí', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const a = await publicada(ctx, c);
  const borrar = await pedir(ctx, 'admin', 'DELETE', `/panel/activities/${a.id}`);
  assert.equal(borrar.status, 409);
  assert.equal(borrar.json.error, 'already_published');
  assert.equal((await pedir(ctx, null, 'GET', `/activities/${a.id}`)).status, 200);

  const borrador = (await pedir(ctx, 'editor', 'POST', '/panel/activities', { content: contenido(c) })).json;
  assert.equal((await pedir(ctx, 'editora2', 'DELETE', `/panel/activities/${borrador.id}`)).status, 403);
  assert.equal((await pedir(ctx, 'editor', 'DELETE', `/panel/activities/${borrador.id}`)).status, 204);
  assert.equal((await pedir(ctx, 'editor', 'GET', `/panel/activities/${borrador.id}`)).status, 404);
  const quedo = await ctx.services.db.query("SELECT action FROM history WHERE entity_id = $1 AND action = 'activity.deleted'", [borrador.id]);
  assert.equal(quedo.length, 1, 'el borrado queda en el historial');
});
