// Editor de actividad, revisión, publicación, cambios con aviso (reprogramar/cancelar),
// reasignación, archivo, borrado e historial de la actividad.
import { h, icono, aviso, abrirDialogo, confirmarAccion, esqueletoTarjetas } from './dom.js';
import { apiProgramacion, apiIdentidad } from './api.js';
import {
  etiquetaEstadoEditorial,
  etiquetaAviso,
  etiquetaTiempo,
  formatoFecha,
  formatoHorarioFuncion,
  formatoFechaHoraIso,
  describirCambioAsistencia,
} from './format.js';
import { renderFicha } from './ficha-componente.js';
import { requiereSesion } from './cuenta.js';
import { barraPanel } from './panel-bandeja.js';

const DIAS_SEMANA_NUM = [
  { n: 1, label: 'Lun' },
  { n: 2, label: 'Mar' },
  { n: 3, label: 'Mié' },
  { n: 4, label: 'Jue' },
  { n: 5, label: 'Vie' },
  { n: 6, label: 'Sáb' },
  { n: 7, label: 'Dom' },
];

function clonarContenido(c) {
  const base = c ?? {};
  return {
    title: base.title ?? '',
    artists: Array.isArray(base.artists) ? [...base.artists] : [],
    organization: base.organization ?? '',
    description: base.description ?? '',
    categoryId: base.categoryId ?? '',
    durationMinutes: base.durationMinutes ?? '',
    access: {
      mode: base.access?.mode ?? 'unconfirmed',
      priceUsd: base.access?.priceUsd ?? '',
    },
    functions: Array.isArray(base.functions)
      ? base.functions.map((f) => ({
          id: f.id,
          date: f.date ?? '',
          startTime: f.startTime ?? '',
          endTime: f.endTime ?? '',
          durationMinutes: f.durationMinutes ?? '',
          venueId: f.venueId ?? '',
        }))
      : [],
    slots: Array.isArray(base.slots)
      ? base.slots.map((s) => ({
          id: s.id,
          venueId: s.venueId ?? '',
          modo: Array.isArray(s.dates) && s.dates.length > 0 ? 'dates' : 'range',
          datesText: Array.isArray(s.dates) ? s.dates.join(', ') : '',
          from: s.from ?? '',
          to: s.to ?? '',
          weekdays: Array.isArray(s.weekdays) ? [...s.weekdays] : [],
          opens: s.opens ?? '',
          closes: s.closes ?? '',
        }))
      : [],
  };
}

