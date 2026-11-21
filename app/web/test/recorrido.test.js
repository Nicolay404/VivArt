import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLAVE_RECORRIDO,
  leerStorageRecorrido,
  escribirStorageRecorrido,
  obtenerRecorrido,
  guardarEnRecorrido,
  quitarDeRecorrido,
  estaEnRecorrido,
  vaciarRecorrido,
  sustituirEnRecorrido,
  horaAMinutos,
  finEnMinutos,
  ordenarCronologicamente,
  detectarCruces,
  buscarAlternativas,
  sincronizarRecorrido,
  determinarEstadoTemporal,
  consultarEstadosVenta,
} from '../js/recorrido.js';

// Mock de localStorage en memoria para pruebas en Node.js
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.get(key) ?? null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

beforeEach(() => {
  globalThis.localStorage = new MockLocalStorage();
  globalThis.document = {
    dispatchEvent: () => true,
    querySelector: () => null,
  };
  if (typeof globalThis.CustomEvent === 'undefined') {
    globalThis.CustomEvent = class CustomEvent {
      constructor(type, detail) {
        this.type = type;
        this.detail = detail;
      }
    };
  }
});

// Helper para crear funciones ficticias en tests
const crearFuncion = (id, fecha, inicio, fin = null, extra = {}) => ({
  id: `fn_${id}`,
  functionId: id,
  activityId: `act_${id}`,
  title: extra.title ?? `Función ${id}`,
  artists: ['Artista de Prueba'],
  date: fecha,
  startTime: inicio,
  endTime: fin,
  durationMinutes: extra.durationMinutes ?? null,
  venue: { id: extra.venueId ?? 'ven_1', name: extra.venueName ?? 'Teatro Bolívar', kind: 'place' },
  status: extra.status ?? 'scheduled',
  notice: extra.notice ?? null,
});

test('T001/T003/T004: Lectura inicial con storage vacío devuelve estructura limpia', () => {
  const datos = leerStorageRecorrido();
  assert.equal(datos.version, 1);
  assert.equal(datos.updatedAt, null);
  assert.deepEqual(datos.items, []);
  assert.deepEqual(obtenerRecorrido(), []);
});

test('T003/T004: Tolerancia a fallos: JSON corrupto o tipos inválidos en localStorage', () => {
  globalThis.localStorage.setItem(CLAVE_RECORRIDO, 'ESTO NO ES UN JSON');
  const datos = leerStorageRecorrido();
  assert.deepEqual(datos.items, []);

  globalThis.localStorage.setItem(CLAVE_RECORRIDO, JSON.stringify({ version: 1, items: 'no-es-array' }));
  const datos2 = leerStorageRecorrido();
  assert.deepEqual(datos2.items, []);

  globalThis.localStorage.setItem(
    CLAVE_RECORRIDO,
    JSON.stringify({
      version: 1,
      items: [
        { id: 'invalido' },
        crearFuncion('valida', '2026-11-21', '18:00'),
      ],
    })
  );
  const datos3 = leerStorageRecorrido();
  assert.equal(datos3.items.length, 1);
  assert.equal(datos3.items[0].id, 'fn_valida');
});

test('T003/T004: Persistencia y vaciado de recorrido (SC-001, SC-008)', () => {
  const f1 = crearFuncion('f1', '2026-11-21', '18:00');
  const f2 = crearFuncion('f2', '2026-11-21', '20:00');

  escribirStorageRecorrido([f1, f2]);
  const guardado = obtenerRecorrido();
  assert.equal(guardado.length, 2);
  assert.equal(guardado[0].id, 'fn_f1');
  assert.equal(guardado[1].id, 'fn_f2');

  vaciarRecorrido();
  assert.deepEqual(obtenerRecorrido(), []);
});

test('T003: Almacenamiento bloqueado (modo privado estricto)', () => {
  globalThis.localStorage = {
    getItem: () => { throw new Error('Blocked'); },
    setItem: () => { throw new Error('Blocked'); },
  };

  const datos = leerStorageRecorrido();
  assert.deepEqual(datos.items, []);

  const resultado = escribirStorageRecorrido([crearFuncion('f1', '2026-11-21', '18:00')]);
  assert.equal(resultado, false);
});

