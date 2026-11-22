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
const porTexto = (x, y) => x.localeCompare(y);
const enlaceAgenda = { label: 'Abrir la Agenda', href: '/agenda' };
const enlaceFicha = (id) => ({ label: 'Ver la ficha', href: `/actividad/${encodeURIComponent(id)}` });
const vacio = () => ({ date: null, from: null, until: null, categoryId: null, venueId: null, access: null, activityId: null });
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

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

const ausente = (v) => v === null || v === undefined;

function textoCorto(v, max = 100) {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

/** null si falta; el valor si es válido; undefined si es inválido. */
function opcional(v, esValido) {
  if (ausente(v)) return null;
  return esValido(v) ? v : undefined;
}

function validarCriterios(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) throw validation({ criteria: 'Criterios no válidos.' });
  const esHora = (v) => horaValida(v) || v === '24:00';
  const r = {
    date: opcional(c.date, fechaValida),
    from: opcional(c.from, esHora),
    until: opcional(c.until, esHora),
    categoryId: textoCorto(c.categoryId),
    venueId: textoCorto(c.venueId),
    access: opcional(c.access, (v) => ACCESOS.has(v)),
    activityId: textoCorto(c.activityId),
  };
  const malos = Object.entries(r).filter(([, v]) => v === undefined);
  if (malos.length) throw validation(Object.fromEntries(malos.map(([k]) => [`criteria.${k}`, 'Valor no válido.'])));
  return r;
}

/** Exactamente uno de `text`, `quick` o `criteria`. */
export function validarConsulta(cuerpo) {
  const c = cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo) ? cuerpo : {};
  const presentes = ['text', 'quick', 'criteria'].filter((k) => !ausente(c[k]));
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
  if (Array.isArray(s.dates) && s.dates.length) return s.dates.filter((d) => d >= desde).sort(porTexto)[0] ?? null;
  if (!s.to || s.to < desde) return null;
  let d = desde;
  if (s.from > d) d = s.from;
  for (let i = 0; i < 366 && d <= s.to; i += 1, d = sumarDias(d, 1)) if (franjaAplicaEn(s, d)) return d;
  return null;
}

function actividadCumple(a, c) {
  if (c.activityId && a.id !== c.activityId) return false;
  if (c.categoryId && a.content.categoryId !== c.categoryId) return false;
  return !c.access || a.content.access.mode === c.access;
}

/** Para hoy solo vale lo que aún no empieza; si se pregunta por una actividad concreta, también lo empezado (RC-03). */
function estadoAdmitido(estado, c) {
  if (estado === 'upcoming') return true;
  return Boolean(c.activityId) && (estado === 'start_passed' || estado === 'in_progress');
}

function funcionesQueCumplen(a, c, ahora, hoy) {
  const r = [];
  for (const f of a.functions) {
    if (f.status === 'cancelled') continue;
    const enFecha = c.date ? f.date === c.date : f.date >= hoy;
    if (!enFecha || (c.venueId && f.venueId !== c.venueId) || !dentroDeHoras(f.startTime, c)) continue;
    const estado = estadoTemporal(f, ahora, a.durationMinutes);
    if (f.date === hoy && !estadoAdmitido(estado, c)) continue;
    r.push({ tipo: 'function', actividad: a, funcion: f, date: f.date, hora: f.startTime, estado });
  }
  return r;
}

function fechaDeFranja(s, c, hoy) {
  if (!c.date) return proximaFechaFranja(s, hoy);
  return franjaAplicaEn(s, c.date) ? c.date : null;
}

function franjasQueCumplen(a, c, ref) {
  const r = [];
  for (const s of a.slots) {
    if (c.venueId && s.venueId !== c.venueId) continue;
    const fecha = fechaDeFranja(s, c, ref.date);
    if (!fecha || fecha < ref.date) continue;
    const fueraDeHoras = (c.from && s.closes <= c.from) || (c.until && s.opens >= c.until);
    if (fueraDeHoras || (fecha === ref.date && s.closes <= ref.time)) continue;
    r.push({ tipo: 'slot', actividad: a, franja: s, date: fecha, hora: s.opens, estado: null });
  }
  return r;
}

/**
 * Funciones y franjas publicadas que cumplen los criterios. Sin fecha: desde hoy. Para hoy, solo lo que aún no empieza
 * (o, en una franja, lo que aún no cierra), salvo cuando se pregunta por una actividad concreta (RC-03).
 */
