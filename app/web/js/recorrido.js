// Mi recorrido y alternativas (spec 004: RF-16 a RF-18, RC-02, RC-03, RC-06, RC-07).
// El recorrido vive exclusivamente en este navegador (P-05, FR-004) y no se asocia a ninguna cuenta.
import { h, icono, aviso, confirmarAccion, abrirDialogo } from './dom.js';
import { formatoFecha, formatoFechaCorta, partesFecha, formatoDuracion, etiquetaAviso } from './format.js';
import { apiProgramacion, apiParticipacion } from './api.js';

export const CLAVE_RECORRIDO = 'vivart_recorrido_v1';

/**
 * Obtiene la referencia a localStorage de forma segura (compatible con browser y Node.js en tests).
 */
function obtenerStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  } catch {
    return null;
  }
  return null;
}

/**
 * Lee el contenido seguro de localStorage.
 * Si no existe o está corrupto, retorna un contenedor vacío con version 1.
 */
export function leerStorageRecorrido() {
  const storage = obtenerStorage();
  if (!storage) return { version: 1, updatedAt: null, items: [] };

  try {
    const raw = storage.getItem(CLAVE_RECORRIDO);
    if (!raw) return { version: 1, updatedAt: null, items: [] };

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
      return { version: 1, updatedAt: null, items: [] };
    }

    // Filtrar elementos válidos citando data-model.md (ItemRecorrido)
    const itemsValidos = parsed.items.filter(
      (item) =>
        item &&
        typeof item.id === 'string' &&
        typeof item.activityId === 'string' &&
        typeof item.title === 'string' &&
        typeof item.date === 'string' &&
        typeof item.startTime === 'string'
    );

    return {
      version: parsed.version ?? 1,
      updatedAt: parsed.updatedAt ?? null,
      items: itemsValidos,
    };
  } catch {
    return { version: 1, updatedAt: null, items: [] };
  }
}

/**
 * Guarda los ítems en localStorage.
 * Emite el evento 'vivart:recorrido' en document si está en un navegador.
 */
export function escribirStorageRecorrido(items) {
  const storage = obtenerStorage();
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    items: Array.isArray(items) ? items : [],
  };

  if (!storage) {
    dispararEventoCambio();
    return false;
  }

  try {
    storage.setItem(CLAVE_RECORRIDO, JSON.stringify(payload));
    dispararEventoCambio();
    return true;
  } catch {
    // Almacenamiento lleno o bloqueado (modo incógnito estricto)
    dispararEventoCambio();
    return false;
  }
}

function dispararEventoCambio() {
  if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function') {
    document.dispatchEvent(new CustomEvent('vivart:recorrido'));
  }
}

/**
 * Compara dos cadenas de tiempo HH:MM en minutos desde 00:00.
 */
export function horaAMinutos(hora) {
  if (!hora || typeof hora !== 'string') return null;
  const match = hora.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
}

/**
 * Ordena ítems de recorrido cronológicamente por date ascendente y startTime ascendente.
 * Cumple SC-002 y FR-002.
 */
export function ordenarCronologicamente(items) {
  return [...items].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const minA = horaAMinutos(a.startTime) ?? 0;
    const minB = horaAMinutos(b.startTime) ?? 0;
    return minA - minB;
  });
}

/**
 * Obtiene la lista completa de elementos guardados, ordenados cronológicamente.
 */
export function obtenerRecorrido() {
  const { items } = leerStorageRecorrido();
  return ordenarCronologicamente(items);
}

/**
 * Verifica si un ítem o functionId específico está en el recorrido.
 */
export function estaEnRecorrido(idOFunctionId) {
  if (!idOFunctionId) return false;
  const { items } = leerStorageRecorrido();
  return items.some(
    (item) =>
      item.id === idOFunctionId ||
      item.functionId === idOFunctionId ||
      item.slotId === idOFunctionId
  );
}

/**
 * Vacía completamente el recorrido local.
 */
export function vaciarRecorrido() {
  escribirStorageRecorrido([]);
}

/**
 * Quita un elemento del recorrido por su identificador.
 * Cumple FR-001 y SC-001.
 */
export function quitarDeRecorrido(id) {
  const { items } = leerStorageRecorrido();
  const nuevos = items.filter((item) => item.id !== id && item.functionId !== id && item.slotId !== id);
  if (nuevos.length === items.length) return false;
  escribirStorageRecorrido(nuevos);
  aviso('Función quitada de Mi recorrido.', 'ok');
  return true;
}

/**
 * Agrega una función o franja a Mi recorrido.
 * Es idempotente: si ya existe, no la duplica.
 * Cumple FR-001, FR-003, FR-020 y SC-001.
 */
