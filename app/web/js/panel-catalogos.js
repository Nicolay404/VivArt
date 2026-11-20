// Gestión de catálogos del administrador (FR-025): ediciones, categorías y sedes (lugar o recorrido).
import { h, aviso, campo, campoTextarea, campoSelect, formulario, abrirDialogo } from './dom.js';
import { apiProgramacion } from './api.js';
import { requiereSesion } from './cuenta.js';
import { barraPanel } from './panel-bandeja.js';

export async function pantallaCatalogos({ persona }) {
  if (!persona) return requiereSesion();
  const subnav = barraPanel(persona, '/panel/catalogos');

  if (!persona.roles.includes('administrador')) {
    return [
      subnav,
      h('h1', {}, 'Catálogos'),
      h('p', { class: 'aviso error-caja' }, 'Para gestionar ediciones, categorías y sedes falta el rol de administrador.'),
    ];
  }

  let pestana = 'categories';
  const zonaContenido = h('div', { class: 'catalogos-contenido' });
  const zonaTabs = h('div', { class: 'tabs-linea', role: 'tablist', 'aria-label': 'Tipo de catálogo' });

  async function cargarLista(tipo) {
    const r = await apiProgramacion('GET', `/${tipo}`);
    return r.ok ? r.datos.items ?? [] : [];
  }

  function pintarTabs() {
    const defs = [
      { id: 'categories', label: 'Categorías' },
      { id: 'venues', label: 'Sedes y recorridos' },
      { id: 'editions', label: 'Ediciones' },
    ];
    zonaTabs.replaceChildren(
      defs.map((d) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            class: `tab-boton ${pestana === d.id ? 'activa' : ''}`,
            'aria-selected': String(pestana === d.id),
            onclick: () => {
              pestana = d.id;
              pintarTabs();
              pintarContenido();
            },
          },
          d.label,
        ),
      ),
    );
  }

  function abrirModalCategoria(existente) {
    const nombre = campo({ id: 'name', etiqueta: 'Nombre de la categoría', valor: existente?.name ?? '' });
    abrirDialogo({
      titulo: existente ? 'Editar categoría' : 'Nueva categoría',
      contenido: (cerrar) =>
        formulario({
          campos: [nombre],
          boton: existente ? 'Guardar cambios' : 'Crear categoría',
          alEnviar: async (v) => {
            const r = existente
              ? await apiProgramacion('PUT', `/panel/categories/${encodeURIComponent(existente.id)}`, { name: v.name })
              : await apiProgramacion('POST', '/panel/categories', { name: v.name });
            if (r.ok) {
              aviso(existente ? 'Categoría actualizada.' : 'Categoría creada.', 'ok');
              cerrar();
              await pintarContenido();
            }
            return r;
          },
        }),
    });
  }

  function abrirModalSede(existente) {
    const nombre = campo({ id: 'name', etiqueta: 'Nombre de la sede o recorrido', valor: existente?.name ?? '' });
    const tipo = campoSelect({
      id: 'kind',
      etiqueta: 'Tipo',
      valor: existente?.kind ?? 'place',
      opciones: [
        { value: 'place', label: 'Lugar (teatro, plaza, museo, sala)' },
        { value: 'route', label: 'Recorrido o tramo de calle' },
      ],
    });
    const direccion = campo({
      id: 'address',
      etiqueta: 'Dirección (opcional)',
      valor: existente?.address ?? '',
      requerido: false,
      ayuda: 'Corregir la dirección actualiza las fichas sin emitir aviso público (FR-025).',
    });
    const recorrido = campoTextarea({
      id: 'routeDescription',
      etiqueta: 'Descripción del recorrido (solo para recorridos)',
      valor: existente?.routeDescription ?? '',
      filas: 3,
      requerido: false,
    });

    const actualizarVisibilidad = () => {
      recorrido.el.hidden = tipo.input.value !== 'route';
    };
    tipo.input.addEventListener('change', actualizarVisibilidad);
    actualizarVisibilidad();

    abrirDialogo({
      titulo: existente ? 'Editar sede' : 'Nueva sede',
      contenido: (cerrar) =>
        formulario({
          campos: [nombre, tipo, direccion, recorrido],
          boton: existente ? 'Guardar cambios' : 'Crear sede',
          alEnviar: async (v) => {
            const payload = {
              name: v.name,
              kind: v.kind,
              address: v.address.trim() || null,
              routeDescription: v.kind === 'route' ? v.routeDescription.trim() || null : null,
            };
            const r = existente
              ? await apiProgramacion('PUT', `/panel/venues/${encodeURIComponent(existente.id)}`, payload)
              : await apiProgramacion('POST', '/panel/venues', payload);
            if (r.ok) {
              aviso(existente ? 'Sede actualizada.' : 'Sede creada.', 'ok');
              cerrar();
              await pintarContenido();
            }
            return r;
          },
        }),
    });
  }

  function abrirModalEdicion(existente) {
    const nombre = campo({ id: 'name', etiqueta: 'Nombre de la edición', valor: existente?.name ?? '' });
    const anio = campo({
      id: 'year',
      etiqueta: 'Año (opcional)',
      tipo: 'number',
      valor: existente?.year ?? '',
      requerido: false,
      min: 1900,
      max: 2200,
    });
    const activa = campoSelect({
      id: 'active',
      etiqueta: 'Estado en la Agenda',
      valor: existente ? String(existente.active) : 'true',
      opciones: [
        { value: 'true', label: 'Activa (visible por defecto)' },
        { value: 'false', label: 'Inactiva' },
      ],
    });

    abrirDialogo({
      titulo: existente ? 'Editar edición' : 'Nueva edición',
      contenido: (cerrar) =>
        formulario({
          campos: [nombre, anio, activa],
          boton: existente ? 'Guardar cambios' : 'Crear edición',
          alEnviar: async (v) => {
            const payload = {
              name: v.name,
              year: v.year.trim() === '' ? null : Number(v.year),
              active: v.active === 'true',
            };
            const r = existente
              ? await apiProgramacion('PUT', `/panel/editions/${encodeURIComponent(existente.id)}`, payload)
              : await apiProgramacion('POST', '/panel/editions', payload);
            if (r.ok) {
              aviso(existente ? 'Edición actualizada.' : 'Edición creada.', 'ok');
              cerrar();
              await pintarContenido();
            }
            return r;
          },
        }),
    });
  }

  async function pintarContenido() {
    const items = await cargarLista(pestana);
    if (pestana === 'categories') {
      zonaContenido.replaceChildren(
        h(
          'div',
          { class: 'seccion-cabecera-inline' },
          h('h2', {}, `Categorías (${items.length})`),
          h('button', { type: 'button', onclick: () => abrirModalCategoria(null) }, 'Nueva categoría'),
        ),
        items.length === 0
          ? h('p', { class: 'ayuda' }, 'Aún no hay categorías registradas.')
          : h(
              'div',
              { class: 'tabla-scroll', tabindex: '0' },
              h(
                'table',
                {},
                h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Nombre'), h('th', { scope: 'col' }, 'Acción'))),
                h(
                  'tbody',
                  {},
                  items.map((c) =>
                    h(
                      'tr',
                      {},
                      h('td', { 'data-etiqueta': 'Nombre' }, c.name),
                      h(
                        'td',
                        { 'data-etiqueta': 'Acción' },
                        h('button', { type: 'button', class: 'secundario boton-sm', onclick: () => abrirModalCategoria(c) }, 'Editar'),
                      ),
                    ),
                  ),
                ),
              ),
            ),
      );
      return;
    }

    if (pestana === 'venues') {
      zonaContenido.replaceChildren(
        h(
          'div',
          { class: 'seccion-cabecera-inline' },
          h('h2', {}, `Sedes y recorridos (${items.length})`),
          h('button', { type: 'button', onclick: () => abrirModalSede(null) }, 'Nueva sede'),
        ),
        items.length === 0
          ? h('p', { class: 'ayuda' }, 'Aún no hay sedes registradas.')
          : h(
              'div',
              { class: 'tabla-scroll', tabindex: '0' },
              h(
                'table',
                {},
                h(
                  'thead',
                  {},
                  h(
                    'tr',
                    {},
                    ['Nombre', 'Tipo', 'Dirección / Recorrido', 'Acción'].map((t) => h('th', { scope: 'col' }, t)),
                  ),
                ),
                h(
                  'tbody',
                  {},
                  items.map((s) =>
                    h(
                      'tr',
                      {},
                      h('td', { 'data-etiqueta': 'Nombre' }, s.name),
                      h('td', { 'data-etiqueta': 'Tipo' }, h('span', { class: 'chip-sutil' }, s.kind === 'route' ? 'Recorrido' : 'Lugar')),
                      h(
                        'td',
                        { 'data-etiqueta': 'Detalle' },
                        s.kind === 'route' ? s.routeDescription || s.address || '—' : s.address || '—',
                      ),
                      h(
                        'td',
                        { 'data-etiqueta': 'Acción' },
                        h('button', { type: 'button', class: 'secundario boton-sm', onclick: () => abrirModalSede(s) }, 'Editar'),
                      ),
                    ),
                  ),
                ),
              ),
            ),
      );
      return;
    }

    zonaContenido.replaceChildren(
      h(
        'div',
        { class: 'seccion-cabecera-inline' },
        h('h2', {}, `Ediciones (${items.length})`),
        h('button', { type: 'button', onclick: () => abrirModalEdicion(null) }, 'Nueva edición'),
      ),
      items.length === 0
        ? h('p', { class: 'ayuda' }, 'Aún no hay ediciones registradas.')
        : h(
            'div',
            { class: 'tabla-scroll', tabindex: '0' },
            h(
              'table',
              {},
              h(
                'thead',
                {},
                h(
                  'tr',
                  {},
                  ['Nombre', 'Año', 'Estado', 'Acción'].map((t) => h('th', { scope: 'col' }, t)),
                ),
              ),
              h(
                'tbody',
                {},
                items.map((e) =>
                  h(
                    'tr',
                    {},
                    h('td', { 'data-etiqueta': 'Nombre' }, e.name),
                    h('td', { 'data-etiqueta': 'Año' }, e.year ?? '—'),
                    h('td', { 'data-etiqueta': 'Estado' }, h('span', { class: `insignia-editorial ${e.active ? 'ed-publicada' : 'ed-archivada'}` }, e.active ? 'Activa' : 'Inactiva')),
                    h(
                      'td',
                      { 'data-etiqueta': 'Acción' },
                      h('button', { type: 'button', class: 'secundario boton-sm', onclick: () => abrirModalEdicion(e) }, 'Editar'),
                    ),
                  ),
                ),
              ),
            ),
          ),
    );
  }

  pintarTabs();
  await pintarContenido();

  return [
    subnav,
    h(
      'div',
      { class: 'panel-cabecera' },
      h(
        'div',
        {},
        h('h1', {}, 'Catálogos'),
        h('p', { class: 'ayuda' }, 'Los cambios se aplican sin revisión editorial y quedan registrados en el historial (FR-025).'),
      ),
    ),
    zonaTabs,
    zonaContenido,
  ];
}
