import { enLoja } from '../clock.js';
import { normalizarContenido, contenidoVacio, validarEnvio, cambiosDeAsistencia, nuevoId } from './content.js';
import { fichaPublica } from './presenter.js';
import { normalizar, textoONulo } from './text.js';
import { validation, conflict, notFound, AppError } from '../http/errors.js';

// Flujo editorial (FR-008 a FR-014, FR-027 a FR-030, FR-032).
//   editor: crea y edita SUS borradores, los envía; no publica ni edita lo que está en revisión.
//   publicador y administrador: ven y editan todo, devuelven con observaciones y publican (también lo propio).
//   administrador: reasigna, archiva y borra.
// Publicar NO activa ventas (FR-014): este servicio no tiene datos de venta.

const textoBusqueda = (c) => normalizar([c.title, ...(c.artists ?? []), c.organization].filter(Boolean).join(' '));

export function createEditorial({ db, crearRepos, permisos, catalogs, clock }) {
  const repos = crearRepos(db);
  const ahora = () => clock().toISOString();

  async function cargar(id, r = repos) {
    const a = await r.activities.find(id);
    if (!a) throw notFound();
    return a;
  }

  /** 'any' (publicador o administrador) u 'own' (el editor, si es el autor). Si no, 403 sin revelar contenido. */
  async function exigirEdicion(sesion, a) {
    if (await permisos.puede(sesion, 'draft.edit_any')) return 'any';
    await permisos.permitir(sesion, 'draft.edit_own', { ownerId: a.ownerId });
    return 'own';
  }

  const noArchivada = (a) => {
    if (a.status === 'archived') throw conflict('archived', 'La actividad está archivada: ya no se edita.');
  };

  async function guardarConVersion(a, version, cambios, r = repos) {
    if (!Number.isInteger(version)) throw validation({ version: 'Falta la versión que estás editando.' });
    if (!(await r.activities.update(a.id, version, cambios, ahora()))) {
      throw conflict('version_conflict', 'Otra persona guardó cambios antes que tú. Recarga para ver la versión actual.');
    }
  }

  const auditar = (r, actorId, action, entityId, details) =>
    r.history.add({ at: ahora(), actorId, action, entityType: 'activity', entityId, details });

  /** Publica el contenido de trabajo. Lo usan «publicar» y la publicación de un lote. Atómico. */
  async function publicarInterno(actorId, id, { version, reason, notice } = {}) {
    return db.transaction(`actividad:${id}`, async (tx) => {
      const r = crearRepos(tx);
      const a = await cargar(id, r);
      noArchivada(a);
      if (version !== undefined && version !== a.version) {
        throw conflict('version_conflict', 'Otra persona guardó cambios antes que tú. Recarga para ver la versión actual.');
      }
      if (!a.workingContent || a.editorialState === 'none') throw conflict('nothing_to_publish', 'No hay una versión pendiente para publicar.');
      const contenido = normalizarContenido(a.workingContent);
      const campos = validarEnvio(contenido, await r.catalogs.ids());
      if (Object.keys(campos).length) throw validation(campos, 'La propuesta no está completa para publicarse.');

      const [funciones, franjas] = await Promise.all([r.published.functionsOf(id), r.published.slotsOf(id)]);
      const cambios = cambiosDeAsistencia(funciones, franjas, contenido);
      const motivo = textoONulo(reason, 2000);
      const aviso = textoONulo(notice, 2000);
      if (cambios.length && (!motivo || !aviso)) {
        throw new AppError(422, 'notice_required', 'Esta versión cambia fechas, horas, sedes o franjas ya publicadas: escribe el motivo interno y el aviso público.', {
          changes: cambios,
        });
      }

      const momento = ahora();
      for (const f of contenido.functions) await r.published.upsertFunction({ ...f, activityId: id }, momento);
      const quitadas = cambios.filter((c) => c.type === 'function_removed').map((c) => c.functionId);
      for (const fid of quitadas) await r.published.cancelFunction(fid, momento);
      await r.published.replaceSlots(id, contenido.slots, momento);

      if (cambios.length) {
        let kind = 'changed';
        if (cambios.some((c) => c.type === 'function_rescheduled')) kind = 'rescheduled';
        else if (cambios.every((c) => c.type === 'function_removed')) kind = 'cancelled';
        await r.published.addNotice({ activityId: id, kind, text: aviso, reason: motivo, actorId, at: momento });
      }
      await r.activities.update(
        id,
        a.version,
        {
          published_content: contenido,
          working_content: null,
          editorial_state: 'none',
          review_notes: null,
          published_at: a.publishedAt ?? momento,
          search_text: textoBusqueda(contenido),
        },
        momento,
      );
      await auditar(r, actorId, 'activity.published', id, { changes: cambios, firstPublication: !a.publishedAt });
      for (const fid of quitadas) await auditar(r, actorId, 'function.cancelled', id, { functionId: fid, reason: motivo });
      return { id, published: true, changes: cambios };
    });
  }

  async function detalle(a) {
    const [funciones, avisos] = await Promise.all([repos.published.functionsOf(a.id), repos.published.noticesOf(a.id)]);
    const base = a.workingContent ?? a.publishedContent ?? contenidoVacio();
    const ids = await repos.catalogs.ids();
    return {
      id: a.id,
      ownerId: a.ownerId,
      createdBy: a.createdBy,
      editionId: a.editionId,
      version: a.version,
      editorialState: a.editorialState,
      status: a.status,
      published: Boolean(a.publishedAt),
      publishedAt: a.publishedAt,
      reviewNotes: a.reviewNotes,
      working: a.workingContent,
      publishedContent: a.publishedContent,
      functions: funciones,
      notices: avisos,
      source: a.source,
      missingForSubmit: validarEnvio(normalizarContenido(base), ids),
      updatedAt: a.updatedAt,
    };
  }

  const resumen = (a) => ({
    id: a.id,
    title: (a.workingContent ?? a.publishedContent)?.title ?? null,
    ownerId: a.ownerId,
    editorialState: a.editorialState,
    status: a.status,
    published: Boolean(a.publishedAt),
    hasPendingRevision: Boolean(a.publishedAt && a.workingContent),
    source: a.source,
    updatedAt: a.updatedAt,
  });

  return {
    publicarInterno,

    async bandeja(sesion, { state, mine } = {}) {
      const todas = (await permisos.puede(sesion, 'draft.edit_any')) || (await permisos.puede(sesion, 'draft.review'));
      if (!todas) await permisos.permitir(sesion, 'draft.edit_own', { ownerId: sesion.userId });
      const ownerId = !todas || mine ? sesion.userId : undefined;
      return { items: (await repos.activities.list({ ownerId, state })).map(resumen) };
    },

    async crear(sesion, cuerpo = {}) {
      if (!(await permisos.puede(sesion, 'draft.edit_any'))) {
        await permisos.permitir(sesion, 'draft.edit_own', { ownerId: sesion.userId });
      }
      const editionId = cuerpo.editionId ?? null;
      if (editionId && !(await repos.catalogs.find('editions', editionId))) throw validation({ editionId: 'La edición no existe.' });
      const id = nuevoId('act');
      await repos.activities.create({
        id,
        ownerId: sesion.userId,
        createdBy: sesion.userId,
        editionId,
        workingContent: normalizarContenido(cuerpo.content),
        now: ahora(),
      });
      await auditar(repos, sesion.userId, 'activity.created', id, {});
      return detalle(await cargar(id));
    },

    async ver(sesion, id) {
      const a = await cargar(id);
      await exigirEdicion(sesion, a);
      return detalle(a);
    },

    async guardar(sesion, id, { version, content } = {}) {
      const a = await cargar(id);
      const modo = await exigirEdicion(sesion, a);
      noArchivada(a);
      if (modo === 'own' && a.editorialState === 'in_review') {
        throw conflict('not_editable', 'Ya la enviaste a revisión: podrás editarla cuando te la devuelvan con observaciones.');
      }
      // Editar una ficha publicada crea una versión pendiente; lo publicado sigue visible (FR-011).
      const estado = a.editorialState === 'none' ? 'draft' : a.editorialState;
      await guardarConVersion(a, version, { working_content: normalizarContenido(content), editorial_state: estado });
      await auditar(repos, sesion.userId, 'draft.saved', id, { state: estado });
      return detalle(await cargar(id));
    },

    async vistaPrevia(sesion, id) {
      const a = await cargar(id);
      await exigirEdicion(sesion, a);
      const contenido = normalizarContenido(a.workingContent ?? a.publishedContent ?? {});
      const estados = new Map((await repos.published.functionsOf(id)).map((f) => [f.id, f.status]));
      const funciones = contenido.functions.map((f) => ({ ...f, status: estados.get(f.id) ?? 'scheduled' }));
      return fichaPublica(
        { id, content: contenido, functions: funciones, slots: contenido.slots, notices: await repos.published.noticesOf(id) },
        await catalogs.mapas(),
        clock(),
      );
    },

    async enviar(sesion, id, { version } = {}) {
      const a = await cargar(id);
      const modo = await exigirEdicion(sesion, a);
      if (modo === 'own') await permisos.permitir(sesion, 'draft.submit');
      noArchivada(a);
      if (!['draft', 'returned'].includes(a.editorialState) || !a.workingContent) {
        throw conflict('not_submittable', a.editorialState === 'in_review' ? 'Ya está en revisión.' : 'No hay cambios pendientes para enviar.');
      }
      const campos = validarEnvio(normalizarContenido(a.workingContent), await repos.catalogs.ids());
      if (Object.keys(campos).length) throw validation(campos, 'Faltan datos para enviar a revisión.');
      await guardarConVersion(a, version, { editorial_state: 'in_review' });
      await auditar(repos, sesion.userId, 'draft.submitted', id, {});
      return detalle(await cargar(id));
    },

    async devolver(sesion, id, { version, notes } = {}) {
      await permisos.permitir(sesion, 'draft.review');
      const a = await cargar(id);
      noArchivada(a);
      if (a.editorialState !== 'in_review') throw conflict('not_in_review', 'Solo se devuelven propuestas en revisión.');
      const observaciones = textoONulo(notes, 5000);
      if (!observaciones) throw validation({ notes: 'Escribe las observaciones para el editor.' });
      // Sin correos de avisos editoriales (FR-032): el editor lee las observaciones en el panel.
      await guardarConVersion(a, version, { editorial_state: 'returned', review_notes: observaciones });
      await auditar(repos, sesion.userId, 'draft.returned', id, { notes: observaciones });
      return detalle(await cargar(id));
    },

    async publicar(sesion, id, cuerpo = {}) {
      await permisos.permitir(sesion, 'publish');
      if (!Number.isInteger(cuerpo.version)) throw validation({ version: 'Falta la versión que estás publicando.' });
      await publicarInterno(sesion.userId, id, cuerpo);
      return detalle(await cargar(id));
    },

    async descartarRevision(sesion, id, { version } = {}) {
      await permisos.permitir(sesion, 'draft.review');
      const a = await cargar(id);
      if (!a.publishedAt || !a.workingContent) throw conflict('no_pending_revision', 'No hay una versión pendiente de una ficha publicada.');
      await guardarConVersion(a, version, { working_content: null, editorial_state: 'none', review_notes: null });
      await auditar(repos, sesion.userId, 'revision.discarded', id, {});
      return detalle(await cargar(id));
    },

    async reasignar(sesion, id, { ownerId } = {}) {
      await permisos.permitir(sesion, 'draft.reassign');
      const a = await cargar(id);
      noArchivada(a);
      const nuevo = textoONulo(ownerId, 100);
      if (!nuevo) throw validation({ ownerId: 'Indica a quién se reasigna.' });
      await guardarConVersion(a, a.version, { owner_id: nuevo });
      await auditar(repos, sesion.userId, 'activity.reassigned', id, { from: a.ownerId, to: nuevo });
      return detalle(await cargar(id));
    },

    async archivar(sesion, id) {
      await permisos.permitir(sesion, 'activity.archive');
      const a = await cargar(id);
      if (a.status === 'archived') return detalle(a);
      // FR-027: una función vigente que no se va a realizar se cancela con aviso antes de retirarse.
      const ref = enLoja(clock());
      const vigentes = (await repos.published.functionsOf(id)).filter(
        (f) => f.status === 'scheduled' && `${f.date} ${f.startTime}` >= `${ref.date} ${ref.time}`,
      );
      if (vigentes.length) {
        throw conflict('has_scheduled_functions', 'Tiene funciones vigentes: cancélalas con aviso antes de archivar.', {
          functionIds: vigentes.map((f) => f.id),
        });
      }
      await guardarConVersion(a, a.version, { status: 'archived' });
      await auditar(repos, sesion.userId, 'activity.archived', id, {});
      return detalle(await cargar(id));
    },

    async borrar(sesion, id) {
      const a = await cargar(id);
      if (!(await permisos.puede(sesion, 'activity.archive'))) {
        await permisos.permitir(sesion, 'draft.edit_own', { ownerId: a.ownerId });
      }
      // FR-029: nunca se borra lo que se publicó (pudo tener ventas o sellos): se archiva.
      if (a.publishedAt) throw conflict('already_published', 'Ya se publicó: no se puede borrar. Puedes archivarla.');
      await repos.activities.delete(id);
      await auditar(repos, sesion.userId, 'activity.deleted', id, { title: a.workingContent?.title ?? null });
    },

    async historial(sesion, id) {
      const a = await cargar(id);
      await exigirEdicion(sesion, a);
      return { entries: await repos.history.of('activity', id) };
    },
  };
}
