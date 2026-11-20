import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir, catalogos, publicada } from '../helpers.js';

// API interna para el servicio de participación (spec 05 y 06): estado publicado de una función.

const interna = (ctx, id, clave) =>
  ctx.app.inject({ method: 'GET', url: `/internal/functions/${id}`, headers: clave ? { 'x-service-key': clave } : {} });

test('con credencial de servicio, participación consulta una función publicada; sin ella, 401', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const a = await publicada(ctx, c, { durationMinutes: 75 });
  const fid = a.publishedContent.functions[0].id;

  assert.equal((await interna(ctx, fid)).statusCode, 401);
  assert.equal((await interna(ctx, fid, 'clave-equivocada')).statusCode, 401);
  const r = await interna(ctx, fid, 'clave-de-prueba-solo-para-tests');
  assert.equal(r.statusCode, 200);
  assert.deepEqual(
    (({ activityId, date, startTime, status, activityStatus, durationMinutes }) => ({ activityId, date, startTime, status, activityStatus, durationMinutes }))(r.json()),
    { activityId: a.id, date: '2026-11-21', startTime: '19:00', status: 'scheduled', activityStatus: 'active', durationMinutes: 75 },
  );
  assert.equal((await interna(ctx, 'no-existe', 'clave-de-prueba-solo-para-tests')).statusCode, 404);

  await pedir(ctx, 'publicador', 'POST', `/panel/functions/${fid}/cancel`, { reason: 'x', notice: 'Cancelada.' });
  assert.equal((await interna(ctx, fid, 'clave-de-prueba-solo-para-tests')).json().status, 'cancelled');
});

test('las rutas internas no aceptan la sesión de una persona como credencial', async () => {
  const ctx = await crearApp();
  const r = await ctx.app.inject({ method: 'GET', url: '/internal/functions/x', headers: { cookie: 'vivart_sid=tok-admin' } });
  assert.equal(r.statusCode, 401);
});

test('spec 005: la función interna trae acceso, precio, sede y último aviso; y se consultan varias a la vez', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const a = await publicada(ctx, c, { access: { mode: 'paid', priceUsd: 7.5 } });
  const b = await publicada(ctx, c, { title: 'Otra obra', access: { mode: 'free' } });
  const fa = a.publishedContent.functions[0].id;
  const fb = b.publishedContent.functions[0].id;

  const r = (await interna(ctx, fa, 'clave-de-prueba-solo-para-tests')).json();
  assert.deepEqual(r.access, { mode: 'paid', priceUsd: 7.5 });
  assert.equal(r.venueName, 'Museo de Ejemplo');
  assert.equal(r.latestNotice, null);

  await pedir(ctx, 'publicador', 'POST', `/panel/functions/${fa}/reschedule`, { startTime: '20:00', reason: 'x', notice: 'Pasa a las 20:00.' });
  assert.equal((await interna(ctx, fa, 'clave-de-prueba-solo-para-tests')).json().latestNotice.text, 'Pasa a las 20:00.');

  const varias = await ctx.app.inject({
    method: 'GET',
    url: `/internal/functions?ids=${fa},${fb},no-existe`,
    headers: { 'x-service-key': 'clave-de-prueba-solo-para-tests' },
  });
  assert.deepEqual(varias.json().items.map((f) => [f.id, f.access.mode]), [[fa, 'paid'], [fb, 'free']]);
  assert.equal((await ctx.app.inject({ method: 'GET', url: `/internal/functions?ids=${fa}` })).statusCode, 401);
});