export function guardarEnRecorrido(datos) {
  if (!datos || typeof datos !== 'object') return false;

  const { items } = leerStorageRecorrido();

  // Construir ID estable según data-model.md (ItemRecorrido.id)
  const id =
    datos.id ??
    (datos.kind === 'slot' || datos.slotId
      ? `slot_${datos.slotId ?? 'anon'}_${datos.date ?? 'sin-fecha'}`
      : `fn_${datos.functionId ?? datos.id}`);

  // Evitar duplicados
  if (items.some((i) => i.id === id)) {
    aviso('Esta función ya está en tu recorrido.', 'alerta');
    return false;
  }

  const nuevoItem = {
    id,
    kind: datos.kind === 'slot' ? 'slot' : 'function',
    activityId: String(datos.activityId ?? ''),
    functionId: datos.functionId ? String(datos.functionId) : (datos.kind !== 'slot' ? id.replace(/^fn_/, '') : null),
    slotId: datos.slotId ? String(datos.slotId) : null,
    title: String(datos.title ?? 'Actividad'),
    artists: Array.isArray(datos.artists) ? datos.artists.map(String) : [],
    date: String(datos.date ?? ''),
    startTime: String(datos.startTime ?? ''),
    endTime: datos.endTime ? String(datos.endTime) : null,
    durationMinutes: Number.isInteger(datos.durationMinutes) ? datos.durationMinutes : null,
    venue: datos.venue
      ? {
          id: String(datos.venue.id ?? ''),
          name: String(datos.venue.name ?? 'Sede por confirmar'),
          kind: datos.venue.kind === 'route' ? 'route' : 'place',
        }
      : { id: '', name: 'Sede por confirmar', kind: 'place' },
    status: datos.status === 'cancelled' ? 'cancelled' : 'scheduled',
    notice: datos.notice ? { ...datos.notice } : null,
    savedAt: new Date().toISOString(),
  };

  const guardadoOk = escribirStorageRecorrido([...items, nuevoItem]);
  if (!guardadoOk && !obtenerStorage()) {
    aviso('Almacenamiento del navegador bloqueado; no se pudo guardar.', 'alerta');
    return false;
  }

  aviso('Guardado en Mi recorrido. Recuerda: guardar no reserva cupo.', 'ok');
  return true;
}

/**
 * Sustituye un ítem por otro atómicamente.
 * Cumple FR-015, FR-021 y SC-011.
 */
export function sustituirEnRecorrido(idOriginal, nuevoItemDatos) {
  const { items } = leerStorageRecorrido();
  const filtrados = items.filter(
    (i) => i.id !== idOriginal && i.functionId !== idOriginal && i.slotId !== idOriginal
  );

  const idNuevo =
    nuevoItemDatos.id ??
    (nuevoItemDatos.kind === 'slot' || nuevoItemDatos.slotId
      ? `slot_${nuevoItemDatos.slotId ?? 'anon'}_${nuevoItemDatos.date ?? 'sin-fecha'}`
      : `fn_${nuevoItemDatos.functionId ?? nuevoItemDatos.id}`);

  const itemNuevo = {
    id: idNuevo,
    kind: nuevoItemDatos.kind === 'slot' ? 'slot' : 'function',
    activityId: String(nuevoItemDatos.activityId ?? ''),
    functionId: nuevoItemDatos.functionId ? String(nuevoItemDatos.functionId) : idNuevo.replace(/^fn_/, ''),
    slotId: nuevoItemDatos.slotId ? String(nuevoItemDatos.slotId) : null,
    title: String(nuevoItemDatos.title ?? 'Actividad'),
    artists: Array.isArray(nuevoItemDatos.artists) ? nuevoItemDatos.artists.map(String) : [],
    date: String(nuevoItemDatos.date ?? ''),
    startTime: String(nuevoItemDatos.startTime ?? ''),
    endTime: nuevoItemDatos.endTime ? String(nuevoItemDatos.endTime) : null,
    durationMinutes: Number.isInteger(nuevoItemDatos.durationMinutes) ? nuevoItemDatos.durationMinutes : null,
    venue: nuevoItemDatos.venue
      ? {
          id: String(nuevoItemDatos.venue.id ?? ''),
          name: String(nuevoItemDatos.venue.name ?? 'Sede'),
          kind: nuevoItemDatos.venue.kind === 'route' ? 'route' : 'place',
        }
      : { id: '', name: 'Sede', kind: 'place' },
    status: 'scheduled',
    notice: null,
    savedAt: new Date().toISOString(),
  };

  escribirStorageRecorrido([...filtrados, itemNuevo]);
  aviso('Función sustituida en tu recorrido.', 'ok');
  return true;
}

/**
 * Calcula el final estimado de un ítem en minutos desde las 00:00.
 * Retorna null si no se conoce (RC-03).
 */
export function finEnMinutos(item) {
  if (item.endTime) {
    const minFin = horaAMinutos(item.endTime);
    if (minFin !== null) return minFin;
  }
  if (Number.isInteger(item.durationMinutes) && item.durationMinutes > 0 && item.startTime) {
    const minInicio = horaAMinutos(item.startTime);
    if (minInicio !== null) return minInicio + item.durationMinutes;
  }
  return null;
}

/**
 * Determina el estado temporal de una función según el reloj de referencia oficial de Loja (RC-03, RC-07, SC-007).
 * Retorna: 'upcoming', 'in_progress', 'start_passed', 'finished' o 'cancelled'.
 */
export function determinarEstadoTemporal(item, referencia) {
  if (!item) return 'upcoming';
  if (item.status === 'cancelled' || item.notice?.kind === 'cancelled') return 'cancelled';
  if (!referencia?.date || !referencia?.time) return 'upcoming';

  const minRef = horaAMinutos(referencia.time);
  const minInicio = horaAMinutos(item.startTime);
  if (minRef === null || minInicio === null) return 'upcoming';

  if (item.date > referencia.date) return 'upcoming';
  if (item.date === referencia.date && minInicio > minRef) return 'upcoming';

  // El inicio ya pasó (fecha anterior o misma fecha y hora menor o igual a referencia)
  const finMin = finEnMinutos(item);
  if (finMin === null) {
    // RC-03: No se conoce el fin. Nunca afirmar «en curso» ni «terminada».
    return 'start_passed';
  }

  // Si se conoce el fin:
  if (item.date < referencia.date) return 'finished';
  if (item.date === referencia.date) {
    if (minRef >= finMin) return 'finished';
    return 'in_progress';
  }

  return 'upcoming';
}

/**
 * Consulta el estado de venta de las funciones con tolerancia a fallos (FR-019, SC-010).
 */
export async function consultarEstadosVenta(functionIds) {
  if (!Array.isArray(functionIds) || functionIds.length === 0) return [];
  try {
    const res = await apiParticipacion('GET', `/sale-status?functionIds=${encodeURIComponent(functionIds.join(','))}`);
    if (res?.ok && res?.datos && Array.isArray(res.datos.items)) {
      return res.datos.items;
    }
  } catch {
    // Degradación suave ante fallo de red o del servicio (FR-019)
  }
  return [];
}

