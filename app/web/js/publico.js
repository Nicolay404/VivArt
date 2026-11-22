// Pantallas públicas de VIVART (sin sesión; celular primero):
// Agenda (/ y /agenda), «¿Qué hay ahora?» (dentro de Agenda), Ficha pública (/actividad/:id),
// y el estado honesto «Próximamente» para Pasaporte (/pasaporte). El Mapa (/mapa) vive en mapa.js (spec 003).
import { h, icono, esqueletoTarjetas, aviso } from './dom.js';
import { apiProgramacion, apiParticipacion } from './api.js';
import { agregarAlCarrito } from './carrito.js';
import {
  formatoFechaCorta,
  formatoFecha,
  formatoHorarioFuncion,
  formatoFranjaDias,
  partesFecha,
  claseAcceso,
  iconoParaCategoria,
} from './format.js';
import { renderFicha } from './ficha-componente.js';

/** Tono del bloque de fecha según la categoría: siempre el mismo para la misma categoría (solo decoración). */
function tonoCategoria(nombre) {
  let suma = 0;
  for (const c of String(nombre)) suma += c.codePointAt(0);
  return `tono-${(suma % 3) + 1}`;
}

/** Bloque con el día de la próxima función en grande, como en los carteles del festival. */
function bloqueFecha(item, categoria) {
  const p = item.nextDate ? partesFecha(item.nextDate) : null;
  if (p) {
    return h(
      'div',
      { class: `tarjeta-agenda-fecha ${tonoCategoria(categoria)}` },
      h('span', { class: 'sr-only' }, 'Próxima función: '),
      h('span', { class: 'fecha-semana' }, p.semana),
      h('span', { class: 'fecha-dia' }, String(p.dia)),
      h('span', { class: 'fecha-mes' }, p.mes),
    );
  }
  return h(
    'div',
    { class: `tarjeta-agenda-fecha sin-dia ${tonoCategoria(categoria)}` },
    icono(item.isPermanent ? 'reloj' : 'calendario', 'icono'),
    h('span', { class: 'fecha-mes' }, item.isPermanent ? 'Por franja' : 'Por confirmar'),
  );
}

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
      bloqueFecha(item, categoria),
      h('span', { class: 'tarjeta-agenda-flecha', 'aria-hidden': 'true' }, '↗'),
      h(
        'div',
        { class: 'tarjeta-agenda-cuerpo' },
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
      sedesNombres.length
        ? h('div', { class: 'tarjeta-agenda-meta' }, h('span', { class: 'meta-item' }, icono('sede', 'icono-xs'), sedesNombres.join(', ')))
        : null,
      item.isPermanent || item.hasNotices
        ? h(
            'div',
            { class: 'tarjeta-agenda-distintivos' },
            item.isPermanent ? h('span', { class: 'chip-permanente' }, 'Exposición permanente') : null,
            item.hasNotices ? h('span', { class: 'chip-aviso' }, icono('aviso', 'icono-xs'), 'Tiene avisos') : null,
          )
        : null,
      ),
    ),
  );
}

/** Parte superior de las tarjetas de «¿Qué hay ahora?»: el estado en texto (nunca solo con color) y la flecha. */
function topAhora(etiquetaEstado) {
  return h(
    'div',
    { class: 'tarjeta-ahora-top' },
    h('span', { class: 'estado-ahora' }, etiquetaEstado),
    h('span', { class: 'tarjeta-ahora-flecha', 'aria-hidden': 'true' }, '↗'),
  );
}

