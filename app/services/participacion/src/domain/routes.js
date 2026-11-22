import { randomBytes } from 'node:crypto';
import { AppError, badRequest } from '../http/errors.js';

export const ICONOS_INSIGNIA = ['teatro', 'musica', 'danza', 'artes-vivas', 'patrimonio', 'estrella', 'brujula'];
export const COLORES_INSIGNIA = ['violeta', 'atardecer', 'terracota', 'esmeralda'];

export const nuevoId = (prefijo) => `${prefijo}_${randomBytes(12).toString('base64url')}`;

export function validarTexto(nombre, valor, min, max) {
  if (typeof valor !== 'string') {
    throw badRequest(`El campo ${nombre} debe ser texto.`);
  }
  const limpio = valor.trim();
  if (limpio.length < min || limpio.length > max) {
    throw badRequest(`El campo ${nombre} debe tener entre ${min} y ${max} caracteres.`);
  }
  return limpio;
}

export function validarIcono(icono) {
  if (typeof icono !== 'string' || !ICONOS_INSIGNIA.includes(icono.trim())) {
    throw badRequest(`El icono de la insignia debe ser uno de: ${ICONOS_INSIGNIA.join(', ')}.`);
  }
  return icono.trim();
}

export function validarColor(color) {
  if (typeof color !== 'string' || !COLORES_INSIGNIA.includes(color.trim())) {
    throw badRequest(`El color de la insignia debe ser uno de: ${COLORES_INSIGNIA.join(', ')}.`);
  }
  return color.trim();
}

/**
 * Valida que la meta sea un entero positivo y alcanzable respecto al total de funciones elegibles (FR-003, SC-007).
 */
export function validarMeta(meta, totalElegibles) {
  const n = Number(meta);
  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest('La meta debe ser un número entero mayor a 0.');
  }
  if (n > totalElegibles) {
    throw new AppError(422, 'unreachable_goal', `La meta (${n}) no puede ser mayor al número de funciones elegibles (${totalElegibles}).`);
  }
  return n;
}

/**
 * Valida todos los campos requeridos para crear o actualizar una ruta e insignia (FR-001, FR-004).
 */
export function validarDatosRuta(datos, totalElegibles) {
  const title = validarTexto('título de la ruta', datos.title, 3, 120);
  const description = validarTexto('descripción de la ruta', datos.description, 10, 500);
  const badgeTitle = validarTexto('nombre de la insignia', datos.badgeTitle, 3, 80);
  const badgeDescription = validarTexto('descripción de la insignia', datos.badgeDescription, 5, 280);
  const badgeIcon = validarIcono(datos.badgeIcon);
  const badgeColor = validarColor(datos.badgeColor);
  const goal = validarMeta(datos.goal, totalElegibles);

  return {
    title,
    description,
    badgeTitle,
    badgeDescription,
    badgeIcon,
    badgeColor,
    goal,
  };
}

/**
 * Determina si una ruta queda en estado «Ruta en revisión» (R-07, RF-30, FR-020, SC-011).
 * Ocurre cuando las funciones elegibles activas (no canceladas) son estrictamente menores a la meta.
 */
export function calcularRutaEnRevision(funcionesElegibles, goal) {
  if (!Array.isArray(funcionesElegibles) || funcionesElegibles.length === 0) return true;
  const activas = funcionesElegibles.filter((f) => f && f.status !== 'cancelled').length;
  return activas < goal;
}

/**
 * Formatea el progreso de un usuario en una ruta con denominador estricto (M-01, FR-012, FR-015).
 */
export function formatearProgreso(conteoDistintos, goal) {
  const current = Number(conteoDistintos) || 0;
  return {
    current,
    goal,
    formatted: `${current} de ${goal}`,
    completed: current >= goal,
  };
}