/**
 * Detecta pares de funciones o franjas que se cruzan en horario.
 * Cumple RC-02, FR-006 a FR-008, SC-003 y SC-004.
 */
export function detectarCruces(items) {
  if (!Array.isArray(items) || items.length < 2) return [];

  const cruces = [];
  const ordenados = ordenarCronologicamente(items);

  for (let i = 0; i < ordenados.length; i++) {
    const a = ordenados[i];
    const inicioA = horaAMinutos(a.startTime);
    const finA = finEnMinutos(a);

    // Si no se conoce el inicio o el fin de A, no se advierte cruce (RC-02, FR-008)
    if (inicioA === null || finA === null) continue;

    for (let j = i + 1; j < ordenados.length; j++) {
      const b = ordenados[j];

      // Los cruces solo aplican si ocurren en la misma fecha
      if (a.date !== b.date) continue;

      const inicioB = horaAMinutos(b.startTime);
      const finB = finEnMinutos(b);

      // Si no se conoce el inicio o fin de B, no se advierte cruce
      if (inicioB === null || finB === null) continue;

      // Solapamiento estricto: inicioA < finB y inicioB < finA.
      // Si finA == inicioB (tangentes consecutivas), NO es cruce.
      if (inicioA < finB && inicioB < finA) {
        const solapamientoMinutos = Math.min(finA, finB) - Math.max(inicioA, inicioB);
        if (solapamientoMinutos > 0) {
          cruces.push({
            itemA: a.id,
            itemB: b.id,
            date: a.date,
            overlapMinutes: solapamientoMinutos,
          });
        }
      }
    }
  }

  return cruces;
}

/**
 * Busca alternativas de funciones futuras en la misma sede.
 * Cumple FR-012, FR-013, FR-017 y SC-006.
 */
export function buscarAlternativas(itemAfectado, itemsAgenda, referencia) {
  if (!itemAfectado || !Array.isArray(itemsAgenda) || !referencia) return [];

  const venueIdAfectado = itemAfectado.venue?.id;
  if (!venueIdAfectado) return [];

  const fechaRef = referencia.date;
  const horaRef = referencia.time;
  const minutosRef = horaAMinutos(horaRef) ?? 0;

  const alternativas = [];

  for (const act of itemsAgenda) {
    // Si la actividad fue cancelada o no tiene funciones públicas, continuar
    if (act.status === 'cancelled' || !Array.isArray(act.functions)) continue;

    for (const fn of act.functions) {
      // Misma sede obligatoria
      if (fn.venue?.id !== venueIdAfectado) continue;

      // No cancelada
      if (fn.status === 'cancelled') continue;

      // No debe ser la misma función original
      if (fn.id === itemAfectado.functionId || fn.id === itemAfectado.id) continue;

      // Debe ser una función que aún no comience respecto a la referencia (Loja)
      if (fn.date < fechaRef) continue;
      if (fn.date === fechaRef) {
        const inicioMin = horaAMinutos(fn.startTime);
        if (inicioMin === null || inicioMin <= minutosRef) continue;
      }

      alternativas.push({
        functionId: fn.id,
        activityId: act.id,
        title: act.title,
        artists: Array.isArray(act.artists) ? act.artists : [],
        date: fn.date,
        startTime: fn.startTime,
        endTime: fn.endTime ?? null,
        durationMinutes: fn.durationMinutes ?? null,
        venue: fn.venue,
        access: act.access,
      });
    }
  }

  // Ordenar cronológicamente las alternativas
  return alternativas.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (horaAMinutos(a.startTime) ?? 0) - (horaAMinutos(b.startTime) ?? 0);
  });
}

/**
 * Sincroniza los ítems locales del recorrido con la programación y venta vigente.
 * Cumple FR-009, FR-010, FR-018, FR-019, SC-005, SC-009, SC-010.
 */
export function sincronizarRecorrido(itemsLocales, catalogoAgenda, estadosVenta = []) {
  if (!Array.isArray(itemsLocales)) return [];
  if (catalogoAgenda === null || catalogoAgenda === undefined) {
    return [...itemsLocales];
  }

  const mapaVenta = new Map((estadosVenta ?? []).map((s) => [s.functionId, s.state]));
  const mapaActividades = new Map((catalogoAgenda ?? []).map((a) => [a.id, a]));

  return itemsLocales.map((item) => {
    const act = mapaActividades.get(item.activityId);

    // Si la actividad ya no está en la Agenda (archivada o despublicada):
    if (!act) {
      return {
        ...item,
        status: item.status === 'cancelled' || item.notice?.kind === 'cancelled' ? 'cancelled' : 'archived',
        isArchived: true,
        saleState: null,
      };
    }

    // Buscar la función correspondiente
    const fn = (act.functions ?? []).find((f) => f.id === item.functionId || f.id === item.id);

    if (!fn) {
      // Si la función específica ya no existe en la actividad
      return {
        ...item,
        status: item.status === 'cancelled' || item.notice?.kind === 'cancelled' ? 'cancelled' : 'archived',
        isArchived: true,
        saleState: null,
      };
    }

    // Actualizar con datos vigentes de hora, sede, avisos y venta
    const notice = fn.notice ?? act.notices?.find((n) => n.functionId === fn.id) ?? item.notice ?? null;
    const saleState = mapaVenta.get(fn.id) ?? null;

    return {
      ...item,
      title: act.title ?? item.title,
      artists: act.artists ?? item.artists,
      date: fn.date ?? item.date,
      startTime: fn.startTime ?? item.startTime,
      endTime: fn.endTime ?? item.endTime,
      durationMinutes: fn.durationMinutes ?? item.durationMinutes,
      venue: fn.venue ?? item.venue,
      status: fn.status === 'cancelled' ? 'cancelled' : 'scheduled',
      isArchived: false,
      notice,
      saleState,
    };
  });
}