// --- TESTS DE USER STORY 1 (T005) ---

test('T005 [US1]: Guardar funciones y franjas de forma idempotente (SC-001)', () => {
  const fn1 = crearFuncion('f1', '2026-11-21', '18:00');
  const guardado1 = guardarEnRecorrido(fn1);
  assert.equal(guardado1, true);
  assert.equal(estaEnRecorrido('fn_f1'), true);
  assert.equal(estaEnRecorrido('f1'), true);

  // Intentar guardar la misma función: no debe duplicar (idempotencia)
  const duplicado = guardarEnRecorrido(fn1);
  assert.equal(duplicado, false);
  const recorrido = obtenerRecorrido();
  assert.equal(recorrido.length, 1);

  // Guardar una franja
  const franja = {
    kind: 'slot',
    slotId: 'sl_1',
    activityId: 'act_exp',
    title: 'Exposición Permanente',
    date: '2026-11-21',
    startTime: '10:00',
    endTime: '14:00',
    venue: { id: 'ven_museo', name: 'Museo de la Cultura', kind: 'place' },
  };
  const guardadoFranja = guardarEnRecorrido(franja);
  assert.equal(guardadoFranja, true);
  assert.equal(estaEnRecorrido('slot_sl_1_2026-11-21'), true);
  assert.equal(estaEnRecorrido('sl_1'), true);
  assert.equal(obtenerRecorrido().length, 2);
});

test('T005 [US1]: Quitar funciones del recorrido (FR-001, SC-001)', () => {
  guardarEnRecorrido(crearFuncion('f1', '2026-11-21', '18:00'));
  guardarEnRecorrido(crearFuncion('f2', '2026-11-21', '20:00'));
  assert.equal(obtenerRecorrido().length, 2);

  const quitado = quitarDeRecorrido('fn_f1');
  assert.equal(quitado, true);
  assert.equal(estaEnRecorrido('f1'), false);
  assert.equal(estaEnRecorrido('f2'), true);
  assert.equal(obtenerRecorrido().length, 1);

  // Quitar elemento inexistente
  const noExiste = quitarDeRecorrido('fn_fantasma');
  assert.equal(noExiste, false);
});

test('T005 [US1]: Ordenamiento cronológico por fecha y hora (FR-002, SC-002)', () => {
  // Guardar en desorden cronológico
  guardarEnRecorrido(crearFuncion('tarde', '2026-11-22', '19:00'));
  guardarEnRecorrido(crearFuncion('temprano', '2026-11-21', '10:00'));
  guardarEnRecorrido(crearFuncion('noche_primer_dia', '2026-11-21', '21:00'));
  guardarEnRecorrido(crearFuncion('mediodia_primer_dia', '2026-11-21', '12:30'));

  const ordenados = obtenerRecorrido();
  assert.equal(ordenados.length, 4);
  assert.equal(ordenados[0].id, 'fn_temprano');
  assert.equal(ordenados[1].id, 'fn_mediodia_primer_dia');
  assert.equal(ordenados[2].id, 'fn_noche_primer_dia');
  assert.equal(ordenados[3].id, 'fn_tarde');
});

// --- TESTS DE USER STORY 2 (T013) ---

test('T013 [US2]: Solapamiento estricto en la misma fecha (SC-003, RC-02, FR-006)', () => {
  const f1 = crearFuncion('a', '2026-11-21', '18:00', '19:30', { title: 'Obra A' });
  const f2 = crearFuncion('b', '2026-11-21', '19:00', '20:30', { title: 'Obra B' });

  const cruces = detectarCruces([f1, f2]);
  assert.equal(cruces.length, 1);
  assert.equal(cruces[0].itemA, 'fn_a');
  assert.equal(cruces[0].itemB, 'fn_b');
  assert.equal(cruces[0].date, '2026-11-21');
  // Solapamiento: 19:00 a 19:30 = 30 minutos
  assert.equal(cruces[0].overlapMinutes, 30);
});

