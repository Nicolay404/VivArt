import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretar, limpiarTexto, horaDe } from '../../src/domain/alforjita-interprete.js';
import { validarConsulta, fechaLarga } from '../../src/domain/alforjita.js';

// Spec 008: reglas simples del intérprete de Alforjita (D-04, M-14). Datos FICTICIOS.

const CTX = {
  hoy: '2026-11-21', // sábado
  categorias: [
    { id: 'c-danza', name: 'Danza' },
    { id: 'c-teatro', name: 'Teatro' },
    { id: 'c-expo', name: 'Exposición' },
  ],
  sedes: [
    { id: 'v-museo', name: 'Museo de Ejemplo' },
    { id: 'v-teatro', name: 'Teatro de Ejemplo' },
    { id: 'v-plaza', name: 'Plaza de Ejemplo' },
  ],
  actividades: [
    { id: 'a-doble', title: 'Obra de ejemplo con doble función' },
    { id: 'a-fuego', title: 'La Danza del Fuego' },
    { id: 'a-luna1', title: 'Cantos de Luna Nueva' },
    { id: 'a-luna2', title: 'Cantos de Luna Llena' },
  ],
};
const leer = (texto) => interpretar(texto, CTX);
const criterios = (texto) => leer(texto).criteria;

test('SC-011: «¿Qué funciones gratuitas de danza hay después de las seis?» asume hoy, desde las 18:00, danza y gratuitas', () => {
  assert.deepEqual(leer('¿Qué funciones gratuitas de danza hay después de las seis?'), {
    intent: 'search',
    criteria: { date: '2026-11-21', from: '18:00', until: null, categoryId: 'c-danza', venueId: null, access: 'free', activityId: null },
    assumedDay: true,
    activityIds: [],
    invalidDate: false,
  });
});

test('M-14: de 1 a 11 sin «de la mañana» es de tarde o noche; «después de» incluye la hora', () => {
  assert.equal(criterios('después de las 6').from, '18:00');
  assert.equal(criterios('desde las seis y media').from, '18:30');
  assert.equal(criterios('a partir de las 6 de la mañana').from, '06:00');
  assert.equal(criterios('después de las 6 am').from, '06:00');
  assert.equal(criterios('después de 6pm').from, '18:00');
  assert.equal(criterios('antes de las 18h').until, '18:00');
  assert.equal(criterios('a las 12').from, '12:00');
  assert.equal(criterios('desde las 20:30').from, '20:30');
  assert.deepEqual([criterios('a las 7').from, criterios('a las 7').until], ['19:00', '20:00']);
  assert.deepEqual([criterios('desde las 10 de la mañana hasta las 2').from, criterios('desde las 10 de la mañana hasta las 2').until], ['10:00', '14:00']);
  // «a una función» no es una hora: con palabras hace falta el artículo («a la una»).
  assert.equal(criterios('¿puedo ir a una función hoy?').from, null);
  assert.equal(criterios('a la una').from, '13:00');
  assert.equal(horaDe([' a las 25', 'a', '25', undefined, undefined, undefined, undefined]), null);
});

test('M-14: «mañana» sola es el día siguiente; «en la mañana», «en la tarde» y «en la noche» son franjas del día', () => {
  assert.deepEqual(criterios('¿qué hay mañana?').date, '2026-11-22');
  assert.deepEqual(criterios('qué hay pasado mañana').date, '2026-11-23');
  const m = criterios('¿qué hay en la mañana?');
  assert.deepEqual([m.date, m.from, m.until], ['2026-11-21', null, '12:00']);
  const mm = criterios('mañana en la mañana');
  assert.deepEqual([mm.date, mm.until], ['2026-11-22', '12:00']);
  const tarde = criterios('teatro por la tarde');
  assert.deepEqual([tarde.from, tarde.until, tarde.categoryId], ['12:00', '18:00', 'c-teatro']);
  const noche = leer('¿qué hay esta noche?');
  assert.deepEqual([noche.criteria.date, noche.criteria.from, noche.assumedDay], ['2026-11-21', '18:00', false]);
});

test('Días: hoy, nombres de día (la próxima vez, hoy incluido), «sábado 28», «el 22», «22 de noviembre» e ISO', () => {
  assert.equal(leer('qué hay hoy').assumedDay, false);
  assert.equal(criterios('el domingo').date, '2026-11-22');
  assert.equal(criterios('el sábado').date, '2026-11-21');
  assert.equal(criterios('el viernes').date, '2026-11-27');
  assert.equal(criterios('¿el sábado 28 hay danza?').date, '2026-11-28');
  assert.equal(criterios('hay algo el 22').date, '2026-11-22');
  assert.equal(criterios('22 de noviembre').date, '2026-11-22');
  assert.equal(criterios('funciones del 2026-11-25').date, '2026-11-25');
  assert.deepEqual(leer('31 de febrero'), { intent: 'not_understood', invalidDate: true });
  // Un número suelto no es un día.
  assert.equal(criterios('funciones para 2 personas').date, '2026-11-21');
});

