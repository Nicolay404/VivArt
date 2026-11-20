// Pantallas públicas de VIVART (sin sesión; celular primero):
// Agenda (/ y /agenda), «¿Qué hay ahora?» (dentro de Agenda), Ficha pública (/actividad/:id),
// y estados honestos «Próximamente» para Mapa (/mapa) y Pasaporte (/pasaporte).
import { h, icono, esqueletoTarjetas } from './dom.js';
import { apiProgramacion } from './api.js';
import {
  formatoFechaCorta,
  formatoFecha,
  formatoHorarioFuncion,
  formatoFranjaDias,
  claseAcceso,
  iconoParaCategoria,
} from './format.js';
import { renderFicha } from './ficha-componente.js';

function tarjetaAgenda(item) {
  const categoria = item.category?.name ?? 'Categoría por confirmar';
  const sedesNombres = [...new Set((item.venues ?? []).map((v) => v.name))];
  const acceso = item.access ?? { mode: 'unconfirmed', label: 'Acceso por confirmar' };

  return h(
    'article',
    { class: 'tarjeta-agenda' },
    h(
      'a',
      { href: `/actividad/${encodeURIComponent(item.id)}`, 'data-enlace': true, class: 'tarjeta-agenda-enlace' },
      h(
        'div',
        { class: 'tarjeta-agenda-top' },
        h(
          'span',
          { class: `chip-categoria ${!item.category ? 'dato-pendiente-chip' : ''}` },
          icono(iconoParaCategoria(categoria), 'icono-xs'),
          categoria,
        ),
        h('span', { class: `insignia-acceso ${claseAcceso(acceso.mode)}` }, acceso.label),
      ),
      h('h3', { class: 'tarjeta-agenda-titulo' }, item.title),
      item.artists?.length
        ? h('p', { class: 'tarjeta-agenda-artistas' }, item.artists.join(' · '))
        : null,
      h(
        'div',
        { class: 'tarjeta-agenda-meta' },
        item.nextDate
          ? h('span', { class: 'meta-item' }, icono('calendario', 'icono-xs'), `Próxima: ${formatoFechaCorta(item.nextDate)}`)
          : item.isPermanent
            ? h('span', { class: 'meta-item' }, icono('reloj', 'icono-xs'), 'Visitas por franja')
            : null,
        sedesNombres.length
          ? h('span', { class: 'meta-item' }, icono('sede', 'icono-xs'), sedesNombres.join(', '))
          : null,
      ),
      item.isPermanent || item.hasNotices
        ? h(
            'div',
            { class: 'tarjeta-agenda-distintivos' },
            item.isPermanent ? h('span', { class: 'chip-permanente' }, 'Exposición permanente') : null,
            item.hasNotices ? h('span', { class: 'chip-aviso' }, icono('aviso', 'icono-xs'), 'Tiene avisos') : null,
          )
        : null,
    ),
  );
}

function tarjetaAhoraFuncion(entrada, etiquetaEstado, claseEstado) {
  const fn = entrada.function;
  return h(
    'article',
    { class: 'tarjeta-ahora' },
    h(
      'a',
      { href: `/actividad/${encodeURIComponent(entrada.activityId)}`, 'data-enlace': true, class: 'tarjeta-ahora-enlace' },
      h(
        'div',
        { class: 'tarjeta-ahora-top' },
        h('span', { class: 'hora-destacada' }, icono('reloj', 'icono-xs'), formatoHorarioFuncion(fn)),
        h('span', { class: `insignia-estado ${claseEstado}` }, etiquetaEstado),
      ),
      h('h3', { class: 'tarjeta-ahora-titulo' }, entrada.title),
      fn.venue
        ? h(
            'p',
            { class: 'meta-item' },
            icono(fn.venue.kind === 'route' ? 'recorrido' : 'sede', 'icono-xs'),
            fn.venue.name,
          )
        : null,
    ),
  );
}

