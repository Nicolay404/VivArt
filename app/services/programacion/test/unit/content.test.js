import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarContenido, validarEnvio, cambiosDeAsistencia } from '../../src/domain/content.js';
import { pendientes, etiquetaAcceso } from '../../src/domain/presenter.js';

const cat = { categorias: new Set(['cat']), sedes: new Set(['sede', 'otra']) };

test('normalizar no completa ni deduce datos ausentes y da identificadores estables', () => {
  const c = normalizarContenido({ title: '  Obra  ', functions: [{ date: '2026-11-21' }, { id: 'fn_fijo', startTime: '19:00' }] });
  assert.equal(c.title, 'Obra');
  assert.deepEqual([c.description, c.organization, c.categoryId, c.durationMinutes], [null, null, null, null]);
  assert.deepEqual(c.access, { mode: 'unconfirmed', priceUsd: null });
  assert.match(c.functions[0].id, /^fn_/);
  assert.equal(c.functions[1].id, 'fn_fijo');
  assert.equal(normalizarContenido(c).functions[0].id, c.functions[0].id, 'el identificador se conserva al volver a guardar');
});

test('gratuita nunca lleva precio; de pago sin precio queda «por confirmar»; un modo desconocido no se acepta', () => {
  assert.deepEqual(normalizarContenido({ access: { mode: 'free', priceUsd: 9 } }).access, { mode: 'free', priceUsd: null });
  assert.deepEqual(normalizarContenido({ access: { mode: 'paid' } }).access, { mode: 'paid', priceUsd: null });
  assert.deepEqual(normalizarContenido({ access: { mode: 'paid', priceUsd: '4.5' } }).access, { mode: 'paid', priceUsd: 4.5 });
  assert.deepEqual(normalizarContenido({ access: { mode: 'gratis' } }).access, { mode: 'unconfirmed', priceUsd: null });
  assert.equal(etiquetaAcceso({ mode: 'paid', priceUsd: null }), 'De pago: precio por confirmar');
  assert.equal(etiquetaAcceso({ mode: 'paid', priceUsd: 4.5 }), 'De pago: USD 4,50');
});

test('SC-012: validar el envío señala cada campo que falta', () => {
  assert.deepEqual(Object.keys(validarEnvio(normalizarContenido({}), cat)).sort(), ['categoryId', 'functions', 'title']);
  const ok = normalizarContenido({ title: 'T', categoryId: 'cat', functions: [{ date: '2026-11-21', startTime: '19:00', venueId: 'sede' }] });
  assert.deepEqual(validarEnvio(ok, cat), {});
  const franja = normalizarContenido({ title: 'T', categoryId: 'cat', slots: [{ venueId: 'sede', dates: ['2026-11-21'], opens: '10:00', closes: '12:00' }] });
  assert.deepEqual(validarEnvio(franja, cat), {});
  const mala = normalizarContenido({
    title: 'T',
    categoryId: 'no',
    functions: [{ date: '2026-02-30', startTime: '25:00', endTime: '18:00', venueId: 'x' }],
    slots: [{ venueId: 'sede', from: '2026-11-30', to: '2026-11-20', opens: '14:00', closes: '10:00' }],
  });
  const errores = validarEnvio(mala, cat);
  for (const campo of ['categoryId', 'functions[0].date', 'functions[0].startTime', 'functions[0].venueId', 'slots[0].dates', 'slots[0].closes']) {
    assert.ok(errores[campo], campo);
  }
});

test('cambios de asistencia: mover o quitar funciones y cambiar franjas exige aviso; añadir no', () => {
  const pub = [
    { id: 'f1', date: '2026-11-21', startTime: '19:00', venueId: 'sede', status: 'scheduled' },
    { id: 'f2', date: '2026-11-22', startTime: '19:00', venueId: 'sede', status: 'scheduled' },
    { id: 'f3', date: '2026-11-23', startTime: '19:00', venueId: 'sede', status: 'cancelled' },
  ];
  const franjas = [{ id: 's1', venueId: 'sede', dates: null, from: '2026-11-20', to: '2026-11-30', weekdays: null, opens: '10:00', closes: '14:00' }];
  const igual = normalizarContenido({
    functions: [{ id: 'f1', date: '2026-11-21', startTime: '19:00', venueId: 'sede' }, { id: 'f2', date: '2026-11-22', startTime: '19:00', venueId: 'sede' }, { date: '2026-11-25', startTime: '10:00', venueId: 'sede' }],
    slots: franjas,
  });
  assert.deepEqual(cambiosDeAsistencia(pub, franjas, igual), []);
  const distinto = normalizarContenido({
    functions: [{ id: 'f1', date: '2026-11-21', startTime: '19:00', venueId: 'otra' }],
    slots: [{ ...franjas[0], closes: '13:00' }],
  });
  assert.deepEqual(cambiosDeAsistencia(pub, franjas, distinto).map((c) => c.type).sort(), ['function_removed', 'function_rescheduled', 'slot_changed']);
});

test('SC-003: lo no confirmado se lista como pendiente', () => {
  const c = normalizarContenido({ title: 'T', categoryId: 'cat', access: { mode: 'paid' } });
  assert.deepEqual(pendientes(c, [{ date: '2026-11-21', startTime: '19:00', endTime: null, durationMinutes: null }]).sort(), [
    'description',
    'duration',
    'organization',
    'price',
  ]);
  assert.ok(!pendientes({ ...c, durationMinutes: 60 }, [{ date: '2026-11-21', startTime: '19:00' }]).includes('duration'));
});
