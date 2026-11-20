import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir, habilitar } from '../helpers.js';

// Historia 1: armar el carrito (FR-001 a FR-006, FR-038, FR-039, FR-041; SC-001, SC-015, SC-017).

test('cotiza en USD con el precio de la actividad y advierte cruces solo con fin conocido', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra');
  await habilitar(ctx, 'f-danza');
  await habilitar(ctx, 'f-sin-fin');
  const r = await pedir(ctx, null, 'POST', '/cart/quote', {
    items: [
      { functionId: 'f-obra', quantity: 2 },
      { functionId: 'f-danza', quantity: 1 },
      { functionId: 'f-sin-fin', quantity: 1 },
    ],
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.totalCents, 2 * 500 + 750 + 500);
  assert.equal(r.json.totalUnits, 4);
  // obra 19:00–20:30 y danza 20:00–21:00 se cruzan; la función sin hora de fin no se advierte (RC-02).
  assert.deepEqual(r.json.overlaps, [['f-obra', 'f-danza']]);
});

test('gratuitas, sin precio, sin venta habilitada o inexistentes no se venden (SC-001)', async () => {
  const ctx = await crearApp();
  const r = await pedir(ctx, null, 'POST', '/cart/quote', {
    items: [
      { functionId: 'f-gratis', quantity: 1 },
      { functionId: 'f-sin-precio', quantity: 1 },
      { functionId: 'f-pendiente', quantity: 1 },
      { functionId: 'f-obra', quantity: 1 },
      { functionId: 'no-existe', quantity: 1 },
    ],
  });
  assert.equal(r.status, 200);
  assert.deepEqual(
    r.json.items.map((i) => [i.functionId, i.sellable, i.reason]),
    [
      ['f-gratis', false, 'free'],
      ['f-sin-precio', false, 'no_price'],
      ['f-pendiente', false, 'no_price'],
      ['f-obra', false, 'not_enabled'],
      ['no-existe', false, 'not_found'],
    ],
  );
  assert.equal(r.json.totalCents, 0);
});

test('máximo seis entradas por pedido aunque sean de funciones distintas, y respeta el cupo (SC-015)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra', 3);
  await habilitar(ctx, 'f-danza', 10);
  const r = await pedir(ctx, null, 'POST', '/cart/quote', {
    items: [
      { functionId: 'f-obra', quantity: 5 },
      { functionId: 'f-danza', quantity: 5 },
    ],
  });
  assert.equal(r.json.items[0].quantity, 3, 'se ajusta al cupo de la función');
  assert.equal(r.json.items[1].quantity, 3, 'y al límite de seis en total');
  assert.equal(r.json.totalUnits, 6);
  assert.equal(r.json.changed, true);
});

test('la venta cierra 30 minutos antes del inicio y una función cancelada no se vende (FR-039, FR-031)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-pronto');
  await habilitar(ctx, 'f-cancelable');
  ctx.programacion.funciones.get('f-cancelable').status = 'cancelled';
  const r = await pedir(ctx, null, 'POST', '/cart/quote', {
    items: [
      { functionId: 'f-pronto', quantity: 1 },
      { functionId: 'f-cancelable', quantity: 1 },
    ],
  });
  assert.deepEqual(r.json.items.map((i) => i.reason), ['sale_closed', 'function_cancelled']);
});

test('el estado de venta público no muestra cupos y retenidas cuentan como agotadas (FR-041, SC-017)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra', 1);
  await habilitar(ctx, 'f-pronto', 5);
  let r = await pedir(ctx, null, 'GET', '/sale-status?functionIds=f-obra,f-pronto,f-gratis');
  assert.deepEqual(r.json.items, [
    { functionId: 'f-obra', state: 'available' },
    { functionId: 'f-pronto', state: 'closed' },
  ]);
  assert.doesNotMatch(r.body, /capacity|cupo/);

  const cot = await pedir(ctx, null, 'POST', '/cart/quote', { items: [{ functionId: 'f-obra', quantity: 1 }] });
  await pedir(ctx, 'usuaria', 'POST', '/orders', { items: [{ functionId: 'f-obra', quantity: 1 }], acceptedTotalCents: cot.json.totalCents });
  r = await pedir(ctx, null, 'GET', '/sale-status?functionIds=f-obra');
  assert.deepEqual(r.json.items, [{ functionId: 'f-obra', state: 'sold_out' }]);

  ctx.reloj.avanzar(11);
  r = await pedir(ctx, null, 'GET', '/sale-status?functionIds=f-obra');
  assert.deepEqual(r.json.items, [{ functionId: 'f-obra', state: 'available' }], 'al vencer la retención vuelve a estar disponible');
});

test('si programación no responde, no se cotiza: no se pudo verificar (RNF-07)', async () => {
  const ctx = await crearApp();
  ctx.programacion.estado.caida = true;
  const r = await pedir(ctx, null, 'POST', '/cart/quote', { items: [{ functionId: 'f-obra', quantity: 1 }] });
  assert.equal(r.status, 503);
  assert.equal(r.json.error, 'not_verifiable');
});
