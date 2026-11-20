import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir, habilitar, comprarYConfirmar, entradas } from '../helpers.js';

// Historia 5: validar entradas en la sede (FR-023 a FR-028; SC-006, SC-007).

async function preparar() {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra');
  await habilitar(ctx, 'f-danza');
  await habilitar(ctx, 'f-cancelable');
  await comprarYConfirmar(ctx, 'usuaria', [
    { functionId: 'f-obra', quantity: 1 },
    { functionId: 'f-danza', quantity: 1 },
    { functionId: 'f-cancelable', quantity: 1 },
  ]);
  const mias = await entradas(ctx, 'usuaria');
  const de = (id) => mias.find((t) => t.functionId === id);
  const qr = (t) => `VIVART-E1:${ctx.services.codes.secreto(t.id)}`;
  return { ctx, de, qr };
}

const validar = (ctx, fid, code, quien = 'acceso') => pedir(ctx, quien, 'POST', `/access/functions/${fid}/validate`, { code });

test('con el control cerrado no se admite nada; abierto, se admite una vez (FR-023, FR-025)', async () => {
  const { ctx, de, qr } = await preparar();
  const t = de('f-obra');
  assert.equal((await validar(ctx, 'f-obra', qr(t))).json.reason, 'access_closed');
  await pedir(ctx, 'acceso', 'POST', '/access/functions/f-obra/open');
  const ok = await validar(ctx, 'f-obra', qr(t));
  assert.equal(ok.json.admitted, true);
  const otra = await validar(ctx, 'f-obra', t.code);
  assert.equal(otra.json.admitted, false);
  assert.equal(otra.json.reason, 'already_used');
  await pedir(ctx, 'acceso', 'POST', '/access/functions/f-obra/close');
  assert.equal((await validar(ctx, 'f-obra', qr(t))).json.reason, 'access_closed');
});

test('cada rechazo da su motivo (SC-007)', async () => {
  const { ctx, de, qr } = await preparar();
  await pedir(ctx, 'acceso', 'POST', '/access/functions/f-obra/open');
  await pedir(ctx, 'acceso', 'POST', '/access/functions/f-cancelable/open');

  assert.equal((await validar(ctx, 'f-obra', 'https://vivart.example/pasaporte/sello/abc')).json.reason, 'wrong_code_type');
  assert.equal((await validar(ctx, 'f-obra', 'VIVART-P1:sello-de-pasaporte')).json.reason, 'wrong_code_type');
  assert.equal((await validar(ctx, 'f-obra', 'ABCDEFGHJK')).json.reason, 'not_found');
  assert.equal((await validar(ctx, 'f-obra', qr(de('f-danza')))).json.reason, 'wrong_function');

  ctx.programacion.funciones.get('f-cancelable').status = 'cancelled';
  assert.equal((await validar(ctx, 'f-cancelable', qr(de('f-cancelable')))).json.reason, 'function_cancelled');

  await pedir(ctx, 'admin', 'POST', `/panel/tickets/${de('f-obra').id}/invalidate`, { reason: 'Entrada reportada como robada' });
  assert.equal((await validar(ctx, 'f-obra', qr(de('f-obra')))).json.reason, 'not_valid');

  ctx.programacion.estado.caida = true;
  assert.equal((await validar(ctx, 'f-obra', qr(de('f-obra')))).json.reason, 'not_verifiable');
});

test('el personal no valida funciones ajenas y sin asignaciones no ve funciones (RNF-04)', async () => {
  const { ctx, de, qr } = await preparar();
  const r = await validar(ctx, 'f-danza', qr(de('f-danza')));
  assert.equal(r.status, 403);
  assert.equal((await pedir(ctx, 'acceso2', 'POST', '/access/functions/f-obra/open')).status, 403);
  assert.deepEqual((await pedir(ctx, 'acceso2', 'GET', '/access/functions')).json.items, []);
  const mias = (await pedir(ctx, 'acceso', 'GET', '/access/functions')).json.items;
  assert.deepEqual(mias.map((f) => f.functionId), ['f-obra', 'f-cancelable']);
});

test('dos validaciones simultáneas de la misma entrada admiten exactamente una (SC-006)', async () => {
  const { ctx, de, qr } = await preparar();
  await pedir(ctx, 'acceso', 'POST', '/access/functions/f-obra/open');
  const codigo = qr(de('f-obra'));
  const resultados = await Promise.all(Array.from({ length: 20 }, () => validar(ctx, 'f-obra', codigo)));
  assert.equal(resultados.filter((r) => r.json.admitted).length, 1);
  assert.ok(resultados.filter((r) => !r.json.admitted).every((r) => r.json.reason === 'already_used'));
});

test('tras reprogramar, la entrada sigue válida con los datos nuevos; una usada no se reactiva (SC-009)', async () => {
  const { ctx, de, qr } = await preparar();
  await pedir(ctx, 'acceso', 'POST', '/access/functions/f-obra/open');
  const f = ctx.programacion.funciones.get('f-obra');
  Object.assign(f, { date: '2026-11-23', startTime: '21:00', venueName: 'Plaza de Ejemplo', latestNotice: { kind: 'rescheduled', text: 'Se traslada a la plaza.' } });
  const t = (await entradas(ctx, 'usuaria')).find((x) => x.functionId === 'f-obra');
  assert.equal(t.state, 'valid');
  assert.equal(t.date, '2026-11-23');
  assert.equal(t.notice.text, 'Se traslada a la plaza.');
  assert.equal((await validar(ctx, 'f-obra', qr(de('f-obra')))).json.admitted, true);
  Object.assign(f, { date: '2026-11-24' });
  assert.equal((await validar(ctx, 'f-obra', qr(de('f-obra')))).json.reason, 'already_used');
});
