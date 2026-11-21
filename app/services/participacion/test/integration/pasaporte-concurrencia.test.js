import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../helpers.js';
import { qrActivo, reclamar } from '../pasaporte-ayuda.js';

// Spec 006, RC-05 y RNF-06: un sello por persona y función, también con solicitudes simultáneas reales contra PostgreSQL.

test('SC-002: veinte solicitudes simultáneas de la misma persona dan un solo sello, el mismo en todas las respuestas', async () => {
  const ctx = await crearApp();
  const { ref } = await qrActivo(ctx, 'f-obra');
  const respuestas = await Promise.all(Array.from({ length: 20 }, () => reclamar(ctx, 'usuaria', ref)));
  for (const r of respuestas) assert.ok([200, 201].includes(r.status), `${r.status} ${r.body}`);
  assert.equal(respuestas.filter((r) => r.json.created).length, 1, 'exactamente una solicitud crea el sello');
  assert.equal(new Set(respuestas.map((r) => r.json.stamp.id)).size, 1, 'todas devuelven el mismo sello');
  const filas = await ctx.services.db.query("SELECT COUNT(*)::int AS n FROM stamps WHERE user_id = 'u-usuaria' AND function_id = 'f-obra'");
  assert.equal(filas[0].n, 1);
});

test('dos personas distintas con el mismo enlace reciben cada una su propio sello', async () => {
  const ctx = await crearApp();
  const { ref } = await qrActivo(ctx, 'f-obra');
  const [a, b] = await Promise.all([reclamar(ctx, 'usuaria', ref), reclamar(ctx, 'usuario2', ref)]);
  assert.deepEqual([a.status, b.status], [201, 201]);
  assert.notEqual(a.json.stamp.id, b.json.stamp.id);
});