test('T013 [US2]: Funciones consecutivas tangentes finA == inicioB NO son cruce (SC-003, RC-02, FR-008)', () => {
  const f1 = crearFuncion('a', '2026-11-21', '18:00', '19:30');
  const f2 = crearFuncion('b', '2026-11-21', '19:30', '21:00');

  const cruces = detectarCruces([f1, f2]);
  assert.equal(cruces.length, 0);
});

test('T013 [US2]: Funciones en fechas distintas NO generan cruce', () => {
  const f1 = crearFuncion('a', '2026-11-21', '18:00', '20:00');
  const f2 = crearFuncion('b', '2026-11-22', '18:00', '20:00');

  const cruces = detectarCruces([f1, f2]);
  assert.equal(cruces.length, 0);
});

test('T013 [US2]: Función sin hora de fin ni duración conocida NO advierte cruce (RC-02, FR-008, SC-004)', () => {
  // f1 tiene inicio pero fin desconocido (RC-03 / FR-008)
  const f1 = crearFuncion('sin_fin', '2026-11-21', '18:00', null, { durationMinutes: null });
  const f2 = crearFuncion('con_fin', '2026-11-21', '18:30', '20:00');

  const cruces = detectarCruces([f1, f2]);
  assert.equal(cruces.length, 0);
});

test('T013 [US2]: Cruce calculado con durationMinutes cuando endTime no está explícito', () => {
  const f1 = crearFuncion('duracion', '2026-11-21', '17:00', null, { durationMinutes: 90 }); // fin 18:30
  const f2 = crearFuncion('segunda', '2026-11-21', '18:00', '19:00'); // inicio 18:00

  const cruces = detectarCruces([f1, f2]);
  assert.equal(cruces.length, 1);
  // Solapamiento: 18:00 a 18:30 = 30 minutos
  assert.equal(cruces[0].overlapMinutes, 30);
});

test('T013 [US2]: Cruce entre franja horaria (slot) y función puntual (SC-004)', () => {
  const franja = {
    id: 'slot_exp_2026-11-21',
    kind: 'slot',
    slotId: 'exp',
    activityId: 'act_exp',
    title: 'Exposición Mañana',
    date: '2026-11-21',
    startTime: '10:00',
    endTime: '14:00',
    durationMinutes: 240,
  };
  const funcionPuntual = crearFuncion('visita', '2026-11-21', '11:00', '12:30');

  const cruces = detectarCruces([franja, funcionPuntual]);
  assert.equal(cruces.length, 1);
  // Solapamiento: 11:00 a 12:30 = 90 minutos
  assert.equal(cruces[0].overlapMinutes, 90);
});

test('T013 [US2]: Múltiples cruces concurrentes en el mismo día', () => {
  const f1 = crearFuncion('f1', '2026-11-21', '15:00', '17:00');
  const f2 = crearFuncion('f2', '2026-11-21', '16:00', '18:00');
  const f3 = crearFuncion('f3', '2026-11-21', '16:30', '19:00');

  const cruces = detectarCruces([f1, f2, f3]);
  // f1 se cruza con f2 (16:00 a 17:00 = 60 min)
  // f1 se cruza con f3 (16:30 a 17:00 = 30 min)
  // f2 se cruza con f3 (16:30 a 18:00 = 90 min)
  assert.equal(cruces.length, 3);
  assert.deepEqual(
    cruces.map((c) => `${c.itemA}-${c.itemB}:${c.overlapMinutes}`),
    ['fn_f1-fn_f2:60', 'fn_f1-fn_f3:30', 'fn_f2-fn_f3:90']
  );
});

test('T013/T014 [US2]: Advertencia de cruce nunca bloquea guardar ambas funciones (RC-02, SC-004)', () => {
  const f1 = crearFuncion('solapada_1', '2026-11-21', '18:00', '19:30');
  const f2 = crearFuncion('solapada_2', '2026-11-21', '18:30', '20:00');

  // Guardar ambas
  const g1 = guardarEnRecorrido(f1);
  const g2 = guardarEnRecorrido(f2);
  assert.equal(g1, true);
  assert.equal(g2, true);

  // Ambas coexisten en el recorrido
  const recorrido = obtenerRecorrido();
  assert.equal(recorrido.length, 2);

  // Se detecta el cruce pero el estado sigue accesible
  const cruces = detectarCruces(recorrido);
  assert.equal(cruces.length, 1);
  assert.equal(cruces[0].overlapMinutes, 60);
});

