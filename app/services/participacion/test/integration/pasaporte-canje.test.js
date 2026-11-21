import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir, habilitar, comprarYConfirmar } from '../helpers.js';
import { qrActivo, reclamar, refDe } from '../pasaporte-ayuda.js';

// Spec 006, historias 1, 2 y 3: canje del sello, rechazos y colección. Datos FICTICIOS.

test('SC-001, FR-002: un canje válido entrega el sello en una función gratuita o de pago, sin entrada; repetirlo da el mismo', async () => {
  const ctx = await crearApp();
  for (const fid of ['f-gratis', 'f-obra']) {
    const { ref } = await qrActivo(ctx, fid);
    const r = await reclamar(ctx, 'usuaria', ref);
    assert.equal(r.status, 201, fid);
    assert.equal(r.json.created, true);
    assert.equal(r.json.stamp.functionId, fid);
    assert.equal(r.json.stamp.title, `Función ${fid}`);
    assert.equal(r.json.stamp.venueName, 'Teatro de Ejemplo');
    assert.equal(r.json.stamp.content, null, 'sin contenido: solo la plantilla común (SC-012)');
    const otra = await reclamar(ctx, 'usuaria', ref);
    assert.deepEqual([otra.status, otra.json.created, otra.json.stamp.id], [200, false, r.json.stamp.id]);
  }
  assert.equal((await ctx.services.db.query('SELECT COUNT(*)::int AS n FROM orders'))[0].n, 0, 'no hizo falta comprar');
});

test('FR-004: comprar una entrada no entrega el sello', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra');
  await comprarYConfirmar(ctx, 'usuaria', [{ functionId: 'f-obra', quantity: 1 }]);
  assert.equal((await pedir(ctx, 'usuaria', 'GET', '/passport')).json.total, 0);
});

test('FR-006: sin sesión se pide identificarse, pero un enlace mal formado se rechaza antes', async () => {
  const ctx = await crearApp();
  const { ref } = await qrActivo(ctx, 'f-obra');
  const sinSesion = await reclamar(ctx, null, ref);
  assert.deepEqual([sinSesion.status, sinSesion.json.error], [401, 'unauthenticated']);
  assert.equal((await reclamar(ctx, null, 'no-es-un-qr')).json.error, 'qr_not_found');
  assert.equal((await reclamar(ctx, null, 'VIVART-E1:abcdefghijklmnopqrstuv')).json.error, 'wrong_code_type');
});

test('SC-003, SC-004: cada rechazo da su motivo y no emite sello', async () => {
  const ctx = await crearApp();
  const motivo = async (quien, ref) => {
    const r = await reclamar(ctx, quien, ref);
    return [r.status, r.json.error, r.json.cause ?? null];
  };
  // Tipo de código incorrecto: el contenido de una entrada (RC-04).
  assert.deepEqual(await motivo('usuaria', 'VIVART-E1:abcdefghijklmnopqrstuv'), [409, 'wrong_code_type', null]);
  // Correo sin verificar.
  const { ref } = await qrActivo(ctx, 'f-obra');
  assert.deepEqual(await motivo('sinVerificar', ref), [403, 'email_not_verified', null]);
  // Desactivado a mano.
  await pedir(ctx, 'admin', 'POST', '/panel/functions/f-obra/passport/deactivate');
  assert.deepEqual(await motivo('usuaria', ref), [409, 'qr_inactive', 'manual']);
  // Reemplazado: el ref anterior ya no vale.
  const nuevo = await pedir(ctx, 'admin', 'POST', '/panel/functions/f-obra/passport/qr/replace');
  assert.deepEqual(await motivo('usuaria', ref), [409, 'qr_replaced', null]);
  assert.notEqual(refDe(nuevo.json), ref);
  // Fuera de la ventana: aún no abierta y vencida.
  const { ref: refDanza } = await qrActivo(ctx, 'f-danza', { start: '2026-11-22 18:00', end: '2026-11-22 22:00' });
  assert.deepEqual(await motivo('usuaria', refDanza), [409, 'window_not_open', null]);
  ctx.reloj.fijar('2026-11-22T22:01:00-05:00');
  assert.deepEqual(await motivo('usuaria', refDanza), [409, 'window_expired', null]);
  // Función cancelada: nada nuevo.
  ctx.reloj.fijar('2026-11-21T18:00:00-05:00');
  const { ref: refCancelable } = await qrActivo(ctx, 'f-cancelable');
  ctx.programacion.funciones.get('f-cancelable').status = 'cancelled';
  assert.deepEqual(await motivo('usuaria', refCancelable), [409, 'function_cancelled', null]);
  assert.equal((await ctx.services.db.query('SELECT COUNT(*)::int AS n FROM stamps'))[0].n, 0);
});

