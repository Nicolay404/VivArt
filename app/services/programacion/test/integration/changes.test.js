import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir, catalogos, publicada } from '../helpers.js';
import { createParticipacionClient } from '../../src/clients/participacion.js';

// Historia 5: reprogramar o cancelar con aviso (FR-015 a FR-019; SC-007).

test('FR-015, FR-016, SC-007: reprogramar (también mover de sede) publica un aviso y registra quién y cuándo', async () => {
  const ctx = await crearApp({ participacion: createParticipacionClient({ url: '' }) });
  const c = await catalogos(ctx);
  const a = await publicada(ctx, c);
  const fid = a.publishedContent.functions[0].id;

  const sinAviso = await pedir(ctx, 'publicador', 'POST', `/panel/functions/${fid}/reschedule`, { startTime: '20:00' });
  assert.equal(sinAviso.status, 422);
  assert.ok(sinAviso.json.fields.reason && sinAviso.json.fields.notice);

  const r = await pedir(ctx, 'publicador', 'POST', `/panel/functions/${fid}/reschedule`, {
    date: '2026-11-22',
    startTime: '20:00',
    venueId: c.plaza.id,
    reason: 'La sala no está disponible',
    notice: 'La función pasa al domingo 22 a las 20:00 en la Plaza de Ejemplo.',
  });
  assert.equal(r.status, 200);
  assert.deepEqual([r.json.function.date, r.json.function.startTime, r.json.function.venueId], ['2026-11-22', '20:00', c.plaza.id]);
  // FR-017: el conteo de entradas se informa como no disponible (participación aún no existe), sin inventar ceros
  assert.deepEqual([r.json.impact.available, r.json.impact.soldTickets], [false, null]);

  const ficha = (await pedir(ctx, null, 'GET', `/activities/${a.id}`)).json;
  assert.equal(ficha.functions[0].venue.name, 'Plaza de Ejemplo');
  assert.equal(ficha.notices[0].kind, 'rescheduled');
  assert.ok(!JSON.stringify(ficha).includes('La sala no está disponible'));

  const historial = (await pedir(ctx, 'publicador', 'GET', `/panel/activities/${a.id}/history`)).json.entries;
  const cambio = historial.find((e) => e.action === 'function.rescheduled');
  assert.equal(cambio.actorId, 'u-publicador');
  assert.equal(cambio.details.venueChanged, true);
  assert.ok(cambio.at);

  // Publicar después una revisión no deshace la reprogramación
  const panel = (await pedir(ctx, 'editor', 'GET', `/panel/activities/${a.id}`)).json;
  const v = (await pedir(ctx, 'editor', 'PUT', `/panel/activities/${a.id}/draft`, { version: panel.version, content: { ...panel.publishedContent, description: 'Nueva descripción' } })).json.version;
  const pub = await pedir(ctx, 'publicador', 'POST', `/panel/activities/${a.id}/publish`, { version: v });
  assert.equal(pub.status, 200, pub.body);
  assert.equal((await pedir(ctx, null, 'GET', `/activities/${a.id}`)).json.functions[0].date, '2026-11-22');
});

test('FR-015, FR-027: cancelar con motivo y aviso; la función queda cancelada, visible con su aviso', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const a = await publicada(ctx, c);
  const fid = a.publishedContent.functions[0].id;
  const r = await pedir(ctx, 'admin', 'POST', `/panel/functions/${fid}/cancel`, { reason: 'Enfermedad', notice: 'Función cancelada.' });
  assert.equal(r.status, 200);
  assert.equal(r.json.function.status, 'cancelled');
  const ficha = (await pedir(ctx, null, 'GET', `/activities/${a.id}`)).json;
  assert.deepEqual([ficha.functions[0].status, ficha.functions[0].timeStatus, ficha.notices[0].kind], ['cancelled', 'cancelled', 'cancelled']);
  assert.equal((await pedir(ctx, 'admin', 'POST', `/panel/functions/${fid}/cancel`, { reason: 'x', notice: 'y' })).status, 409);
});

test('FR-017: el impacto se consulta antes de confirmar; con participación disponible se muestran sus cifras', async () => {
  const participacion = { impact: async () => ({ available: true, soldTickets: 12, pendingOrders: 3, message: 'ok' }) };
  const ctx = await crearApp({ participacion });
  const c = await catalogos(ctx);
  const a = await publicada(ctx, c);
  const fid = a.publishedContent.functions[0].id;
  const r = await pedir(ctx, 'publicador', 'GET', `/panel/functions/${fid}/impact`);
  assert.deepEqual([r.json.available, r.json.soldTickets, r.json.pendingOrders], [true, 12, 3]);
  assert.equal((await pedir(ctx, 'editor', 'GET', `/panel/functions/${fid}/impact`)).status, 403);
});

test('solo publicador y administrador reprograman o cancelan; el editor no, ni por solicitud directa', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const a = await publicada(ctx, c);
  const fid = a.publishedContent.functions[0].id;
  for (const quien of ['editor', 'usuario', 'acceso']) {
    const r = await pedir(ctx, quien, 'POST', `/panel/functions/${fid}/cancel`, { reason: 'x', notice: 'y' });
    assert.equal(r.status, 403, quien);
  }
  assert.equal((await pedir(ctx, 'publicador', 'POST', '/panel/functions/no-existe/cancel', { reason: 'x', notice: 'y' })).status, 404);
});

test('spec 005, FR-030: con entradas vendidas solo cancela el administrador; reprogramar sigue siendo del publicador', async () => {
  const conVentas = { impact: async () => ({ available: true, soldTickets: 0, pendingOrders: 0, issuedTickets: 3, message: 'ok' }) };
  const ctx = await crearApp({ participacion: conVentas });
  const c = await catalogos(ctx);
  const a = await publicada(ctx, c);
  const fid = a.publishedContent.functions[0].id;

  const r = await pedir(ctx, 'publicador', 'POST', `/panel/functions/${fid}/cancel`, { reason: 'x', notice: 'Cancelada.' });
  assert.equal(r.status, 403);
  assert.equal(r.json.missingRole, 'administrador');
  const re = await pedir(ctx, 'publicador', 'POST', `/panel/functions/${fid}/reschedule`, { startTime: '21:00', reason: 'x', notice: 'Pasa a las 21:00.' });
  assert.equal(re.status, 200, 'reprogramar con ventas lo puede hacer el publicador (las entradas siguen válidas)');
  assert.equal((await pedir(ctx, 'admin', 'POST', `/panel/functions/${fid}/cancel`, { reason: 'x', notice: 'Cancelada.' })).status, 200);
});

test('spec 005, FR-030: si no se puede saber si hay ventas, el publicador no cancela (fallo cerrado)', async () => {
  const ctx = await crearApp({ participacion: createParticipacionClient({ url: '' }) });
  const c = await catalogos(ctx);
  const a = await publicada(ctx, c);
  const fid = a.publishedContent.functions[0].id;
  assert.equal((await pedir(ctx, 'publicador', 'POST', `/panel/functions/${fid}/cancel`, { reason: 'x', notice: 'y' })).status, 403);
  assert.equal((await pedir(ctx, 'admin', 'POST', `/panel/functions/${fid}/cancel`, { reason: 'x', notice: 'y' })).status, 200);
});

test('spec 005, FR-030: sin ventas el publicador sí cancela', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const a = await publicada(ctx, c);
  const fid = a.publishedContent.functions[0].id;
  assert.equal((await pedir(ctx, 'publicador', 'POST', `/panel/functions/${fid}/cancel`, { reason: 'x', notice: 'y' })).status, 200);
});