function tarjetaAhoraFranja(entrada) {
  const sl = entrada.slot;
  return h(
    'article',
    { class: 'tarjeta-ahora' },
    h(
      'a',
      { href: `/actividad/${encodeURIComponent(entrada.activityId)}`, 'data-enlace': true, class: 'tarjeta-ahora-enlace' },
      h(
        'div',
        { class: 'tarjeta-ahora-top' },
        h('span', { class: 'hora-destacada' }, icono('reloj', 'icono-xs'), `${sl.opens} – ${sl.closes}`),
        h('span', { class: 'insignia-estado estado-curso' }, 'Abierto ahora'),
      ),
      h('h3', { class: 'tarjeta-ahora-titulo' }, entrada.title),
      h('p', { class: 'meta-item' }, icono('calendario', 'icono-xs'), formatoFranjaDias(sl)),
      sl.venue
        ? h('p', { class: 'meta-item' }, icono(sl.venue.kind === 'route' ? 'recorrido' : 'sede', 'icono-xs'), sl.venue.name)
        : null,
    ),
  );
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

export async function pantallaAgenda() {
  const params = new URLSearchParams(location.search);
  const estado = {
    vista: params.get('vista') === 'ahora' ? 'ahora' : 'todo',
    q: params.get('q') ?? '',
    date: params.get('date') ?? '',
    categoryId: params.get('categoryId') ?? '',
    venueId: params.get('venueId') ?? '',
    access: params.get('access') ?? '',
  };

  const contenedor = h('div', { class: 'agenda-pagina' });
  const zonaReloj = h('div', { class: 'zona-reloj' });
  const zonaFiltros = h('section', { class: 'agenda-filtros', 'aria-label': 'Filtros de la agenda' });
  const zonaResultados = h('section', { class: 'agenda-resultados', 'aria-live': 'polite' });

  let categorias = [];
  let sedes = [];
  let consultaId = 0;

  function sincronizarUrl() {
    const p = new URLSearchParams();
    if (estado.vista === 'ahora') p.set('vista', 'ahora');
    if (estado.q.trim()) p.set('q', estado.q.trim());
    if (estado.date) p.set('date', estado.date);
    if (estado.categoryId) p.set('categoryId', estado.categoryId);
    if (estado.venueId) p.set('venueId', estado.venueId);
    if (estado.access) p.set('access', estado.access);
    const qs = p.toString();
    const rutaBase = location.pathname === '/agenda' ? '/agenda' : '/';
    history.replaceState({}, '', qs ? `${rutaBase}?${qs}` : rutaBase);
  }

  const hayFiltros = () => Boolean(estado.q.trim() || estado.date || estado.categoryId || estado.venueId || estado.access);

  const btnTodo = h(
    'button',
    {
      type: 'button',
      class: 'pestana-hero',
      'aria-pressed': String(estado.vista === 'todo'),
      onclick: () => cambiarVista('todo'),
    },
    icono('calendario', 'icono-sm'),
    'Todo el festival',
  );
  const btnAhora = h(
    'button',
    {
      type: 'button',
      class: 'pestana-hero',
      'aria-pressed': String(estado.vista === 'ahora'),
      onclick: () => cambiarVista('ahora'),
    },
    icono('reloj', 'icono-sm'),
    '¿Qué hay ahora?',
  );

  function actualizarPestanas() {
    btnTodo.setAttribute('aria-pressed', String(estado.vista === 'todo'));
    btnAhora.setAttribute('aria-pressed', String(estado.vista === 'ahora'));
    btnTodo.classList.toggle('activa', estado.vista === 'todo');
    btnAhora.classList.toggle('activa', estado.vista === 'ahora');
    zonaFiltros.hidden = estado.vista === 'ahora';
  }

  async function cambiarVista(nueva) {
    estado.vista = nueva;
    sincronizarUrl();
    actualizarPestanas();
    if (nueva === 'ahora') await cargarAhora();
    else await cargarAgenda();
  }

  function limpiarFiltros() {
    estado.q = '';
    estado.date = '';
    estado.categoryId = '';
    estado.venueId = '';
    estado.access = '';
    sincronizarUrl();
    pintarFiltros();
    void cargarAgenda();
  }

  function pintarFiltros() {
    const inputBuscar = h('input', {
      id: 'agenda-q',
      type: 'search',
      placeholder: 'Buscar por título, artista u organización…',
      value: estado.q,
      'aria-label': 'Buscar por título, artista u organización',
    });
    let temporizador = null;
    inputBuscar.addEventListener('input', () => {
      estado.q = inputBuscar.value;
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        sincronizarUrl();
        void cargarAgenda();
      }, 240);
    });

    const inputFecha = h('input', {
      id: 'agenda-fecha',
      type: 'date',
      value: estado.date,
      'aria-label': 'Filtrar por fecha',
      onchange: () => {
        estado.date = inputFecha.value;
        sincronizarUrl();
        void cargarAgenda();
      },
    });

    const selectSede = h(
      'select',
      {
        id: 'agenda-sede',
        'aria-label': 'Filtrar por sede',
        onchange: () => {
          estado.venueId = selectSede.value;
          sincronizarUrl();
          void cargarAgenda();
        },
      },
      h('option', { value: '', selected: !estado.venueId }, 'Todas las sedes'),
      sedes.map((s) => h('option', { value: s.id, selected: estado.venueId === s.id }, s.name)),
    );

    const selectAcceso = h(
      'select',
      {
        id: 'agenda-acceso',
        'aria-label': 'Filtrar por modalidad de acceso',
        onchange: () => {
          estado.access = selectAcceso.value;
          sincronizarUrl();
          void cargarAgenda();
        },
      },
      [
        { value: '', label: 'Todo tipo de acceso' },
        { value: 'free', label: 'Gratuita' },
        { value: 'paid', label: 'De pago' },
        { value: 'unconfirmed', label: 'Por confirmar' },
      ].map((o) => h('option', { value: o.value, selected: estado.access === o.value }, o.label)),
    );

    const pildorasCategoria = h(
      'div',
      { class: 'pildoras-scroll', role: 'group', 'aria-label': 'Filtrar por categoría' },
      h(
        'button',
        {
          type: 'button',
          class: `pildora ${!estado.categoryId ? 'activa' : ''}`,
          'aria-pressed': String(!estado.categoryId),
          onclick: () => {
            estado.categoryId = '';
            sincronizarUrl();
            pintarFiltros();
            void cargarAgenda();
          },
        },
        'Todas',
      ),
      categorias.map((c) =>
        h(
          'button',
          {
            type: 'button',
            class: `pildora ${estado.categoryId === c.id ? 'activa' : ''}`,
            'aria-pressed': String(estado.categoryId === c.id),
            onclick: () => {
              estado.categoryId = estado.categoryId === c.id ? '' : c.id;
              sincronizarUrl();
              pintarFiltros();
              void cargarAgenda();
            },
          },
          icono(iconoParaCategoria(c.name), 'icono-xs'),
          c.name,
        ),
      ),
    );

    zonaFiltros.replaceChildren(
      h(
        'div',
        { class: 'buscador-caja' },
        icono('buscar', 'icono-buscar'),
        inputBuscar,
      ),
      pildorasCategoria,
      h(
        'div',
        { class: 'filtros-secundarios' },
        h('div', { class: 'filtro-campo' }, h('label', { for: 'agenda-fecha' }, 'Fecha'), inputFecha),
        h('div', { class: 'filtro-campo' }, h('label', { for: 'agenda-sede' }, 'Sede'), selectSede),
        h('div', { class: 'filtro-campo' }, h('label', { for: 'agenda-acceso' }, 'Acceso'), selectAcceso),
        hayFiltros()
          ? h('button', { type: 'button', class: 'secundario boton-limpiar', onclick: limpiarFiltros }, 'Limpiar filtros')
          : null,
      ),
    );
  }

  async function cargarAgenda() {
    const id = ++consultaId;
    zonaResultados.replaceChildren(esqueletoTarjetas(3));
    const p = new URLSearchParams();
    if (estado.q.trim()) p.set('q', estado.q.trim());
    if (estado.date) p.set('date', estado.date);
    if (estado.categoryId) p.set('categoryId', estado.categoryId);
    if (estado.venueId) p.set('venueId', estado.venueId);
    if (estado.access) p.set('access', estado.access);

    const r = await apiProgramacion('GET', `/agenda${p.toString() ? `?${p.toString()}` : ''}`);
    if (id !== consultaId) return;

    if (!r.ok) {
      zonaResultados.replaceChildren(
        h(
          'div',
          { class: 'estado-vacio estado-error' },
          h('h2', {}, 'No pudimos cargar la Agenda'),
          h('p', {}, r.datos?.message ?? 'Ocurrió un problema al consultar la programación.'),
          h('button', { type: 'button', onclick: cargarAgenda }, 'Reintentar'),
        ),
      );
      return;
    }

    zonaReloj.replaceChildren(...[barraReloj(r.datos.reference)].filter(Boolean));
    const items = r.datos.items ?? [];

    if (items.length === 0) {
      if (hayFiltros()) {
        zonaResultados.replaceChildren(
          h(
            'div',
            { class: 'estado-vacio' },
            h('h2', {}, 'Sin coincidencias'),
            h('p', {}, 'Ninguna actividad publicada cumple con los filtros elegidos.'),
            h('button', { type: 'button', class: 'secundario', onclick: limpiarFiltros }, 'Limpiar filtros'),
          ),
        );
      } else {
        zonaResultados.replaceChildren(
          h(
            'div',
            { class: 'estado-vacio' },
            h('h2', {}, 'Aún no hay actividades publicadas'),
            h('p', {}, 'Cuando el equipo publique la programación del festival aparecerá aquí.'),
          ),
        );
      }
      return;
    }

    zonaResultados.replaceChildren(
      h(
        'div',
        { class: 'resumen-resultados' },
        h('h2', { class: 'sr-only' }, 'Actividades publicadas'),
        h('p', { class: 'conteo-resultados' }, `${items.length} ${items.length === 1 ? 'actividad' : 'actividades'}`),
      ),
      h('div', { class: 'grid-agenda' }, items.map(tarjetaAgenda)),
    );
  }

  async function cargarAhora() {
    const id = ++consultaId;
    zonaResultados.replaceChildren(esqueletoTarjetas(3));
    const r = await apiProgramacion('GET', '/now');
    if (id !== consultaId) return;

    if (!r.ok) {
      zonaResultados.replaceChildren(
        h(
          'div',
          { class: 'estado-vacio estado-error' },
          h('h2', {}, 'No pudimos consultar «¿Qué hay ahora?»'),
          h('p', {}, r.datos?.message ?? 'Inténtalo nuevamente en unos segundos.'),
          h('button', { type: 'button', onclick: cargarAhora }, 'Reintentar'),
        ),
      );
      return;
    }

    zonaReloj.replaceChildren(...[barraReloj(r.datos.reference)].filter(Boolean));
    const { openSlots = [], inProgress = [], upcoming = [], startPassed = [] } = r.datos;
    const total = openSlots.length + inProgress.length + upcoming.length + startPassed.length;

    if (total === 0) {
      zonaResultados.replaceChildren(
        h(
          'div',
          { class: 'estado-vacio' },
          h('h2', {}, 'No hay actividades en curso ni próximas hoy'),
          h('p', {}, 'Puedes explorar toda la programación en «Todo el festival».'),
          h('button', { type: 'button', class: 'secundario', onclick: () => cambiarVista('todo') }, 'Ver todo el festival'),
        ),
      );
      return;
    }

    const seccion = (titulo, descripcion, tarjetas) =>
      tarjetas.length
        ? h(
            'section',
            { class: 'ahora-seccion' },
            h('div', { class: 'ahora-seccion-cabecera' }, h('h2', {}, titulo), descripcion ? h('p', { class: 'ayuda' }, descripcion) : null),
            h('div', { class: 'grid-ahora' }, tarjetas),
          )
        : null;

    zonaResultados.replaceChildren(
      ...[
        seccion('Abierto ahora', 'Exposiciones y actividades permanentes en horario de visita.', openSlots.map(tarjetaAhoraFranja)),
        seccion(
          'En curso',
          'Funciones con hora de fin o duración confirmada que están sucediendo ahora.',
          inProgress.map((e) => tarjetaAhoraFuncion(e, 'En curso', 'estado-curso')),
        ),
        seccion(
          'Próximas hoy',
          'Funciones programadas más tarde en el día (hora de Loja).',
          upcoming.map((e) => tarjetaAhoraFuncion(e, 'Próxima', 'estado-proxima')),
        ),
        seccion(
          'Ya empezaron',
          'Funciones sin hora de fin confirmada cuya hora de inicio ya pasó.',
          startPassed.map((e) => tarjetaAhoraFuncion(e, 'Hora de inicio pasada', 'estado-pasada')),
        ),
      ].filter(Boolean),
    );
  }

  const hero = h(
    'section',
    { class: 'hero-festival' },
    h(
      'div',
      { class: 'hero-contenido' },
      h('p', { class: 'hero-eyebrow' }, 'Festival Internacional de Artes Vivas de Loja'),
      h('h1', { class: 'hero-titulo' }, 'Agenda cultural'),
      h('p', { class: 'hero-subtitulo' }, 'Consulta obras, conciertos, exposiciones y recorridos confirmados en hora local de Loja.'),
      h('div', { class: 'hero-pestanas', role: 'group', 'aria-label': 'Modo de consulta' }, btnTodo, btnAhora),
      zonaReloj,
    ),
  );

  contenedor.append(hero, h('div', { class: 'hoja-contenido' }, zonaFiltros, zonaResultados));

  // Cargar catálogos para los filtros en paralelo con la vista inicial
  actualizarPestanas();
  const [rCat, rSedes] = await Promise.all([apiProgramacion('GET', '/categories'), apiProgramacion('GET', '/venues')]);
  categorias = rCat.ok ? rCat.datos.items ?? [] : [];
  sedes = rSedes.ok ? rSedes.datos.items ?? [] : [];
  pintarFiltros();

  if (estado.vista === 'ahora') await cargarAhora();
  else await cargarAgenda();

  return contenedor;
}

