// Formateadores y etiquetas de dominio para VIVART (RNF-08, RC-03).
// Nunca deduce datos ausentes ni usa el reloj del navegador para decidir «hoy» o «ahora».

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DIAS_ISO = { 1: 'lun', 2: 'mar', 3: 'mié', 4: 'jue', 5: 'vie', 6: 'sáb', 7: 'dom' };

/** Formatea AAAA-MM-DD sin aplicar husos horarios del navegador. */
export function formatoFecha(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return 'Por confirmar';
  const partes = isoDate.split('-').map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return isoDate;
  const [anio, mes, dia] = partes;
  const d = new Date(Date.UTC(anio, mes - 1, dia, 12, 0, 0));
  return `${DIAS_SEMANA[d.getUTCDay()]}, ${dia} ${MESES[mes - 1]} ${anio}`;
}

export function formatoFechaCorta(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return 'Por confirmar';
  const partes = isoDate.split('-').map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return isoDate;
  const [, mes, dia] = partes;
  return `${dia} ${MESES[mes - 1]}`;
}

export function formatoFechaHoraIso(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('es-EC', {
      timeZone: 'America/Guayaquil',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatoHorarioFuncion(fn) {
  if (!fn?.startTime) return 'Por confirmar';
  return fn.endTime ? `${fn.startTime} – ${fn.endTime}` : `${fn.startTime}`;
}

export function formatoDuracion(minutos) {
  if (!Number.isInteger(minutos) || minutos <= 0) return 'Por confirmar';
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatoFranjaDias(slot) {
  if (!slot) return 'Por confirmar';
  if (Array.isArray(slot.dates) && slot.dates.length > 0) {
    if (slot.dates.length <= 3) return slot.dates.map(formatoFechaCorta).join(', ');
    return `${slot.dates.length} fechas (${formatoFechaCorta(slot.dates[0])} – ${formatoFechaCorta(slot.dates.at(-1))})`;
  }
  const rango = slot.from && slot.to ? `Del ${formatoFechaCorta(slot.from)} al ${formatoFechaCorta(slot.to)}` : 'Fechas por confirmar';
  if (Array.isArray(slot.weekdays) && slot.weekdays.length > 0 && slot.weekdays.length < 7) {
    const nombres = slot.weekdays.map((n) => DIAS_ISO[n]).filter(Boolean).join(', ');
    return `${rango} (${nombres})`;
  }
  return rango;
}

/** Estado temporal estrictamente desde `timeStatus` de la API (RC-03). */
export function etiquetaTiempo(timeStatus) {
  const mapa = {
    upcoming: { texto: 'Próxima', clase: 'estado-proxima' },
    in_progress: { texto: 'En curso', clase: 'estado-curso' },
    start_passed: { texto: 'Hora de inicio pasada', clase: 'estado-pasada' },
    finished: { texto: 'Terminada', clase: 'estado-terminada' },
    cancelled: { texto: 'Cancelada', clase: 'estado-cancelada' },
  };
  return mapa[timeStatus] ?? null;
}

export function etiquetaAviso(kind) {
  const mapa = {
    rescheduled: 'Reprogramación',
    cancelled: 'Cancelación',
    changed: 'Cambio en la programación',
  };
  return mapa[kind] ?? 'Aviso';
}

export function claseAcceso(mode) {
  if (mode === 'free') return 'acceso-gratuita';
  if (mode === 'paid') return 'acceso-pago';
  return 'acceso-pendiente';
}

export function etiquetaEstadoEditorial(item) {
  if (item.status === 'archived') return { texto: 'Archivada', clase: 'ed-archivada' };
  if (item.published && (item.hasPendingRevision || item.editorialState !== 'none')) {
    const sub = item.editorialState === 'in_review' ? ' (en revisión)' : item.editorialState === 'returned' ? ' (devuelta)' : '';
    return { texto: `Publicada con cambios pendientes${sub}`, clase: 'ed-revision-pendiente' };
  }
  if (item.published) return { texto: 'Publicada', clase: 'ed-publicada' };
  const mapa = {
    draft: { texto: 'Borrador', clase: 'ed-borrador' },
    in_review: { texto: 'En revisión', clase: 'ed-revision' },
    returned: { texto: 'Devuelta', clase: 'ed-devuelta' },
  };
  return mapa[item.editorialState] ?? { texto: 'Borrador', clase: 'ed-borrador' };
}

export function iconoParaCategoria(nombre) {
  const n = String(nombre ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (n.includes('teatro') || n.includes('escen')) return 'teatro';
  if (n.includes('music') || n.includes('conciert')) return 'musica';
  if (n.includes('danz') || n.includes('baile')) return 'danza';
  if (n.includes('expos') || n.includes('arte') || n.includes('visual') || n.includes('galer')) return 'arte';
  if (n.includes('calle') || n.includes('desfil') || n.includes('recorr')) return 'recorrido';
  return 'estrella';
}

export function describirCambioAsistencia(c) {
  if (!c) return 'Cambio en la programación';
  if (c.type === 'function_rescheduled') return `Se reprograma la función ${c.functionId} (cambio de fecha, hora o sede).`;
  if (c.type === 'function_removed') return `Se cancela/retira la función publicada ${c.functionId}.`;
  if (c.type === 'slots_changed') return 'Se modifican las franjas de apertura publicadas.';
  return `Cambio: ${c.type ?? 'programación'}`;
}

export function etiquetaResultadoCarga(outcome) {
  const mapa = {
    pending: { texto: 'Pendiente', clase: 'ed-borrador' },
    loaded: { texto: 'Cargado como borrador', clase: 'ed-publicada' },
    skipped_existing: { texto: 'Omitido (ya existía)', clase: 'ed-revision-pendiente' },
    skipped_error: { texto: 'Omitido (con errores)', clase: 'ed-devuelta' },
  };
  return mapa[outcome] ?? { texto: outcome, clase: 'ed-borrador' };
}
