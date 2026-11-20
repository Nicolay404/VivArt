import { randomUUID } from 'node:crypto';
import { fechaValida, horaValida, minutos } from '../clock.js';
import { textoONulo } from './text.js';

// Contenido editable de una actividad (ver data-model.md, «Contenido»).
// Guardar un borrador NO exige nada (FR-030); enviarlo a revisión sí (validarEnvio).
// Nunca se completa ni se deduce un dato ausente (FR-004): lo que no llega queda en null.

export const MODOS_ACCESO = ['free', 'paid', 'unconfirmed'];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const nuevoId = (prefijo) => `${prefijo}_${randomUUID().replaceAll('-', '').slice(0, 16)}`;

const texto = (v) => (typeof v === 'string' ? v.trim() || null : null);
const enteroPositivo = (v) => (Number.isInteger(v) && v > 0 && v < 100000 ? v : null);

function precio(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
}

function normalizarFuncion(f = {}) {
  return {
    id: typeof f.id === 'string' && ID_RE.test(f.id) ? f.id : nuevoId('fn'),
    date: texto(f.date),
    startTime: texto(f.startTime),
    endTime: texto(f.endTime),
    durationMinutes: enteroPositivo(f.durationMinutes),
    venueId: texto(f.venueId),
  };
}

function normalizarFranja(s = {}) {
  const fechas = Array.isArray(s.dates) ? s.dates.map(texto).filter(Boolean).slice(0, 400) : null;
  const dias = Array.isArray(s.weekdays) ? [...new Set(s.weekdays.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort((x, y) => x - y) : null;
  return {
    id: typeof s.id === 'string' && ID_RE.test(s.id) ? s.id : nuevoId('fr'),
    venueId: texto(s.venueId),
    dates: fechas && fechas.length ? fechas : null,
    from: texto(s.from),
    to: texto(s.to),
    weekdays: dias && dias.length ? dias : null,
    opens: texto(s.opens),
    closes: texto(s.closes),
  };
}

/** Normaliza lo que envía el panel. Acepta datos incompletos; descarta lo que no tiene la forma esperada. */
export function normalizarContenido(entrada = {}) {
  const e = entrada && typeof entrada === 'object' ? entrada : {};
  const acceso = e.access && typeof e.access === 'object' ? e.access : {};
  const modo = MODOS_ACCESO.includes(acceso.mode) ? acceso.mode : 'unconfirmed';
  return {
    title: textoONulo(e.title, 300),
    artists: Array.isArray(e.artists) ? e.artists.map((a) => textoONulo(a, 200)).filter(Boolean).slice(0, 50) : [],
    organization: textoONulo(e.organization, 300),
    description: textoONulo(e.description, 10000),
    categoryId: texto(e.categoryId),
    durationMinutes: enteroPositivo(e.durationMinutes),
    // Gratuita no lleva precio; de pago sin precio = «precio por confirmar» (nunca gratuidad).
    access: { mode: modo, priceUsd: modo === 'free' ? null : precio(acceso.priceUsd) },
    functions: Array.isArray(e.functions) ? e.functions.slice(0, 200).map(normalizarFuncion) : [],
    slots: Array.isArray(e.slots) ? e.slots.slice(0, 100).map(normalizarFranja) : [],
  };
}

export const contenidoVacio = () => normalizarContenido({});

function erroresFuncion(f, sedes) {
  const errores = {};
  if (!fechaValida(f.date)) errores.date = 'La función necesita una fecha válida (AAAA-MM-DD).';
  if (!horaValida(f.startTime)) errores.startTime = 'La función necesita una hora de inicio (HH:MM).';
  if (f.endTime !== null && !horaValida(f.endTime)) errores.endTime = 'La hora de fin no es válida (HH:MM).';
  if (horaValida(f.startTime) && horaValida(f.endTime) && minutos(f.endTime) <= minutos(f.startTime)) {
    errores.endTime = 'La hora de fin debe ser posterior a la de inicio.';
  }
  if (!f.venueId || !sedes.has(f.venueId)) errores.venueId = 'La función necesita una sede existente.';
  return errores;
}

function erroresFranja(s, sedes) {
  const errores = {};
  if (!s.venueId || !sedes.has(s.venueId)) errores.venueId = 'La franja necesita una sede existente.';
  const porFechas = s.dates && s.dates.length > 0;
  const porRango = s.from || s.to;
  if (!porFechas && !porRango) {
    errores.dates = 'La franja necesita días: una lista de fechas o un rango desde–hasta.';
  } else if (porFechas && s.dates.some((d) => !fechaValida(d))) {
    errores.dates = 'Hay fechas no válidas (AAAA-MM-DD).';
  } else if (!porFechas && (!fechaValida(s.from) || !fechaValida(s.to) || s.from > s.to)) {
    errores.dates = 'El rango de días no es válido: «desde» y «hasta» con «desde» antes de «hasta».';
  }
  if (!horaValida(s.opens) || !horaValida(s.closes)) errores.opens = 'La franja necesita horario de apertura y cierre (HH:MM).';
  else if (minutos(s.closes) <= minutos(s.opens)) errores.closes = 'El cierre debe ser posterior a la apertura.';
  return errores;
}

/**
 * Requisitos para enviar a revisión (FR-030, SC-012): título, categoría y al menos una función o franja válida.
 * Una función o franja presente pero inválida impide el envío. Devuelve { campo: mensaje } (vacío si se puede enviar).
 */
export function validarEnvio(contenido, { categorias, sedes }) {
  const campos = {};
  if (!contenido.title) campos.title = 'Falta el título.';
  if (!contenido.categoryId) campos.categoryId = 'Falta la categoría.';
  else if (!categorias.has(contenido.categoryId)) campos.categoryId = 'La categoría no existe.';

  contenido.functions.forEach((f, i) => {
    for (const [k, m] of Object.entries(erroresFuncion(f, sedes))) campos[`functions[${i}].${k}`] = m;
  });
  contenido.slots.forEach((s, i) => {
    for (const [k, m] of Object.entries(erroresFranja(s, sedes))) campos[`slots[${i}].${k}`] = m;
  });
  if (contenido.functions.length === 0 && contenido.slots.length === 0) {
    campos.functions = 'Añade al menos una función con fecha, hora y sede, o una franja de apertura.';
  }
  return campos;
}

const mismaFranja = (a, b) =>
  a.venueId === b.venueId &&
  JSON.stringify(a.dates ?? null) === JSON.stringify(b.dates ?? null) &&
  (a.from ?? null) === (b.from ?? null) &&
  (a.to ?? null) === (b.to ?? null) &&
  JSON.stringify(a.weekdays ?? null) === JSON.stringify(b.weekdays ?? null) &&
  a.opens === b.opens &&
  a.closes === b.closes;

/**
 * Cambios que afectan la asistencia frente a lo ya publicado (FR-015, FR-016, FR-019):
 * mover fecha, hora o sede de una función vigente, quitarla (se cancelará) o cambiar o quitar una franja publicada.
 * Las funciones y franjas nuevas y las correcciones de texto o categoría no exigen aviso.
 */
export function cambiosDeAsistencia(funcionesPublicadas, franjasPublicadas, contenido) {
  const cambios = [];
  const nuevas = new Map(contenido.functions.map((f) => [f.id, f]));
  for (const p of funcionesPublicadas) {
    if (p.status === 'cancelled') continue;
    const n = nuevas.get(p.id);
    if (!n) cambios.push({ type: 'function_removed', functionId: p.id });
    else if (n.date !== p.date || n.startTime !== p.startTime || n.venueId !== p.venueId) {
      cambios.push({ type: 'function_rescheduled', functionId: p.id });
    }
  }
  const franjas = new Map(contenido.slots.map((s) => [s.id, s]));
  for (const p of franjasPublicadas) {
    const n = franjas.get(p.id);
    if (!n) cambios.push({ type: 'slot_removed', slotId: p.id });
    else if (!mismaFranja(n, p)) cambios.push({ type: 'slot_changed', slotId: p.id });
  }
  return cambios;
}