// --- TESTS DE USER STORY 3 (T017, T018, T019, T020) ---

test('T017/T018 [US3]: Sincronización actualiza hora y sede reflejando aviso Notice.text (FR-009, FR-010, SC-005)', () => {
  const itemLocal = crearFuncion('f1', '2026-11-21', '16:00', '17:30', {
    title: 'Danza Contemporánea',
    venueId: 'ven_bolivar',
    venueName: 'Teatro Bolívar',
  });

  const agenda = [
    {
      id: 'act_f1',
      title: 'Danza Contemporánea',
      artists: ['Artista de Prueba'],
      functions: [
        {
          id: 'f1',
          date: '2026-11-21',
          startTime: '18:00',
          endTime: '19:30',
          durationMinutes: 90,
          venue: { id: 'ven_mora', name: 'Centro Cultural Alfredo Mora Reyes', kind: 'place' },
          status: 'scheduled',
          notice: {
            kind: 'rescheduled',
            text: 'Reprogramada a las 18:00 en Alfredo Mora Reyes por lluvia',
            at: '2026-11-21T10:00:00Z',
          },
        },
      ],
    },
  ];

  const sincronizados = sincronizarRecorrido([itemLocal], agenda);
  assert.equal(sincronizados.length, 1);
  assert.equal(sincronizados[0].startTime, '18:00');
  assert.equal(sincronizados[0].endTime, '19:30');
  assert.equal(sincronizados[0].venue.id, 'ven_mora');
  assert.equal(sincronizados[0].venue.name, 'Centro Cultural Alfredo Mora Reyes');
  assert.equal(sincronizados[0].notice?.kind, 'rescheduled');
  assert.equal(sincronizados[0].notice?.text, 'Reprogramada a las 18:00 en Alfredo Mora Reyes por lluvia');
});

test('T017/T018 [US3]: Retención de funciones canceladas con su aviso (FR-010, SC-005)', () => {
  const itemLocal = crearFuncion('f_canc', '2026-11-21', '18:00', '19:30', {
    title: 'Concierto Sinfónico',
    status: 'scheduled',
  });

  const agenda = [
    {
      id: 'act_f_canc',
      title: 'Concierto Sinfónico',
      functions: [
        {
          id: 'f_canc',
          date: '2026-11-21',
          startTime: '18:00',
          endTime: '19:30',
          status: 'cancelled',
          notice: {
            kind: 'cancelled',
            text: 'Cancelada por fuerza mayor y quebranto de salud del solista.',
            at: '2026-11-21T09:00:00Z',
          },
        },
      ],
    },
  ];

  const sincronizados = sincronizarRecorrido([itemLocal], agenda);
  assert.equal(sincronizados.length, 1);
  assert.equal(sincronizados[0].status, 'cancelled');
  assert.equal(sincronizados[0].notice?.kind, 'cancelled');
  assert.equal(sincronizados[0].notice?.text, 'Cancelada por fuerza mayor y quebranto de salud del solista.');
});

test('T017/T019 [US3]: Funciones archivadas (404 en API) se conservan con estado archived y aviso descriptivo (FR-018, SC-009)', () => {
  const itemLocal = crearFuncion('f_arch', '2026-11-21', '20:00', '21:30', {
    title: 'Obra Retirada',
  });

  // Catálogo donde ya no existe act_f_arch (archivada/despublicada)
  const agendaVacia = [];

  const sincronizados = sincronizarRecorrido([itemLocal], agendaVacia);
  assert.equal(sincronizados.length, 1);
  assert.equal(sincronizados[0].id, 'fn_f_arch');
  assert.equal(sincronizados[0].title, 'Obra Retirada');
  assert.equal(sincronizados[0].status, 'archived');
  assert.equal(sincronizados[0].isArchived, true);
});

