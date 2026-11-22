import { enLoja, referencia } from '../clock.js';
import { normalizar } from './text.js';
import { franjaAplicaEn, queHayAhora } from './now.js';
import { fichaPublica, etiquetaAcceso } from './presenter.js';
import { funcionDesdeFila, franjaDesdeFila, avisoDesdeFila } from '../repositories/published.js';
import { notFound } from '../http/errors.js';

// Consulta pública sin sesión: Agenda, ficha y «¿Qué hay ahora?» (FR-001 a FR-007).
// Solo actividades PUBLICADAS y no archivadas; nunca borradores, propuestas ni versiones pendientes (SC-001, SC-006).

export function createAgenda({ db, catalogs, clock, clockFixed = false }) {
  /** Carga las actividades publicadas con sus funciones, franjas y avisos. `filtroTexto` ya normalizado. */
  async function publicadas({ filtroTexto, ids } = {}) {
    const params = [];
    let where = "a.status = 'active' AND a.published_at IS NOT NULL";
    if (filtroTexto) {
      params.push(`%${filtroTexto.replace(/[\\%_]/g, '\\$&')}%`);
      where += ` AND a.search_text LIKE $${params.length} ESCAPE '\\'`;
    }
    if (ids) {
      params.push(ids);
      where += ` AND a.id = ANY($${params.length})`;
    }
    const filas = await db.query(`SELECT a.id, a.edition_id, a.published_content FROM activities a WHERE ${where}`, params);
    if (filas.length === 0) return [];
    const lista = filas.map((f) => f.id);
    const [funciones, franjas, avisos, ediciones] = await Promise.all([
      db.query('SELECT * FROM functions WHERE activity_id = ANY($1) ORDER BY date, start_time', [lista]),
      db.query('SELECT * FROM opening_slots WHERE activity_id = ANY($1) ORDER BY id', [lista]),
      db.query('SELECT * FROM notices WHERE activity_id = ANY($1) ORDER BY id DESC', [lista]),
      db.query('SELECT id, active FROM editions'),
    ]);
    const activas = new Map(ediciones.map((e) => [e.id, e.active]));
    const agrupar = (filasHijas, convertir) => {
      const m = new Map(lista.map((id) => [id, []]));
      for (const h of filasHijas) m.get(h.activity_id)?.push(convertir(h));
      return m;
    };
    const fs = agrupar(funciones, funcionDesdeFila);
    const ss = agrupar(franjas, franjaDesdeFila);
    const ns = agrupar(avisos, avisoDesdeFila);
    return filas.map((f) => ({
      id: f.id,
      editionId: f.edition_id,
      editionActive: f.edition_id ? activas.get(f.edition_id) !== false : true,
      content: f.published_content,
      durationMinutes: f.published_content.durationMinutes,
      functions: fs.get(f.id),
      slots: ss.get(f.id),
      notices: ns.get(f.id),
    }));
  }

  /** Próxima fecha con función vigente o franja, desde hoy (o null). */
  function proximaFecha(a, hoy) {
    const fechas = a.functions.filter((f) => f.status === 'scheduled' && f.date >= hoy).map((f) => f.date);
    for (const s of a.slots) {
      if (Array.isArray(s.dates) && s.dates.length) fechas.push(...s.dates.filter((d) => d >= hoy));
      else if (s.to && s.to >= hoy) fechas.push(s.from > hoy ? s.from : hoy);
    }
    return fechas.sort()[0] ?? null;
  }

  function cumple(a, filtros) {
    if (filtros.editionId ? a.editionId !== filtros.editionId : !a.editionActive) return false;
    if (filtros.categoryId && a.content.categoryId !== filtros.categoryId) return false;
    if (filtros.access && a.content.access.mode !== filtros.access) return false;
    if (filtros.venueId && !a.functions.some((f) => f.venueId === filtros.venueId) && !a.slots.some((s) => s.venueId === filtros.venueId)) {
      return false;
    }
    if (filtros.date && !a.functions.some((f) => f.date === filtros.date) && !a.slots.some((s) => franjaAplicaEn(s, filtros.date))) {
      return false;
    }
    return true;
  }

  return {
    /** Lectura del catálogo publicado que usa la Agenda; Alforjita lee exactamente lo mismo (spec 008, FR-006). */
    publicadas: () => publicadas(),

    async agenda(filtros = {}) {
      const ahora = clock();
      const hoy = enLoja(ahora).date;
      const texto = normalizar(filtros.q ?? '');
      const { venues, categories } = await catalogs.mapas();
      const items = (await publicadas({ filtroTexto: texto || undefined }))
        .filter((a) => cumple(a, filtros))
        .map((a) => {
          const sedes = [...new Set([...a.functions.map((f) => f.venueId), ...a.slots.map((s) => s.venueId)])];
          return {
            id: a.id,
            title: a.content.title,
            artists: a.content.artists,
            category: a.content.categoryId ? (categories.get(a.content.categoryId) ?? null) : null,
            access: { mode: a.content.access.mode, priceUsd: a.content.access.priceUsd, label: etiquetaAcceso(a.content.access) },
            nextDate: proximaFecha(a, hoy),
            venues: sedes.map((id) => venues.get(id)).filter(Boolean),
            isPermanent: a.slots.length > 0,
            hasNotices: a.notices.length > 0,
          };
        })
        .sort((x, y) => (x.nextDate ?? '9999').localeCompare(y.nextDate ?? '9999') || x.title.localeCompare(y.title, 'es'));
      return { reference: referencia(clock, clockFixed), items };
    },

    async ficha(id) {
      const [a] = await publicadas({ ids: [id] });
      if (!a) throw notFound('Esta actividad no está publicada o ya no forma parte de la programación.');
      return fichaPublica(a, await catalogs.mapas(), clock());
    },

    async ahora() {
      const ahora = clock();
      const mapas = await catalogs.mapas();
      const actividades = (await publicadas()).filter((a) => a.editionActive);
      const r = queHayAhora(actividades, ahora);
      const sede = (id) => mapas.venues.get(id) ?? null;
      const funcion = (x) => ({
        activityId: x.activity.id,
        title: x.activity.content.title,
        function: {
          id: x.function.id,
          date: x.function.date,
          startTime: x.function.startTime,
          endTime: x.function.endTime,
          durationMinutes: x.function.durationMinutes,
          venue: sede(x.function.venueId),
          status: x.function.status,
          timeStatus: x.timeStatus,
        },
      });
      return {
        reference: referencia(clock, clockFixed),
        openSlots: r.openSlots.map((x) => ({
          activityId: x.activity.id,
          title: x.activity.content.title,
          slot: { ...x.slot, venue: sede(x.slot.venueId) },
        })),
        upcoming: r.upcoming.map(funcion),
        inProgress: r.inProgress.map(funcion),
        startPassed: r.startPassed.map(funcion),
      };
    },
  };
}
