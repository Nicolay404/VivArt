// Bandeja del panel editorial (GET /panel/activities) y barra de subnavegación del panel.
import { h, icono, aviso, esqueletoTarjetas } from './dom.js';
import { apiProgramacion } from './api.js';
import { etiquetaEstadoEditorial, formatoFechaHoraIso } from './format.js';
import { requiereSesion } from './cuenta.js';

export function tieneRolPanel(persona) {
  return Boolean(persona?.roles?.some((r) => ['editor', 'publicador', 'administrador'].includes(r)));
}

export function barraPanel(persona, rutaActual) {
  if (!persona) return null;
  const esAdmin = persona.roles.includes('administrador');
  const enlace = (href, texto) =>
    h(
      'a',
      {
        href,
        'data-enlace': true,
        class: `panel-tab ${rutaActual === href || (href === '/panel/actividades' && rutaActual.startsWith('/panel/actividades')) ? 'activa' : ''}`,
        'aria-current': rutaActual === href ? 'page' : null,
      },
      texto,
    );

  return h(
    'nav',
    { class: 'panel-subnav', 'aria-label': 'Secciones del panel interno' },
    enlace('/panel/actividades', 'Bandeja editorial'),
    esAdmin ? enlace('/panel/ventas', 'Ventas') : null,
    esAdmin ? enlace('/panel/pasaporte', 'Pasaporte') : null,
    esAdmin ? enlace('/panel/catalogos', 'Catálogos') : null,
    esAdmin ? enlace('/panel/carga', 'Carga desde PDF') : null,
    esAdmin ? enlace('/panel/roles', 'Roles') : null,
    esAdmin ? enlace('/panel/historial', 'Historial de permisos') : null,
  );
}

export async function pantallaBandeja({ persona, navegar }) {
  if (!persona) return requiereSesion();
  const subnav = barraPanel(persona, '/panel/actividades');

  const esRevisor = persona.roles.includes('publicador') || persona.roles.includes('administrador');
  const estado = { state: '', mine: false };
  const zonaTabla = h('div', { class: 'bandeja-lista', 'aria-live': 'polite' });

  async function cargar() {
    zonaTabla.replaceChildren(esqueletoTarjetas(3));
    const p = new URLSearchParams();
    if (estado.state) p.set('state', estado.state);
    if (estado.mine) p.set('mine', 'true');
    const consulta = p.toString();
    const sufijo = consulta ? `?${consulta}` : '';
    const r = await apiProgramacion('GET', `/panel/activities${sufijo}`);
    if (!r.ok) {
      zonaTabla.replaceChildren(
        h(
          'div',
          { class: 'estado-vacio estado-error' },
          h('h2', {}, 'No puedes ver esta bandeja'),
          h('p', {}, r.datos?.message ?? 'No se pudo cargar el listado editorial.'),
          r.status !== 403 ? h('button', { type: 'button', onclick: cargar }, 'Reintentar') : null,
        ),
      );
      return;
    }

    const items = r.datos.items ?? [];
    if (items.length === 0) {
      zonaTabla.replaceChildren(
        h(
          'div',
          { class: 'estado-vacio' },
          h('h2', {}, 'Sin actividades en esta vista'),
          h('p', {}, estado.state || estado.mine ? 'Prueba cambiando los filtros.' : 'Crea tu primer borrador para comenzar.'),
        ),
      );
      return;
    }

    const filas = items.map((item) => {
      const est = etiquetaEstadoEditorial(item);
      return h(
        'tr',
        {},
        h(
          'td',
          { 'data-etiqueta': 'Actividad' },
          h(
            'a',
            { href: `/panel/actividades/${encodeURIComponent(item.id)}`, 'data-enlace': true, class: 'enlace-titulo-tabla' },
            item.title || 'Sin título',
          ),
          item.source?.page ? h('span', { class: 'chip-sutil' }, `PDF pág. ${item.source.page}`) : null,
        ),
        h('td', { 'data-etiqueta': 'Estado' }, h('span', { class: `insignia-editorial ${est.clase}` }, est.texto)),
        h('td', { 'data-etiqueta': 'Publicada' }, item.published ? 'Sí (visible en Agenda)' : 'No'),
        h('td', { 'data-etiqueta': 'Actualizada' }, formatoFechaHoraIso(item.updatedAt)),
        h(
          'td',
          { 'data-etiqueta': 'Acción' },
          h(
            'a',
            { href: `/panel/actividades/${encodeURIComponent(item.id)}`, 'data-enlace': true, class: 'boton secundario boton-sm' },
            'Abrir',
          ),
        ),
      );
    });

    zonaTabla.replaceChildren(
      h(
        'div',
        { class: 'tabla-scroll', tabindex: '0', role: 'region', 'aria-label': 'Actividades en el panel editorial' },
        h(
          'table',
          {},
          h('caption', { class: 'sr-only' }, 'Lista de actividades del panel editorial'),
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              ['Actividad', 'Estado editorial', 'Visibilidad', 'Última actualización', 'Acción'].map((t) => h('th', { scope: 'col' }, t)),
            ),
          ),
          h('tbody', {}, filas),
        ),
      ),
    );
  }

  async function crearNueva() {
    const r = await apiProgramacion('POST', '/panel/activities', { content: {} });
    if (!r.ok) {
      aviso(r.datos?.message ?? 'No se pudo crear el borrador.', 'error');
      return;
    }
    aviso('Borrador creado. Puedes guardarlo aunque esté incompleto.', 'ok');
    navegar(`/panel/actividades/${encodeURIComponent(r.datos.id)}`);
  }

  const selectEstado = h(
    'select',
    {
      id: 'filtro-estado',
      'aria-label': 'Filtrar por estado editorial',
      onchange: () => {
        estado.state = selectEstado.value;
        void cargar();
      },
    },
    [
      { value: '', label: 'Todos los estados' },
      { value: 'draft', label: 'Borrador' },
      { value: 'in_review', label: 'En revisión' },
      { value: 'returned', label: 'Devuelta' },
      { value: 'published', label: 'Publicada' },
      { value: 'archived', label: 'Archivada' },
    ].map((o) => h('option', { value: o.value }, o.label)),
  );

  const checkMias = esRevisor
    ? h(
        'label',
        { class: 'check-inline' },
        h('input', {
          type: 'checkbox',
          onchange: (ev) => {
            estado.mine = ev.target.checked;
            void cargar();
          },
        }),
        'Solo las mías',
      )
    : null;

  const cabecera = h(
    'div',
    { class: 'panel-cabecera' },
    h(
      'div',
      {},
      h('h1', {}, 'Panel editorial'),
      h(
        'p',
        { class: 'ayuda' },
        esRevisor
          ? 'Ves todas las propuestas y fichas del festival según tus roles activos.'
          : 'Ves tus borradores y propuestas. Un publicador o administrador las revisará y publicará.',
      ),
    ),
    h(
      'div',
      { class: 'fila-acciones' },
      h('button', { type: 'button', onclick: crearNueva }, icono('calendario', 'icono-sm'), 'Nueva actividad'),
    ),
  );

  const barraFiltros = h(
    'div',
    { class: 'panel-filtros' },
    h('div', { class: 'filtro-campo' }, h('label', { for: 'filtro-estado' }, 'Estado'), selectEstado),
    checkMias,
  );

  await cargar();
  return [subnav, cabecera, barraFiltros, zonaTabla];
}