test('T017/T019 [US3]: Función archivada que había sido cancelada conserva estado cancelado y su aviso (FR-018, SC-009)', () => {
  const itemCancelado = crearFuncion('f_arch_canc', '2026-11-21', '20:00', '21:30', {
    title: 'Mimo Callejero',
    status: 'cancelled',
    notice: { kind: 'cancelled', text: 'Cancelado antes del archivo definitivo' },
  });

  // Ya no está en el catálogo activo
  const agenda = [
    { id: 'otra_act', title: 'Otra', functions: [] },
  ];

  const sincronizados = sincronizarRecorrido([itemCancelado], agenda);
  assert.equal(sincronizados.length, 1);
  assert.equal(sincronizados[0].isArchived, true);
  assert.equal(sincronizados[0].status, 'cancelled');
  assert.equal(sincronizados[0].notice?.kind, 'cancelled');
  assert.equal(sincronizados[0].notice?.text, 'Cancelado antes del archivo definitivo');
});

test('T020 [US3]: Recálculo automático de cruces de horario al sincronizar cuando cambie la hora (FR-011)', () => {
  const fn1 = crearFuncion('fn1', '2026-11-21', '18:00', '19:30');
  const fn2 = crearFuncion('fn2', '2026-11-21', '14:00', '15:30');

  // Inicialmente NO hay cruce
  assert.equal(detectarCruces([fn1, fn2]).length, 0);

  // fn2 es reprogramada en la agenda a las 18:30 (generando cruce con fn1 de 18:00 a 19:30)
  const agendaConCruce = [
    {
      id: 'act_fn1',
      functions: [{ id: 'fn1', date: '2026-11-21', startTime: '18:00', endTime: '19:30', status: 'scheduled' }],
    },
    {
      id: 'act_fn2',
      functions: [{ id: 'fn2', date: '2026-11-21', startTime: '18:30', endTime: '20:00', status: 'scheduled' }],
    },
  ];

  const sincConCruce = sincronizarRecorrido([fn1, fn2], agendaConCruce);
  const crucesNuevos = detectarCruces(sincConCruce);
  assert.equal(crucesNuevos.length, 1);
  assert.equal(crucesNuevos[0].overlapMinutes, 60);

  // Luego fn2 es reprogramada a las 20:00 (eliminando el cruce)
  const agendaSinCruce = [
    {
      id: 'act_fn1',
      functions: [{ id: 'fn1', date: '2026-11-21', startTime: '18:00', endTime: '19:30', status: 'scheduled' }],
    },
    {
      id: 'act_fn2',
      functions: [{ id: 'fn2', date: '2026-11-21', startTime: '20:00', endTime: '21:30', status: 'scheduled' }],
    },
  ];

  const sincSinCruce = sincronizarRecorrido([fn1, fn2], agendaSinCruce);
  const crucesResueltos = detectarCruces(sincSinCruce);
  assert.equal(crucesResueltos.length, 0);
});

test('T018 [US3]: Tolerancia a modo offline: si la agenda no responde (null/undefined), se conserva el estado local', () => {
  const fn1 = crearFuncion('fn1', '2026-11-21', '18:00', '19:30');
  const resNull = sincronizarRecorrido([fn1], null);
  assert.deepEqual(resNull, [fn1]);

  const resUndef = sincronizarRecorrido([fn1], undefined);
  assert.deepEqual(resUndef, [fn1]);
});

// --- TESTS DE USER STORY 4 (T022, T023, T024, T025) ---

