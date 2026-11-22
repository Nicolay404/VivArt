import { enLoja, referencia, fechaValida, horaValida } from '../clock.js';
import { estadoTemporal, finConocido, franjaAplicaEn } from './now.js';
import { etiquetaAcceso } from './presenter.js';
import { interpretar, limpiarTexto, sumarDias, TEXTO_MAX } from './alforjita-interprete.js';
import { AppError, validation } from '../http/errors.js';

// Alforjita (spec 008): responde sobre el catálogo publicado vigente, el mismo que lee la Agenda (FR-006).
// No guarda ni registra nada de lo que se pregunta y nunca repite el texto recibido (M-17, FR-028).
// No consulta entradas, sellos ni progreso (otro servicio) ni borradores: solo `agenda.publicadas()`.

export const MAX_RESULTADOS = 10;
export const PREGUNTAS_RAPIDAS = ['today', 'free_today', 'tonight', 'venue', 'changes', 'passport_routes'];
const ACCESOS = new Set(['free', 'paid']);
const INTENCIONES = new Set(['search', 'price', 'end', 'accessibility']);

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** «sábado 21 de noviembre» */
export function fechaLarga(fecha) {
  const d = new Date(`${fecha}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

const conMayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const enlaceAgenda = { label: 'Abrir la Agenda', href: '/agenda' };

const FUERA_DE_ALCANCE = {
  buy: {
    message: 'No puedo comprar entradas. Si la función tiene venta, la compras desde su ficha y pagas en el Carrito.',
    links: [{ label: 'Ir al Carrito', href: '/carrito' }],
  },
  redeem: {
    message:
      'No puedo canjear sellos. El sello se reclama escaneando con tu cuenta el QR del Pasaporte que hay en la función, mientras su canje está abierto.',
    links: [{ label: 'Ir al Pasaporte', href: '/pasaporte' }],
  },
  tickets: {
    message: 'No consulto entradas ni pedidos: son datos personales. Los ves en Mis entradas, con tu sesión iniciada.',
    links: [{ label: 'Ir a Mis entradas', href: '/mis-entradas' }],
  },
  passport_personal: {
    message: 'No consulto tus sellos, rutas ni progreso: son datos personales. Los ves en tu Pasaporte, con tu sesión iniciada.',
    links: [{ label: 'Ir al Pasaporte', href: '/pasaporte' }],
  },
  modify: {
    message:
      'No puedo cambiar la programación ni ver borradores o propuestas. Solo consulto lo que ya está publicado; la programación la gestiona el equipo del festival.',
    links: [enlaceAgenda],
  },
  others_data: {
    message: 'No consulto datos de otras personas. Puedo ayudarte con la programación publicada.',
    links: [enlaceAgenda],
  },
};

const PASAPORTE_Y_RUTAS =
  'El Pasaporte Vivo reúne los sellos que consigues en el festival: en las funciones que lo tienen, escaneas con tu cuenta su QR del Pasaporte y obtienes un sello, uno por persona y función, sin necesidad de comprar entrada. Las rutas culturales agrupan funciones del festival: cada ruta tiene su meta, avanzas con los sellos de sus funciones y, al alcanzarla, desbloqueas su insignia. Las rutas se pueden consultar sin cuenta en la página del Pasaporte.';

const NO_ENTENDIDA =
  'No entendí la pregunta. Puedo buscar funciones por día, hora, categoría, sede o si son gratuitas. Prueba con una de estas preguntas o revisa la Agenda.';

const CARACTERISTICAS = {
  step_free: 'acceso sin escalones',
  accessible_toilet: 'baño accesible',
};

// ---------- Validación de la consulta ----------

function textoCorto(v, max = 100) {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

function validarCriterios(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) throw validation({ criteria: 'Criterios no válidos.' });
  const hora = (v) => (v === null || v === undefined ? null : horaValida(v) || v === '24:00' ? v : undefined);
  const r = {
    date: c.date === null || c.date === undefined ? null : fechaValida(c.date) ? c.date : undefined,
    from: hora(c.from),
    until: hora(c.until),
    categoryId: textoCorto(c.categoryId),
    venueId: textoCorto(c.venueId),
    access: c.access === null || c.access === undefined ? null : ACCESOS.has(c.access) ? c.access : undefined,
    activityId: textoCorto(c.activityId),
  };
  const malos = Object.entries(r).filter(([, v]) => v === undefined);
  if (malos.length) throw validation(Object.fromEntries(malos.map(([k]) => [`criteria.${k}`, 'Valor no válido.'])));
  return r;
}

/** Exactamente uno de `text`, `quick` o `criteria`. */
export function validarConsulta(cuerpo) {
  const c = cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo) ? cuerpo : {};
  const presentes = ['text', 'quick', 'criteria'].filter((k) => c[k] !== undefined && c[k] !== null);
  if (presentes.length !== 1) throw validation({ text: 'Escribe tu pregunta o elige una pregunta rápida.' });
  if (presentes[0] === 'text') {
    const texto = limpiarTexto(c.text);
    if (!texto) throw validation({ text: 'Escribe tu pregunta.' });
    if (texto.length > TEXTO_MAX) throw validation({ text: `Escribe como máximo ${TEXTO_MAX} caracteres.` });
    return { text: texto };
  }
  if (presentes[0] === 'quick') {
    if (!PREGUNTAS_RAPIDAS.includes(c.quick)) throw validation({ quick: 'Pregunta rápida desconocida.' });
    return { quick: c.quick, venueId: textoCorto(c.venueId) };
  }
  if (c.intent !== undefined && !INTENCIONES.has(c.intent)) throw validation({ intent: 'Intención no válida.' });
  return { criteria: validarCriterios(c.criteria), intent: c.intent ?? 'search' };
}

// ---------- Selección sobre el catálogo ----------

const dentroDeHoras = (hora, c) => (!c.from || hora >= c.from) && (!c.until || hora < c.until);

/** Primera fecha (desde `desde`) en que abre una franja, o null. Recorre como máximo un año. */
function proximaFechaFranja(s, desde) {
  if (Array.isArray(s.dates) && s.dates.length) return s.dates.filter((d) => d >= desde).sort()[0] ?? null;
  if (!s.to || s.to < desde) return null;
  let d = s.from > desde ? s.from : desde;
  for (let i = 0; i < 366 && d <= s.to; i += 1, d = sumarDias(d, 1)) if (franjaAplicaEn(s, d)) return d;
  return null;
}

/**
 * Funciones y franjas publicadas que cumplen los criterios. Sin fecha: desde hoy. Para hoy, solo lo que aún no empieza
 * (o, en una franja, lo que aún no cierra), salvo cuando se pregunta por una actividad concreta (RC-03).
 */
export function seleccionar(actividades, c, ahora) {
  const ref = enLoja(ahora);
  const hoy = ref.date;
  const resultado = [];
  for (const a of actividades) {
    if (c.activityId && a.id !== c.activityId) continue;
    if (c.categoryId && a.content.categoryId !== c.categoryId) continue;
    if (c.access && a.content.access.mode !== c.access) continue;
    for (const f of a.functions) {
      if (f.status === 'cancelled') continue;
      if (c.date ? f.date !== c.date : f.date < hoy) continue;
      if (c.venueId && f.venueId !== c.venueId) continue;
      if (!dentroDeHoras(f.startTime, c)) continue;
      const estado = estadoTemporal(f, ahora, a.durationMinutes);
      if (f.date === hoy && estado !== 'upcoming' && !(c.activityId && estado === 'start_passed') && !(c.activityId && estado === 'in_progress')) {
        continue;
      }
      resultado.push({ tipo: 'function', actividad: a, funcion: f, date: f.date, hora: f.startTime, estado });
    }
    for (const s of a.slots) {
      if (c.venueId && s.venueId !== c.venueId) continue;
      const fecha = c.date ? (franjaAplicaEn(s, c.date) ? c.date : null) : proximaFechaFranja(s, hoy);
      if (!fecha || fecha < hoy) continue;
      if ((c.from && s.closes <= c.from) || (c.until && s.opens >= c.until)) continue;
      if (fecha === hoy && s.closes <= ref.time) continue;
      resultado.push({ tipo: 'slot', actividad: a, franja: s, date: fecha, hora: s.opens, estado: null });
    }
  }
  return resultado.sort((x, y) => x.date.localeCompare(y.date) || x.hora.localeCompare(y.hora) || x.actividad.content.title.localeCompare(y.actividad.content.title, 'es'));
}

// ---------- Presentación ----------

function item(r, mapas, aviso = null) {
  const a = r.actividad;
  const venueId = r.tipo === 'function' ? r.funcion.venueId : r.franja.venueId;
  const v = mapas.venues.get(venueId);
  const base = {
    type: r.tipo,
    activityId: a.id,
    title: a.content.title,
    href: `/actividad/${encodeURIComponent(a.id)}`,
    date: r.date,
    venue: v ? { id: v.id, name: v.name, kind: v.kind } : null,
    access: { mode: a.content.access.mode, priceUsd: a.content.access.priceUsd ?? null, label: etiquetaAcceso(a.content.access) },
  };
  if (r.tipo === 'slot') return { ...base, functionId: null, startTime: r.franja.opens, endTime: r.franja.closes, timeStatus: null, notice: null };
  const f = r.funcion;
  const fin = finConocido(f, a.durationMinutes);
  return {
    ...base,
    functionId: f.id,
    startTime: f.startTime,
    endTime: fin ? fin.slice(11) : null,
    timeStatus: r.estado,
    notice: aviso ? { kind: aviso.kind, text: aviso.text, at: aviso.at } : null,
  };
}

function etiquetas(c, mapas, actividades, hoy) {
  const l = [];
  if (c.date) l.push(c.date === hoy ? `hoy, ${fechaLarga(c.date)}` : fechaLarga(c.date));
  else l.push('desde hoy');
  if (c.from && c.until) l.push(`de ${c.from} a ${c.until === '24:00' ? '24:00' : c.until}`);
  else if (c.from) l.push(`desde las ${c.from}`);
  else if (c.until) l.push(`antes de las ${c.until}`);
  if (c.categoryId) l.push(mapas.categories.get(c.categoryId)?.name ?? 'categoría desconocida');
  if (c.venueId) l.push(mapas.venues.get(c.venueId)?.name ?? 'sede desconocida');
  if (c.access) l.push(c.access === 'free' ? 'gratuitas' : 'de pago');
  if (c.activityId) l.push(`«${actividades.find((a) => a.id === c.activityId)?.content.title ?? 'actividad'}»`);
  return l;
}

function urlAgenda(c, actividades) {
  const p = new URLSearchParams();
  if (c.date) p.set('date', c.date);
  if (c.categoryId) p.set('categoryId', c.categoryId);
  if (c.venueId) p.set('venueId', c.venueId);
  if (c.access) p.set('access', c.access);
  const titulo = c.activityId && actividades.find((a) => a.id === c.activityId)?.content.title;
  if (titulo) p.set('q', titulo);
  const qs = p.toString();
  return qs ? `/agenda?${qs}` : '/agenda';
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export function createAlforjita({ agenda, catalogs, repos, clock, clockFixed = false }) {
  /** Lee el catálogo; si la base falla, la respuesta es «falla del servicio» (FR-014). */
  async function leer(lectura) {
    try {
      return await lectura();
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError(503, 'catalog_unavailable', 'No pude consultar la programación en este momento. Puedes revisar la Agenda.');
    }
  }

  async function contexto() {
    const [todas, mapas] = await leer(() => Promise.all([agenda.publicadas(), catalogs.mapas()]));
    const ahora = clock();
    return { actividades: todas.filter((a) => a.editionActive), mapas, ahora, hoy: enLoja(ahora).date, reference: referencia(clock, clockFixed) };
  }

  /** Días (posteriores a `desde`) con resultados para los mismos criterios: «¿quieres consultar otro día?» (FR-007). */
  function otrosDias(ctx, c, desde, max = 3) {
    const dias = new Set();
    for (const a of ctx.actividades) {
      for (const f of a.functions) if (f.status !== 'cancelled' && f.date > desde) dias.add(f.date);
    }
    const r = [];
    for (const d of [...dias].sort()) {
      if (r.length >= max) break;
      const cd = { ...c, date: d };
      if (seleccionar(ctx.actividades, cd, ctx.ahora).length) r.push({ label: conMayuscula(fechaLarga(d)), criteria: cd });
    }
    return r;
  }

  function buscar(ctx, c, { assumedDay = false, intro = null } = {}) {
    const base = { reference: ctx.reference, criteria: c, criteriaLabels: etiquetas(c, ctx.mapas, ctx.actividades, ctx.hoy), assumedDay };
    const suposicion = assumedDay ? `Asumí hoy, ${fechaLarga(ctx.hoy)} (hora de Loja). ` : '';
    if (c.date && c.date < ctx.hoy) {
      return {
        ...base,
        kind: 'past_day',
        message: `El ${fechaLarga(c.date)} ya pasó. ¿Quieres consultar hoy u otro día?`,
        suggestions: [{ label: 'Hoy', criteria: { ...c, date: ctx.hoy } }, ...otrosDias(ctx, c, ctx.hoy)],
        links: [enlaceAgenda],
      };
    }
    const todos = seleccionar(ctx.actividades, c, ctx.ahora);
    const agendaUrl = urlAgenda(c, ctx.actividades);
    if (todos.length === 0) {
      const sugerencias = [];
      const quitar = [
        ['from', 'Sin límite de hora', { from: null, until: null }],
        ['categoryId', `Sin «${ctx.mapas.categories.get(c.categoryId)?.name ?? ''}»`, { categoryId: null }],
        ['venueId', `En cualquier sede`, { venueId: null }],
        ['access', 'Gratuitas y de pago', { access: null }],
      ];
      for (const [campo, label, cambio] of quitar) {
        const activo = campo === 'from' ? c.from || c.until : c[campo];
        if (!activo) continue;
        const cc = { ...c, ...cambio };
        if (seleccionar(ctx.actividades, cc, ctx.ahora).length) sugerencias.push({ label, criteria: cc });
      }
      const dias = c.date ? otrosDias(ctx, c, c.date) : [];
      const enDia = c.date === ctx.hoy ? 'Hoy no encontré' : 'No encontré';
      return {
        ...base,
        kind: 'no_matches',
        message: `${suposicion}${enDia} funciones con estos criterios: ${base.criteriaLabels.join(', ')}.${
          dias.length ? ' ¿Quieres consultar otro día?' : ''
        } También puedes quitar un criterio o abrir la Agenda.`,
        suggestions: [...sugerencias, ...dias],
        items: [],
        total: 0,
        agendaUrl,
        links: [{ label: 'Abrir la Agenda', href: agendaUrl }],
      };
    }
    return {
      ...base,
      kind: 'matches',
      message: `${suposicion}${intro ?? `Encontré ${plural(todos.length, 'resultado', 'resultados')}`} (${base.criteriaLabels.join(', ')}).${
        todos.length > MAX_RESULTADOS ? ` Te muestro los ${MAX_RESULTADOS} primeros; el resto está en la Agenda.` : ''
      }`,
      items: todos.slice(0, MAX_RESULTADOS).map((r) => item(r, ctx.mapas)),
      total: todos.length,
      agendaUrl,
    };
  }

  function elegirActividad(ctx, ids, pedir) {
    return {
      reference: ctx.reference,
      kind: 'choose',
      message: '¿De cuál actividad hablas? Elige una:',
      options: ids.slice(0, MAX_RESULTADOS).map((id) => {
        const t = ctx.actividades.find((a) => a.id === id).content.title;
        return { type: 'activity', id, name: t, request: pedir(id, t) };
      }),
    };
  }

  const pedirNombre = (ctx, que) => ({
    reference: ctx.reference,
    kind: 'not_understood',
    message: `No reconocí de qué actividad quieres saber ${que}. Escribe su título como aparece en la Agenda.`,
    links: [enlaceAgenda],
  });

  function precio(ctx, ids) {
    if (ids.length === 0) return pedirNombre(ctx, 'el precio');
    if (ids.length > 1) return elegirActividad(ctx, ids, (id) => ({ criteria: { activityId: id }, intent: 'price' }));
    const a = ctx.actividades.find((x) => x.id === ids[0]);
    const { mode, priceUsd } = a.content.access;
    const t = `«${a.content.title}»`;
    const links = [{ label: 'Ver la ficha', href: `/actividad/${encodeURIComponent(a.id)}` }];
    if (mode === 'free') return { reference: ctx.reference, kind: 'answer', message: `${t} es gratuita.`, links };
    if (mode === 'paid' && priceUsd !== null && priceUsd !== undefined) {
      return { reference: ctx.reference, kind: 'answer', message: `${t} es de pago: ${etiquetaAcceso(a.content.access).replace('De pago: ', '')}.`, links };
    }
    if (mode === 'paid') {
      return { reference: ctx.reference, kind: 'unconfirmed', missing: ['price'], message: `${t} es de pago, pero su precio aún no está confirmado.`, links };
    }
    return {
      reference: ctx.reference,
      kind: 'unconfirmed',
      missing: ['access'],
      message: `Aún no está confirmado si ${t} es gratuita o de pago, ni su precio.`,
      links,
    };
  }

  function fin(ctx, ids, fecha) {
    if (ids.length === 0) return pedirNombre(ctx, 'la hora de fin');
    if (ids.length > 1) return elegirActividad(ctx, ids, (id) => ({ criteria: { activityId: id, date: fecha ?? null }, intent: 'end' }));
    const a = ctx.actividades.find((x) => x.id === ids[0]);
    const t = `«${a.content.title}»`;
    const links = [{ label: 'Ver la ficha', href: `/actividad/${encodeURIComponent(a.id)}` }];
    const funciones = seleccionar([a], { activityId: a.id, date: fecha ?? null }, ctx.ahora).filter((r) => r.tipo === 'function');
    if (funciones.length === 0) {
      return { reference: ctx.reference, kind: 'no_matches', message: `${t} no tiene funciones próximas.`, items: [], total: 0, links };
    }
    const items = funciones.slice(0, MAX_RESULTADOS).map((r) => item(r, ctx.mapas));
    const sinFin = items.filter((i) => !i.endTime);
    const missing = sinFin.length ? (a.durationMinutes ? ['end'] : ['end', 'duration']) : [];
    if (sinFin.length === items.length) {
      return {
        reference: ctx.reference,
        kind: 'unconfirmed',
        missing,
        message: `La hora de fin de ${t} no está confirmada${a.durationMinutes ? '' : ', ni su duración'}. No puedo calcularla.`,
        items,
        total: funciones.length,
        links,
      };
    }
    return {
      reference: ctx.reference,
      kind: 'answer',
      missing,
      message: sinFin.length
        ? `Estas son las funciones de ${t}. En algunas la hora de fin no está confirmada.`
        : `Estas son las funciones de ${t} con su hora de fin.`,
      items,
      total: funciones.length,
      links,
    };
  }

  async function accesibilidad(ctx, venueIds, features) {
    if (venueIds.length !== 1) {
      const sedes = [...ctx.mapas.venues.values()].sort((x, y) => x.name.localeCompare(y.name, 'es'));
      return {
        reference: ctx.reference,
        kind: 'choose',
        message: '¿De qué sede quieres saber la accesibilidad? Elige una:',
        options: sedes.map((s) => ({ type: 'venue', id: s.id, name: s.name, request: { intent: 'accessibility', criteria: { venueId: s.id } } })),
      };
    }
    const sede = ctx.mapas.venues.get(venueIds[0]);
    const datos = (await leer(() => repos.sedes.accessibility([sede.id]))).get(sede.id) ?? {};
    const accessibility = features.map((k) => {
      const d = datos[k];
      const status = d?.status ?? 'unconfirmed';
      return { feature: k, label: CARACTERISTICAS[k], status, source: status === 'unconfirmed' ? null : d.source, verifiedOn: status === 'unconfirmed' ? null : d.verifiedOn };
    });
    const frases = accessibility.map((x) => {
      if (x.status === 'confirmed') return `Tiene ${x.label} (confirmado: ${x.source}, ${x.verifiedOn}).`;
      if (x.status === 'unavailable') return `No tiene ${x.label} (según ${x.source}, ${x.verifiedOn}).`;
      return `El ${x.label} está por confirmar: no lo doy por disponible.`;
    });
    const missing = accessibility.filter((x) => x.status === 'unconfirmed').map((x) => x.feature);
    return {
      reference: ctx.reference,
      kind: missing.length ? 'unconfirmed' : 'answer',
      missing,
      message: `${sede.name}: ${frases.join(' ')}`,
      accessibility,
      links: [{ label: 'Ver sedes en el Mapa', href: '/mapa' }],
    };
  }

  function cambios(ctx) {
    const lista = [];
    for (const a of ctx.actividades) {
      const vistos = new Set();
      for (const n of a.notices) {
        if (!n.functionId || !['cancelled', 'rescheduled'].includes(n.kind) || vistos.has(n.functionId)) continue;
        vistos.add(n.functionId); // los avisos llegan del más reciente al más antiguo: se queda el último
        const f = a.functions.find((x) => x.id === n.functionId);
        if (!f || f.date < ctx.hoy) continue;
        const estado = f.status === 'cancelled' ? 'cancelled' : estadoTemporal(f, ctx.ahora, a.durationMinutes);
        lista.push({ r: { tipo: 'function', actividad: a, funcion: f, date: f.date, hora: f.startTime, estado }, aviso: n });
      }
    }
    lista.sort((x, y) => y.aviso.at.localeCompare(x.aviso.at));
    const base = { reference: ctx.reference, criteriaLabels: ['desde hoy', 'canceladas o reprogramadas'], agendaUrl: '/agenda' };
    if (lista.length === 0) {
      return { ...base, kind: 'no_matches', message: 'No hay funciones canceladas ni reprogramadas de hoy en adelante.', items: [], total: 0, links: [enlaceAgenda] };
    }
    return {
      ...base,
      kind: 'matches',
      message: `Hay ${plural(lista.length, 'función cancelada o reprogramada', 'funciones canceladas o reprogramadas')} de hoy en adelante; la más reciente primero.`,
      items: lista.slice(0, MAX_RESULTADOS).map((x) => item(x.r, ctx.mapas, x.aviso)),
      total: lista.length,
    };
  }

  const info = (ctx) => ({
    reference: ctx.reference,
    kind: 'info',
    message: PASAPORTE_Y_RUTAS,
    links: [{ label: 'Ver el Pasaporte y las rutas', href: '/pasaporte' }],
  });

  const noEntendida = (ctx, fechaInvalida = false) => ({
    reference: ctx.reference,
    kind: 'not_understood',
    message: fechaInvalida ? 'Esa fecha no existe en el calendario. Prueba con otro día o con una de estas preguntas.' : NO_ENTENDIDA,
    links: [enlaceAgenda],
  });

  async function rapida(ctx, quick, venueId) {
    const hoy = ctx.hoy;
    if (quick === 'today') return buscar(ctx, { ...vacio(), date: hoy }, { intro: 'Esto hay hoy desde ahora' });
    if (quick === 'free_today') return buscar(ctx, { ...vacio(), date: hoy, access: 'free' }, { intro: 'Esto hay gratis hoy' });
    if (quick === 'tonight') return buscar(ctx, { ...vacio(), date: hoy, from: '18:00' }, { intro: 'Esto hay esta noche' });
    if (quick === 'changes') return cambios(ctx);
    if (quick === 'passport_routes') return info(ctx);
    // venue
    if (!venueId) {
      const sedes = [...ctx.mapas.venues.values()].sort((x, y) => x.name.localeCompare(y.name, 'es'));
      return {
        reference: ctx.reference,
        kind: 'choose',
        message: '¿Qué sede te interesa? Elige una:',
        options: sedes.map((s) => ({ type: 'venue', id: s.id, name: s.name, request: { quick: 'venue', venueId: s.id } })),
      };
    }
    if (!ctx.mapas.venues.has(venueId)) throw validation({ venueId: 'Esa sede no está registrada.' });
    return buscar(ctx, { ...vacio(), venueId }, { intro: 'Esto hay en esa sede de hoy en adelante' });
  }

  return {
    /** Responde una consulta ya recibida. Nunca guarda, registra ni devuelve el texto. */
    async responder(cuerpo) {
      const consulta = validarConsulta(cuerpo);
      const ctx = await contexto();

      if (consulta.quick) return rapida(ctx, consulta.quick, consulta.venueId);

      if (consulta.criteria) {
        const c = { ...vacio(), ...consulta.criteria };
        if (c.activityId && !ctx.actividades.some((a) => a.id === c.activityId)) throw validation({ 'criteria.activityId': 'Esa actividad no está publicada.' });
        const intencion = consulta.intent;
        if (intencion === 'price') return precio(ctx, c.activityId ? [c.activityId] : []);
        if (intencion === 'end') return fin(ctx, c.activityId ? [c.activityId] : [], c.date);
        if (intencion === 'accessibility') {
          if (!c.venueId || !ctx.mapas.venues.has(c.venueId)) throw validation({ 'criteria.venueId': 'Esa sede no está registrada.' });
          return accesibilidad(ctx, [c.venueId], Object.keys(CARACTERISTICAS));
        }
        return buscar(ctx, c);
      }

      const r = interpretar(consulta.text, {
        hoy: ctx.hoy,
        categorias: [...ctx.mapas.categories.values()],
        sedes: [...ctx.mapas.venues.values()],
        actividades: ctx.actividades.map((a) => ({ id: a.id, title: a.content.title })),
      });
      switch (r.intent) {
        case 'out_of_scope': {
          const fa = FUERA_DE_ALCANCE[r.topic];
          const ficha =
            r.topic === 'buy' && r.activityIds.length === 1 ? [{ label: 'Ver la ficha', href: `/actividad/${encodeURIComponent(r.activityIds[0])}` }] : [];
          return { reference: ctx.reference, kind: 'out_of_scope', topic: r.topic, message: fa.message, links: [...ficha, ...fa.links] };
        }
        case 'passport_routes':
          return info(ctx);
        case 'price':
          return precio(ctx, r.activityIds);
        case 'end':
          return fin(ctx, r.activityIds, r.date);
        case 'accessibility':
          return accesibilidad(ctx, r.venueIds, r.features);
        case 'changes':
          return cambios(ctx);
        case 'search':
          if (r.activityIds.length > 1 && !r.criteria.activityId) {
            return elegirActividad(ctx, r.activityIds, (id) => ({ criteria: { ...r.criteria, activityId: id } }));
          }
          return buscar(ctx, r.criteria, { assumedDay: r.assumedDay });
        default:
          return noEntendida(ctx, r.invalidDate);
      }
    },
  };
}

const vacio = () => ({ date: null, from: null, until: null, categoryId: null, venueId: null, access: null, activityId: null });