export function seleccionar(actividades, c, ahora) {
  const ref = enLoja(ahora);
  const resultado = actividades
    .filter((a) => actividadCumple(a, c))
    .flatMap((a) => [...funcionesQueCumplen(a, c, ahora, ref.date), ...franjasQueCumplen(a, c, ref)]);
  return resultado.sort(
    (x, y) => x.date.localeCompare(y.date) || x.hora.localeCompare(y.hora) || x.actividad.content.title.localeCompare(y.actividad.content.title, 'es'),
  );
}

// ---------- Presentación ----------

function baseItem(r, mapas) {
  const a = r.actividad;
  const venueId = r.tipo === 'function' ? r.funcion.venueId : r.franja.venueId;
  const v = mapas.venues.get(venueId);
  return {
    type: r.tipo,
    activityId: a.id,
    title: a.content.title,
    href: `/actividad/${encodeURIComponent(a.id)}`,
    date: r.date,
    venue: v ? { id: v.id, name: v.name, kind: v.kind } : null,
    access: { mode: a.content.access.mode, priceUsd: a.content.access.priceUsd ?? null, label: etiquetaAcceso(a.content.access) },
  };
}

function item(r, mapas, aviso = null) {
  const base = baseItem(r, mapas);
  if (r.tipo === 'slot') return { ...base, functionId: null, startTime: r.franja.opens, endTime: r.franja.closes, timeStatus: null, notice: null };
  const f = r.funcion;
  const fin = finConocido(f, r.actividad.durationMinutes);
  return {
    ...base,
    functionId: f.id,
    startTime: f.startTime,
    endTime: fin ? fin.slice(11) : null,
    timeStatus: r.estado,
    notice: aviso ? { kind: aviso.kind, text: aviso.text, at: aviso.at } : null,
  };
}

function etiquetaHoras(c) {
  if (c.from && c.until) return `de ${c.from} a ${c.until}`;
  if (c.from) return `desde las ${c.from}`;
  if (c.until) return `antes de las ${c.until}`;
  return null;
}

function etiquetaDia(c, hoy) {
  if (!c.date) return 'desde hoy';
  return c.date === hoy ? `hoy, ${fechaLarga(c.date)}` : fechaLarga(c.date);
}

function etiquetas(c, ctx) {
  const titulo = c.activityId && ctx.actividades.find((a) => a.id === c.activityId)?.content.title;
  return [
    etiquetaDia(c, ctx.hoy),
    etiquetaHoras(c),
    c.categoryId && (ctx.mapas.categories.get(c.categoryId)?.name ?? 'categoría desconocida'),
    c.venueId && (ctx.mapas.venues.get(c.venueId)?.name ?? 'sede desconocida'),
    c.access && { free: 'gratuitas', paid: 'de pago' }[c.access],
    c.activityId && `«${titulo ?? 'actividad'}»`,
  ].filter(Boolean);
}

function urlAgenda(c, actividades) {
  const p = new URLSearchParams();
  for (const campo of ['date', 'categoryId', 'venueId', 'access']) if (c[campo]) p.set(campo, c[campo]);
  const titulo = c.activityId && actividades.find((a) => a.id === c.activityId)?.content.title;
  if (titulo) p.set('q', titulo);
  const qs = p.toString();
  return qs ? `/agenda?${qs}` : '/agenda';
}

// ---------- Respuestas (cada una recibe el contexto de la consulta) ----------

/** Días (posteriores a `desde`) con resultados para los mismos criterios: «¿quieres consultar otro día?» (FR-007). */
function otrosDias(ctx, c, desde, max = 3) {
  const dias = new Set();
  for (const a of ctx.actividades) {
    for (const f of a.functions) if (f.status !== 'cancelled' && f.date > desde) dias.add(f.date);
  }
  const r = [];
  for (const d of [...dias].sort(porTexto)) {
    if (r.length >= max) break;
    const cd = { ...c, date: d };
    if (seleccionar(ctx.actividades, cd, ctx.ahora).length) r.push({ label: conMayuscula(fechaLarga(d)), criteria: cd });
  }
  return r;
}

