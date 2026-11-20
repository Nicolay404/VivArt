import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir, catalogos, publicada, relojMovible } from '../helpers.js';

// Historia 2: «¿Qué hay ahora?» (FR-005 a FR-007; SC-004).

test('FR-005 a FR-007, SC-004: franjas abiertas, próximas, sin canceladas y «hora de inicio pasada» con el reloj común', async () => {
  const reloj = relojMovible('2026-11-21T18:00:00-05:00');
  const ctx = await crearApp({ reloj });
  const c = await catalogos(ctx);
  await publicada(ctx, c, {
    title: 'Exposición',
    functions: [],
    slots: [{ venueId: c.museo.id, from: '2026-11-20', to: '2026-11-30', opens: '10:00', closes: '19:30' }],
  });
  const obra = await publicada(ctx, c, {
    title: 'Dos funciones el mismo día',
    functions: [
      { date: '2026-11-21', startTime: '17:00', venueId: c.museo.id },
      { date: '2026-11-21', startTime: '20:00', venueId: c.museo.id },
    ],
  });
  const cancelar = await publicada(ctx, c, { title: 'Cancelada', functions: [{ date: '2026-11-21', startTime: '21:00', venueId: c.plaza.id }] });
  const fid = cancelar.publishedContent.functions[0].id;
  await pedir(ctx, 'publicador', 'POST', `/panel/functions/${fid}/cancel`, { reason: 'Lluvia', notice: 'Se cancela por lluvia.' });

  const r = (await pedir(ctx, null, 'GET', '/now')).json;
  assert.deepEqual(r.reference, { now: '2026-11-21T23:00:00.000Z', date: '2026-11-21', time: '18:00', timeZone: 'America/Guayaquil', fixed: true });
  assert.deepEqual(r.openSlots.map((x) => x.title), ['Exposición']);
  assert.deepEqual(r.upcoming.map((x) => [x.title, x.function.startTime]), [['Dos funciones el mismo día', '20:00']]);
  assert.deepEqual(r.startPassed.map((x) => [x.title, x.function.timeStatus]), [['Dos funciones el mismo día', 'start_passed']]);
  assert.deepEqual(r.inProgress, []);
  assert.ok(!JSON.stringify(r).includes('Cancelada'));

  // La ficha también usa el mismo reloj y nunca dice «en curso» sin hora de fin
  const ficha = (await pedir(ctx, null, 'GET', `/activities/${obra.id}`)).json;
  assert.deepEqual(ficha.functions.map((f) => f.timeStatus), ['start_passed', 'upcoming']);

  // Más tarde la franja ya cerró
  reloj.fijar('2026-11-21T19:45:00-05:00');
  assert.deepEqual((await pedir(ctx, null, 'GET', '/now')).json.openSlots, []);
});

test('RC-07: el reloj fijado por variable solo vale fuera de producción', async () => {
  const { loadConfig } = await import('../../src/config.js');
  const demo = loadConfig({ CLOCK_FIXED: '2026-11-21T19:30:00-05:00' });
  assert.equal(demo.clock().toISOString(), '2026-11-22T00:30:00.000Z');
  assert.equal(demo.clockFixed, true);
  const prod = loadConfig({ NODE_ENV: 'production', CLOCK_FIXED: '2026-11-21T19:30:00-05:00' });
  assert.equal(prod.clockFixed, false);
  assert.equal(prod.clockIgnored, true);
  assert.ok(Math.abs(prod.clock().getTime() - Date.now()) < 5000);
});
