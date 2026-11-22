import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarTexto,
  validarIcono,
  validarColor,
  validarMeta,
  validarDatosRuta,
  calcularRutaEnRevision,
  formatearProgreso,
  ICONOS_INSIGNIA,
  COLORES_INSIGNIA,
} from '../../src/domain/routes.js';

test('validarTexto: valida longitudes mínima y máxima', () => {
  assert.equal(validarTexto('nombre', '   Hola Mundo  ', 3, 20), 'Hola Mundo');
  assert.throws(() => validarTexto('nombre', 'ab', 3, 20), { message: /entre 3 y 20/ });
  assert.throws(() => validarTexto('nombre', '123456789012345678901', 3, 20), { message: /entre 3 y 20/ });
  assert.throws(() => validarTexto('nombre', 123, 3, 20), { message: /debe ser texto/ });
});

test('validarIcono y validarColor: restringen a catálogos oficiales de VIVART', () => {
  for (const icono of ICONOS_INSIGNIA) {
    assert.equal(validarIcono(icono), icono);
  }
  assert.throws(() => validarIcono('dragon'), { message: /icono de la insignia debe ser uno de/ });

  for (const color of COLORES_INSIGNIA) {
    assert.equal(validarColor(color), color);
  }
  assert.throws(() => validarColor('azul'), { message: /color de la insignia debe ser uno de/ });
});

test('validarMeta: rechaza metas no enteras, <= 0 o mayores al total de elegibles (FR-003, SC-007)', () => {
  assert.equal(validarMeta(3, 5), 3);
  assert.equal(validarMeta(5, 5), 5);
  assert.throws(() => validarMeta(0, 5), { message: /mayor a 0/ });
  assert.throws(() => validarMeta(-1, 5), { message: /mayor a 0/ });
  assert.throws(() => validarMeta(3.5, 5), { message: /número entero/ });
  assert.throws(() => validarMeta(6, 5), { message: /no puede ser mayor/ });
});

test('validarDatosRuta: valida objeto completo de entrada', () => {
  const datos = {
    title: 'Ruta Teatral',
    description: 'Recorrido por las obras teatrales del festival',
    badgeTitle: 'Explorador del Escenario',
    badgeDescription: 'Completaste 3 funciones teatrales',
    badgeIcon: 'teatro',
    badgeColor: 'violeta',
    goal: 3,
  };
  const validados = validarDatosRuta(datos, 4);
  assert.equal(validados.title, 'Ruta Teatral');
  assert.equal(validados.goal, 3);
  assert.equal(validados.badgeIcon, 'teatro');
});

test('calcularRutaEnRevision: true si funciones activas son menores a la meta (FR-020, SC-011)', () => {
  const funciones = [
    { id: 'f1', status: 'active' },
    { id: 'f2', status: 'active' },
    { id: 'f3', status: 'active' },
  ];
  assert.equal(calcularRutaEnRevision(funciones, 3), false);

  const conCancelada = [
    { id: 'f1', status: 'active' },
    { id: 'f2', status: 'active' },
    { id: 'f3', status: 'cancelled' },
  ];
  // 2 activas < 3 requeridas => Ruta en revisión
  assert.equal(calcularRutaEnRevision(conCancelada, 3), true);

  // Si meta era 2 y quedan 2 activas => Sigue viable
  assert.equal(calcularRutaEnRevision(conCancelada, 2), false);
});

test('formatearProgreso: entrega denominador de la ruta y estado de completitud', () => {
  const p = formatearProgreso(2, 3);
  assert.deepEqual(p, {
    current: 2,
    goal: 3,
    formatted: '2 de 3',
    completed: false,
  });

  const pCompleto = formatearProgreso(3, 3);
  assert.deepEqual(pCompleto, {
    current: 3,
    goal: 3,
    formatted: '3 de 3',
    completed: true,
  });
});