function barraReloj(reference) {
  if (!reference) return null;
  return h(
    'div',
    { class: 'reloj-referencia' },
    h('span', { class: 'reloj-texto' }, icono('reloj', 'icono-xs'), `Hora de Loja: ${formatoFecha(reference.date)} · ${reference.time}`),
    reference.fixed ? h('span', { class: 'chip-demo-reloj' }, 'Reloj fijado (demo)') : null,
  );
}

/**
 * Abre el diálogo modal con las alternativas en la misma sede (FR-012, FR-013, FR-015, FR-017, FR-021).
 */
export function abrirModalAlternativas(itemAfectado, itemsAgenda, referencia, alActualizar) {
  const alts = buscarAlternativas(itemAfectado, itemsAgenda, referencia);
  abrirDialogo({
    titulo: 'Alternativas en la misma sede',
    contenido: (cerrar) => {
      if (!alts.length) {
        return h(
          'div',
          { class: 'pila' },
          h('p', {}, `No hay otras funciones programadas que aún no hayan comenzado en ${itemAfectado.venue?.name ?? 'esta sede'}.`),
          h(
            'div',
            { class: 'fila-acciones' },
            h('a', { href: '/agenda', 'data-enlace': true, class: 'boton', onclick: cerrar }, 'Volver a la Agenda'),
            h('button', { type: 'button', class: 'secundario', onclick: cerrar }, 'Cerrar'),
          ),
        );
      }

      return h(
        'div',
        { class: 'pila' },
        h('p', { class: 'ayuda' }, `Funciones en ${itemAfectado.venue?.name ?? 'esta sede'} que aún no han comenzado:`),
        h(
          'ul',
          { class: 'lista-alternativas' },
          alts.map((alt) =>
            h(
              'li',
              { class: 'tarjeta-alternativa' },
              h(
                'div',
                { class: 'tarjeta-alternativa-cabecera' },
                h('strong', {}, alt.title),
                h('span', { class: 'chip-sutil' }, `${formatoFecha(alt.date)} · ${alt.startTime}`),
              ),
              alt.artists?.length ? h('p', { class: 'tarjeta-agenda-artistas' }, alt.artists.join(' · ')) : null,
              h(
                'div',
                { class: 'fila-acciones' },
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'boton-sm',
                    'aria-label': `Sustituir «${itemAfectado.title}» por «${alt.title}»`,
                    onclick: () => {
                      sustituirEnRecorrido(itemAfectado.id, alt);
                      cerrar();
                      if (alActualizar) alActualizar();
                    },
                  },
                  'Sustituir',
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'secundario boton-sm',
                    'aria-label': `Conservar «${itemAfectado.title}» y agregar «${alt.title}»`,
                    onclick: () => {
                      guardarEnRecorrido(alt);
                      cerrar();
                      if (alActualizar) alActualizar();
                    },
                  },
                  'Conservar ambas',
                ),
              ),
            ),
          ),
        ),
      );
    },
  });
}

/**
 * Escultura de «Poste Indicador de Escenarios y Reloj-Brújula Solar» para el encabezado
 * de Mi recorrido: un hito callejero cultural con tres flechas direccionales en esmalte
 * que apuntan a distintos escenarios de Loja, coronado por una rosa de los vientos giratoria.
 * Composición exclusiva de Mi recorrido (distinta del mosaico de Agenda y de la libreta de Pasaporte).
 */
function esculturaPosteEscenarios() {
  return h(
    'div',
    { class: 'hero-poste-escultura', 'aria-hidden': 'true' },
    // Halo y rueda de reloj-brújula astronómica detrás del poste
    h('div', { class: 'poste-halo-solar' }),
    h(
      'div',
      { class: 'poste-rueda-horaria' },
      h('span', { class: 'rueda-marca m-norte' }, 'XVIII · H'),
      h('span', { class: 'rueda-marca m-este' }, 'XX · H'),
      h('span', { class: 'rueda-marca m-sur' }, 'XXII · H'),
      h('span', { class: 'rueda-marca m-oeste' }, 'XVI · H'),
    ),
    h('div', { class: 'poste-orbita-interior' }),
    // Mástil central del poste indicador de escenarios
    h(
      'div',
      { class: 'poste-estructura' },
      h(
        'div',
        { class: 'poste-remate-brujula' },
        icono('recorrido', 'icono-sm'),
      ),
      h('div', { class: 'poste-mastil' }),
      // Tres letreros direccionales en forma de flecha de calle
      h(
        'div',
        { class: 'poste-flecha flecha-hacia-izq flecha-1' },
        h('span', { class: 'flecha-codigo' }, '01'),
        h(
          'div',
          { class: 'flecha-textos' },
          h('strong', {}, 'Teatro B. Carrión'),
          h('span', {}, '19:00 · Escenario mayor'),
        ),
      ),
      h(
        'div',
        { class: 'poste-flecha flecha-hacia-der flecha-2' },
        h(
          'div',
          { class: 'flecha-textos' },
          h('strong', {}, 'Plaza San Sebastián'),
          h('span', {}, '20:30 · Aire libre · Sin cruces'),
        ),
        h('span', { class: 'flecha-codigo' }, '02'),
      ),
      h(
        'div',
        { class: 'poste-flecha flecha-hacia-izq flecha-3' },
        h('span', { class: 'flecha-codigo' }, '03'),
        h(
          'div',
          { class: 'flecha-textos' },
          h('strong', {}, 'Casona Cultural'),
          h('span', {}, '22:00 · Alternativas en sede'),
        ),
      ),
      h(
        'div',
        { class: 'poste-hito-base' },
        h('span', {}, 'KM 0 · LOJA CULTURAL'),
      ),
    ),
  );
}