test('FR-009, RNF-07: si programación no responde, el canje no está confirmado y no se emite nada', async () => {
  const ctx = await crearApp();
  const { ref } = await qrActivo(ctx, 'f-obra');
  ctx.programacion.estado.caida = true;
  const r = await reclamar(ctx, 'usuaria', ref);
  assert.deepEqual([r.status, r.json.error], [503, 'not_verifiable']);
  assert.match(r.json.message, /no está confirmado/);
  assert.equal((await ctx.services.db.query('SELECT COUNT(*)::int AS n FROM stamps'))[0].n, 0);
});

test('SC-006, SC-007: Mi pasaporte muestra el total, sin meta, y cada persona ve solo sus sellos', async () => {
  const ctx = await crearApp();
  for (const fid of ['f-obra', 'f-danza', 'f-gratis']) {
    const { ref } = await qrActivo(ctx, fid);
    await reclamar(ctx, 'usuaria', ref);
    if (fid === 'f-obra') await reclamar(ctx, 'usuario2', ref);
  }
  const mio = await pedir(ctx, 'usuaria', 'GET', '/passport');
  assert.equal(mio.json.total, 3);
  assert.equal(mio.json.items.length, 3);
  assert.equal(mio.json.verified, true);
  for (const campo of ['goal', 'percentage', 'nextStamp', 'meta']) assert.ok(!(campo in mio.json), campo);
  const otro = await pedir(ctx, 'usuario2', 'GET', '/passport');
  assert.equal(otro.json.total, 1);
  // Un sello ajeno no existe para quien lo pide.
  const ajeno = await pedir(ctx, 'usuario2', 'GET', `/passport/stamps/${mio.json.items[0].id}`);
  assert.equal(ajeno.status, 404);
  assert.equal((await pedir(ctx, null, 'GET', '/passport')).status, 401);
});

test('SC-011, FR-021: un sello obtenido antes de cancelar sigue en la colección con el aviso; el canje nuevo se rechaza', async () => {
  const ctx = await crearApp();
  const { ref } = await qrActivo(ctx, 'f-cancelable');
  const obtenido = await reclamar(ctx, 'usuaria', ref);
  const f = ctx.programacion.funciones.get('f-cancelable');
  f.status = 'cancelled';
  f.latestNotice = { kind: 'cancelled', text: 'Función cancelada por lluvia.', at: '2026-11-21T23:30:00.000Z' };
  const detalle = await pedir(ctx, 'usuaria', 'GET', `/passport/stamps/${obtenido.json.stamp.id}`);
  assert.equal(detalle.status, 200);
  assert.equal(detalle.json.functionStatus, 'cancelled');
  assert.equal(detalle.json.notice.text, 'Función cancelada por lluvia.');
  // Reabrir el enlace sigue mostrando su sello (FR-003); otra persona ya no puede reclamar.
  assert.equal((await reclamar(ctx, 'usuaria', ref)).json.stamp.id, obtenido.json.stamp.id);
  assert.equal((await reclamar(ctx, 'usuario2', ref)).json.error, 'function_cancelled');
});

test('P-14 (opción simple): el sello muestra los datos vigentes de la función; si programación cae, se marca sin confirmar', async () => {
  const ctx = await crearApp();
  const { ref } = await qrActivo(ctx, 'f-obra');
  await reclamar(ctx, 'usuaria', ref);
  ctx.programacion.funciones.get('f-obra').title = 'Título corregido';
  assert.equal((await pedir(ctx, 'usuaria', 'GET', '/passport')).json.items[0].title, 'Título corregido');
  ctx.programacion.estado.caida = true;
  const caida = await pedir(ctx, 'usuaria', 'GET', '/passport');
  assert.deepEqual([caida.status, caida.json.total, caida.json.verified], [200, 1, false]);
});