function serializarContenido(borrador) {
  const numONulo = (v) => {
    const t = String(v ?? '').trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  const intONulo = (v) => {
    const n = numONulo(v);
    return n !== null ? Math.trunc(n) : null;
  };
  return {
    title: borrador.title.trim() || null,
    artists: borrador.artists.map((a) => a.trim()).filter(Boolean),
    organization: borrador.organization.trim() || null,
    description: borrador.description.trim() || null,
    categoryId: borrador.categoryId || null,
    durationMinutes: intONulo(borrador.durationMinutes),
    access: {
      mode: borrador.access.mode || 'unconfirmed',
      priceUsd: borrador.access.mode === 'paid' ? numONulo(borrador.access.priceUsd) : null,
    },
    functions: borrador.functions.map((f) => ({
      ...(f.id ? { id: f.id } : {}),
      date: f.date || null,
      startTime: f.startTime || null,
      endTime: f.endTime || null,
      durationMinutes: intONulo(f.durationMinutes),
      venueId: f.venueId || null,
    })),
    slots: borrador.slots.map((s) => {
      const porFechas = s.modo === 'dates';
      const listaFechas = porFechas
        ? s.datesText
            .split(/[\s,;]+/)
            .map((x) => x.trim())
            .filter(Boolean)
        : null;
      return {
        ...(s.id ? { id: s.id } : {}),
        venueId: s.venueId || null,
        dates: porFechas ? listaFechas : null,
        from: porFechas ? null : s.from || null,
        to: porFechas ? null : s.to || null,
        weekdays: porFechas ? null : s.weekdays.length ? [...s.weekdays].sort((a, b) => a - b) : null,
        opens: s.opens || null,
        closes: s.closes || null,
      };
    }),
  };
}

function bloqueImpacto(impacto) {
  if (!impacto || impacto.available === false) {
    return h(
      'div',
      { class: 'aviso alerta-caja' },
      h('strong', {}, 'Impacto en entradas: '),
      'No se pudo consultar el servicio de entradas. Verifica manualmente antes de confirmar.',
    );
  }
  return h(
    'div',
    { class: 'aviso' },
    h('strong', {}, 'Impacto actual de la función: '),
    `${impacto.soldTickets} entradas vendidas · ${impacto.pendingOrders} pedidos pendientes.`,
  );
}

export async function pantallaEditor({ id, persona, navegar }) {
  if (!persona) return requiereSesion();
  const subnav = barraPanel(persona, `/panel/actividades/${id}`);

  const contenedor = h('div', { class: 'editor-pagina' });
  contenedor.append(subnav, esqueletoTarjetas(2));

  const [rAct, rCats, rSedes] = await Promise.all([
    apiProgramacion('GET', `/panel/activities/${encodeURIComponent(id)}`),
    apiProgramacion('GET', '/categories'),
    apiProgramacion('GET', '/venues'),
  ]);

  if (!rAct.ok) {
    contenedor.replaceChildren(
      subnav,
      h('p', { class: 'migas' }, h('a', { href: '/panel/actividades', 'data-enlace': true, class: 'enlace-volver' }, icono('volver', 'icono-sm'), 'Volver a la bandeja')),
      h(
        'div',
        { class: 'estado-vacio estado-error' },
        h('h1', {}, rAct.status === 403 ? 'Sin permiso para editar esta actividad' : 'No pudimos abrir la actividad'),
        h('p', {}, rAct.datos?.message ?? 'Inténtalo nuevamente.'),
      ),
    );
    return contenedor;
  }

  let actividad = rAct.datos;
  const categorias = rCats.ok ? rCats.datos.items ?? [] : [];
  const sedes = rSedes.ok ? rSedes.datos.items ?? [] : [];
  const sedesPorId = new Map(sedes.map((s) => [s.id, s]));

  const esAdmin = persona.roles.includes('administrador');
  const esPublicador = persona.roles.includes('publicador') || esAdmin;

  let borrador = clonarContenido(actividad.working ?? actividad.publishedContent ?? {});
  let conflictoVersion = false;
  let forzarSoloLectura = false;
  let erroresCampos = {};
  let funcionesBloqueandoArchivo = new Set();
  let historialEntradas = null;

  const esSoloLectura = () =>
    actividad.status === 'archived' || forzarSoloLectura || (!esPublicador && actividad.editorialState === 'in_review');

  async function recargarActividad() {
    const r = await apiProgramacion('GET', `/panel/activities/${encodeURIComponent(id)}`);
    if (!r.ok) {
      aviso(r.datos?.message ?? 'No se pudo recargar la actividad.', 'error');
      return;
    }
    actividad = r.datos;
    borrador = clonarContenido(actividad.working ?? actividad.publishedContent ?? {});
    conflictoVersion = false;
    forzarSoloLectura = false;
    erroresCampos = {};
    funcionesBloqueandoArchivo = new Set();
    pintarTodo();
  }

  async function guardarBorrador({ silencioso = false } = {}) {
    erroresCampos = {};
    const r = await apiProgramacion('PUT', `/panel/activities/${encodeURIComponent(id)}/draft`, {
      version: actividad.version,
      content: serializarContenido(borrador),
    });
    if (!r.ok) {
      if (r.status === 409 && r.datos?.error === 'version_conflict') {
        conflictoVersion = true;
        aviso(r.datos.message, 'error');
        pintarTodo();
        return null;
      }
      if (r.status === 409 && r.datos?.error === 'not_editable') {
        forzarSoloLectura = true;
        aviso(r.datos.message, 'error');
        pintarTodo();
        return null;
      }
      if (r.datos?.fields) {
        erroresCampos = r.datos.fields;
        pintarTodo();
        enfocarPrimerError();
      }
      aviso(r.datos?.message ?? 'No se pudo guardar el borrador.', 'error');
      return null;
    }
    actividad = r.datos;
    borrador = clonarContenido(actividad.working ?? actividad.publishedContent ?? {});
    conflictoVersion = false;
    if (!silencioso) aviso('Borrador guardado.', 'ok');
    pintarTodo();
    return actividad;
  }

  function enfocarPrimerError() {
    const claves = Object.keys(erroresCampos);
    for (const k of claves) {
      const el = contenedor.querySelector(`[data-campo="${CSS.escape(k)}"]`);
      if (el) {
        el.focus();
        return;
      }
    }
  }

  async function abrirVistaPrevia() {
    // Si es editable, guardamos primero para que la vista previa refleje lo último escrito
    if (!esSoloLectura()) {
      const guardado = await guardarBorrador({ silencioso: true });
      if (!guardado) return;
    }
    const r = await apiProgramacion('GET', `/panel/activities/${encodeURIComponent(id)}/preview`);
    if (!r.ok) {
      aviso(r.datos?.message ?? 'No se pudo generar la vista previa.', 'error');
      return;
    }
    abrirDialogo({
      titulo: 'Vista previa de la ficha',
      ancho: 'grande',
      contenido: () => renderFicha(r.datos, { esVistaPrevia: true }),
    });
  }

  async function enviarARevision() {
    const guardado = await guardarBorrador({ silencioso: true });
    if (!guardado) return;
    const r = await apiProgramacion('POST', `/panel/activities/${encodeURIComponent(id)}/submit`, {
      version: actividad.version,
    });
    if (!r.ok) {
      if (r.status === 409 && r.datos?.error === 'version_conflict') {
        conflictoVersion = true;
        aviso(r.datos.message, 'error');
        pintarTodo();
        return;
      }
      if (r.status === 422 && r.datos?.fields) {
        erroresCampos = r.datos.fields;
        aviso(r.datos.message ?? 'Faltan datos obligatorios para enviar a revisión.', 'error');
        pintarTodo();
        enfocarPrimerError();
        return;
      }
      aviso(r.datos?.message ?? 'No se pudo enviar a revisión.', 'error');
      return;
    }
    actividad = r.datos;
    erroresCampos = {};
    aviso('Propuesta enviada a revisión.', 'ok');
    pintarTodo();
  }

  function abrirModalDevolver() {
    const errorEl = h('p', { class: 'error', hidden: true });
    const textarea = h('textarea', {
      id: 'notas-devolucion',
      rows: 4,
      required: true,
      placeholder: 'Indica qué debe corregir o completar el editor…',
    });
    abrirDialogo({
      titulo: 'Devolver propuesta con observaciones',
      contenido: (cerrar) =>
        h(
          'form',
          {
            novalidate: true,
            onsubmit: async (ev) => {
              ev.preventDefault();
              errorEl.hidden = true;
              const notes = textarea.value.trim();
              if (!notes) {
                errorEl.textContent = 'Escribe las observaciones para el editor.';
                errorEl.hidden = false;
                textarea.focus();
                return;
              }
              const r = await apiProgramacion('POST', `/panel/activities/${encodeURIComponent(id)}/return`, {
                version: actividad.version,
                notes,
              });
              if (!r.ok) {
                errorEl.textContent = r.datos?.message ?? 'No se pudo devolver.';
                errorEl.hidden = false;
                return;
              }
              actividad = r.datos;
              cerrar();
              aviso('Propuesta devuelta. El editor verá tus observaciones en el panel.', 'ok');
              pintarTodo();
            },
          },
          h('div', { class: 'campo' }, h('label', { for: 'notas-devolucion' }, 'Observaciones para el editor'), textarea, errorEl),
          h(
            'div',
            { class: 'fila-acciones' },
            h('button', { type: 'button', class: 'secundario', onclick: cerrar }, 'Cancelar'),
            h('button', { type: 'submit' }, 'Devolver propuesta'),
          ),
        ),
    });
  }

  function abrirModalAvisoPublicacion(changes) {
    const inputMotivo = h('textarea', { id: 'pub-reason', rows: 2, required: true, placeholder: 'Motivo interno (solo visible en el panel y el historial)' });
    const inputAviso = h('textarea', { id: 'pub-notice', rows: 3, required: true, placeholder: 'Aviso público que verá el público en la ficha' });
    const errorEl = h('p', { class: 'error', hidden: true });

    abrirDialogo({
      titulo: 'Esta publicación requiere aviso público',
      contenido: (cerrar) =>
        h(
          'form',
          {
            novalidate: true,
            onsubmit: async (ev) => {
              ev.preventDefault();
              errorEl.hidden = true;
              const reason = inputMotivo.value.trim();
              const notice = inputAviso.value.trim();
              if (!reason || !notice) {
                errorEl.textContent = 'Escribe tanto el motivo interno como el aviso público.';
                errorEl.hidden = false;
                (!reason ? inputMotivo : inputAviso).focus();
                return;
              }
              const r = await apiProgramacion('POST', `/panel/activities/${encodeURIComponent(id)}/publish`, {
                version: actividad.version,
                reason,
                notice,
              });
              if (!r.ok) {
                errorEl.textContent = r.datos?.message ?? 'No se pudo publicar.';
                errorEl.hidden = false;
                return;
              }
              actividad = r.datos;
              borrador = clonarContenido(actividad.working ?? actividad.publishedContent ?? {});
              cerrar();
              aviso('Actividad publicada con su aviso correspondiente.', 'ok');
              pintarTodo();
            },
          },
          h('p', {}, 'Los cambios afectan fechas, horas, sedes o franjas ya publicadas:'),
          h('ul', { class: 'lista-simple' }, (changes ?? []).map((c) => h('li', {}, describirCambioAsistencia(c)))),
          h('div', { class: 'campo' }, h('label', { for: 'pub-reason' }, 'Motivo interno'), inputMotivo),
          h('div', { class: 'campo' }, h('label', { for: 'pub-notice' }, 'Aviso público para los asistentes'), inputAviso),
          errorEl,
          h(
            'div',
            { class: 'fila-acciones' },
            h('button', { type: 'button', class: 'secundario', onclick: cerrar }, 'Cancelar'),
            h('button', { type: 'submit' }, 'Publicar con aviso'),
          ),
        ),
    });
  }

  async function publicarActividad() {
    if (!esSoloLectura() && actividad.editorialState !== 'none') {
      const guardado = await guardarBorrador({ silencioso: true });
      if (!guardado) return;
    }
    const ok = await confirmarAccion({
      titulo: 'Publicar actividad',
      mensaje: 'La versión actual pasará a ser visible en la Agenda pública. Publicar no activa ventas.',
      botonConfirmar: 'Publicar ahora',
    });
    if (!ok) return;

    const r = await apiProgramacion('POST', `/panel/activities/${encodeURIComponent(id)}/publish`, {
      version: actividad.version,
    });
    if (!r.ok) {
      if (r.status === 422 && r.datos?.error === 'notice_required') {
        abrirModalAvisoPublicacion(r.datos.changes);
        return;
      }
      if (r.status === 422 && r.datos?.fields) {
        erroresCampos = r.datos.fields;
        aviso(r.datos.message ?? 'La propuesta no está completa para publicarse.', 'error');
        pintarTodo();
        enfocarPrimerError();
        return;
      }
      aviso(r.datos?.message ?? 'No se pudo publicar.', 'error');
      return;
    }
    actividad = r.datos;
    borrador = clonarContenido(actividad.working ?? actividad.publishedContent ?? {});
    aviso('Actividad publicada en la Agenda.', 'ok');
    pintarTodo();
  }

  async function descartarRevision() {
    const ok = await confirmarAccion({
      titulo: 'Descartar cambios pendientes',
      mensaje: 'Se descartará la revisión pendiente y se mantendrá intacta la versión publicada actual.',
      botonConfirmar: 'Descartar revisión',
      peligro: true,
    });
    if (!ok) return;
    const r = await apiProgramacion('POST', `/panel/activities/${encodeURIComponent(id)}/discard-revision`, {
      version: actividad.version,
    });
    if (!r.ok) {
      aviso(r.datos?.message ?? 'No se pudo descartar la revisión.', 'error');
      return;
    }
    actividad = r.datos;
    borrador = clonarContenido(actividad.working ?? actividad.publishedContent ?? {});
    aviso('Revisión pendiente descartada.', 'ok');
    pintarTodo();
  }

  async function abrirModalReprogramar(fn) {
    const rImp = await apiProgramacion('GET', `/panel/functions/${encodeURIComponent(fn.id)}/impact`);
    const impacto = rImp.ok ? rImp.datos : { available: false };

    const inFecha = h('input', { id: 'rep-date', type: 'date', value: fn.date ?? '', required: true });
    const inInicio = h('input', { id: 'rep-start', type: 'time', value: fn.startTime ?? '', required: true });
    const inFin = h('input', { id: 'rep-end', type: 'time', value: fn.endTime ?? '' });
    const selSede = h(
      'select',
      { id: 'rep-venue', required: true },
      sedes.map((s) => h('option', { value: s.id, selected: s.id === (fn.venueId ?? fn.venue?.id) }, s.name)),
    );
    const inMotivo = h('textarea', { id: 'rep-reason', rows: 2, required: true, placeholder: 'Motivo interno del cambio' });
    const inAviso = h('textarea', { id: 'rep-notice', rows: 3, required: true, placeholder: 'Aviso público que verá el público en la ficha' });
    const errorEl = h('p', { class: 'error', hidden: true });

    abrirDialogo({
      titulo: 'Reprogramar función',
      contenido: (cerrar) =>
        h(
          'form',
          {
            novalidate: true,
            onsubmit: async (ev) => {
              ev.preventDefault();
              errorEl.hidden = true;
              const payload = {
                date: inFecha.value,
                startTime: inInicio.value,
                endTime: inFin.value || null,
                venueId: selSede.value,
                reason: inMotivo.value.trim(),
                notice: inAviso.value.trim(),
              };
              if (!payload.reason || !payload.notice) {
                errorEl.textContent = 'Escribe tanto el motivo interno como el aviso público.';
                errorEl.hidden = false;
                return;
              }
              const r = await apiProgramacion('POST', `/panel/functions/${encodeURIComponent(fn.id)}/reschedule`, payload);
              if (!r.ok) {
                errorEl.textContent = r.datos?.message ?? 'No se pudo reprogramar la función.';
                errorEl.hidden = false;
                return;
              }
              cerrar();
              aviso('Función reprogramada y aviso público publicado.', 'ok');
              await recargarActividad();
            },
          },
          bloqueImpacto(impacto),
          h('p', { class: 'ayuda' }, 'Cambiar la fecha, la hora o la sede se registra como reprogramación con aviso público (FR-015, FR-016).'),
          h(
            'div',
            { class: 'grid-dos' },
            h('div', { class: 'campo' }, h('label', { for: 'rep-date' }, 'Fecha'), inFecha),
            h('div', { class: 'campo' }, h('label', { for: 'rep-start' }, 'Hora de inicio'), inInicio),
            h('div', { class: 'campo' }, h('label', { for: 'rep-end' }, 'Hora de fin (opcional)'), inFin),
            h('div', { class: 'campo' }, h('label', { for: 'rep-venue' }, 'Sede'), selSede),
          ),
          h('div', { class: 'campo' }, h('label', { for: 'rep-reason' }, 'Motivo interno'), inMotivo),
          h('div', { class: 'campo' }, h('label', { for: 'rep-notice' }, 'Aviso público'), inAviso),
          errorEl,
          h(
            'div',
            { class: 'fila-acciones' },
            h('button', { type: 'button', class: 'secundario', onclick: cerrar }, 'Cerrar'),
            h('button', { type: 'submit' }, 'Confirmar reprogramación'),
          ),
        ),
    });
  }

  async function abrirModalCancelarFuncion(fn) {
    const rImp = await apiProgramacion('GET', `/panel/functions/${encodeURIComponent(fn.id)}/impact`);
    const impacto = rImp.ok ? rImp.datos : { available: false };

    const inMotivo = h('textarea', { id: 'can-reason', rows: 2, required: true, placeholder: 'Motivo interno de la cancelación' });
    const inAviso = h('textarea', { id: 'can-notice', rows: 3, required: true, placeholder: 'Aviso público que verá el público en la ficha' });
    const errorEl = h('p', { class: 'error', hidden: true });

    abrirDialogo({
      titulo: 'Cancelar función con aviso',
      contenido: (cerrar) =>
        h(
          'form',
          {
            novalidate: true,
            onsubmit: async (ev) => {
              ev.preventDefault();
              errorEl.hidden = true;
              const reason = inMotivo.value.trim();
              const notice = inAviso.value.trim();
              if (!reason || !notice) {
                errorEl.textContent = 'Escribe tanto el motivo interno como el aviso público.';
                errorEl.hidden = false;
                return;
              }
              const r = await apiProgramacion('POST', `/panel/functions/${encodeURIComponent(fn.id)}/cancel`, { reason, notice });
              if (!r.ok) {
                errorEl.textContent = r.datos?.message ?? 'No se pudo cancelar la función.';
                errorEl.hidden = false;
                return;
              }
              cerrar();
              aviso('Función cancelada. Seguirá visible en la ficha con su aviso y saldrá de «¿Qué hay ahora?».', 'ok');
              await recargarActividad();
            },
          },
          bloqueImpacto(impacto),
          h('p', { class: 'ayuda' }, `Función: ${formatoFecha(fn.date)} · ${formatoHorarioFuncion(fn)}`),
          h('div', { class: 'campo' }, h('label', { for: 'can-reason' }, 'Motivo interno'), inMotivo),
          h('div', { class: 'campo' }, h('label', { for: 'can-notice' }, 'Aviso público'), inAviso),
          errorEl,
          h(
            'div',
            { class: 'fila-acciones' },
            h('button', { type: 'button', class: 'secundario', onclick: cerrar }, 'Volver'),
            h('button', { type: 'submit', class: 'peligro-solido' }, 'Confirmar cancelación'),
          ),
        ),
    });
  }

  function abrirModalReasignar() {
    const inOwner = h('input', { id: 'reasignar-owner', type: 'text', value: actividad.ownerId ?? '', required: true });
    const inBuscar = h('input', { id: 'reasignar-buscar', type: 'search', placeholder: 'Buscar cuenta por correo…' });
    const listaCuentas = h('div', { class: 'lista-sugerencias' });
    const errorEl = h('p', { class: 'error', hidden: true });

    async function buscarCuentas() {
      const q = inBuscar.value.trim();
      const r = await apiIdentidad('GET', `/users?email=${encodeURIComponent(q)}`);
      if (!r.ok) return;
      listaCuentas.replaceChildren(
        (r.datos.users ?? []).slice(0, 6).map((u) =>
          h(
            'button',
            {
              type: 'button',
              class: 'secundario boton-sm',
              onclick: () => {
                inOwner.value = u.id;
              },
            },
            `${u.email} (${u.id})`,
          ),
        ),
      );
    }

    abrirDialogo({
      titulo: 'Reasignar responsable',
      contenido: (cerrar) =>
        h(
          'form',
          {
            novalidate: true,
            onsubmit: async (ev) => {
              ev.preventDefault();
              errorEl.hidden = true;
              const ownerId = inOwner.value.trim();
              if (!ownerId) {
                errorEl.textContent = 'Indica el identificador del nuevo responsable.';
                errorEl.hidden = false;
                return;
              }
              const r = await apiProgramacion('POST', `/panel/activities/${encodeURIComponent(id)}/reassign`, { ownerId });
              if (!r.ok) {
                errorEl.textContent = r.datos?.message ?? 'No se pudo reasignar.';
                errorEl.hidden = false;
                return;
              }
              actividad = r.datos;
              cerrar();
              aviso('Responsable actualizado y registrado en el historial.', 'ok');
              pintarTodo();
            },
          },
          h('div', { class: 'campo' }, h('label', { for: 'reasignar-buscar' }, 'Buscar cuenta por correo'), h('div', { class: 'fila' }, inBuscar, h('button', { type: 'button', class: 'secundario', onclick: buscarCuentas }, 'Buscar'))),
          listaCuentas,
          h('div', { class: 'campo' }, h('label', { for: 'reasignar-owner' }, 'Identificador del nuevo responsable (ownerId)'), inOwner),
          errorEl,
          h(
            'div',
            { class: 'fila-acciones' },
            h('button', { type: 'button', class: 'secundario', onclick: cerrar }, 'Cancelar'),
            h('button', { type: 'submit' }, 'Reasignar'),
          ),
        ),
    });
  }

  async function archivarActividad() {
    const ok = await confirmarAccion({
      titulo: 'Archivar actividad',
      mensaje: 'Saldrá de la Agenda pública pero conservará entradas, pedidos, sellos e historial. No se podrá editar después.',
      botonConfirmar: 'Archivar',
      peligro: true,
    });
    if (!ok) return;
    const r = await apiProgramacion('POST', `/panel/activities/${encodeURIComponent(id)}/archive`);
    if (!r.ok) {
      if (r.status === 409 && r.datos?.error === 'has_scheduled_functions') {
        funcionesBloqueandoArchivo = new Set(r.datos.functionIds ?? []);
        aviso(r.datos.message ?? 'Debes cancelar con aviso las funciones vigentes antes de archivar.', 'error');
        pintarTodo();
        contenedor.querySelector('#seccion-funciones-publicadas')?.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      aviso(r.datos?.message ?? 'No se pudo archivar.', 'error');
      return;
    }
    actividad = r.datos;
    funcionesBloqueandoArchivo = new Set();
    aviso('Actividad archivada.', 'ok');
    pintarTodo();
  }

  async function borrarBorrador() {
    const ok = await confirmarAccion({
      titulo: 'Eliminar borrador definitivamente',
      mensaje: 'Esta acción elimina el borrador de forma permanente. Solo es posible si nunca fue publicada.',
      botonConfirmar: 'Eliminar borrador',
      peligro: true,
    });
    if (!ok) return;
    const r = await apiProgramacion('DELETE', `/panel/activities/${encodeURIComponent(id)}`);
    if (!r.ok) {
      if (r.status === 409 && r.datos?.error === 'already_published') {
        aviso('Esta actividad ya fue publicada y no puede borrarse definitivamente. Usa «Archivar» en su lugar.', 'error');
        return;
      }
      aviso(r.datos?.message ?? 'No se pudo eliminar el borrador.', 'error');
      return;
    }
    aviso('Borrador eliminado.', 'ok');
    navegar('/panel/actividades');
  }

  async function cargarHistorial() {
    const r = await apiProgramacion('GET', `/panel/activities/${encodeURIComponent(id)}/history`);
    if (!r.ok) {
      aviso(r.datos?.message ?? 'No se pudo cargar el historial.', 'error');
      return;
    }
    historialEntradas = r.datos.entries ?? [];
    pintarTodo();
  }

  function errorDe(clave) {
    const msg = erroresCampos[clave];
    return msg ? h('p', { class: 'error' }, msg) : null;
  }

  function pintarTodo() {
    const soloLectura = esSoloLectura();
    const est = etiquetaEstadoEditorial(actividad);
    const faltantes = Object.entries(actividad.missingForSubmit ?? {});

    const bannerConflicto = conflictoVersion
      ? h(
          'div',
          { class: 'aviso error-caja fila-espaciada', role: 'alert' },
          h('span', {}, 'Otra persona guardó cambios antes que tú. Recarga para ver la versión actual sin perder el contexto.'),
          h('button', { type: 'button', class: 'secundario boton-sm', onclick: recargarActividad }, 'Recargar versión actual'),
        )
      : null;

    const bannerDevuelta =
      actividad.editorialState === 'returned' && actividad.reviewNotes
        ? h(
            'section',
            { class: 'banner-devuelta', role: 'region', 'aria-label': 'Observaciones de devolución' },
            h('h2', {}, icono('aviso', 'icono-sm'), 'Propuesta devuelta — observaciones'),
            h('p', {}, actividad.reviewNotes),
          )
        : null;

    const bannerSoloLectura = soloLectura
      ? h(
          'p',
          { class: 'aviso alerta-caja' },
          actividad.status === 'archived'
            ? 'Esta actividad está archivada y se muestra en solo lectura.'
            : 'Esta propuesta está en revisión: solo lectura hasta que un publicador la devuelva con observaciones.',
        )
      : null;

    const bannerBloqueoArchivo = funcionesBloqueandoArchivo.size
      ? h(
          'div',
          { class: 'aviso error-caja', role: 'alert' },
          h('strong', {}, 'No se puede archivar todavía: '),
          'cancela con aviso las funciones vigentes resaltadas en la sección «Funciones publicadas».',
        )
      : null;

    const bloqueFaltantes =
      !soloLectura && faltantes.length > 0
        ? h(
            'section',
            { class: 'tarjeta-faltantes', 'aria-label': 'Requisitos pendientes para enviar a revisión' },
            h('h2', {}, 'Pendiente para poder enviar a revisión'),
            h('p', { class: 'ayuda' }, 'Puedes guardar el borrador incompleto ahora y completarlo después.'),
            h('ul', { class: 'lista-simple' }, faltantes.map(([k, msg]) => h('li', {}, msg, ' ', h('code', { class: 'clave-sutil' }, k)))),
          )
        : null;

    // Sección artistas
    const nuevoArtistaInput = h('input', {
      id: 'nuevo-artista',
      type: 'text',
      placeholder: 'Nombre de artista o compañía',
      disabled: soloLectura,
      onkeydown: (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          const val = nuevoArtistaInput.value.trim();
          if (val) {
            borrador.artists.push(val);
            pintarTodo();
          }
        }
      },
    });

    const bloqueArtistas = h(
      'div',
      { class: 'campo' },
      h('label', { for: 'nuevo-artista' }, 'Artistas o compañías'),
      borrador.artists.length
        ? h(
            'div',
            { class: 'fila-chips' },
            borrador.artists.map((art, idx) =>
              h(
                'span',
                { class: 'chip-editable' },
                art,
                !soloLectura
                  ? h(
                      'button',
                      {
                        type: 'button',
                        class: 'chip-quitar',
                        'aria-label': `Quitar ${art}`,
                        onclick: () => {
                          borrador.artists.splice(idx, 1);
                          pintarTodo();
                        },
                      },
                      '×',
                    )
                  : null,
              ),
            ),
          )
        : null,
      !soloLectura
        ? h(
            'div',
            { class: 'fila' },
            nuevoArtistaInput,
            h(
              'button',
              {
                type: 'button',
                class: 'secundario',
                onclick: () => {
                  const val = nuevoArtistaInput.value.trim();
                  if (val) {
                    borrador.artists.push(val);
                    pintarTodo();
                  }
                },
              },
              'Añadir',
            ),
          )
        : null,
    );

    // Formulario principal
    const formDatos = h(
      'section',
      { class: 'tarjeta pila' },
      h('h2', {}, 'Información de la actividad'),
      h(
        'div',
        { class: 'campo' },
        h('label', { for: 'ed-title' }, 'Título'),
        h('input', {
          id: 'ed-title',
          type: 'text',
          'data-campo': 'title',
          value: borrador.title,
          disabled: soloLectura,
          'aria-invalid': erroresCampos.title ? 'true' : null,
          oninput: (ev) => {
            borrador.title = ev.target.value;
          },
        }),
        errorDe('title'),
      ),
      bloqueArtistas,
      h(
        'div',
        { class: 'grid-dos' },
        h(
          'div',
          { class: 'campo' },
          h('label', { for: 'ed-org' }, 'Organización (opcional)'),
          h('input', {
            id: 'ed-org',
            type: 'text',
            value: borrador.organization,
            disabled: soloLectura,
            placeholder: 'Si se deja vacío: Por confirmar',
            oninput: (ev) => {
              borrador.organization = ev.target.value;
            },
          }),
        ),
        h(
          'div',
          { class: 'campo' },
          h('label', { for: 'ed-cat' }, 'Categoría'),
          h(
            'select',
            {
              id: 'ed-cat',
              'data-campo': 'categoryId',
              disabled: soloLectura,
              'aria-invalid': erroresCampos.categoryId ? 'true' : null,
              onchange: (ev) => {
                borrador.categoryId = ev.target.value;
              },
            },
            h('option', { value: '', selected: !borrador.categoryId }, 'Sin categoría (Por confirmar)'),
            categorias.map((c) => h('option', { value: c.id, selected: borrador.categoryId === c.id }, c.name)),
          ),
          errorDe('categoryId'),
        ),
      ),
      h(
        'div',
        { class: 'campo' },
        h('label', { for: 'ed-desc' }, 'Descripción (opcional)'),
        h('textarea', {
          id: 'ed-desc',
          rows: 4,
          disabled: soloLectura,
          placeholder: 'Sinopsis o información útil. Si se deja vacía aparecerá como Por confirmar.',
          value: borrador.description,
          oninput: (ev) => {
            borrador.description = ev.target.value;
          },
        }),
      ),
      h(
        'div',
        { class: 'grid-tres' },
        h(
          'div',
          { class: 'campo' },
          h('label', { for: 'ed-dur' }, 'Duración en minutos (opcional)'),
          h('input', {
            id: 'ed-dur',
            type: 'number',
            min: 1,
            value: borrador.durationMinutes,
            disabled: soloLectura,
            placeholder: 'Por confirmar',
            oninput: (ev) => {
              borrador.durationMinutes = ev.target.value;
            },
          }),
        ),
        h(
          'div',
          { class: 'campo' },
          h('label', { for: 'ed-acc-mode' }, 'Modalidad de acceso'),
          h(
            'select',
            {
              id: 'ed-acc-mode',
              disabled: soloLectura,
              onchange: (ev) => {
                borrador.access.mode = ev.target.value;
                if (borrador.access.mode !== 'paid') borrador.access.priceUsd = '';
                pintarTodo();
              },
            },
            [
              { value: 'unconfirmed', label: 'Acceso por confirmar' },
              { value: 'free', label: 'Gratuita' },
              { value: 'paid', label: 'De pago' },
            ].map((o) => h('option', { value: o.value, selected: borrador.access.mode === o.value }, o.label)),
          ),
        ),
        h(
          'div',
          { class: 'campo' },
          h('label', { for: 'ed-price' }, 'Precio USD (solo si es de pago)'),
          h('input', {
            id: 'ed-price',
            type: 'number',
            min: 0,
            step: '0.01',
            value: borrador.access.priceUsd,
            disabled: soloLectura || borrador.access.mode !== 'paid',
            placeholder: 'Vacío = precio por confirmar',
            oninput: (ev) => {
              borrador.access.priceUsd = ev.target.value;
            },
          }),
          h('p', { class: 'ayuda' }, 'Dejar sin precio no la convierte en gratuita ni activa ventas.'),
        ),
      ),
    );

    // Sección funciones del borrador
    const seccionFunciones = h(
      'section',
      { class: 'tarjeta pila' },
      h(
        'div',
        { class: 'seccion-cabecera-inline' },
        h('div', {}, h('h2', {}, `Funciones puntuales (${borrador.functions.length})`), h('p', { class: 'ayuda' }, 'Fecha y hora local de Loja. La hora de fin y la duración son opcionales.')),
        !soloLectura
          ? h(
              'button',
              {
                type: 'button',
                class: 'secundario',
                onclick: () => {
                  borrador.functions.push({ date: '', startTime: '', endTime: '', durationMinutes: '', venueId: '' });
                  pintarTodo();
                },
              },
              'Añadir función',
            )
          : null,
      ),
      errorDe('schedule'),
      borrador.functions.length === 0
        ? h('p', { class: 'ayuda' }, 'No hay funciones puntuales en este borrador.')
        : borrador.functions.map((fn, i) =>
            h(
              'div',
              { class: 'subtarjeta pila-chica' },
              h(
                'div',
                { class: 'seccion-cabecera-inline' },
                h('strong', {}, `Función #${i + 1}`, fn.id ? h('code', { class: 'clave-sutil' }, ` ${fn.id}`) : null),
                !soloLectura
                  ? h(
                      'button',
                      {
                        type: 'button',
                        class: 'peligro boton-sm',
                        onclick: () => {
                          borrador.functions.splice(i, 1);
                          pintarTodo();
                        },
                      },
                      'Quitar',
                    )
                  : null,
              ),
              h(
                'div',
                { class: 'grid-tres' },
                h(
                  'div',
                  { class: 'campo' },
                  h('label', { for: `fn-${i}-date` }, 'Fecha'),
                  h('input', {
                    id: `fn-${i}-date`,
                    type: 'date',
                    'data-campo': `functions[${i}].date`,
                    value: fn.date,
                    disabled: soloLectura,
                    'aria-invalid': erroresCampos[`functions[${i}].date`] ? 'true' : null,
                    onchange: (ev) => {
                      fn.date = ev.target.value;
                    },
                  }),
                  errorDe(`functions[${i}].date`),
                ),
                h(
                  'div',
                  { class: 'campo' },
                  h('label', { for: `fn-${i}-start` }, 'Hora de inicio'),
                  h('input', {
                    id: `fn-${i}-start`,
                    type: 'time',
                    'data-campo': `functions[${i}].startTime`,
                    value: fn.startTime,
                    disabled: soloLectura,
                    'aria-invalid': erroresCampos[`functions[${i}].startTime`] ? 'true' : null,
                    onchange: (ev) => {
                      fn.startTime = ev.target.value;
                    },
                  }),
                  errorDe(`functions[${i}].startTime`),
                ),
                h(
                  'div',
                  { class: 'campo' },
                  h('label', { for: `fn-${i}-end` }, 'Hora de fin (opcional)'),
                  h('input', {
                    id: `fn-${i}-end`,
                    type: 'time',
                    'data-campo': `functions[${i}].endTime`,
                    value: fn.endTime,
                    disabled: soloLectura,
                    'aria-invalid': erroresCampos[`functions[${i}].endTime`] ? 'true' : null,
                    onchange: (ev) => {
                      fn.endTime = ev.target.value;
                    },
                  }),
                  errorDe(`functions[${i}].endTime`),
                ),
                h(
                  'div',
                  { class: 'campo' },
                  h('label', { for: `fn-${i}-dur` }, 'Duración min (opcional)'),
                  h('input', {
                    id: `fn-${i}-dur`,
                    type: 'number',
                    min: 1,
                    value: fn.durationMinutes,
                    disabled: soloLectura,
                    oninput: (ev) => {
                      fn.durationMinutes = ev.target.value;
                    },
                  }),
                ),
                h(
                  'div',
                  { class: 'campo col-span-2' },
                  h('label', { for: `fn-${i}-venue` }, 'Sede'),
                  h(
                    'select',
                    {
                      id: `fn-${i}-venue`,
                      'data-campo': `functions[${i}].venueId`,
                      disabled: soloLectura,
                      'aria-invalid': erroresCampos[`functions[${i}].venueId`] ? 'true' : null,
                      onchange: (ev) => {
                        fn.venueId = ev.target.value;
                      },
                    },
                    h('option', { value: '', selected: !fn.venueId }, 'Selecciona una sede'),
                    sedes.map((s) => h('option', { value: s.id, selected: fn.venueId === s.id }, `${s.name}${s.kind === 'route' ? ' (Recorrido)' : ''}`)),
                  ),
                  errorDe(`functions[${i}].venueId`),
                ),
              ),
            ),
          ),
    );

    // Sección franjas de apertura
    const seccionFranjas = h(
      'section',
      { class: 'tarjeta pila' },
      h(
        'div',
        { class: 'seccion-cabecera-inline' },
        h('div', {}, h('h2', {}, `Franjas de apertura (${borrador.slots.length})`), h('p', { class: 'ayuda' }, 'Para exposiciones permanentes. Añade varias franjas el mismo día para horario partido.')),
        !soloLectura
          ? h(
              'button',
              {
                type: 'button',
                class: 'secundario',
                onclick: () => {
                  borrador.slots.push({ venueId: '', modo: 'range', datesText: '', from: '', to: '', weekdays: [], opens: '', closes: '' });
                  pintarTodo();
                },
              },
              'Añadir franja',
            )
          : null,
      ),
      borrador.slots.length === 0
        ? h('p', { class: 'ayuda' }, 'No hay franjas de apertura en este borrador.')
        : borrador.slots.map((sl, i) =>
            h(
              'div',
              { class: 'subtarjeta pila-chica' },
              h(
                'div',
                { class: 'seccion-cabecera-inline' },
                h('strong', {}, `Franja #${i + 1}`),
                !soloLectura
                  ? h(
                      'button',
                      {
                        type: 'button',
                        class: 'peligro boton-sm',
                        onclick: () => {
                          borrador.slots.splice(i, 1);
                          pintarTodo();
                        },
                      },
                      'Quitar',
                    )
                  : null,
              ),
              h(
                'div',
                { class: 'grid-tres' },
                h(
                  'div',
                  { class: 'campo' },
                  h('label', { for: `sl-${i}-venue` }, 'Sede'),
                  h(
                    'select',
                    {
                      id: `sl-${i}-venue`,
                      'data-campo': `slots[${i}].venueId`,
                      disabled: soloLectura,
                      'aria-invalid': erroresCampos[`slots[${i}].venueId`] ? 'true' : null,
                      onchange: (ev) => {
                        sl.venueId = ev.target.value;
                      },
                    },
                    h('option', { value: '', selected: !sl.venueId }, 'Selecciona una sede'),
                    sedes.map((s) => h('option', { value: s.id, selected: sl.venueId === s.id }, s.name)),
                  ),
                  errorDe(`slots[${i}].venueId`),
                ),
                h(
                  'div',
                  { class: 'campo' },
                  h('label', { for: `sl-${i}-opens` }, 'Abre'),
                  h('input', {
                    id: `sl-${i}-opens`,
                    type: 'time',
                    'data-campo': `slots[${i}].opens`,
                    value: sl.opens,
                    disabled: soloLectura,
                    'aria-invalid': erroresCampos[`slots[${i}].opens`] ? 'true' : null,
                    onchange: (ev) => {
                      sl.opens = ev.target.value;
                    },
                  }),
                  errorDe(`slots[${i}].opens`),
                ),
                h(
                  'div',
                  { class: 'campo' },
                  h('label', { for: `sl-${i}-closes` }, 'Cierra'),
                  h('input', {
                    id: `sl-${i}-closes`,
                    type: 'time',
                    'data-campo': `slots[${i}].closes`,
                    value: sl.closes,
                    disabled: soloLectura,
                    'aria-invalid': erroresCampos[`slots[${i}].closes`] ? 'true' : null,
                    onchange: (ev) => {
                      sl.closes = ev.target.value;
                    },
                  }),
                  errorDe(`slots[${i}].closes`),
                ),
              ),
              h(
                'div',
                { class: 'fila' },
                h(
                  'label',
                  { class: 'check-inline' },
                  h('input', {
                    type: 'radio',
                    name: `sl-${i}-modo`,
                    checked: sl.modo === 'range',
                    disabled: soloLectura,
                    onchange: () => {
                      sl.modo = 'range';
                      pintarTodo();
                    },
                  }),
                  'Rango de fechas',
                ),
                h(
                  'label',
                  { class: 'check-inline' },
                  h('input', {
                    type: 'radio',
                    name: `sl-${i}-modo`,
                    checked: sl.modo === 'dates',
                    disabled: soloLectura,
                    onchange: () => {
                      sl.modo = 'dates';
                      pintarTodo();
                    },
                  }),
                  'Lista de fechas específicas',
                ),
              ),
              sl.modo === 'dates'
                ? h(
                    'div',
                    { class: 'campo' },
                    h('label', { for: `sl-${i}-dates` }, 'Fechas (AAAA-MM-DD separadas por coma)'),
                    h('input', {
                      id: `sl-${i}-dates`,
                      type: 'text',
                      'data-campo': `slots[${i}].dates`,
                      value: sl.datesText,
                      placeholder: '2026-11-20, 2026-11-21',
                      disabled: soloLectura,
                      oninput: (ev) => {
                        sl.datesText = ev.target.value;
                      },
                    }),
                    errorDe(`slots[${i}].dates`),
                  )
                : h(
                    'div',
                    { class: 'pila-chica' },
                    h(
                      'div',
                      { class: 'grid-dos' },
                      h(
                        'div',
                        { class: 'campo' },
                        h('label', { for: `sl-${i}-from` }, 'Desde'),
                        h('input', {
                          id: `sl-${i}-from`,
                          type: 'date',
                          'data-campo': `slots[${i}].from`,
                          value: sl.from,
                          disabled: soloLectura,
                          onchange: (ev) => {
                            sl.from = ev.target.value;
                          },
                        }),
                        errorDe(`slots[${i}].from`),
                      ),
                      h(
                        'div',
                        { class: 'campo' },
                        h('label', { for: `sl-${i}-to` }, 'Hasta'),
                        h('input', {
                          id: `sl-${i}-to`,
                          type: 'date',
                          'data-campo': `slots[${i}].to`,
                          value: sl.to,
                          disabled: soloLectura,
                          onchange: (ev) => {
                            sl.to = ev.target.value;
                          },
                        }),
                        errorDe(`slots[${i}].to`),
                      ),
                    ),
                    h(
                      'fieldset',
                      { class: 'dias-fieldset' },
                      h('legend', {}, 'Días de la semana (opcional: vacío = todos)'),
                      h(
                        'div',
                        { class: 'fila-dias' },
                        DIAS_SEMANA_NUM.map((d) =>
                          h(
                            'label',
                            { class: 'check-dia' },
                            h('input', {
                              type: 'checkbox',
                              checked: sl.weekdays.includes(d.n),
                              disabled: soloLectura,
                              onchange: (ev) => {
                                if (ev.target.checked) {
                                  if (!sl.weekdays.includes(d.n)) sl.weekdays.push(d.n);
                                } else {
                                  sl.weekdays = sl.weekdays.filter((x) => x !== d.n);
                                }
                              },
                            }),
                            d.label,
                          ),
                        ),
                      ),
                    ),
                  ),
            ),
          ),
    );

    // Sección funciones publicadas (cambios con aviso: reprogramar / cancelar)
    const funcionesPublicadas = actividad.functions ?? [];
    const seccionPublicadas =
      actividad.published && funcionesPublicadas.length > 0
        ? h(
            'section',
            { id: 'seccion-funciones-publicadas', class: 'tarjeta pila' },
            h('h2', {}, 'Funciones publicadas — cambios con aviso'),
            h('p', { class: 'ayuda' }, 'Reprogramar o cancelar una función publicada consulta antes el impacto en entradas y exige motivo interno y aviso público.'),
            h(
              'ul',
              { class: 'lista-horarios' },
              funcionesPublicadas.map((fn) => {
                const cancelada = fn.status === 'cancelled';
                const bloquea = funcionesBloqueandoArchivo.has(fn.id);
                const sede = sedesPorId.get(fn.venueId) ?? fn.venue;
                return h(
                  'li',
                  { class: `horario-tarjeta ${cancelada ? 'horario-cancelada' : ''} ${bloquea ? 'horario-resaltada' : ''}` },
                  h(
                    'div',
                    { class: 'horario-principal' },
                    h(
                      'div',
                      { class: 'horario-fecha-hora' },
                      h('span', { class: 'horario-fecha' }, icono('calendario', 'icono-sm'), formatoFecha(fn.date)),
                      h('span', { class: 'horario-hora' }, icono('reloj', 'icono-sm'), formatoHorarioFuncion(fn)),
                      sede ? h('span', { class: 'meta-item' }, icono('sede', 'icono-xs'), sede.name) : null,
                    ),
                    h(
                      'span',
                      { class: `insignia-estado ${cancelada ? 'estado-cancelada' : 'estado-proxima'}` },
                      cancelada ? 'Cancelada' : 'Programada',
                    ),
                  ),
                  !cancelada && esPublicador && actividad.status !== 'archived'
                    ? h(
                        'div',
                        { class: 'fila-acciones' },
                        h('button', { type: 'button', class: 'secundario boton-sm', onclick: () => abrirModalReprogramar(fn) }, 'Reprogramar'),
                        h('button', { type: 'button', class: 'peligro boton-sm', onclick: () => abrirModalCancelarFuncion(fn) }, 'Cancelar función'),
                      )
                    : null,
                );
              }),
            ),
          )
        : null;

    // Avisos registrados
    const seccionAvisos = actividad.notices?.length
      ? h(
          'section',
          { class: 'tarjeta pila-chica' },
          h('h2', {}, `Avisos emitidos (${actividad.notices.length})`),
          h(
            'ul',
            { class: 'lista-avisos' },
            actividad.notices.map((n) =>
              h(
                'li',
                { class: `aviso-item aviso-${n.kind}` },
                h(
                  'div',
                  { class: 'aviso-item-cabecera' },
                  h('span', { class: 'aviso-etiqueta' }, etiquetaAviso(n.kind)),
                  h('time', { class: 'aviso-fecha', datetime: n.at }, formatoFechaHoraIso(n.at)),
                ),
                h('p', { class: 'aviso-texto' }, h('strong', {}, 'Público: '), n.text),
                n.reason ? h('p', { class: 'ayuda' }, h('strong', {}, 'Motivo interno: '), n.reason) : null,
              ),
            ),
          ),
        )
      : null;

    // Historial de la actividad
    const seccionHistorial = h(
      'section',
      { class: 'tarjeta pila-chica' },
      h(
        'div',
        { class: 'seccion-cabecera-inline' },
        h('h2', {}, 'Historial de la actividad'),
        h('button', { type: 'button', class: 'secundario boton-sm', onclick: cargarHistorial }, historialEntradas ? 'Actualizar historial' : 'Cargar historial'),
      ),
      historialEntradas === null
        ? h('p', { class: 'ayuda' }, 'Consulta quién realizó cada cambio y cuándo (RC-06, RNF-09).')
        : historialEntradas.length === 0
          ? h('p', { class: 'ayuda' }, 'Sin registros todavía.')
          : h(
              'div',
              { class: 'tabla-scroll', tabindex: '0' },
              h(
                'table',
                {},
                h('thead', {}, h('tr', {}, ['Cuándo', 'Quién', 'Acción', 'Detalle'].map((t) => h('th', { scope: 'col' }, t)))),
                h(
                  'tbody',
                  {},
                  historialEntradas.map((e) =>
                    h(
                      'tr',
                      {},
                      h('td', { 'data-etiqueta': 'Cuándo' }, formatoFechaHoraIso(e.at)),
                      h('td', { 'data-etiqueta': 'Quién' }, e.actorId ?? e.actor_id ?? '—'),
                      h('td', { 'data-etiqueta': 'Acción' }, e.action),
                      h('td', { 'data-etiqueta': 'Detalle' }, e.details ? JSON.stringify(e.details) : '—'),
                    ),
                  ),
                ),
              ),
            ),
    );

    // Barra de acciones editoriales
    const puedeEnviar = !soloLectura && ['draft', 'returned'].includes(actividad.editorialState) && actividad.status !== 'archived';
    const puedePublicar = esPublicador && actividad.editorialState !== 'none' && actividad.status !== 'archived';
    const puedeDevolver = esPublicador && actividad.editorialState === 'in_review' && actividad.status !== 'archived';
    const puedeDescartar = esPublicador && actividad.published && actividad.working && actividad.status !== 'archived';

    const barraAcciones = h(
      'div',
      { class: 'barra-acciones-editor' },
      !soloLectura ? h('button', { type: 'button', onclick: () => guardarBorrador() }, 'Guardar borrador') : null,
      h('button', { type: 'button', class: 'secundario', onclick: abrirVistaPrevia }, 'Vista previa'),
      puedeEnviar ? h('button', { type: 'button', class: 'secundario', onclick: enviarARevision }, 'Enviar a revisión') : null,
      puedeDevolver ? h('button', { type: 'button', class: 'secundario', onclick: abrirModalDevolver }, 'Devolver con observaciones') : null,
      puedePublicar ? h('button', { type: 'button', class: 'boton-exito', onclick: publicarActividad }, 'Publicar') : null,
      puedeDescartar ? h('button', { type: 'button', class: 'peligro', onclick: descartarRevision }, 'Descartar revisión') : null,
    );

    const barraAdmin = esAdmin
      ? h(
          'section',
          { class: 'tarjeta pila-chica', 'aria-label': 'Acciones de administración' },
          h('h2', {}, 'Administración'),
          h(
            'div',
            { class: 'fila-acciones' },
            actividad.status !== 'archived'
              ? h('button', { type: 'button', class: 'secundario', onclick: abrirModalReasignar }, 'Reasignar responsable')
              : null,
            actividad.status !== 'archived'
              ? h('button', { type: 'button', class: 'peligro', onclick: archivarActividad }, 'Archivar actividad')
              : null,
            !actividad.published
              ? h('button', { type: 'button', class: 'peligro', onclick: borrarBorrador }, 'Eliminar borrador')
              : null,
          ),
        )
      : null;

    const cabecera = h(
      'div',
      { class: 'panel-cabecera' },
      h(
        'div',
        {},
        h('p', { class: 'migas' }, h('a', { href: '/panel/actividades', 'data-enlace': true, class: 'enlace-volver' }, icono('volver', 'icono-sm'), 'Volver a la bandeja')),
        h('h1', {}, borrador.title || 'Borrador sin título'),
        h(
          'div',
          { class: 'fila-chips' },
          h('span', { class: `insignia-editorial ${est.clase}` }, est.texto),
          h('span', { class: 'chip-sutil' }, `Versión ${actividad.version}`),
          actividad.source?.page ? h('span', { class: 'chip-sutil' }, `Origen: PDF pág. ${actividad.source.page}`) : null,
          actividad.published
            ? h('a', { href: `/actividad/${encodeURIComponent(actividad.id)}`, 'data-enlace': true, class: 'enlace-sutil' }, 'Ver ficha pública')
            : null,
        ),
      ),
    );

    contenedor.replaceChildren(
      ...[
        subnav,
        cabecera,
        bannerConflicto,
        bannerDevuelta,
        bannerSoloLectura,
        bannerBloqueoArchivo,
        barraAcciones,
        bloqueFaltantes,
        formDatos,
        seccionFunciones,
        seccionFranjas,
        seccionPublicadas,
        seccionAvisos,
        barraAdmin,
        seccionHistorial,
      ].filter(Boolean),
    );
  }

  pintarTodo();
  return contenedor;
}
