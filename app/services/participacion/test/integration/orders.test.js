import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir, habilitar, comprar } from '../helpers.js';

// Historia 2: pagar con retención de cupos (FR-007 a FR-012, FR-038; SC-003, SC-015).

const items = [{ functionId: 'f-obra', quantity: 2 }];

test('pagar exige sesión y correo verificado (FR-007)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra');
  assert.equal((await pedir(ctx, null, 'POST', '/orders', { items, acceptedTotalCents: 1000 })).status, 401);
  const r = await pedir(ctx, 'sinVerificar', 'POST', '/orders', { items, acceptedTotalCents: 1000 });
  assert.equal(r.status, 403);
  assert.equal(r.json.error, 'email_not_verified');
});

test('el pedido retiene el cupo 10 minutos con el total validado', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra', 2);
  const r = await comprar(ctx, 'usuaria', items);
  assert.equal(r.status, 201);
  assert.equal(r.json.status, 'pending');
  assert.equal(r.json.totalCents, 1000);
  assert.equal(new Date(r.json.expiresAt) - new Date(r.json.createdAt), 10 * 60000);
  const otro = await comprar(ctx, 'usuario2', [{ functionId: 'f-obra', quantity: 1 }]);
  assert.equal(otro.status, 409);
  assert.equal(otro.json.error, 'sold_out');
});

test('si el precio cambió, se pide revisar el carrito; el pedido vigente conserva su total (FR-008, FR-010)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra');
  const pedido = await comprar(ctx, 'usuaria', items);
  ctx.programacion.funciones.get('f-obra').access.priceUsd = 6;

  const r = await pedir(ctx, 'usuario2', 'POST', '/orders', { items, acceptedTotalCents: 1000 });
  assert.equal(r.status, 409);
  assert.equal(r.json.error, 'cart_changed');
  assert.equal(r.json.quote.totalCents, 1200);

  const mio = await pedir(ctx, 'usuaria', 'GET', `/orders/${pedido.json.id}`);
  assert.equal(mio.json.totalCents, 1000, 'el pedido pendiente conserva el total validado');
});

test('la retención vencida libera el cupo y el pedido se ve vencido (FR-009)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra', 2);
  const pedido = await comprar(ctx, 'usuaria', items);
  ctx.reloj.avanzar(10);
  assert.equal((await pedir(ctx, 'usuaria', 'GET', `/orders/${pedido.json.id}`)).json.status, 'expired');
  assert.equal((await comprar(ctx, 'usuario2', items)).status, 201, 'el cupo volvió a estar disponible');
});

test('el plazo nuevo solo aplica a pedidos nuevos y solo lo cambia el administrador (FR-012)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra');
  const antes = await comprar(ctx, 'usuaria', [{ functionId: 'f-obra', quantity: 1 }]);
  assert.equal((await pedir(ctx, 'publicador', 'PUT', '/panel/settings', { holdMinutes: 5, saleCloseMinutes: 30 })).status, 403);
  assert.equal((await pedir(ctx, 'admin', 'PUT', '/panel/settings', { holdMinutes: 5, saleCloseMinutes: 30 })).status, 200);
  const despues = await comprar(ctx, 'usuario2', [{ functionId: 'f-obra', quantity: 1 }]);
  assert.equal(new Date(antes.json.expiresAt) - new Date(antes.json.createdAt), 10 * 60000);
  assert.equal(new Date(despues.json.expiresAt) - new Date(despues.json.createdAt), 5 * 60000);
});

test('un pedido de siete unidades se rechaza (SC-015)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra');
  await habilitar(ctx, 'f-danza');
  const r = await pedir(ctx, 'usuaria', 'POST', '/orders', {
    items: [
      { functionId: 'f-obra', quantity: 4 },
      { functionId: 'f-danza', quantity: 3 },
    ],
    acceptedTotalCents: 4250,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error, 'limit_exceeded');
});

test('nadie ve pedidos de otra cuenta (SC-012)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra');
  const pedido = await comprar(ctx, 'usuaria', items);
  assert.equal((await pedir(ctx, 'usuario2', 'GET', `/orders/${pedido.json.id}`)).status, 404);
  assert.deepEqual((await pedir(ctx, 'usuario2', 'GET', '/orders')).json.items, []);
});