test('T022/T024 [US4]: buscarAlternativas sugiere solo funciones de la misma sede, no canceladas y futuras (SC-006, FR-012, FR-013, FR-017)', () => {
  const itemAfectado = crearFuncion('f_afectada', '2026-11-21', '18:00', '19:30', {
    venueId: 'ven_bolivar',
    venueName: 'Teatro Bolívar',
    status: 'cancelled',
  });

  const referencia = { date: '2026-11-21', time: '17:30' };

  const agenda = [
    {
      id: 'act_1',
      title: 'Música Andina',
      status: 'scheduled',
      access: { mode: 'free', label: 'Entrada libre' },
      functions: [
        // Válida: misma sede, no cancelada, hora posterior a 17:30
        {
          id: 'fn_alt1',
          date: '2026-11-21',
          startTime: '19:00',
          endTime: '20:30',
          venue: { id: 'ven_bolivar', name: 'Teatro Bolívar', kind: 'place' },
          status: 'scheduled',
        },
        // Inválida: hora ya comenzó (16:00 < 17:30)
        {
          id: 'fn_pasada',
          date: '2026-11-21',
          startTime: '16:00',
          endTime: '17:15',
          venue: { id: 'ven_bolivar', name: 'Teatro Bolívar', kind: 'place' },
          status: 'scheduled',
        },
        // Inválida: cancelada
        {
          id: 'fn_canc',
          date: '2026-11-21',
          startTime: '21:00',
          venue: { id: 'ven_bolivar', name: 'Teatro Bolívar', kind: 'place' },
          status: 'cancelled',
        },
      ],
    },
    {
      id: 'act_2',
      title: 'Teatro Experimental',
      status: 'scheduled',
      access: { mode: 'paid', label: 'Con entrada' },
      functions: [
        // Válida: misma sede, posterior a 17:30
        {
          id: 'fn_alt2',
          date: '2026-11-21',
          startTime: '20:00',
          endTime: '21:30',
          venue: { id: 'ven_bolivar', name: 'Teatro Bolívar', kind: 'place' },
          status: 'scheduled',
        },
        // Inválida: distinta sede (Centro Cultural Alfredo Mora Reyes, no admitida en MVP según FR-017)
        {
          id: 'fn_otra_sede',
          date: '2026-11-21',
          startTime: '19:30',
          venue: { id: 'ven_mora', name: 'Centro Cultural Alfredo Mora Reyes', kind: 'place' },
          status: 'scheduled',
        },
      ],
    },
    {
      id: 'act_misma',
      title: 'Misma Función Original',
      functions: [
        // Inválida: es la misma función afectada
        {
          id: 'f_afectada',
          date: '2026-11-21',
          startTime: '18:00',
          venue: { id: 'ven_bolivar', name: 'Teatro Bolívar', kind: 'place' },
          status: 'cancelled',
        },
      ],
    },
  ];

  const alternativas = buscarAlternativas(itemAfectado, agenda, referencia);
  assert.equal(alternativas.length, 2);
  assert.equal(alternativas[0].functionId, 'fn_alt1');
  assert.equal(alternativas[0].startTime, '19:00');
  assert.equal(alternativas[1].functionId, 'fn_alt2');
  assert.equal(alternativas[1].startTime, '20:00');
  // Todas son estrictamente de la misma sede
  assert.ok(alternativas.every((a) => a.venue.id === 'ven_bolivar'));
});

test('T022/T024 [US4]: buscarAlternativas retorna array vacío si no hay funciones futuras en esa sede (SC-006, FR-013)', () => {
  const itemAfectado = crearFuncion('f_sola', '2026-11-21', '22:00', '23:30', {
    venueId: 'ven_sin_mas_funciones',
  });
  const referencia = { date: '2026-11-21', time: '21:30' };
  const agenda = [
    {
      id: 'act_otra',
      functions: [
        { id: 'fn_x', date: '2026-11-21', startTime: '22:30', venue: { id: 'ven_otra' }, status: 'scheduled' },
      ],
    },
  ];

  const alts = buscarAlternativas(itemAfectado, agenda, referencia);
  assert.deepEqual(alts, []);
});

test('T022 [US4]: determinarEstadoTemporal: «Hora de inicio pasada» para funciones sin fin conocido (RC-03, SC-007, FR-014)', () => {
  // Función sin endTime ni durationMinutes
  const fnSinFin = crearFuncion('lo_que_somos', '2026-11-21', '16:00', null, { durationMinutes: null });

  // Cuando la hora actual aún no alcanza las 16:00:
  const refAntes = { date: '2026-11-21', time: '15:30' };
  assert.equal(determinarEstadoTemporal(fnSinFin, refAntes), 'upcoming');

  // Cuando la hora actual ya superó las 16:00 (16:30):
  // Cumple RC-03: NUNCA afirmar «terminada» ni «en curso»
  const refDespues = { date: '2026-11-21', time: '16:30' };
  assert.equal(determinarEstadoTemporal(fnSinFin, refDespues), 'start_passed');
});