test('Acceso, categorías, sedes y títulos por su nombre en el catálogo, sin tildes ni mayúsculas', () => {
  assert.equal(criterios('EXPOSICIONES GRATIS').categoryId, 'c-expo');
  assert.equal(criterios('exposiciones gratis').access, 'free');
  assert.equal(criterios('obras de pago').access, 'paid');
  // El nombre más largo gana: «Teatro de Ejemplo» es la sede, no la categoría Teatro.
  const sede = criterios('qué hay en el teatro de ejemplo');
  assert.deepEqual([sede.venueId, sede.categoryId], ['v-teatro', null]);
  assert.equal(criterios('que hay en el museo').venueId, 'v-museo');
  // Un título: se buscan sus funciones desde hoy, sin asumir el día.
  const obra = leer('¿a qué hora es la danza del fuego?');
  assert.deepEqual([obra.criteria.activityId, obra.criteria.date, obra.assumedDay], ['a-fuego', null, false]);
  // Dos títulos posibles: se pide elegir.
  assert.deepEqual(leer('cantos de luna').activityIds, ['a-luna1', 'a-luna2']);
  assert.deepEqual(leer('cantos luna nueva').activityIds, ['a-luna1']);
});

test('FR-012: precio, hora de fin y accesibilidad son intenciones propias', () => {
  assert.deepEqual(leer('¿Cuánto cuesta La Danza del Fuego?'), { intent: 'price', activityIds: ['a-fuego'] });
  assert.equal(leer('¿a qué hora termina la obra de ejemplo con doble función?').intent, 'end');
  assert.equal(leer('¿cuánto dura la danza del fuego?').intent, 'end');
  assert.deepEqual(leer('¿el museo tiene baño accesible?'), { intent: 'accessibility', venueIds: ['v-museo'], features: ['accessible_toilet'] });
  assert.deepEqual(leer('¿se puede entrar en silla de ruedas a la plaza?').features, ['step_free']);
  assert.deepEqual(leer('¿es accesible?').venueIds, []);
});

test('FR-013, FR-016, FR-017: fuera de alcance con su pantalla; Pasaporte y rutas se explican', () => {
  const tema = (t) => leer(t).topic;
  assert.equal(tema('Quiero comprar una entrada'), 'buy');
  assert.equal(tema('reservar un asiento'), 'buy');
  assert.equal(tema('canjear mi sello'), 'redeem');
  assert.equal(tema('¿dónde están mis entradas?'), 'tickets');
  assert.equal(tema('mis sellos'), 'passport_personal');
  assert.equal(tema('¿cuál es mi progreso?'), 'passport_personal');
  assert.equal(tema('quiero cambiar la hora de una función'), 'modify');
  assert.equal(tema('muéstrame los borradores'), 'modify');
  assert.equal(tema('¿qué entradas compró mi amiga?'), 'others_data');
  assert.equal(leer('¿Cómo funciona el pasaporte?').intent, 'passport_routes');
  assert.equal(leer('¿qué son las rutas?').intent, 'passport_routes');
  assert.equal(leer('¿hubo cambios?').intent, 'changes');
  assert.equal(leer('funciones canceladas').intent, 'changes');
  // «de pago» no es comprar.
  assert.equal(leer('funciones de pago').intent, 'search');
});

test('FR-021: lo que no entiende no se inventa; los datos personales se descartan', () => {
  assert.equal(leer('asdf qwer').intent, 'not_understood');
  assert.equal(leer('hola').intent, 'not_understood');
  assert.equal(leer('¿qué hay?').intent, 'search');
  // Un correo o un teléfono no se usan para nada.
  assert.equal(leer('ana@correo.test').intent, 'not_understood');
  assert.equal(leer('0991234567').intent, 'not_understood');
  assert.equal(criterios('mi correo es ana@correo.test, ¿qué hay hoy?').date, '2026-11-21');
});

test('Consulta: exactamente uno de texto, pregunta rápida o criterios; texto limpio de 1 a 200 caracteres', () => {
  assert.equal(limpiarTexto('  hola\u0000\n mundo  '), 'hola mundo');
  assert.deepEqual(validarConsulta({ text: '  ¿qué hay?  ' }), { text: '¿qué hay?' });
  assert.deepEqual(validarConsulta({ quick: 'today' }), { quick: 'today', venueId: null });
  const campos = (cuerpo) => {
    try {
      validarConsulta(cuerpo);
      return [];
    } catch (e) {
      return Object.keys(e.extra.fields);
    }
  };
  assert.deepEqual(campos({}), ['text']);
  assert.deepEqual(campos({ text: '   ' }), ['text']);
  assert.deepEqual(campos({ text: 'x'.repeat(201) }), ['text']);
  assert.deepEqual(campos({ text: 'x'.repeat(200) }), []);
  assert.deepEqual(campos({ text: 'hola', quick: 'today' }), ['text']);
  assert.deepEqual(campos({ quick: 'borradores' }), ['quick']);
  assert.deepEqual(campos({ criteria: { date: '2026-02-30', from: '25:00', access: 'gratis' } }), ['criteria.date', 'criteria.from', 'criteria.access']);
  assert.deepEqual(campos({ criteria: {}, intent: 'comprar' }), ['intent']);
  assert.equal(fechaLarga('2026-11-21'), 'sábado 21 de noviembre');
});
