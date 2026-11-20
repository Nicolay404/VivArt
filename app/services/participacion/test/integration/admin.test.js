import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir, habilitar, comprar, comprarYConfirmar, entradas } from '../helpers.js';

// Historias 4 y 6: administración de la venta e impacto de una cancelación (FR-019 a FR-022, FR-030 a FR-033,
// FR-037, FR-042; SC-008, SC-010, SC-014, SC-018).

test('solo el administrador configura la venta; publicar no la activa (SC-010)', async () => {
  const ctx = await crearApp();
  for (const quien of ['editor', 'publicador', 'acceso', 'usuaria']) {
    const r = await pedir(ctx, quien, 'PUT', '/panel/functions/f-obra/sale', { capacity: 10, enabled: true });
    assert.equal(r.status, 403, quien);
  }
  const r = await pedir(ctx, 'admin', 'PUT', '/panel/functions/f-obra/sale', { capacity: 10, enabled: true });
  assert.equal(r.status, 200);
  assert.equal(r.json.priceUsd, 5);
});

test('no se habilita la venta de una función gratuita o sin precio (FR-019)', async () => {
  const ctx = await crearApp();
  for (const id of ['f-gratis', 'f-sin-precio', 'f-pendiente']) {
    const r = await pedir(ctx, 'admin', 'PUT', `/panel/functions/${id}/sale`, { capacity: 10, enabled: true });
    assert.equal(r.status, 409, id);
    assert.equal(r.json.error, 'not_sellable');
  }
});

test('el cupo no baja de lo vendido más lo retenido (FR-021)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra', 5);
  await comprarYConfirmar(ctx, 'usuaria', [{ functionId: 'f-obra', quantity: 2 }]);
  await comprar(ctx, 'usuario2', [{ functionId: 'f-obra', quantity: 1 }]);
  const r = await pedir(ctx, 'admin', 'PUT', '/panel/functions/f-obra/sale', { capacity: 2, enabled: true });
  assert.equal(r.status, 409);
  assert.equal(r.json.error, 'capacity_below_committed');
  const resumen = (await pedir(ctx, 'admin', 'PUT', '/panel/functions/f-obra/sale', { capacity: 3, enabled: true })).json;
  assert.equal(resumen.sold, 2);
  assert.equal(resumen.held, 1);
  assert.equal(resumen.orders.length, 2);
});

test('la invalidación exige administrador y motivo, y no repone cupo (FR-037, SC-014)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra', 1);
  await comprarYConfirmar(ctx, 'usuaria', [{ functionId: 'f-obra', quantity: 1 }]);
  const [t] = await entradas(ctx, 'usuaria');
  assert.equal((await pedir(ctx, 'publicador', 'POST', `/panel/tickets/${t.id}/invalidate`, { reason: 'x' })).status, 403);
  assert.equal((await pedir(ctx, 'admin', 'POST', `/panel/tickets/${t.id}/invalidate`, {})).status, 422);
  const r = await pedir(ctx, 'admin', 'POST', `/panel/tickets/${t.id}/invalidate`, { reason: 'Duplicada por error' });
  assert.equal(r.status, 200);
  const [despues] = await entradas(ctx, 'usuaria');
  assert.equal(despues.state, 'invalidated');
  assert.equal(despues.invalidationReason, 'Duplicada por error');
  assert.equal((await comprar(ctx, 'usuario2', [{ functionId: 'f-obra', quantity: 1 }])).json.error, 'sold_out', 'no repone cupo');
});

test('una entrada usada no se invalida (Historia 4, escenario 8)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra');
  await comprarYConfirmar(ctx, 'usuaria', [{ functionId: 'f-obra', quantity: 1 }]);
  const [t] = await entradas(ctx, 'usuaria');
  await pedir(ctx, 'acceso', 'POST', '/access/functions/f-obra/open');
  await pedir(ctx, 'acceso', 'POST', '/access/functions/f-obra/validate', { code: t.code });
  const r = await pedir(ctx, 'admin', 'POST', `/panel/tickets/${t.id}/invalidate`, { reason: 'x' });
  assert.equal(r.status, 409);
  assert.equal(r.json.error, 'already_used');
});

test('la incidencia de pago tardío se resuelve sin emitir entradas (FR-022)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra');
  const pedido = await comprar(ctx, 'usuaria', [{ functionId: 'f-obra', quantity: 1 }]);
  await pedir(ctx, 'usuaria', 'POST', `/orders/${pedido.json.id}/simulate-payment`, { result: 'confirmed_late' });
  const [x] = (await pedir(ctx, 'admin', 'GET', '/panel/incidents')).json.items;
  assert.equal((await pedir(ctx, 'usuaria', 'GET', '/panel/incidents')).status, 403);
  const r = await pedir(ctx, 'admin', 'POST', `/panel/incidents/${x.id}/resolve`, { resolution: 'Se contactó a la persona; sin entrada.' });
  assert.equal(r.json.status, 'resolved');
  assert.equal((await entradas(ctx, 'usuaria')).length, 0);
});

test('impacto para programación con credencial: entradas válidas no usadas y pedidos pendientes (FR-042, SC-018)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra');
  await comprarYConfirmar(ctx, 'usuaria', [{ functionId: 'f-obra', quantity: 2 }]);
  await comprar(ctx, 'usuario2', [{ functionId: 'f-obra', quantity: 1 }]);
  assert.equal((await pedir(ctx, null, 'GET', '/internal/functions/f-obra/impact')).status, 401);
  const r = await pedir(ctx, null, 'GET', '/internal/functions/f-obra/impact', undefined, { 'x-service-key': 'clave-de-prueba-solo-para-tests' });
  assert.deepEqual(r.json, { soldTickets: 2, pendingOrders: 1, issuedTickets: 2 });
});

test('cancelada la función: no se compra, la retención no cuenta y Mis entradas lo muestra con el aviso (SC-008)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-cancelable', 3);
  await comprarYConfirmar(ctx, 'usuaria', [{ functionId: 'f-cancelable', quantity: 1 }]);
  const pendiente = await comprar(ctx, 'usuario2', [{ functionId: 'f-cancelable', quantity: 1 }]);
  Object.assign(ctx.programacion.funciones.get('f-cancelable'), {
    status: 'cancelled',
    latestNotice: { kind: 'cancelled', text: 'Se cancela por lluvia.' },
  });
  assert.equal((await comprar(ctx, 'usuario2', [{ functionId: 'f-cancelable', quantity: 1 }])).status, 409);
  const pago = await pedir(ctx, 'usuario2', 'POST', `/orders/${pendiente.json.id}/simulate-payment`, { result: 'confirmed' });
  assert.equal(pago.json.error, 'function_cancelled');
  const [t] = await entradas(ctx, 'usuaria');
  assert.equal(t.state, 'function_cancelled');
  assert.equal(t.notice.text, 'Se cancela por lluvia.');
  const resumen = (await pedir(ctx, 'admin', 'GET', '/panel/functions/f-cancelable/sale')).json;
  assert.equal(resumen.cancelled, true);
  assert.equal(resumen.orders.length, 2, 'el administrador identifica los pedidos afectados (FR-033)');
});
