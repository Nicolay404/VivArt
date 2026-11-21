import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRefs,
  clasificarRef,
  horaLoja,
  validarVentana,
  estadoVentana,
  huellaFuncion,
  funcionCambio,
  textoBreve,
  rechazo,
} from '../../src/domain/pasaporte.js';

// Spec 006: reglas puras del Pasaporte.

test('M-13: el ref es estable, de 22 caracteres, impredecible sin la clave y distinto por QR', () => {
  const a = createRefs('clave-de-prueba-solo-para-tests-0123');
  const b = createRefs('otra-clave-de-prueba-para-tests-4567');
  assert.equal(a.ref('qr_1'), a.ref('qr_1'));
  assert.match(a.ref('qr_1'), /^[A-Za-z0-9_-]{22}$/);
  assert.notEqual(a.ref('qr_1'), a.ref('qr_2'));
  assert.notEqual(a.ref('qr_1'), b.ref('qr_1'));
  assert.ok(!a.ref('qr_1').includes('qr_1'));
  assert.throws(() => createRefs('corta'));
});

test('RC-04, SC-003: el contenido de una entrada es «tipo de código incorrecto»; otra cosa no es un QR válido', () => {
  assert.equal(clasificarRef('VIVART-E1:abcdefghijklmnopqrstuv'), 'entrada');
  assert.equal(clasificarRef(encodeURIComponent('VIVART-E1:abcdefghijklmnop')), 'entrada');
  assert.equal(clasificarRef('AbCdEfGhIjKlMnOpQrSt_-'), 'valido');
  for (const malo of ['', 'corto', 'f-obra', '../../etc', 'A'.repeat(23)]) assert.equal(clasificarRef(malo), 'invalido', malo);
});

test('M-10, RC-07: la ventana se escribe en hora de Loja, sin valor por defecto, y el fin va después del inicio', () => {
  assert.equal(horaLoja(new Date('2026-11-22T00:30:00Z')), '2026-11-21 19:30');
  assert.deepEqual(validarVentana({ start: '2026-11-21 18:00', end: '2026-11-21 23:00' }), { start: '2026-11-21 18:00', end: '2026-11-21 23:00' });
  const campos = (cuerpo) => {
    try {
      validarVentana(cuerpo);
      return [];
    } catch (e) {
      return Object.keys(e.extra.fields).sort();
    }
  };
  assert.deepEqual(campos({}), ['end', 'start']);
  assert.deepEqual(campos({ start: '2026-11-21 18:00', end: '2026-11-21 18:00' }), ['end']);
  assert.deepEqual(campos({ start: '2026-02-30 10:00', end: '2026-11-21 25:00' }), ['end', 'start']);

  const qr = { window_start: '2026-11-21 18:00', window_end: '2026-11-21 23:00' };
  assert.equal(estadoVentana(qr, new Date('2026-11-21T17:59:00-05:00')), 'not_open');
  assert.equal(estadoVentana(qr, new Date('2026-11-21T18:00:00-05:00')), 'open');
  assert.equal(estadoVentana(qr, new Date('2026-11-21T23:00:00-05:00')), 'open');
  assert.equal(estadoVentana(qr, new Date('2026-11-21T23:01:00-05:00')), 'expired');
});

test('P-03: un cambio de fecha, hora o sede se detecta; otros cambios no', () => {
  const f = { date: '2026-11-22', startTime: '19:00', venueId: 'v-1', title: 'Obra' };
  const guardada = huellaFuncion(f);
  assert.equal(funcionCambio(guardada, { ...f, title: 'Otro título' }), false);
  assert.equal(funcionCambio(guardada, { ...f, date: '2026-11-23' }), true);
  assert.equal(funcionCambio(guardada, { ...f, startTime: '20:00' }), true);
  assert.equal(funcionCambio(guardada, { ...f, venueId: 'v-2' }), true);
  assert.equal(funcionCambio(null, f), false);
});

test('M-12, SC-015: el texto breve es texto plano de hasta 280 caracteres', () => {
  assert.equal(textoBreve('  <b>Gracias</b>\n por venir  '), '<b>Gracias</b>\n por venir');
  assert.equal(textoBreve('a\u0000b\u0007c'), 'abc');
  assert.equal(textoBreve('   '), null);
  assert.equal(textoBreve(null), null);
  assert.equal(textoBreve('é'.repeat(280)).length, 280);
  assert.throws(() => textoBreve('x'.repeat(281)), (e) => e.status === 422 && Boolean(e.extra.fields.text));
  assert.throws(() => textoBreve(42), (e) => e.status === 422);
});

test('FR-007: cada rechazo tiene su código, su estado HTTP y su mensaje', () => {
  assert.deepEqual([rechazo('wrong_code_type').status, rechazo('wrong_code_type').code], [409, 'wrong_code_type']);
  assert.equal(rechazo('email_not_verified').status, 403);
  assert.equal(rechazo('not_verifiable').status, 503);
  const cambio = rechazo('qr_inactive', 'function_changed');
  assert.equal(cambio.extra.cause, 'function_changed');
  assert.match(cambio.message, /cambió de fecha, hora o sede/);
  assert.equal(rechazo('qr_inactive').extra.cause, 'manual');
});