function tarjetaAhoraFuncion(entrada, etiquetaEstado, claseEstado) {
  const fn = entrada.function;
  return h(
    'article',
    { class: `tarjeta-ahora tarjeta-color ${claseEstado}` },
    h(
      'a',
      { href: `/actividad/${encodeURIComponent(entrada.activityId)}`, 'data-enlace': true, class: 'tarjeta-ahora-enlace' },
      topAhora(etiquetaEstado),
      h('p', { class: 'hora-ahora' }, h('span', { class: 'sr-only' }, 'Hora: '), formatoHorarioFuncion(fn)),
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
    { class: 'tarjeta-ahora tarjeta-color estado-curso' },
    h(
      'a',
      { href: `/actividad/${encodeURIComponent(entrada.activityId)}`, 'data-enlace': true, class: 'tarjeta-ahora-enlace' },
      topAhora('Abierto ahora'),
      h('p', { class: 'hora-ahora' }, h('span', { class: 'sr-only' }, 'Horario: '), `${sl.opens} – ${sl.closes}`),
      h('h3', { class: 'tarjeta-ahora-titulo' }, entrada.title),
      h('p', { class: 'meta-item' }, icono('calendario', 'icono-xs'), formatoFranjaDias(sl)),
      sl.venue
        ? h('p', { class: 'meta-item' }, icono(sl.venue.kind === 'route' ? 'recorrido' : 'sede', 'icono-xs'), sl.venue.name)
        : null,
    ),
  );
}

/**
 * Video de fondo de la portada: empieza en silencio (los navegadores no dejan que un video suene solo), en bucle, con
 * botones para pausar (WCAG 2.2.2) y para activar el sonido. No se carga si la persona pidió reducir el movimiento, si su
 * conexión ahorra datos o en pantallas de celular, para no gastar sus datos.
 */
function videoDePortada(src) {
  const reducir = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const celular = globalThis.matchMedia?.('(max-width: 39.99rem)').matches;
  if (reducir || celular || navigator.connection?.saveData) return null;
  const video = document.createElement('video');
  video.className = 'hero-video';
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.autoplay = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('aria-label', 'Video de ambiente del festival');
  video.setAttribute('tabindex', '-1');
  video.src = src;
  const boton = h('button', { type: 'button', class: 'hero-video-pausa', 'aria-pressed': 'false' });
  // Botones pequeños, solo con icono: su nombre va en aria-label (lectores de pantalla) y en title (al pasar el cursor).
  const nombrar = (b, texto) => {
    b.setAttribute('aria-label', texto);
    b.setAttribute('title', texto);
  };
  const etiqueta = (pausado) => {
    boton.setAttribute('aria-pressed', String(pausado));
    nombrar(boton, pausado ? 'Reanudar video' : 'Pausar video');
    boton.replaceChildren(icono(pausado ? 'reproducir' : 'pausa', 'icono-sm'));
  };
  etiqueta(false);
  boton.addEventListener('click', () => {
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  });
  const sonido = h('button', { type: 'button', class: 'hero-video-pausa', 'aria-pressed': 'false' });
  const etiquetaSonido = () => {
    sonido.setAttribute('aria-pressed', String(!video.muted));
    nombrar(sonido, video.muted ? 'Activar sonido' : 'Silenciar');
    sonido.replaceChildren(icono(video.muted ? 'sonido' : 'silencio', 'icono-sm'));
  };
  etiquetaSonido();
  sonido.addEventListener('click', () => {
    video.muted = !video.muted;
    // Si el navegador no deja que suene (no reconoce el clic como acción de la persona), sigue en silencio y en marcha.
    if (!video.muted) {
      void video.play().catch(() => {
        video.muted = true;
        void video.play().catch(() => {});
      });
    }
    etiquetaSonido();
  });
  video.addEventListener('volumechange', etiquetaSonido);
  const controles = h('div', { class: 'hero-video-controles', role: 'group', 'aria-label': 'Controles del video' }, boton, sonido);
  video.addEventListener('play', () => etiqueta(false));
  video.addEventListener('pause', () => etiqueta(true));
  // Si el video no carga, la portada queda como antes, sin video ni botón.
  video.addEventListener('error', () => {
    video.remove();
    controles.remove();
  });
  return { video, controles };
}

// PDF oficial de la programación, publicado por el festival. Se enlaza (no se copia al repositorio, M-04): así siempre
// se descarga la versión vigente que publica el festival.
const PDF_PROGRAMACION = 'https://festivaldeloja.com/wp-content/uploads/2026/11/PROGRAMACION-FIAVVL-2026-Final-Aprobada.pdf';
const PDF_PROGRAMA_DE_MANO = 'https://festivaldeloja.com/wp-content/uploads/2026/11/PROGRAMA-DE-MANO-LOJA-2026-FINALA.pdf';

function bloqueDescargaPdf() {
  const externo = (href, clase, ...contenido) =>
    h('a', { href, class: clase, target: '_blank', rel: 'noopener noreferrer' }, ...contenido, h('span', { class: 'sr-only' }, ' (abre el sitio del festival en otra pestaña)'));
  return h(
    'section',
    { class: 'descarga-pdf', 'aria-labelledby': 'titulo-descarga-pdf' },
    h('div', { class: 'descarga-pdf-mosaico', 'aria-hidden': 'true' }, h('span'), h('span'), h('span'), h('span')),
    h(
      'div',
      { class: 'descarga-pdf-texto' },
      h('p', { class: 'eyebrow' }, 'Programación impresa'),
      h('h2', { id: 'titulo-descarga-pdf', class: 'titulo-seccion' }, 'Llévate la programación'),
      h('p', {}, 'Descarga el PDF oficial del festival con todas las funciones, sedes y horarios, para consultarlo sin conexión.'),
      h(
        'div',
        { class: 'acciones-fila' },
        externo(PDF_PROGRAMACION, 'boton boton-descarga', icono('descargar', 'icono-sm'), 'Descargar programación (PDF)'),
        externo(PDF_PROGRAMA_DE_MANO, 'boton secundario', icono('externo', 'icono-sm'), 'Programa de mano'),
      ),
      h('p', { class: 'ayuda' }, 'Fuente: festivaldeloja.com. Si una función cambia, la Agenda muestra el aviso vigente.'),
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
  let dias = [];
  let hoyLoja = null;
  let consultaId = 0;
  const zonaDias = h('nav', { class: 'selector-dias', 'aria-label': 'Días del festival' });
  const zonaRango = h('div', { class: 'hero-rango', 'aria-hidden': 'true' });

  /** Días con funciones publicadas, como en la programación impresa: un botón por día y «Todos». */
  function pintarDias() {
    zonaDias.hidden = estado.vista === 'ahora' || dias.length === 0;
    if (zonaDias.hidden) return;
    const elegir = (fecha) => {
      estado.date = estado.date === fecha ? '' : fecha;
      sincronizarUrl();
      pintarDias();
      pintarFiltros();
      void cargarAgenda();
    };
    const boton = (fecha, contenido, etiqueta) =>
      h(
        'button',
        {
          type: 'button',
          class: `dia-boton ${estado.date === fecha ? 'activo' : ''}`,
          'aria-pressed': String(estado.date === fecha),
          'aria-label': etiqueta,
          onclick: () => elegir(fecha),
        },
        contenido,
      );
    zonaDias.replaceChildren(
      h(
        'div',
        { class: 'selector-dias-interior' },
        boton('', [h('span', { class: 'dia-numero' }, '★'), h('span', { class: 'dia-semana' }, 'Todos')], 'Todos los días'),
        dias.map((d) => {
          const p = partesFecha(d);
          return boton(
            d,
            [
              d === hoyLoja ? h('span', { class: 'dia-hoy' }, 'Hoy') : null,
              h('span', { class: 'dia-numero' }, String(p.dia)),
              h('span', { class: 'dia-semana' }, p.semana),
            ],
            `${formatoFecha(d)}${d === hoyLoja ? ' (hoy)' : ''}`,
          );
        }),
      ),
    );
  }

  /** Rango de la edición a partir de los días publicados («20—30 NOV 2026»); nunca se escribe a mano. */
  function pintarRango() {
    if (dias.length === 0) return zonaRango.replaceChildren();
    const a = partesFecha(dias[0]);
    const b = partesFecha(dias.at(-1));
    const rango = a.mes === b.mes ? `${a.dia}—${b.dia}` : `${a.dia} ${a.mes}—${b.dia}`;
    zonaRango.replaceChildren(h('span', { class: 'rango-dias' }, rango), h('span', { class: 'rango-mes' }, `${b.mes} ${b.anio}`));
  }

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
    pintarDias();
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
    pintarDias();
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
        pintarDias();
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
    if (hoyLoja !== r.datos.reference?.date) {
      hoyLoja = r.datos.reference?.date ?? null;
      pintarDias();
    }
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
        h('p', { class: 'eyebrow' }, estado.date ? formatoFecha(estado.date) : 'Programación publicada'),
        h('h2', { class: 'titulo-seccion' }, `${items.length} ${items.length === 1 ? 'actividad' : 'actividades'}`),
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
            h(
              'div',
              { class: 'ahora-seccion-cabecera' },
              h('p', { class: 'eyebrow' }, 'Hoy · hora de Loja'),
              h('h2', { class: 'titulo-seccion' }, titulo),
              descripcion ? h('p', { class: 'ayuda' }, descripcion) : null,
            ),
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

  const fondo = videoDePortada('/video/video1.mp4');
  const hero = h(
    'section',
    { class: `hero-festival ${fondo ? 'con-video' : ''}` },
    fondo?.video,
    fondo?.controles,
    h(
      'div',
      { class: 'hero-contenido' },
      h('p', { class: 'hero-eyebrow' }, 'Festival Internacional de Artes Vivas de Loja'),
      h('h1', { class: 'hero-titulo' }, 'Agenda ', h('span', { class: 'resalte' }, 'cultural')),
      h('p', { class: 'hero-subtitulo' }, 'Consulta obras, conciertos, exposiciones y recorridos confirmados en hora local de Loja.'),
      h(
        'div',
        { class: 'hero-fila-acciones' },
        h('div', { class: 'hero-pestanas', role: 'group', 'aria-label': 'Modo de consulta' }, btnTodo, btnAhora),
        h(
          'a',
          {
            href: '/recorrido',
            'data-enlace': true,
            class: 'boton boton-recorrido-acceso',
            'aria-label': 'Ir a Mi recorrido guardado',
          },
          icono('calendario', 'icono-sm'),
          'Mi recorrido',
        ),
        // Alforjita (spec 008): se importa al pulsar, así la Agenda no la espera; si falla, la Agenda sigue igual.
        h(
          'button',
          {
            type: 'button',
            id: 'boton-alforjita',
            class: 'boton boton-alforjita',
            'aria-haspopup': 'dialog',
            onclick: () =>
              import('./alforjita.js')
                .then((m) => m.abrirAlforjita())
                .catch(() => aviso('No pude abrir Alforjita. Puedes seguir buscando en la Agenda.', 'error')),
          },
          icono('alforja', 'icono-sm'),
          'Pregúntale a Alforjita',
        ),
      ),
      zonaReloj,
    ),
    h(
      'div',
      { class: 'hero-mosaico', 'aria-hidden': 'true' },
      ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9'].map((c) => h('span', { class: c })),
      zonaRango,
    ),
  );

  contenedor.append(hero, zonaDias, h('div', { class: 'hoja-contenido' }, zonaFiltros, zonaResultados, bloqueDescargaPdf()));

  // Cargar catálogos para los filtros en paralelo con la vista inicial
  actualizarPestanas();
  const [rCat, rSedes, rMapa] = await Promise.all([
    apiProgramacion('GET', '/categories'),
    apiProgramacion('GET', '/venues'),
    apiProgramacion('GET', '/map'),
  ]);
  categorias = rCat.ok ? rCat.datos.items ?? [] : [];
  sedes = rSedes.ok ? rSedes.datos.items ?? [] : [];
  // Días con funciones publicadas de la edición activa (los mismos del Mapa, spec 003). Sin ellos, no hay selector.
  dias = rMapa.ok ? rMapa.datos.days ?? [] : [];
  hoyLoja = rMapa.ok ? rMapa.datos.reference?.date ?? null : null;
  pintarRango();
  pintarDias();
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

  // Estado de venta de sus funciones (spec 005). Si no responde, la ficha se muestra igual, sin venta.
  const ids = (r.datos.functions ?? []).map((f) => f.id);
  const venta = new Map();
  if (ids.length) {
    const rv = await apiParticipacion('GET', `/sale-status?functionIds=${ids.map(encodeURIComponent).join(',')}`);
    if (rv.ok) for (const it of rv.datos.items) venta.set(it.functionId, it.state);
  }
  return [volver, renderFicha(r.datos, { venta, alAgregar: (fn) => agregarAlCarrito(fn.id) })];
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