/**
 * Ondas luminosas de fondo que cruzan todo el ancho del encabezado de Mi recorrido.
 */
function ondasHorizonteHero() {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 1440 320');
  s.setAttribute('preserveAspectRatio', 'none');
  s.setAttribute('class', 'hero-recorrido-ondas-svg');
  s.setAttribute('aria-hidden', 'true');

  const trazos = [
    ['path', { d: 'M -40 260 C 280 180, 520 310, 860 200 C 1120 115, 1290 210, 1480 140', class: 'onda-horizonte-1' }],
    ['path', { d: 'M -40 290 C 340 220, 640 320, 980 225 C 1190 165, 1340 240, 1480 195', class: 'onda-horizonte-2' }],
    ['path', { d: 'M -20 235 C 310 145, 590 285, 920 170 C 1160 85, 1310 175, 1460 110', class: 'onda-sendero-dorado' }],
  ];
  for (const [tag, attrs] of trazos) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    s.append(el);
  }
  return s;
}

/**
 * Cabecera exclusiva para Mi recorrido (/recorrido): estética de «Horizonte y Poste Indicador
 * de Escenarios» con barra inferior de telemetría de ruta a todo lo ancho.
 */
function heroRecorrido({ totalParadas, totalDias, totalCruces, referencia }) {
  const textoReloj = referencia?.nowIso
    ? `${formatoFecha(referencia.todayIso ?? referencia.nowIso.slice(0, 10))} · ${referencia.nowIso.slice(11, 16)}`
    : 'Hora oficial · Loja (UTC-5)';
  const sufijoCruces = totalCruces === 1 ? 'cruce de horario' : 'cruces de horario';
  const etiquetaCruces = totalCruces > 0 ? `${totalCruces} ${sufijoCruces}` : 'Ruta despejada';

  return h(
    'section',
    { class: 'hero-festival hero-recorrido-unico', 'aria-label': 'Encabezado de Mi recorrido' },
    ondasHorizonteHero(),
    h(
      'div',
      { class: 'hero-recorrido-cuerpo' },
      h(
        'div',
        { class: 'hero-recorrido-columna-texto' },
        h(
          'div',
          { class: 'hero-coordenadas-badge' },
          h('span', { class: 'coordenada-pulso', 'aria-hidden': 'true' }),
          h('span', { class: 'coordenada-codigo' }, '03°59′S · 79°12′O'),
          h('span', { class: 'coordenada-separador' }, '·'),
          h('span', {}, 'Bitácora escénica de Loja'),
        ),
        h(
          'h1',
          { class: 'hero-titulo hero-recorrido-titulo' },
          'Mi ',
          h('span', { class: 'resalte-atardecer' }, 'recorrido'),
        ),
        h(
          'p',
          { class: 'hero-recorrido-bajada' },
          'Elige tu propio rumbo entre teatros, plazas y casonas: enlaza tus paradas día por día, vigila el compás del reloj y descubre alternativas sin perderte ninguna función.',
        ),
      ),
      esculturaPosteEscenarios(),
    ),
    // Barra panorámica inferior de telemetría de ruta (sustituye a las píldoras tipo Pasaporte)
    h(
      'div',
      { class: 'hero-telemetria-franja' },
      h(
        'div',
        { class: 'hero-telemetria-interior' },
        h(
          'div',
          { class: 'telemetria-estacion' },
          h('span', { class: 'telemetria-icono' }, icono('recorrido', 'icono-sm')),
          h(
            'div',
            { class: 'telemetria-datos' },
            h('strong', { class: 'telemetria-valor' }, `${String(totalParadas).padStart(2, '0')} ${totalParadas === 1 ? 'parada' : 'paradas'}`),
            h('span', { class: 'telemetria-etiqueta' }, 'Trazadas en tu bitácora'),
          ),
        ),
        h('span', { class: 'telemetria-conector', 'aria-hidden': 'true' }),
        h(
          'div',
          { class: 'telemetria-estacion' },
          h('span', { class: 'telemetria-icono' }, icono('calendario', 'icono-sm')),
          h(
            'div',
            { class: 'telemetria-datos' },
            h('strong', { class: 'telemetria-valor' }, `${String(totalDias).padStart(2, '0')} ${totalDias === 1 ? 'jornada' : 'jornadas'}`),
            h('span', { class: 'telemetria-etiqueta' }, 'Días con actividades'),
          ),
        ),
        h('span', { class: 'telemetria-conector', 'aria-hidden': 'true' }),
        h(
          'div',
          { class: `telemetria-estacion ${totalCruces > 0 ? 'telemetria-alerta' : 'telemetria-ok'}` },
          h('span', { class: 'telemetria-icono' }, icono(totalCruces > 0 ? 'aviso' : 'check', 'icono-sm')),
          h(
            'div',
            { class: 'telemetria-datos' },
            h('strong', { class: 'telemetria-valor' }, etiquetaCruces),
            h(
              'span',
              { class: 'telemetria-etiqueta' },
              totalCruces > 0 ? 'Revisa las paradas solapadas' : 'Sin solapamientos horarios',
            ),
          ),
        ),
        h('span', { class: 'telemetria-conector', 'aria-hidden': 'true' }),
        h(
          'div',
          { class: 'telemetria-estacion telemetria-reloj' },
          h('span', { class: 'telemetria-icono' }, icono('reloj', 'icono-sm')),
          h(
            'div',
            { class: 'telemetria-datos' },
            h('strong', { class: 'telemetria-valor' }, textoReloj),
            h('span', { class: 'telemetria-etiqueta' }, 'Reloj oficial del festival'),
          ),
        ),
      ),
    ),
  );
}