test('T022 [US4]: determinarEstadoTemporal: Funciones con fin conocido reflejan en_curso o terminada', () => {
  const fnConFin = crearFuncion('concierto', '2026-11-21', '16:00', '17:30');

  // Durante la función:
  const refEnCurso = { date: '2026-11-21', time: '16:45' };
  assert.equal(determinarEstadoTemporal(fnConFin, refEnCurso), 'in_progress');

  // Después del fin:
  const refTerminada = { date: '2026-11-21', time: '18:00' };
  assert.equal(determinarEstadoTemporal(fnConFin, refTerminada), 'finished');

  // Con duración de 60 min y sin endTime explícito:
  const fnConDuracion = crearFuncion('danza', '2026-11-21', '16:00', null, { durationMinutes: 60 });
  assert.equal(determinarEstadoTemporal(fnConDuracion, { date: '2026-11-21', time: '17:15' }), 'finished');
});

test('T022/T023 [US4]: Detección de sold_out vía estados de venta y degradación suave (FR-019, SC-010)', () => {
  const itemLocal = crearFuncion('f_agotada', '2026-11-21', '19:00', '20:30');
  const agenda = [
    {
      id: 'act_f_agotada',
      functions: [{ id: 'f_agotada', date: '2026-11-21', startTime: '19:00', endTime: '20:30', status: 'scheduled' }],
    },
  ];

  // Caso 1: Venta reporta sold_out
  const estadosVenta = [{ functionId: 'f_agotada', state: 'sold_out' }];
  const sincAgotada = sincronizarRecorrido([itemLocal], agenda, estadosVenta);
  assert.equal(sincAgotada[0].saleState, 'sold_out');

  // Caso 2: Servicio de venta falla o responde vacío (degradación suave)
  const sincFalloVenta = sincronizarRecorrido([itemLocal], agenda, []);
  assert.equal(sincFalloVenta[0].saleState, null);
});

test('T022/T025 [US4]: sustituirEnRecorrido reemplaza atómicamente la función afectada por la alternativa (FR-015, FR-021, SC-011)', () => {
  const fnOriginal = crearFuncion('f_canc', '2026-11-21', '18:00', '19:30', { title: 'Función Cancelada' });
  const fnOtra = crearFuncion('f_otra', '2026-11-21', '21:00', '22:30', { title: 'Otra Función Intacta' });

  guardarEnRecorrido(fnOriginal);
  guardarEnRecorrido(fnOtra);
  assert.equal(obtenerRecorrido().length, 2);

  const alternativaNueva = {
    functionId: 'alt_99',
    activityId: 'act_alt_99',
    title: 'Nueva Obra Sustituta',
    date: '2026-11-21',
    startTime: '19:30',
    endTime: '21:00',
    venue: { id: 'ven_bolivar', name: 'Teatro Bolívar', kind: 'place' },
  };

  const sustituido = sustituirEnRecorrido('fn_f_canc', alternativaNueva);
  assert.equal(sustituido, true);

  const recorridoPost = obtenerRecorrido();
  assert.equal(recorridoPost.length, 2);
  // La original fue quitada
  assert.equal(estaEnRecorrido('fn_f_canc'), false);
  assert.equal(estaEnRecorrido('f_canc'), false);
  // La otra permanece intacta
  assert.equal(estaEnRecorrido('fn_f_otra'), true);
  // La nueva está guardada
  assert.equal(estaEnRecorrido('fn_alt_99'), true);
  assert.equal(estaEnRecorrido('alt_99'), true);
  const itemNuevo = recorridoPost.find((i) => i.functionId === 'alt_99');
  assert.equal(itemNuevo.title, 'Nueva Obra Sustituta');
  assert.equal(itemNuevo.startTime, '19:30');
});



