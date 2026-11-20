// Reloj común en hora de Loja (RC-07, RNF-10). Loja usa UTC−5 todo el año (sin horario de verano).
// Las funciones y franjas se guardan como fecha y hora LOCALES de Loja; aquí se traducen desde un instante.

export const ZONA = 'America/Guayaquil';
const DESFASE_MS = -5 * 3600 * 1000;

const dos = (n) => String(n).padStart(2, '0');

/** Fecha (AAAA-MM-DD), hora (HH:MM), minutos del día y día de la semana (1 = lunes … 7 = domingo) en Loja. */
export function enLoja(instante) {
  const local = new Date(instante.getTime() + DESFASE_MS);
  const date = `${local.getUTCFullYear()}-${dos(local.getUTCMonth() + 1)}-${dos(local.getUTCDate())}`;
  const time = `${dos(local.getUTCHours())}:${dos(local.getUTCMinutes())}`;
  const diaSemana = local.getUTCDay() === 0 ? 7 : local.getUTCDay();
  return { date, time, minutes: local.getUTCHours() * 60 + local.getUTCMinutes(), weekday: diaSemana };
}

/** Referencia pública del reloj, la que muestran la Agenda y «¿Qué hay ahora?». */
export function referencia(clock, fixed = false) {
  const ahora = clock();
  const { date, time } = enLoja(ahora);
  return { now: ahora.toISOString(), date, time, timeZone: ZONA, fixed };
}

/** Minutos desde la medianoche de un texto HH:MM. */
export const minutos = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};

/** Día de la semana (1 = lunes … 7 = domingo) de una fecha AAAA-MM-DD. */
export function diaDeLaSemana(fecha) {
  const d = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Suma minutos a una fecha y hora locales y devuelve { date, time }. */
export function sumarMinutos(fecha, hhmm, mins) {
  const base = new Date(`${fecha}T${hhmm}:00Z`);
  const d = new Date(base.getTime() + mins * 60000);
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
}

export const FECHA_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function fechaValida(texto) {
  if (typeof texto !== 'string' || !FECHA_RE.test(texto)) return false;
  const d = new Date(`${texto}T12:00:00Z`);
  return d.toISOString().slice(0, 10) === texto;
}

export const horaValida = (texto) => typeof texto === 'string' && HORA_RE.test(texto);