/**
 * Construye una curva SVG en S que conecta visualmente dos paradas consecutivas del sendero.
 */
function conectorCurvoParada(haciaDerecha, enCruce) {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 360 56');
  s.setAttribute('class', `recorrido-curva-svg ${enCruce ? 'curva-cruce' : ''}`);
  s.setAttribute('aria-hidden', 'true');

  const d = haciaDerecha
    ? 'M 70 2 C 70 30, 290 26, 290 54'
    : 'M 290 2 C 290 30, 70 26, 70 54';

  const halo = document.createElementNS(SVG_NS, 'path');
  halo.setAttribute('d', d);
  halo.setAttribute('class', 'curva-halo');

  const trazo = document.createElementNS(SVG_NS, 'path');
  trazo.setAttribute('d', d);
  trazo.setAttribute('class', 'curva-trazo');

  s.append(halo, trazo);
  return s;
}

/**
 * Pantalla principal de Mi recorrido (/recorrido).
 * Cumple FR-001 a FR-021 y criterios de aceptación SC-001 a SC-011.
 */
export async function pantallaRecorrido(ctx = {}) {
  const contenedor = h('div', { class: 'recorrido-pagina' });
  const zonaContenido = h('div', { class: 'recorrido-cuerpo', 'aria-live': 'polite' });

  // Carga inicial de datos de la Agenda y estados de venta
  let catalogoAgenda = null;
  let referencia = null;
  let estadosVenta = [];

  try {
    const resAgenda = await apiProgramacion('GET', '/agenda');
    if (resAgenda.ok && resAgenda.datos) {
      catalogoAgenda = resAgenda.datos.items ?? [];
      referencia = resAgenda.datos.reference ?? null;
    }
  } catch {
    // Si falla la red, la consulta se hace sobre el snapshot local
  }

  // Consultar estado de venta en /api/participacion/sale-status (FR-019)
  const itemsLocales = obtenerRecorrido();
  const functionIds = itemsLocales.map((i) => i.functionId).filter(Boolean);
  if (functionIds.length > 0) {
    estadosVenta = await consultarEstadosVenta(functionIds);
  }

  function repintar() {
    const actual = obtenerRecorrido();
    const sincronizados = sincronizarRecorrido(actual, catalogoAgenda, estadosVenta);
    const cruces = detectarCruces(sincronizados);
    const idsConCruce = new Set(cruces.flatMap((c) => [c.itemA, c.itemB]));

    // Agrupar por fecha
    const porFecha = new Map();
    for (const item of sincronizados) {
      const f = item.date || 'Sin fecha';
      if (!porFecha.has(f)) porFecha.set(f, []);
      porFecha.get(f).push(item);
    }

    const hero = heroRecorrido({
      totalParadas: sincronizados.length,
      totalDias: porFecha.size,
      totalCruces: cruces.length,
      referencia,
    });

    // Barra superior de navegación, reloj oficial y nota de privacidad local
    const bannerCupo = h(
      'div',
      { class: 'recorrido-banner-cupo', role: 'note' },
      h('span', { class: 'recorrido-banner-icono' }, icono('recorrido', 'icono-sm')),
      h(
        'div',
        { class: 'recorrido-banner-texto' },
        h('strong', {}, 'Bitácora de ruta en tu dispositivo: '),
        h(
          'span',
          {},
          'Guardar no reserva cupo. Tus paradas se conservan en este navegador y no se sincronizan con ninguna cuenta ni dispositivo (FR-003, FR-004).',
        ),
      ),
    );

    const barraControl = h(
      'header',
      { class: 'recorrido-cabecera' },
      h(
        'div',
        { class: 'recorrido-cabecera-top' },
        h(
          'div',
          { class: 'seccion-encabezado' },
          h('p', { class: 'eyebrow' }, 'Itinerario por escenarios · Guardado en este navegador'),
          h(
            'h2',
            { class: 'titulo-seccion' },
            icono('recorrido', 'icono-titulo'),
            'Tu ',
            h('span', { class: 'resalte' }, 'ruta trazada'),
          ),
        ),
        h(
          'div',
          { class: 'recorrido-cabecera-derecha' },
          barraReloj(referencia),
          h(
            'a',
            { href: '/agenda', 'data-enlace': true, class: 'boton secundario boton-sm' },
            icono('calendario', 'icono-xs'),
            'Explorar Agenda',
          ),
          actual.length > 0
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'secundario boton-sm boton-vaciar',
                  'aria-label': 'Vaciar todas las funciones de Mi recorrido',
                  onclick: async () => {
                    const conf = await confirmarAccion({
                      titulo: 'Vaciar Mi recorrido',
                      mensaje: '¿Deseas quitar todas las funciones de tu recorrido local?',
                      botonConfirmar: 'Sí, vaciar',
                      peligro: true,
                    });
                    if (conf) {
                      vaciarRecorrido();
                      repintar();
                    }
                  },
                },
                icono('basura', 'icono-xs'),
                'Vaciar recorrido',
              )
            : null,
        ),
      ),
      bannerCupo,
    );

    if (sincronizados.length === 0) {
      zonaContenido.replaceChildren(
        h(
          'section',
          { class: 'estado-vacio recorrido-vacio recorrido-vacio-mapa' },
          h(
            'div',
            { class: 'recorrido-vacio-ilustracion', 'aria-hidden': 'true' },
            h('span', { class: 'vacio-estacion' }, '01'),
            h('span', { class: 'vacio-tramo' }),
            h('span', { class: 'vacio-estacion vacio-estacion-central' }, icono('recorrido', 'icono-md')),
            h('span', { class: 'vacio-tramo' }),
            h('span', { class: 'vacio-estacion' }, '02'),
          ),
          h('h2', {}, 'No tienes funciones guardadas en tu ruta'),
          h(
            'p',
            {},
            'Explora las actividades y funciones de la Agenda y guárdalas para trazar tu ruta personal de paradas por Loja.',
          ),
          h('a', { href: '/agenda', 'data-enlace': true, class: 'boton' }, 'Explorar la Agenda'),
        ),
      );
      const hojaVacia = h('div', { class: 'hoja-contenido recorrido-hoja' }, barraControl, zonaContenido);
      contenedor.replaceChildren(hero, hojaVacia);
      return;
    }

    const acentosFestival = ['acento-violeta', 'acento-ambar', 'acento-magenta', 'acento-coral', 'acento-esmeralda'];
    const seccionesDias = [];
    let contadorGlobalParada = 0;
    let indiceJornada = 0;

    for (const [fecha, itemsDelDia] of porFecha.entries()) {
      indiceJornada += 1;
      const partes = partesFecha(fecha);

      const seccion = h(
        'section',
        { class: 'recorrido-dia-seccion', 'aria-label': `Funciones para ${formatoFecha(fecha)}` },
        h(
          'div',
          { class: 'recorrido-dia-encabezado' },
          partes
            ? h(
                'div',
                { class: 'recorrido-dia-medallon', 'aria-hidden': 'true' },
                h('span', { class: 'medallon-semana' }, partes.semana),
                h('strong', { class: 'medallon-numero' }, String(partes.dia)),
                h('span', { class: 'medallon-mes' }, partes.mes),
              )
            : h('span', { class: 'recorrido-dia-icono' }, icono('calendario', 'icono-sm')),
          h(
            'div',
            { class: 'recorrido-dia-titular' },
            h('span', { class: 'recorrido-jornada-kicker' }, `Jornada ${String(indiceJornada).padStart(2, '0')} · Sendero del día`),
            h('h2', { class: 'recorrido-dia-titulo' }, formatoFecha(fecha)),
          ),
          h(
            'span',
            { class: 'recorrido-dia-chip' },
            icono('recorrido', 'icono-xs'),
            `${itemsDelDia.length} ${itemsDelDia.length === 1 ? 'estación' : 'estaciones'}`,
          ),
        ),
        h(
          'div',
          { class: 'recorrido-tablero-sendero' },
          h('div', { class: 'sendero-columna-espina', 'aria-hidden': 'true' }),
          h(
            'ul',
            { class: 'recorrido-lista recorrido-sendero-dia' },
            itemsDelDia.map((item, idxDia) => {
              contadorGlobalParada += 1;
              const codigoParada = String(contadorGlobalParada).padStart(2, '0');
              const acentoClase = acentosFestival[(contadorGlobalParada - 1) % acentosFestival.length];
              const esIzquierda = idxDia % 2 === 0;
              const ladoClase = esIzquierda ? 'parada-lado-izq' : 'parada-lado-der';
              const siguienteDelDia = itemsDelDia[idxDia + 1] ?? null;
              const tieneCruce = idsConCruce.has(item.id);
              const crucesDelItem = cruces.filter((c) => c.itemA === item.id || c.itemB === item.id);
              const cruceConSiguiente = siguienteDelDia
                ? cruces.find(
                    (c) =>
                      (c.itemA === item.id && c.itemB === siguienteDelDia.id) ||
                      (c.itemB === item.id && c.itemA === siguienteDelDia.id),
                  )
                : null;
              const esCancelada = item.status === 'cancelled' || item.notice?.kind === 'cancelled';
              const esArchivada = item.status === 'archived' || item.isArchived;
              const esReprogramada = item.notice?.kind === 'rescheduled' && !esCancelada;
              const esAgotada = item.saleState === 'sold_out';
              const estadoTemporal = determinarEstadoTemporal(item, referencia);
              const esInicioPasado = estadoTemporal === 'start_passed';
              const esTerminada = estadoTemporal === 'finished';

              // Comprobar si requiere alternativas (FR-012, FR-018)
              const necesitaAlternativas = esCancelada || esArchivada || esAgotada || esInicioPasado || esTerminada;

              const detalleCruces = crucesDelItem
                .map((c) => {
                  const otroId = c.itemA === item.id ? c.itemB : c.itemA;
                  const otro = sincronizados.find((x) => x.id === otroId);
                  const tituloOtro = otro?.title ? `«${otro.title}»` : 'otra función';
                  return `Se solapa con ${tituloOtro} (${c.overlapMinutes} min de cruce).`;
                })
                .join(' ');

              return h(
                'li',
                {
                  id: `parada-estacion-${codigoParada}`,
                  class: `recorrido-tarjeta ${ladoClase} ${acentoClase} ${tieneCruce ? 'tarjeta-con-cruce' : ''} ${esCancelada ? 'tarjeta-cancelada' : ''}`,
                },
                // Nodo central sobre el sendero serpenteante (brújula de estación)
                h(
                  'div',
                  { class: 'recorrido-hito-central', 'aria-hidden': 'true' },
                  h('span', { class: 'hito-central-etiqueta' }, `PARADA ${codigoParada}`),
                  h(
                    'div',
                    { class: 'recorrido-estacion-pin' },
                    h('span', { class: 'estacion-pin-num' }, codigoParada),
                  ),
                  h('span', { class: 'recorrido-estacion-hora' }, item.startTime),
                ),
                // Boleto postal artístico de la parada
                h(
                  'div',
                  { class: 'recorrido-tarjeta-contenedor' },
                  tieneCruce
                    ? h(
                        'div',
                        { class: 'alerta-cruce-horario', role: 'alert' },
                        icono('aviso', 'icono-xs'),
                        h('strong', {}, 'Advertencia de cruce en tu ruta: '),
                        ` ${detalleCruces} Guardar nunca se bloquea (RC-02).`,
                      )
                    : null,
                  h(
                    'div',
                    { class: 'recorrido-boleto-interior' },
                    // Talón izquierdo de la parada (reloj y sello de estación)
                    h(
                      'div',
                      { class: 'recorrido-boleto-talon', 'aria-hidden': 'true' },
                      h('span', { class: 'talon-sello-parada' }, `ESTACIÓN · ${codigoParada}`),
                      h('strong', { class: 'talon-hora-grande' }, item.startTime),
                      item.endTime ? h('span', { class: 'talon-hora-fin' }, `a ${item.endTime}`) : null,
                      item.durationMinutes
                        ? h('span', { class: 'talon-duracion-chip' }, formatoDuracion(item.durationMinutes))
                        : null,
                    ),
                    // Cuerpo derecho del boleto postal
                    h(
                      'div',
                      { class: 'recorrido-tarjeta-cuerpo' },
                      h(
                        'div',
                        { class: 'recorrido-tarjeta-top' },
                        h('span', { class: 'recorrido-parada-badge-movil' }, `Parada ${codigoParada}`),
                        h(
                          'span',
                          { class: 'recorrido-hora-badge' },
                          icono('reloj', 'icono-xs'),
                          `${item.startTime}${item.endTime ? ` – ${item.endTime}` : ''}`,
                          item.durationMinutes ? ` (${formatoDuracion(item.durationMinutes)})` : '',
                        ),
                        item.venue
                          ? h(
                              'span',
                              { class: 'recorrido-sede-pill' },
                              icono(item.venue.kind === 'route' ? 'recorrido' : 'sede', 'icono-xs'),
                              item.venue.name,
                            )
                          : null,
                        esCancelada ? h('span', { class: 'insignia-estado estado-cancelada' }, 'Cancelada') : null,
                        esReprogramada ? h('span', { class: 'insignia-estado estado-reprogramada' }, 'Reprogramada') : null,
                        esArchivada ? h('span', { class: 'chip-aviso' }, 'Ya no está en la programación activa') : null,
                        esAgotada ? h('span', { class: 'insignia-estado venta-agotada' }, 'Agotada') : null,
                        esInicioPasado && !esCancelada && !esArchivada
                          ? h('span', { class: 'insignia-estado estado-pasada' }, 'Hora de inicio pasada')
                          : null,
                        esTerminada && !esCancelada && !esArchivada
                          ? h('span', { class: 'insignia-estado estado-terminada' }, 'Terminada')
                          : null,
                      ),
                      h(
                        'h3',
                        { class: 'recorrido-tarjeta-titulo' },
                        h('a', { href: `/actividad/${encodeURIComponent(item.activityId)}`, 'data-enlace': true }, item.title),
                      ),
                      item.artists?.length
                        ? h('p', { class: 'recorrido-tarjeta-artistas' }, item.artists.join(' · '))
                        : null,
                      item.notice
                        ? h(
                            'div',
                            { class: `horario-aviso-caja aviso-${item.notice.kind}` },
                            icono('aviso', 'icono-xs'),
                            h('div', {}, h('strong', {}, `${etiquetaAviso(item.notice.kind)}: `), item.notice.text),
                          )
                        : null,
                      h(
                        'div',
                        { class: 'recorrido-tarjeta-acciones' },
                        h(
                          'a',
                          {
                            href: `/actividad/${encodeURIComponent(item.activityId)}`,
                            'data-enlace': true,
                            class: 'enlace-ficha-parada',
                          },
                          'Ver ficha de la actividad →',
                        ),
                        necesitaAlternativas
                          ? h(
                              'button',
                              {
                                type: 'button',
                                class: 'boton-sm boton-alternativas',
                                'aria-label': `Ver alternativas en la misma sede para «${item.title}»`,
                                onclick: () => abrirModalAlternativas(item, catalogoAgenda ?? [], referencia, repintar),
                              },
                              icono('calendario', 'icono-xs'),
                              'Ver alternativas en esta sede',
                            )
                          : null,
                        h(
                          'button',
                          {
                            type: 'button',
                            class: 'secundario boton-sm boton-quitar-item',
                            'aria-label': `Quitar «${item.title}» de Mi recorrido`,
                            onclick: () => {
                              quitarDeRecorrido(item.id);
                              repintar();
                            },
                          },
                          icono('basura', 'icono-xs'),
                          'Quitar',
                        ),
                      ),
                    ),
                  ),
                ),
                // Curva en S y cartel conector del tramo hacia la siguiente parada del mismo día
                siguienteDelDia
                  ? h(
                      'div',
                      { class: 'recorrido-conector-paso', 'aria-hidden': 'true' },
                      conectorCurvoParada(esIzquierda, Boolean(cruceConSiguiente)),
                      h(
                        'div',
                        {
                          class: `recorrido-tramo-cartel ${cruceConSiguiente ? 'tramo-en-cruce' : 'tramo-despejado'}`,
                        },
                        icono(cruceConSiguiente ? 'aviso' : 'recorrido', 'icono-xs'),
                        h(
                          'span',
                          {},
                          cruceConSiguiente
                            ? `Cruce de ${cruceConSiguiente.overlapMinutes} min con «${siguienteDelDia.title}»`
                            : `Rumbo a Parada ${String(contadorGlobalParada + 1).padStart(2, '0')} · ${siguienteDelDia.venue?.name ?? 'Siguiente escenario'} (${siguienteDelDia.startTime})`,
                        ),
                      ),
                    )
                  : null,
              );
            }),
          ),
        ),
      );
      seccionesDias.push(seccion);
    }

    zonaContenido.replaceChildren(...seccionesDias);
    const hoja = h('div', { class: 'hoja-contenido recorrido-hoja' }, barraControl, zonaContenido);
    contenedor.replaceChildren(hero, hoja);
  }

  repintar();
  return contenedor;
}

