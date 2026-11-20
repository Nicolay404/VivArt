import { enLoja, minutos, diaDeLaSemana, sumarMinutos } from '../clock.js';

// Estado temporal de una función y franjas abiertas (FR-005, FR-006, RC-03).
// Sin hora de fin ni duración conocida, una función empezada es «Hora de inicio pasada»:
// nunca se dice «en curso» ni «terminada», porque no se sabe.

const momento = (fecha, hora) => `${fecha} ${hora}`;

/** Fin conocido de una función (o null): hora de fin, o su duración, o la duración de la actividad. */
export function finConocido(funcion, duracionActividad = null) {
  if (funcion.endTime) return momento(funcion.date, funcion.endTime);
  const duracion = funcion.durationMinutes ?? duracionActividad;
  if (duracion) {
    const fin = sumarMinutos(funcion.date, funcion.startTime, duracion);
    return momento(fin.date, fin.time);
  }
  return null;
}

/** upcoming | in_progress | start_passed | finished | cancelled */
export function estadoTemporal(funcion, ahora, duracionActividad = null) {
  if (funcion.status === 'cancelled') return 'cancelled';
  const ref = enLoja(ahora);
  const actual = momento(ref.date, ref.time);
  if (actual < momento(funcion.date, funcion.startTime)) return 'upcoming';
  const fin = finConocido(funcion, duracionActividad);
  if (!fin) return 'start_passed';
  return actual < fin ? 'in_progress' : 'finished';
}

/** ¿La franja abre en esa fecha? Por lista de fechas, o por rango con días de la semana opcionales. */
export function franjaAplicaEn(franja, fecha) {
  if (Array.isArray(franja.dates) && franja.dates.length) return franja.dates.includes(fecha);
  if (!franja.from || !franja.to || fecha < franja.from || fecha > franja.to) return false;
  return !Array.isArray(franja.weekdays) || franja.weekdays.length === 0 || franja.weekdays.includes(diaDeLaSemana(fecha));
}

/** ¿La franja está abierta en este instante? Se abre a la hora indicada y cierra a la hora de cierre (excluida). */
export function franjaAbierta(franja, ahora) {
  const ref = enLoja(ahora);
  return franjaAplicaEn(franja, ref.date) && ref.minutes >= minutos(franja.opens) && ref.minutes < minutos(franja.closes);
}

/**
 * «¿Qué hay ahora?» a partir de las actividades publicadas: franjas abiertas ahora, funciones de hoy aún por empezar,
 * en curso (solo si se conoce el fin) y con hora de inicio pasada. Las canceladas no aparecen.
 */
export function queHayAhora(actividades, ahora) {
  const hoy = enLoja(ahora).date;
  const openSlots = [];
  const upcoming = [];
  const inProgress = [];
  const startPassed = [];
  for (const a of actividades) {
    for (const s of a.slots) if (franjaAbierta(s, ahora)) openSlots.push({ activity: a, slot: s });
    for (const f of a.functions) {
      if (f.status === 'cancelled' || f.date !== hoy) continue;
      const estado = estadoTemporal(f, ahora, a.durationMinutes);
      const item = { activity: a, function: f, timeStatus: estado };
      if (estado === 'upcoming') upcoming.push(item);
      else if (estado === 'in_progress') inProgress.push(item);
      else if (estado === 'start_passed') startPassed.push(item);
    }
  }
  const porHora = (x, y) => x.function.startTime.localeCompare(y.function.startTime);
  return { openSlots, upcoming: upcoming.sort(porHora), inProgress: inProgress.sort(porHora), startPassed: startPassed.sort(porHora) };
}