export async function pantallaFicha(id) {
  const r = await apiProgramacion('GET', `/activities/${encodeURIComponent(id)}`);
  const volver = h(
    'p',
    { class: 'migas' },
    h('a', { href: '/', 'data-enlace': true, class: 'enlace-volver' }, icono('volver', 'icono-sm'), 'Volver a la Agenda'),
  );

  if (r.status === 404) {
    return [
      volver,
      h(
        'div',
        { class: 'estado-vacio' },
        h('h1', {}, 'Actividad no encontrada'),
        h('p', {}, 'Esta ficha no existe, aún no está publicada o fue archivada.'),
        h('a', { href: '/', 'data-enlace': true, class: 'boton' }, 'Explorar la Agenda'),
      ),
    ];
  }
  if (!r.ok) {
    return [
      volver,
      h(
        'div',
        { class: 'estado-vacio estado-error' },
        h('h1', {}, 'No pudimos abrir esta ficha'),
        h('p', {}, r.datos?.message ?? 'Inténtalo nuevamente en unos segundos.'),
        h('a', { href: '/', 'data-enlace': true, class: 'boton secundario' }, 'Ir a la Agenda'),
      ),
    ];
  }

  return [volver, renderFicha(r.datos)];
}

export function pantallaProximamente(titulo, descripcion, specTexto) {
  return h(
    'section',
    { class: 'estado-vacio proximamente-caja' },
    h('span', { class: 'chip-sutil' }, 'Próximamente'),
    h('h1', {}, titulo),
    h('p', {}, descripcion),
    h('p', { class: 'ayuda' }, specTexto),
    h('a', { href: '/', 'data-enlace': true, class: 'boton' }, 'Ir a la Agenda'),
  );
}
