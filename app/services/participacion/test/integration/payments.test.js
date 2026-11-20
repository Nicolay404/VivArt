import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir, habilitar, comprar, comprarYConfirmar, entradas } from '../helpers.js';

// Historia 3: recibir las entradas (FR-014 a FR-018, FR-036, FR-040; SC-004, SC-005, SC-012, SC-013).

test('un pago confirmado de tres emite tres entradas con QR y código distintos (SC-004)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra');
  const pedido = await comprarYConfirmar(ctx, 'usuaria', [{ functionId: 'f-obra', quantity: 3 }]);
  assert.equal(pedido.status, 'confirmed');
  const mias = await entradas(ctx, 'usuaria');
  assert.equal(mias.length, 3);
  assert.equal(new Set(mias.map((t) => t.qrSvg)).size, 3);
  assert.equal(new Set(mias.map((t) => t.code)).size, 3);
  assert.ok(mias.every((t) => t.state === 'valid' && t.qrSvg.startsWith('<svg') && /^[2-9A-Z]{10}$/.test(t.code)));
});

test('una confirmación repetida, también simultánea, no emite más entradas (FR-015)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra');
  const pedido = await comprar(ctx, 'usuaria', [{ functionId: 'f-obra', quantity: 2 }]);
  const confirmar = () => pedir(ctx, 'usuaria', 'POST', `/orders/${pedido.json.id}/simulate-payment`, { result: 'confirmed', reference: 'pago-1' });
  const resultados = await Promise.all([confirmar(), confirmar(), confirmar()]);
  assert.ok(resultados.every((r) => r.status === 200 && r.json.status === 'confirmed'));
  assert.equal((await confirmar()).json.status, 'confirmed');
  assert.equal((await entradas(ctx, 'usuaria')).length, 2);
});

test('un pago fallido libera el cupo (FR-009)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra', 1);
  const pedido = await comprar(ctx, 'usuaria', [{ functionId: 'f-obra', quantity: 1 }]);
  const r = await pedir(ctx, 'usuaria', 'POST', `/orders/${pedido.json.id}/simulate-payment`, { result: 'failed' });
  assert.equal(r.json.status, 'failed');
  assert.equal((await comprar(ctx, 'usuario2', [{ functionId: 'f-obra', quantity: 1 }])).status, 201);
});

test('un pago tardío pasa a revisión sin entradas ni cupo recuperado (FR-016, SC-005)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra', 1);
  const pedido = await comprar(ctx, 'usuaria', [{ functionId: 'f-obra', quantity: 1 }]);
  const r = await pedir(ctx, 'usuaria', 'POST', `/orders/${pedido.json.id}/simulate-payment`, { result: 'confirmed_late' });
  assert.equal(r.json.status, 'in_review');
  assert.equal((await entradas(ctx, 'usuaria')).length, 0);
  const incidencias = (await pedir(ctx, 'admin', 'GET', '/panel/incidents')).json.items;
  assert.equal(incidencias.length, 1);
  assert.equal(incidencias[0].orderId, pedido.json.id);

  // Un pago confirmado después de que la retención venció también es tardío.
  const ctx2 = await crearApp();
  await habilitar(ctx2, 'f-obra');
  const otro = await comprar(ctx2, 'usuaria', [{ functionId: 'f-obra', quantity: 1 }]);
  ctx2.reloj.avanzar(11);
  const tarde = await pedir(ctx2, 'usuaria', 'POST', `/orders/${otro.json.id}/simulate-payment`, { result: 'confirmed' });
  assert.equal(tarde.json.status, 'in_review');
});

test('un pedido de una función cancelada ya no se puede pagar (FR-031)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-cancelable');
  const pedido = await comprar(ctx, 'usuaria', [{ functionId: 'f-cancelable', quantity: 1 }]);
  ctx.programacion.funciones.get('f-cancelable').status = 'cancelled';
  const r = await pedir(ctx, 'usuaria', 'POST', `/orders/${pedido.json.id}/simulate-payment`, { result: 'confirmed' });
  assert.equal(r.status, 409);
  assert.equal(r.json.error, 'function_cancelled');
  assert.equal((await pedir(ctx, 'usuaria', 'GET', `/orders/${pedido.json.id}`)).json.status, 'failed');
  assert.equal((await entradas(ctx, 'usuaria')).length, 0);
});

test('el simulador no existe en producción ni pide datos de tarjeta (SC-013, SC-011)', async () => {
  const ctx = await crearApp({ variables: { NODE_ENV: 'production' } });
  await habilitar(ctx, 'f-obra');
  const pedido = await comprar(ctx, 'usuaria', [{ functionId: 'f-obra', quantity: 1 }]);
  assert.equal(pedido.json.simulatorAvailable, false);
  const r = await pedir(ctx, 'usuaria', 'POST', `/orders/${pedido.json.id}/simulate-payment`, { result: 'confirmed' });
  assert.equal(r.status, 404);
  assert.doesNotMatch(JSON.stringify(pedido.json), /card|tarjeta/i);
});

test('Mis entradas muestra solo las propias y, si programación no responde, «sin confirmar» (SC-012, RNF-07)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra');
  await comprarYConfirmar(ctx, 'usuaria', [{ functionId: 'f-obra', quantity: 1 }]);
  assert.equal((await entradas(ctx, 'usuario2')).length, 0);
  ctx.programacion.estado.caida = true;
  const r = await pedir(ctx, 'usuaria', 'GET', '/tickets');
  assert.equal(r.status, 200);
  assert.equal(r.json.verified, false);
  assert.equal(r.json.items[0].state, 'unverified');
});
