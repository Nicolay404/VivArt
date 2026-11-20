import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoTemporal, franjaAbierta, franjaAplicaEn, queHayAhora } from '../../src/domain/now.js';

// RC-03 / FR-006 y SC-004: sin hora de fin ni duración nunca se dice «en curso» ni «terminada».
const en = (iso) => new Date(iso);
const fn = (extra = {}) => ({ id: 'f', date: '2026-11-21', startTime: '19:00', endTime: null, durationMinutes: null, status: 'scheduled', ...extra });

test('una función solo con hora de inicio: próxima, y después «hora de inicio pasada», nunca en curso ni terminada', () => {
  assert.equal(estadoTemporal(fn(), en('2026-11-21T18:59:00-05:00')), 'upcoming');
  assert.equal(estadoTemporal(fn(), en('2026-11-21T19:00:00-05:00')), 'start_passed');
  assert.equal(estadoTemporal(fn(), en('2026-11-22T03:00:00-05:00')), 'start_passed');
});

test('con hora de fin o duración conocida sí hay «en curso» y «terminada»', () => {
  const conFin = fn({ endTime: '20:00' });
  assert.equal(estadoTemporal(conFin, en('2026-11-21T19:30:00-05:00')), 'in_progress');
  assert.equal(estadoTemporal(conFin, en('2026-11-21T20:00:00-05:00')), 'finished');
  assert.equal(estadoTemporal(fn({ durationMinutes: 90 }), en('2026-11-21T20:29:00-05:00')), 'in_progress');
  assert.equal(estadoTemporal(fn(), en('2026-11-21T20:29:00-05:00'), 90), 'in_progress', 'duración de la actividad');
  assert.equal(estadoTemporal(fn({ durationMinutes: 300, startTime: '22:00' }), en('2026-11-22T01:00:00-05:00')), 'in_progress', 'cruza la medianoche');
  assert.equal(estadoTemporal(fn({ status: 'cancelled' }), en('2026-11-21T18:00:00-05:00')), 'cancelled');
});

test('la hora es la de Loja (UTC−5) aunque el instante venga en UTC', () => {
  assert.equal(estadoTemporal(fn(), en('2026-11-21T23:59:00Z')), 'upcoming'); // 18:59 en Loja
  assert.equal(estadoTemporal(fn(), en('2026-11-22T00:01:00Z')), 'start_passed'); // 19:01 en Loja
});

test('franjas: por fechas, por rango, por días de la semana y horario partido', () => {
  const manana = { dates: null, from: '2026-11-20', to: '2026-11-30', weekdays: null, opens: '10:00', closes: '14:00' };
  const tarde = { ...manana, opens: '15:00', closes: '19:30' };
  assert.equal(franjaAbierta(manana, en('2026-11-21T10:00:00-05:00')), true);
  assert.equal(franjaAbierta(manana, en('2026-11-21T14:00:00-05:00')), false, 'cierra a la hora de cierre');
  assert.equal(franjaAbierta(manana, en('2026-11-21T14:30:00-05:00')) || franjaAbierta(tarde, en('2026-11-21T14:30:00-05:00')), false, 'pausa del mediodía');
  assert.equal(franjaAbierta(tarde, en('2026-11-21T19:00:00-05:00')), true);
  assert.equal(franjaAplicaEn(manana, '2026-12-01'), false);
  const finesDeSemana = { ...manana, weekdays: [6, 7] }; // 2026-11-21 es sábado
  assert.equal(franjaAplicaEn(finesDeSemana, '2026-11-21'), true);
  assert.equal(franjaAplicaEn(finesDeSemana, '2026-11-23'), false);
  assert.equal(franjaAplicaEn({ dates: ['2026-11-25'], opens: '10:00', closes: '12:00' }, '2026-11-25'), true);
});

test('«¿Qué hay ahora?» no muestra canceladas ni funciones de otros días', () => {
  const actividad = {
    id: 'a',
    durationMinutes: null,
    slots: [{ id: 's', dates: ['2026-11-21'], opens: '10:00', closes: '20:00' }],
    functions: [
      fn({ id: 'proxima', startTime: '20:00' }),
      fn({ id: 'cancelada', startTime: '21:00', status: 'cancelled' }),
      fn({ id: 'empezada', startTime: '18:00' }),
      fn({ id: 'encurso', startTime: '18:30', endTime: '20:30' }),
      fn({ id: 'otrodia', date: '2026-11-22', startTime: '20:00' }),
    ],
  };
  const r = queHayAhora([actividad], en('2026-11-21T19:00:00-05:00'));
  assert.equal(r.openSlots.length, 1);
  assert.deepEqual(r.upcoming.map((x) => x.function.id), ['proxima']);
  assert.deepEqual(r.inProgress.map((x) => x.function.id), ['encurso']);
  assert.deepEqual(r.startPassed.map((x) => x.function.id), ['empezada']);
});