function diaPasado(ctx, c, base) {
  return {
    ...base,
    kind: 'past_day',
    message: `El ${fechaLarga(c.date)} ya pasó. ¿Quieres consultar hoy u otro día?`,
    suggestions: [{ label: 'Hoy', criteria: { ...c, date: ctx.hoy } }, ...otrosDias(ctx, c, ctx.hoy)],
    links: [enlaceAgenda],
  };
}

/** Quitar un criterio a la vez, solo si así hay resultados (FR-011). */
function relajar(ctx, c) {
  const quitar = [
    [c.from || c.until, 'Sin límite de hora', { from: null, until: null }],
    [c.categoryId, `Sin «${ctx.mapas.categories.get(c.categoryId)?.name ?? ''}»`, { categoryId: null }],
    [c.venueId, 'En cualquier sede', { venueId: null }],
    [c.access, 'Gratuitas y de pago', { access: null }],
  ];
  return quitar
    .filter(([activo]) => activo)
    .map(([, label, cambio]) => ({ label, criteria: { ...c, ...cambio } }))
    .filter((s) => seleccionar(ctx.actividades, s.criteria, ctx.ahora).length > 0);
}

function sinCoincidencias(ctx, c, base, suposicion, agendaUrl) {
  const dias = c.date ? otrosDias(ctx, c, c.date) : [];
  const enDia = c.date === ctx.hoy ? 'Hoy no encontré' : 'No encontré';
  const otroDia = dias.length ? ' ¿Quieres consultar otro día?' : '';
  return {
    ...base,
    kind: 'no_matches',
    message: `${suposicion}${enDia} funciones con estos criterios: ${base.criteriaLabels.join(', ')}.${otroDia} También puedes quitar un criterio o abrir la Agenda.`,
    suggestions: [...relajar(ctx, c), ...dias],
    items: [],
    total: 0,
    agendaUrl,
    links: [{ label: 'Abrir la Agenda', href: agendaUrl }],
  };
}

