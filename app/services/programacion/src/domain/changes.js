import { fechaValida, horaValida, minutos } from '../clock.js';
import { textoONulo } from './text.js';
import { validation, conflict, notFound } from '../http/errors.js';

// Reprogramar o cancelar una función publicada con motivo interno y aviso público (FR-015 a FR-019).
// Mover de sede es reprogramar (FR-016). Antes se consulta el impacto en entradas y pedidos (FR-017);
// las reglas de lo vendido son del spec 05 (RF-24, RF-36) y del spec 06 (RF-25): aquí no se duplican.

export function createChanges({ db, crearRepos, permisos, participacion, clock }) {
  const repos = crearRepos(db);
  const ahora = () => clock().toISOString();

  async function funcionPublicada(id, r = repos) {
    const f = await r.published.findFunction(id);
    if (!f) throw notFound('La función no existe o no está publicada.');
    const a = await r.activities.find(f.activityId);
    if (!a || !a.publishedAt) throw notFound('La función no existe o no está publicada.');
    if (a.status === 'archived') throw conflict('archived', 'La actividad está archivada.');
    return { f, a };
  }

  function motivoYAviso(cuerpo) {
    const reason = textoONulo(cuerpo?.reason, 2000);
    const notice = textoONulo(cuerpo?.notice, 2000);
    const campos = {};
    if (!reason) campos.reason = 'Escribe el motivo interno del cambio.';
    if (!notice) campos.notice = 'Escribe el aviso público que verá el público en la ficha.';
    if (Object.keys(campos).length) throw validation(campos);
    return { reason, notice };
  }

  /** Mantiene la versión publicada y la pendiente en línea con la función cambiada, para no deshacer el cambio al publicar. */
  async function sincronizarContenidos(r, a, funcionId, datos, momento) {
    const actualizar = (c) =>
      c && { ...c, functions: (c.functions ?? []).map((x) => (x.id === funcionId ? { ...x, ...datos } : x)) };
    await r.activities.update(
      a.id,
      a.version,
      { published_content: actualizar(a.publishedContent), working_content: actualizar(a.workingContent) },
      momento,
    );
  }

  return {
    async impacto(sesion, id) {
      await permisos.permitir(sesion, 'schedule.change');
      await funcionPublicada(id);
      return participacion.impact(id);
    },

    async reprogramar(sesion, id, cuerpo = {}) {
      await permisos.permitir(sesion, 'schedule.change');
      const { reason, notice } = motivoYAviso(cuerpo);
      const impacto = await participacion.impact(id);
      return db.transaction(`funcion:${id}`, async (tx) => {
        const r = crearRepos(tx);
        const { f, a } = await funcionPublicada(id, r);
        if (f.status === 'cancelled') throw conflict('cancelled', 'La función está cancelada.');
        const nueva = {
          date: cuerpo.date ?? f.date,
          startTime: cuerpo.startTime ?? f.startTime,
          endTime: cuerpo.endTime === undefined ? f.endTime : cuerpo.endTime,
          venueId: cuerpo.venueId ?? f.venueId,
        };
        const campos = {};
        if (!fechaValida(nueva.date)) campos.date = 'La fecha no es válida (AAAA-MM-DD).';
        if (!horaValida(nueva.startTime)) campos.startTime = 'La hora de inicio no es válida (HH:MM).';
        if (nueva.endTime !== null && !horaValida(nueva.endTime)) campos.endTime = 'La hora de fin no es válida (HH:MM).';
        if (horaValida(nueva.startTime) && horaValida(nueva.endTime) && minutos(nueva.endTime) <= minutos(nueva.startTime)) {
          campos.endTime = 'La hora de fin debe ser posterior a la de inicio.';
        }
        if (!(await r.catalogs.find('venues', nueva.venueId))) campos.venueId = 'La sede no existe.';
        if (Object.keys(campos).length) throw validation(campos);
        if (nueva.date === f.date && nueva.startTime === f.startTime && nueva.venueId === f.venueId && nueva.endTime === f.endTime) {
          throw validation({ date: 'No hay ningún cambio de fecha, hora o sede.' });
        }
        const momento = ahora();
        await r.published.rescheduleFunction(id, nueva, momento);
        await sincronizarContenidos(r, a, id, nueva, momento);
        await r.published.addNotice({ activityId: a.id, functionId: id, kind: 'rescheduled', text: notice, reason, actorId: sesion.userId, at: momento });
        await r.history.add({
          at: momento,
          actorId: sesion.userId,
          action: 'function.rescheduled',
          entityType: 'activity',
          entityId: a.id,
          details: { functionId: id, from: { date: f.date, startTime: f.startTime, venueId: f.venueId }, to: nueva, reason, venueChanged: nueva.venueId !== f.venueId },
        });
        return { function: await r.published.findFunction(id), impact: impacto };
      });
    },

    async cancelar(sesion, id, cuerpo = {}) {
      await permisos.permitir(sesion, 'schedule.change');
      const { reason, notice } = motivoYAviso(cuerpo);
      const impacto = await participacion.impact(id);
      // Regla del spec 005 (FR-030): con entradas vendidas solo cancela el administrador. Si no se puede saber
      // si hay ventas, se trata como si las hubiera (fallo cerrado).
      if (!impacto.available || impacto.issuedTickets > 0 || impacto.soldTickets > 0) {
        await permisos.permitir(sesion, 'schedule.cancel_with_sales');
      }
      return db.transaction(`funcion:${id}`, async (tx) => {
        const r = crearRepos(tx);
        const { f, a } = await funcionPublicada(id, r);
        if (f.status === 'cancelled') throw conflict('cancelled', 'La función ya está cancelada.');
        const momento = ahora();
        await r.published.cancelFunction(id, momento);
        await r.published.addNotice({ activityId: a.id, functionId: id, kind: 'cancelled', text: notice, reason, actorId: sesion.userId, at: momento });
        await r.history.add({
          at: momento,
          actorId: sesion.userId,
          action: 'function.cancelled',
          entityType: 'activity',
          entityId: a.id,
          details: { functionId: id, reason },
        });
        return { function: await r.published.findFunction(id), impact: impacto };
      });
    },

    /** Para participación (spec 05 y 06): estado publicado de una función. */
    async funcionInterna(id) {
      const datos = await interna(id);
      if (!datos) throw notFound();
      return datos;
    },

    /** Varias funciones a la vez; las que no existen o no están publicadas se omiten (spec 005). */
    async funcionesInternas(ids) {
      const items = [];
      for (const id of [...new Set(ids)].slice(0, 100)) {
        const datos = await interna(id);
        if (datos) items.push(datos);
      }
      return { items };
    },
  };

  async function interna(id) {
      const f = await repos.published.findFunction(id);
      const a = f && (await repos.activities.find(f.activityId));
      if (!f || !a || !a.publishedAt) return null;
      const sede = await repos.catalogs.find('venues', f.venueId);
      const aviso = (await repos.published.noticesOf(a.id)).find((n) => n.functionId === id) ?? null;
      const acceso = a.publishedContent.access ?? {};
      return {
        id: f.id,
        activityId: a.id,
        title: a.publishedContent.title,
        date: f.date,
        startTime: f.startTime,
        endTime: f.endTime,
        durationMinutes: f.durationMinutes ?? a.publishedContent.durationMinutes ?? null,
        venueId: f.venueId,
        status: f.status,
        activityStatus: a.status,
        venueName: sede?.name ?? null,
        // Acceso y precio de la actividad: la única fuente del precio de venta (spec 005, FR-019).
        access: { mode: acceso.mode ?? 'unconfirmed', priceUsd: typeof acceso.priceUsd === 'number' ? acceso.priceUsd : null },
        latestNotice: aviso ? { kind: aviso.kind, text: aviso.text, at: aviso.at } : null,
      };
  }
}
