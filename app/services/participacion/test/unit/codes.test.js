import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCodes, clasificar, PREFIJO_QR } from '../../src/domain/codes.js';
import { cruces, precioCentavos } from '../../src/domain/cart.js';
import { loadConfig } from '../../src/config.js';

test('los códigos son estables por entrada, distintos entre entradas y sin caracteres confusos', () => {
  const codes = createCodes('clave-de-prueba-0123456789');
  assert.equal(codes.secreto('a'), codes.secreto('a'));
  assert.notEqual(codes.secreto('a'), codes.secreto('b'));
  assert.match(codes.codigo('a'), /^[2-9A-HJKMNP-Z]{10}$/);
  assert.throws(() => createCodes(''), /TICKET_KEY/);
});

test('clasifica entrada, código alternativo y cualquier otra cosa (RC-04)', () => {
  assert.equal(clasificar(`${PREFIJO_QR}${'x'.repeat(22)}`).tipo, 'qr');
  assert.equal(clasificar('abcd-efgh-jk').tipo, 'codigo');
  assert.equal(clasificar('https://vivart.example/sello/1').tipo, 'otro');
  assert.equal(clasificar('VIVART-P1:sello').tipo, 'otro');
  assert.equal(clasificar('').tipo, 'otro');
});

test('el precio solo existe si la actividad es de pago con precio; sin precio no es gratis', () => {
  assert.equal(precioCentavos({ access: { mode: 'paid', priceUsd: 5.5 } }), 550);
  assert.equal(precioCentavos({ access: { mode: 'paid', priceUsd: null } }), null);
  assert.equal(precioCentavos({ access: { mode: 'free', priceUsd: null } }), null);
  assert.equal(precioCentavos({}), null);
});

test('los cruces usan la duración si no hay hora de fin, y nunca suponen una', () => {
  const f = (id, startTime, extra) => ({ id, date: '2026-11-22', startTime, ...extra });
  assert.deepEqual(cruces([f('a', '19:00', { durationMinutes: 90 }), f('b', '20:00', { endTime: '21:00' })]), [['a', 'b']]);
  assert.deepEqual(cruces([f('a', '19:00', {}), f('b', '19:00', { endTime: '21:00' })]), []);
});

test('el simulador y el reloj fijo se ignoran en producción', () => {
  const c = loadConfig({ NODE_ENV: 'production', PAYMENT_SIMULATOR: 'on', CLOCK_FIXED: '2026-11-21T10:00:00-05:00' });
  assert.equal(c.paymentSimulator, false);
  assert.equal(c.clockFixed, false);
  assert.equal(loadConfig({ PAYMENT_SIMULATOR: 'on' }).paymentSimulator, true);
});
