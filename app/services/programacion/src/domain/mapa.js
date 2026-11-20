import { enLoja, referencia, fechaValida } from '../clock.js';
import { normalizar } from './text.js';
import { estadoTemporal } from './now.js';
import { validation, notFound } from '../http/errors.js';

// Mapa isométrico de sedes (spec 003): consulta pública sin sesión ni ubicación.
// Las sedes y las funciones son las del propio servicio de programación: no se duplica el catálogo.

/**
 * Ilustración vigente. Es PROVISIONAL hasta que el equipo entregue la de Loja (P-13): al cambiarla,
 * se añade el archivo en app/web/img/ y se cambia este objeto con un `id` nuevo. Los marcadores colocados sobre
 * otra ilustración dejan de mostrarse (la sede sigue en la lista) en lugar de quedar en un sitio equivocado.
 */
export const ILUSTRACION = Object.freeze({
  id: 'provisional-2026-11',
  src: '/img/mapa-provisional.svg',
  width: 1600,
  height: 1000,
  provisional: true,
});

export const CARACTERISTICAS = Object.freeze({ step_free: 'stepFree', accessible_toilet: 'accessibleToilet' });

const enRango = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
const redondear = (n, decimales) => Math.round(n * 10 ** decimales) / 10 ** decimales;

/**
 * Valida un marcador recibido del panel: `{ illustrationId, x, y }` con x e y entre 0 y 1 sobre la ilustración vigente.
 * `null` quita el marcador. Lanza 422 si no es válido. El marcador NUNCA es una coordenada real (FR-012, FR-020).
 */
export function validarMarcador(m, ilustracion = ILUSTRACION) {
  if (m === null) return null;
  const esObjeto = m && typeof m === 'object' && !Array.isArray(m);
  if (!esObjeto || m.illustrationId !== ilustracion.id || !enRango(m.x, 0, 1) || !enRango(m.y, 0, 1)) {
    throw validation({ marker: 'Coloca el marcador dentro de la ilustración vigente.' });
  }
  return { illustrationId: ilustracion.id, x: redondear(m.x, 5), y: redondear(m.y, 5) };
}

/** Marcador guardado si pertenece a la ilustración vigente y tiene el formato correcto; si no, null (sin marcador). */
export function marcadorVigente(m, ilustracion = ILUSTRACION) {
  if (!m || typeof m !== 'object' || m.illustrationId !== ilustracion.id) return null;
  if (!enRango(m.x, 0, 1) || !enRango(m.y, 0, 1)) return null;
  return { illustrationId: m.illustrationId, x: m.x, y: m.y };
}

