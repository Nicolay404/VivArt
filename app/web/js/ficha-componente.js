// Componente reutilizable de Ficha de actividad (FR-003, FR-004, RC-03, RNF-08).
// Se usa tanto en la ficha pública (/actividad/{id}) como en la vista previa del editor editorial.
import { h, icono, aviso } from './dom.js';
import {
  formatoFecha,
  formatoHorarioFuncion,
  formatoDuracion,
  formatoFranjaDias,
  formatoFechaHoraIso,
  etiquetaTiempo,
  etiquetaAviso,
  claseAcceso,
  iconoParaCategoria,
} from './format.js';

function renderSede(venue) {
  if (!venue) {
    return h('div', { class: 'ficha-sede' }, icono('sede', 'icono-sm'), h('span', { class: 'dato-pendiente' }, 'Sede por confirmar'));
  }
  const esRecorrido = venue.kind === 'route';
  return h(
    'div',
    { class: 'ficha-sede' },
    icono(esRecorrido ? 'recorrido' : 'sede', 'icono-sm'),
    h(
      'div',
      { class: 'ficha-sede-texto' },
      h('span', { class: 'ficha-sede-nombre' }, venue.name, esRecorrido ? h('span', { class: 'chip-sutil' }, 'Recorrido') : null),
      venue.address ? h('span', { class: 'ficha-sede-detalle' }, venue.address) : null,
      esRecorrido && venue.routeDescription
        ? h('p', { class: 'ficha-recorrido-desc' }, h('strong', {}, 'Recorrido: '), venue.routeDescription)
        : null,
    ),
  );
}