function buscar(ctx, c, { assumedDay = false, intro = null } = {}) {
  const base = { reference: ctx.reference, criteria: c, criteriaLabels: etiquetas(c, ctx), assumedDay };
  const suposicion = assumedDay ? `Asumí hoy, ${fechaLarga(ctx.hoy)} (hora de Loja). ` : '';
  if (c.date && c.date < ctx.hoy) return diaPasado(ctx, c, base);
  const todos = seleccionar(ctx.actividades, c, ctx.ahora);
  const agendaUrl = urlAgenda(c, ctx.actividades);
  if (todos.length === 0) return sinCoincidencias(ctx, c, base, suposicion, agendaUrl);
  const inicio = intro ?? `Encontré ${plural(todos.length, 'resultado', 'resultados')}`;
  const recorte = todos.length > MAX_RESULTADOS ? ` Te muestro los ${MAX_RESULTADOS} primeros; el resto está en la Agenda.` : '';
  return {
    ...base,
    kind: 'matches',
    message: `${suposicion}${inicio} (${base.criteriaLabels.join(', ')}).${recorte}`,
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

function elegirSede(ctx, message, pedir) {
  const sedes = [...ctx.mapas.venues.values()].sort((x, y) => x.name.localeCompare(y.name, 'es'));
  return {
    reference: ctx.reference,
    kind: 'choose',
    message,
    options: sedes.map((s) => ({ type: 'venue', id: s.id, name: s.name, request: pedir(s.id) })),
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
  const base = { reference: ctx.reference, links: [enlaceFicha(a.id)] };
  if (mode === 'free') return { ...base, kind: 'answer', message: `${t} es gratuita.` };
  if (mode === 'paid' && !ausente(priceUsd)) {
    return { ...base, kind: 'answer', message: `${t} es de pago: ${etiquetaAcceso(a.content.access).replace('De pago: ', '')}.` };
  }
  if (mode === 'paid') return { ...base, kind: 'unconfirmed', missing: ['price'], message: `${t} es de pago, pero su precio aún no está confirmado.` };
  return { ...base, kind: 'unconfirmed', missing: ['access'], message: `Aún no está confirmado si ${t} es gratuita o de pago, ni su precio.` };
}

function mensajeFin(t, sinFin, items, conDuracion) {
  if (sinFin.length === items.length) {
    const ni = conDuracion ? '' : ', ni su duración';
    return { kind: 'unconfirmed', message: `La hora de fin de ${t} no está confirmada${ni}. No puedo calcularla.` };
  }
  if (sinFin.length) return { kind: 'answer', message: `Estas son las funciones de ${t}. En algunas la hora de fin no está confirmada.` };
  return { kind: 'answer', message: `Estas son las funciones de ${t} con su hora de fin.` };
}

function fin(ctx, ids, fecha) {
  if (ids.length === 0) return pedirNombre(ctx, 'la hora de fin');
  if (ids.length > 1) return elegirActividad(ctx, ids, (id) => ({ criteria: { activityId: id, date: fecha ?? null }, intent: 'end' }));
  const a = ctx.actividades.find((x) => x.id === ids[0]);
  const t = `«${a.content.title}»`;
  const links = [enlaceFicha(a.id)];
  const funciones = seleccionar([a], { ...vacio(), activityId: a.id, date: fecha ?? null }, ctx.ahora).filter((r) => r.tipo === 'function');
  if (funciones.length === 0) {
    return { reference: ctx.reference, kind: 'no_matches', message: `${t} no tiene funciones próximas.`, items: [], total: 0, links };
  }
  const items = funciones.slice(0, MAX_RESULTADOS).map((r) => item(r, ctx.mapas));
  const sinFin = items.filter((i) => !i.endTime);
  let missing = [];
  if (sinFin.length) missing = a.durationMinutes ? ['end'] : ['end', 'duration'];
  return { reference: ctx.reference, ...mensajeFin(t, sinFin, items, Boolean(a.durationMinutes)), missing, items, total: funciones.length, links };
}

function fraseAccesibilidad(x) {
  if (x.status === 'confirmed') return `Tiene ${x.label} (confirmado: ${x.source}, ${x.verifiedOn}).`;
  if (x.status === 'unavailable') return `No tiene ${x.label} (según ${x.source}, ${x.verifiedOn}).`;
  return `El ${x.label} está por confirmar: no lo doy por disponible.`;
}

async function accesibilidad(ctx, venueIds, features) {
  if (venueIds.length !== 1) {
    return elegirSede(ctx, '¿De qué sede quieres saber la accesibilidad? Elige una:', (id) => ({ intent: 'accessibility', criteria: { venueId: id } }));
  }
  const sede = ctx.mapas.venues.get(venueIds[0]);
  const datos = (await ctx.leer(() => ctx.repos.sedes.accessibility([sede.id]))).get(sede.id) ?? {};
  const accessibility = features.map((k) => {
    const status = datos[k]?.status ?? 'unconfirmed';
    const conocido = status !== 'unconfirmed';
    return { feature: k, label: CARACTERISTICAS[k], status, source: conocido ? datos[k].source : null, verifiedOn: conocido ? datos[k].verifiedOn : null };
  });
  const missing = accessibility.filter((x) => x.status === 'unconfirmed').map((x) => x.feature);
  return {
    reference: ctx.reference,
    kind: missing.length ? 'unconfirmed' : 'answer',
    missing,
    message: `${sede.name}: ${accessibility.map(fraseAccesibilidad).join(' ')}`,
    accessibility,
    links: [{ label: 'Ver sedes en el Mapa', href: '/mapa' }],
  };
}

/** Último aviso público de cancelación o reprogramación de cada función de hoy en adelante. */
function avisosVigentes(ctx, a) {
  const r = [];
  const vistos = new Set();
  for (const n of a.notices) {
    if (!n.functionId || !['cancelled', 'rescheduled'].includes(n.kind) || vistos.has(n.functionId)) continue;
    vistos.add(n.functionId); // los avisos llegan del más reciente al más antiguo: se queda el último
    const f = a.functions.find((x) => x.id === n.functionId);
    if (!f || f.date < ctx.hoy) continue;
    const estado = f.status === 'cancelled' ? 'cancelled' : estadoTemporal(f, ctx.ahora, a.durationMinutes);
    r.push({ r: { tipo: 'function', actividad: a, funcion: f, date: f.date, hora: f.startTime, estado }, aviso: n });
  }
  return r;
}

function cambios(ctx) {
  const lista = ctx.actividades.flatMap((a) => avisosVigentes(ctx, a)).sort((x, y) => y.aviso.at.localeCompare(x.aviso.at));
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

function fueraDeAlcance(ctx, topic, activityIds) {
  const fa = FUERA_DE_ALCANCE[topic];
  const ficha = topic === 'buy' && activityIds.length === 1 ? [enlaceFicha(activityIds[0])] : [];
  return { reference: ctx.reference, kind: 'out_of_scope', topic, message: fa.message, links: [...ficha, ...fa.links] };
}

const RAPIDAS = {
  today: (ctx) => buscar(ctx, { ...vacio(), date: ctx.hoy }, { intro: 'Esto hay hoy desde ahora' }),
  free_today: (ctx) => buscar(ctx, { ...vacio(), date: ctx.hoy, access: 'free' }, { intro: 'Esto hay gratis hoy' }),
  tonight: (ctx) => buscar(ctx, { ...vacio(), date: ctx.hoy, from: '18:00' }, { intro: 'Esto hay esta noche' }),
  changes: cambios,
  passport_routes: info,
  venue: (ctx, venueId) => {
    if (!venueId) return elegirSede(ctx, '¿Qué sede te interesa? Elige una:', (id) => ({ quick: 'venue', venueId: id }));
    if (!ctx.mapas.venues.has(venueId)) throw validation({ venueId: 'Esa sede no está registrada.' });
    return buscar(ctx, { ...vacio(), venueId }, { intro: 'Esto hay en esa sede de hoy en adelante' });
  },
};

function porCriterios(ctx, criterios, intencion) {
  const c = { ...vacio(), ...criterios };
  if (c.activityId && !ctx.actividades.some((a) => a.id === c.activityId)) throw validation({ 'criteria.activityId': 'Esa actividad no está publicada.' });
  const ids = c.activityId ? [c.activityId] : [];
  if (intencion === 'price') return precio(ctx, ids);
  if (intencion === 'end') return fin(ctx, ids, c.date);
  if (intencion === 'accessibility') {
    if (!c.venueId || !ctx.mapas.venues.has(c.venueId)) throw validation({ 'criteria.venueId': 'Esa sede no está registrada.' });
    return accesibilidad(ctx, [c.venueId], Object.keys(CARACTERISTICAS));
  }
  return buscar(ctx, c);
}

function responderTexto(ctx, texto) {
  const r = interpretar(texto, {
    hoy: ctx.hoy,
    categorias: [...ctx.mapas.categories.values()],
    sedes: [...ctx.mapas.venues.values()],
    actividades: ctx.actividades.map((a) => ({ id: a.id, title: a.content.title })),
  });
  const respuestas = {
    out_of_scope: () => fueraDeAlcance(ctx, r.topic, r.activityIds),
    passport_routes: () => info(ctx),
    price: () => precio(ctx, r.activityIds),
    end: () => fin(ctx, r.activityIds, r.date),
    accessibility: () => accesibilidad(ctx, r.venueIds, r.features),
    changes: () => cambios(ctx),
    search: () =>
      r.activityIds.length > 1 && !r.criteria.activityId
        ? elegirActividad(ctx, r.activityIds, (id) => ({ criteria: { ...r.criteria, activityId: id } }))
        : buscar(ctx, r.criteria, { assumedDay: r.assumedDay }),
  };
  return (respuestas[r.intent] ?? (() => noEntendida(ctx, r.invalidDate)))();
}

/** Lee del catálogo; si la base falla, la respuesta es «falla del servicio» (FR-014). */
async function leerCatalogo(lectura) {
  try {
    return await lectura();
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(503, 'catalog_unavailable', 'No pude consultar la programación en este momento. Puedes revisar la Agenda.');
  }
}

export function createAlforjita({ agenda, catalogs, repos, clock, clockFixed = false }) {
  async function contexto() {
    const [todas, mapas] = await leerCatalogo(() => Promise.all([agenda.publicadas(), catalogs.mapas()]));
    const ahora = clock();
    return {
      actividades: todas.filter((a) => a.editionActive),
      mapas,
      ahora,
      hoy: enLoja(ahora).date,
      reference: referencia(clock, clockFixed),
      repos,
      leer: leerCatalogo,
    };
  }

  return {
    /** Responde una consulta ya recibida. Nunca guarda, registra ni devuelve el texto. */
    async responder(cuerpo) {
      const consulta = validarConsulta(cuerpo);
      const ctx = await contexto();
      if (consulta.quick) return RAPIDAS[consulta.quick](ctx, consulta.venueId);
      if (consulta.criteria) return porCriterios(ctx, consulta.criteria, consulta.intent);
      return responderTexto(ctx, consulta.text);
    },
  };
}