/** Enlace de Google Maps a unas coordenadas verificadas (M-08). No pide la ubicación de la persona. */
export function enlaceComoLlegar(lat, lng) {
  if (!enRango(lat, -90, 90) || !enRango(lng, -180, 180)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/** Destino verificado de una fila de `venues` (los cuatro datos), o null. Un recorrido nunca tiene destino. */
export function destinoDeFila(f) {
  if (f.kind === 'route') return null;
  if (f.dest_lat === null || f.dest_lat === undefined || f.dest_lng === null || !f.dest_source || !f.dest_verified_on) return null;
  return { lat: Number(f.dest_lat), lng: Number(f.dest_lng), source: f.dest_source, verifiedOn: f.dest_verified_on };
}

const SIN_CONFIRMAR = Object.freeze({ status: 'unconfirmed', source: null, verifiedOn: null, note: null, updatedAt: null });

/** Accesibilidad completa (las dos características; sin fila = por confirmar). */
export function accesibilidadCompleta(filas = {}) {
  return Object.fromEntries(Object.keys(CARACTERISTICAS).map((k) => [k, filas[k] ?? SIN_CONFIRMAR]));
}

/** Objeto público `VenueSummary` del contrato. */
export function resumenSede(f, { accesibilidad, foto, ilustracion = ILUSTRACION, dayFunctionCount = null }) {
  const destino = destinoDeFila(f);
  const acc = accesibilidadCompleta(accesibilidad);
  return {
    id: f.id,
    name: f.name,
    kind: f.kind,
    address: f.address ?? null,
    routeDescription: f.route_description ?? null,
    marker: marcadorVigente(f.marker, ilustracion),
    directionsUrl: destino ? enlaceComoLlegar(destino.lat, destino.lng) : null,
    accessibility: Object.fromEntries(
      Object.entries(CARACTERISTICAS).map(([k, publico]) => [publico, { status: acc[k].status, note: acc[k].note }]),
    ),
    photo: foto ? { url: `/api/programacion/map/venues/${encodeURIComponent(f.id)}/photo?v=${foto.sha256.slice(0, 16)}`, alt: foto.alt, credit: foto.credit } : null,
    dayFunctionCount,
  };
}

const verdadero = (v) => v === true || v === 'true' || v === '1';

export function createMapa({ repos, clock, clockFixed = false, ilustracion = ILUSTRACION }) {
  function diaValido(day) {
    if (day === undefined || day === null || day === '') return null;
    if (!fechaValida(day)) throw validation({ day: 'El día debe tener el formato AAAA-MM-DD.' });
    return day;
  }

  return {
    ilustracion,

    async datos() {
      return { reference: referencia(clock, clockFixed), illustration: { ...ilustracion }, days: await repos.sedes.days() };
    },

    /** Sedes registradas con búsqueda y filtros combinados con «y» (FR-005 a FR-010, FR-015, FR-027). */
    async sedes(filtros = {}) {
      const day = diaValido(filtros.day);
      const texto = normalizar(String(filtros.q ?? '').slice(0, 100));
      const [filas, accesibilidad, fotos, conteos, dias] = await Promise.all([
        repos.sedes.listVenues(),
        repos.sedes.accessibility(),
        repos.sedes.photos(),
        day ? repos.sedes.dayCounts(day) : Promise.resolve(null),
        day ? repos.sedes.days() : Promise.resolve(null),
      ]);
      const pideSinEscalones = verdadero(filtros.stepFree);
      const pideBanio = verdadero(filtros.accessibleToilet);
      const confirmada = (id, k) => accesibilidad.get(id)?.[k]?.status === 'confirmed';

      const items = filas
        .filter((f) => !texto || f.name_key.includes(texto))
        .filter((f) => !day || (conteos.get(f.id) ?? 0) > 0)
        .filter((f) => !pideSinEscalones || confirmada(f.id, 'step_free'))
        .filter((f) => !pideBanio || confirmada(f.id, 'accessible_toilet'))
        .map((f) =>
          resumenSede(f, { accesibilidad: accesibilidad.get(f.id), foto: fotos.get(f.id), ilustracion, dayFunctionCount: day ? (conteos.get(f.id) ?? 0) : null }),
        );
      return { reference: referencia(clock, clockFixed), day, dayHasFunctions: day ? dias.includes(day) : null, items };
    },

    /** Ficha de una sede: funciones desde hoy (hora de Loja), o solo las del día; las canceladas, marcadas (FR-011). */
    async sede(id, { day } = {}) {
      const dia = diaValido(day);
      const f = await repos.sedes.findVenue(id);
      if (!f) throw notFound('Esta sede no está registrada en la programación.');
      const ahora = clock();
      const [accesibilidad, fotos, funciones] = await Promise.all([
        repos.sedes.accessibility([id]),
        repos.sedes.photos([id]),
        repos.sedes.functionsOf(id, dia ? { day: dia } : { desde: enLoja(ahora).date }),
      ]);
      return {
        ...resumenSede(f, { accesibilidad: accesibilidad.get(id), foto: fotos.get(id), ilustracion }),
        reference: referencia(clock, clockFixed),
        functions: funciones.map((fn) => {
          const funcion = {
            date: fn.date,
            startTime: fn.start_time,
            endTime: fn.end_time,
            durationMinutes: fn.duration_minutes,
            status: fn.status,
          };
          const duracion = typeof fn.activity_duration === 'number' ? fn.activity_duration : null;
          return {
            id: fn.id,
            activityId: fn.activity_id,
            title: fn.title ?? '',
            date: fn.date,
            startTime: fn.start_time,
            endTime: fn.end_time,
            status: fn.status,
            timeStatus: estadoTemporal(funcion, ahora, duracion),
          };
        }),
      };
    },

    async foto(id) {
      const p = await repos.sedes.photoBytes(id);
      if (!p) throw notFound('Esta sede no tiene foto.');
      return p;
    },
  };
}