export function renderFicha(actividad, { esVistaPrevia = false } = {}) {
  const pendientes = new Set(actividad.pending ?? []);
  const categoriaTexto = actividad.category?.name ?? 'Por confirmar';
  const organizacionTexto = actividad.organization ?? 'Por confirmar';
  const descripcionTexto = actividad.description ?? null;
  const duracionTexto = actividad.durationMinutes ? formatoDuracion(actividad.durationMinutes) : pendientes.has('duration') ? 'Por confirmar' : null;
  const acceso = actividad.access ?? { mode: 'unconfirmed', label: 'Acceso por confirmar' };

  const avisosPorFuncion = new Map();
  for (const n of actividad.notices ?? []) {
    if (n.functionId) {
      if (!avisosPorFuncion.has(n.functionId)) avisosPorFuncion.set(n.functionId, []);
      avisosPorFuncion.get(n.functionId).push(n);
    }
  }

  async function compartir() {
    const url = new URL(actividad.shareUrl || `/actividad/${actividad.id}`, location.origin).href;
    const titulo = actividad.title || 'Actividad en VIVART';
    if (navigator.share) {
      try {
        await navigator.share({ title: titulo, text: `${titulo} · VIVART`, url });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        aviso('Enlace de la ficha copiado al portapapeles.', 'ok');
        return;
      } catch {
        // continúa al aviso con URL
      }
    }
    aviso(`Copia este enlace para compartir la ficha: ${url}`, 'info');
  }

  const cabecera = h(
    'header',
    { class: 'ficha-cabecera' },
    h(
      'div',
      { class: 'ficha-meta-superior' },
      h(
        'span',
        { class: `chip-categoria ${pendientes.has('category') ? 'dato-pendiente-chip' : ''}` },
        icono(iconoParaCategoria(categoriaTexto), 'icono-xs'),
        categoriaTexto,
      ),
      h('span', { class: `insignia-acceso ${claseAcceso(acceso.mode)}` }, acceso.label),
      actividad.slots?.length ? h('span', { class: 'chip-permanente' }, 'Exposición permanente') : null,
      esVistaPrevia ? h('span', { class: 'chip-previa' }, 'Vista previa del borrador') : null,
    ),
    h('h1', { class: 'ficha-titulo' }, actividad.title || 'Sin título (Por confirmar)'),
    actividad.artists?.length
      ? h('p', { class: 'ficha-artistas' }, actividad.artists.join(' · '))
      : null,
    h(
      'div',
      { class: 'ficha-acciones-cabecera' },
      !esVistaPrevia
        ? h(
            'button',
            { type: 'button', class: 'secundario boton-con-icono', onclick: compartir },
            icono('compartir', 'icono-sm'),
            'Compartir ficha',
          )
        : null,
    ),
  );

  const bloqueAvisos = actividad.notices?.length
    ? h(
        'section',
        { class: 'ficha-avisos', 'aria-labelledby': 'titulo-avisos-ficha' },
        h(
          'h2',
          { id: 'titulo-avisos-ficha', class: 'ficha-avisos-titulo' },
          icono('aviso', 'icono-sm'),
          `Avisos de programación (${actividad.notices.length})`,
        ),
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
              h('p', { class: 'aviso-texto' }, n.text),
            ),
          ),
        ),
      )
    : null;

  const bloqueDescripcion = h(
    'section',
    { class: 'ficha-seccion', 'aria-labelledby': 'titulo-descripcion' },
    h('h2', { id: 'titulo-descripcion' }, 'Acerca de esta actividad'),
    descripcionTexto
      ? h('p', { class: 'ficha-descripcion' }, descripcionTexto)
      : h('p', { class: 'dato-pendiente' }, 'Descripción: Por confirmar'),
    h(
      'dl',
      { class: 'ficha-datos-clave' },
      h(
        'div',
        { class: 'dato-par' },
        h('dt', {}, 'Organización'),
        h('dd', { class: pendientes.has('organization') ? 'dato-pendiente' : null }, organizacionTexto),
      ),
      h(
        'div',
        { class: 'dato-par' },
        h('dt', {}, 'Acceso y precio'),
        h('dd', {}, acceso.label),
      ),
      duracionTexto
        ? h(
            'div',
            { class: 'dato-par' },
            h('dt', {}, 'Duración'),
            h('dd', { class: duracionTexto === 'Por confirmar' ? 'dato-pendiente' : null }, duracionTexto),
          )
        : null,
    ),
  );

  const funciones = actividad.functions ?? [];
  const bloqueFunciones = funciones.length
    ? h(
        'section',
        { class: 'ficha-seccion', 'aria-labelledby': 'titulo-funciones' },
        h('h2', { id: 'titulo-funciones' }, `Funciones (${funciones.length})`),
        h(
          'ul',
          { class: 'lista-horarios' },
          funciones.map((fn) => {
            const estado = etiquetaTiempo(fn.timeStatus);
            const esCancelada = fn.status === 'cancelled' || fn.timeStatus === 'cancelled';
            const avisosFn = avisosPorFuncion.get(fn.id) ?? [];
            const durFn = fn.durationMinutes ? formatoDuracion(fn.durationMinutes) : null;
            return h(
              'li',
              { class: `horario-tarjeta ${esCancelada ? 'horario-cancelada' : ''}` },
              h(
                'div',
                { class: 'horario-principal' },
                h(
                  'div',
                  { class: 'horario-fecha-hora' },
                  h('span', { class: 'horario-fecha' }, icono('calendario', 'icono-sm'), formatoFecha(fn.date)),
                  h('span', { class: 'horario-hora' }, icono('reloj', 'icono-sm'), formatoHorarioFuncion(fn), ' (hora de Loja)'),
                  durFn ? h('span', { class: 'chip-sutil' }, durFn) : null,
                ),
                estado ? h('span', { class: `insignia-estado ${estado.clase}` }, estado.texto) : null,
              ),
              renderSede(fn.venue),
              avisosFn.length
                ? h(
                    'div',
                    { class: 'horario-avisos' },
                    avisosFn.map((a) =>
                      h('p', { class: 'horario-aviso-texto' }, h('strong', {}, `${etiquetaAviso(a.kind)}: `), a.text),
                    ),
                  )
                : null,
            );
          }),
        ),
      )
    : null;

  const franjas = actividad.slots ?? [];
  const bloqueFranjas = franjas.length
    ? h(
        'section',
        { class: 'ficha-seccion', 'aria-labelledby': 'titulo-franjas' },
        h('h2', { id: 'titulo-franjas' }, `Horarios de visita (${franjas.length})`),
        h(
          'ul',
          { class: 'lista-horarios' },
          franjas.map((sl) =>
            h(
              'li',
              { class: 'horario-tarjeta' },
              h(
                'div',
                { class: 'horario-principal' },
                h(
                  'div',
                  { class: 'horario-fecha-hora' },
                  h('span', { class: 'horario-fecha' }, icono('calendario', 'icono-sm'), formatoFranjaDias(sl)),
                  h(
                    'span',
                    { class: 'horario-hora' },
                    icono('reloj', 'icono-sm'),
                    sl.opens && sl.closes ? `${sl.opens} – ${sl.closes} (hora de Loja)` : 'Horario por confirmar',
                  ),
                ),
                h('span', { class: 'insignia-estado estado-franja' }, 'Franja de apertura'),
              ),
              renderSede(sl.venue),
            ),
          ),
        ),
      )
    : null;

  const sinHorarios =
    funciones.length === 0 && franjas.length === 0
      ? h(
          'section',
          { class: 'ficha-seccion' },
          h('h2', {}, 'Fechas y horarios'),
          h('p', { class: 'dato-pendiente' }, 'Fechas y horarios: Por confirmar'),
        )
      : null;

  const notaCambios = actividad.subjectToChange !== false
    ? h(
        'p',
        { class: 'nota-sujeta-cambios' },
        icono('aviso', 'icono-xs'),
        'Programación sujeta a cambios. Consulta esta ficha antes de asistir para verificar avisos recientes.',
      )
    : null;

  return h(
    'article',
    { class: 'ficha-actividad' },
    cabecera,
    bloqueAvisos,
    bloqueDescripcion,
    bloqueFunciones,
    bloqueFranjas,
    sinHorarios,
    notaCambios,
  );
}
