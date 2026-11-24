// Mapa de sedes (spec 003): pestaña pública /mapa, celular primero.
// Sin cuenta y SIN ubicación: nunca se pide la ubicación del dispositivo ni hay botón «ubicarme» (RNF-05, FR-026).
// Se importa solo al abrir la pestaña, para que la Agenda y las fichas no esperen al mapa (FR-004).
// Con WebGL y sin «reducir movimiento» se muestra la maqueta 3D (mapa-3d.js, Three.js servido desde /vendor porque
// la CSP no permite CDN); si no, la ilustración isométrica con desplazamiento y zoom propios. Marcadores como <button>.
import { h, icono } from './dom.js';
import { apiProgramacion } from './api.js';
import { formatoFecha, formatoFechaCorta, formatoHorarioFuncion, etiquetaTiempo } from './format.js';

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const PASO_TECLADO = 48;

const ESTADOS_ACCESIBILIDAD = {
  confirmed: { texto: 'Confirmado', clase: 'acc-confirmada', icono: 'check' },
  unavailable: { texto: 'No disponible', clase: 'acc-no-disponible', icono: 'cerrar' },
  unconfirmed: { texto: 'Por confirmar', clase: 'acc-por-confirmar', icono: 'aviso' },
};
const CARACTERISTICAS = [
  { clave: 'stepFree', nombre: 'Acceso sin escalones', icono: 'accesible', param: 'sinEscalones', api: 'stepFree' },
  { clave: 'accessibleToilet', nombre: 'Baño accesible', icono: 'bano', param: 'banio', api: 'accessibleToilet' },
];

function direccionDe(s) {
  if (s.kind === 'route') return h('span', {}, s.routeDescription || h('span', { class: 'dato-pendiente' }, 'Recorrido por confirmar'));
  if (s.address) return h('span', {}, s.address);
  return h('span', { class: 'dato-pendiente' }, 'Dirección por confirmar');
}

/** «1 función» o «N funciones» el día consultado. */
const textoFuncionesDia = (n) => `${n} ${n === 1 ? 'función' : 'funciones'} el día consultado`;

/** Ruta con su cadena de consulta, si la hay. */
const conConsulta = (ruta, params) => {
  const qs = params.toString();
  return qs ? `${ruta}?${qs}` : ruta;
};

/** Accesibilidad con icono y texto: nunca solo con color (FR-016). */
function listaAccesibilidad(acc, compacta = false) {
  return h(
    'ul',
    { class: `lista-accesibilidad ${compacta ? 'compacta' : ''}` },
    CARACTERISTICAS.map((c) => {
      const valor = acc?.[c.clave] ?? { status: 'unconfirmed', note: null };
      const estado = ESTADOS_ACCESIBILIDAD[valor.status] ?? ESTADOS_ACCESIBILIDAD.unconfirmed;
      return h(
        'li',
        { class: `item-accesibilidad ${estado.clase}` },
        icono(c.icono, 'icono-xs'),
        h('span', {}, `${c.nombre}: `, h('strong', {}, estado.texto)),
        !compacta && valor.note ? h('span', { class: 'nota-accesibilidad' }, `Observación: ${valor.note}`) : null,
      );
    }),
  );
}

/** ¿Puede este navegador dibujar la maqueta 3D? Se comprueba sin descargar Three.js y se libera el contexto de prueba. */
function hayWebGL() {
  try {
    const contexto = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl');
    contexto?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(contexto);
  } catch {
    return false;
  }
}

/** Nombre comparable: sin tildes, sin mayúsculas y sin espacios sobrantes. */
const normalizarNombre = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .toLowerCase()
    .trim();

const pasoMapa = (numero, nombreIcono, texto) =>
  h('div', { class: 'pasaporte-paso' }, h('span', { class: 'paso-num', 'aria-hidden': 'true' }, numero), icono(nombreIcono, 'icono-xs'), h('span', {}, texto));

/** Vitrina de la cabecera, con el lenguaje del Pasaporte: la maqueta inclinada, anillos dorados y fichas flotantes. */
function vitrinaHeroMapa() {
  const ficha = (clase, nombreIcono, titulo, detalle) =>
    h(
      'div',
      { class: `hero-timbre ${clase}` },
      h('span', { class: 'hero-timbre-icono' }, icono(nombreIcono, 'icono-sm')),
      h('div', { class: 'hero-timbre-textos' }, h('span', { class: 'hero-timbre-titulo' }, titulo), h('span', { class: 'hero-timbre-lugar' }, detalle)),
    );
  return h(
    'div',
    { class: 'hero-pasaporte-arte hero-mapa-arte', 'aria-hidden': 'true' },
    h('div', { class: 'hero-resplandor-solar' }),
    h('div', { class: 'hero-brujula-anillo' }),
    h('div', { class: 'hero-brujula-anillo-interno' }),
    h(
      'div',
      { class: 'hero-pasaporte-centro' },
      h(
        'div',
        { class: 'hero-mapa-tarjeta' },
        h('img', { src: '/img/mapa-loja-centro.svg', alt: '', width: '1600', height: '1000', draggable: 'false' }),
        h('span', { class: 'hero-mapa-faro f1' }, '1'),
        h('span', { class: 'hero-mapa-faro f2' }, '4'),
        h('span', { class: 'hero-mapa-faro f3' }, '7'),
      ),
    ),
    ficha('timbre-1', 'sede', 'Teatro Bolívar', 'Lugar 7'),
    ficha('timbre-2', 'recorrido', 'Desfile inaugural', 'Calle Bolívar'),
    ficha('timbre-3', 'brujula', 'Parque Central', 'Lugar 2'),
  );
}

function cabeceraMapa(zonaReloj) {
  return h(
    'section',
    { class: 'hero-festival hero-pasaporte hero-pasaporte-portada hero-mapa' },
    h(
      'div',
      { class: 'hero-pasaporte-interior' },
      h(
        'div',
        { class: 'hero-contenido' },
        h('p', { class: 'hero-eyebrow' }, h('span', { class: 'hero-eyebrow-punto', 'aria-hidden': 'true' }), 'Festival Internacional de Artes Vivas de Loja'),
        h('h1', { class: 'hero-titulo' }, 'Mapa del ', h('span', { class: 'resalte' }, 'Festival')),
        h('p', { class: 'hero-subtitulo' }, 'Recorre el Circuito Cultural del centro de Loja. No necesitas cuenta y no pedimos tu ubicación.'),
        h(
          'div',
          { class: 'pasaporte-pasos', 'aria-label': 'Cómo usar el mapa' },
          pasoMapa('01', 'sede', 'Elige un lugar del circuito'),
          pasoMapa('02', 'brujula', 'Acerca y explora la maqueta'),
          pasoMapa('03', 'calendario', 'Mira qué hay en cada lugar'),
        ),
        zonaReloj,
      ),
      vitrinaHeroMapa(),
    ),
  );
}

export async function pantallaMapa() {
  const params = new URLSearchParams(location.search);
  const estado = {
    q: params.get('q') ?? '',
    dia: params.get('dia') ?? '',
    sinEscalones: params.get('sinEscalones') === '1',
    banio: params.get('banio') === '1',
    vista: params.get('vista') === 'lista' ? 'lista' : 'mapa',
    sede: params.get('sede') ?? '',
  };

  const pagina = h('div', { class: 'mapa-pagina' });
  const zonaReloj = h('div', { class: 'zona-reloj' });
  const hero = cabeceraMapa(zonaReloj);

  // Datos generales: ilustración vigente, días elegibles y reloj común (RC-07).
  const rDatos = await apiProgramacion('GET', '/map');
  if (!rDatos.ok) {
    pagina.append(
      hero,
      h(
        'div',
        { class: 'hoja-contenido' },
        h(
          'div',
          { class: 'estado-vacio estado-error', role: 'alert' },
          h('h2', {}, 'No pudimos cargar el mapa'),
          h('p', {}, 'La Agenda y las fichas siguen disponibles mientras tanto.'),
          h('a', { href: '/agenda', 'data-enlace': true, class: 'boton' }, 'Ir a la Agenda'),
        ),
      ),
    );
    return pagina;
  }
  const { illustration: ilustracion, days: dias = [], reference } = rDatos.datos;
  // Lugares numerados del Circuito Cultural (orden del mapa oficial).
  const numerosCircuito = new Map((ilustracion.circuit ?? []).map((nombre, i) => [normalizarNombre(nombre), i + 1]));
  const numeroDe = (s) => numerosCircuito.get(normalizarNombre(s.name)) ?? null;
  zonaReloj.replaceChildren(
    h(
      'div',
      { class: 'reloj-referencia' },
      h('span', { class: 'reloj-texto' }, icono('reloj', 'icono-xs'), `Hora de Loja: ${formatoFecha(reference.date)} · ${reference.time}`),
      reference.fixed ? h('span', { class: 'chip-demo-reloj' }, 'Reloj fijado (demo)') : null,
    ),
  );

  const zonaControles = h('section', { class: 'mapa-controles', 'aria-label': 'Buscar y filtrar sedes' });
  const zonaEstado = h('p', { class: 'mapa-estado', 'aria-live': 'polite' });
  const zonaVista = h('div', { class: 'mapa-vista' });
  const zonaSede = h('section', { class: 'panel-sede', 'aria-live': 'polite', 'aria-label': 'Sede seleccionada' });
  zonaSede.hidden = true;

  let sedes = [];
  let consultaId = 0;
  let consultaSede = 0;

  function sincronizarUrl() {
    const p = new URLSearchParams();
    if (estado.q.trim()) p.set('q', estado.q.trim());
    if (estado.dia) p.set('dia', estado.dia);
    if (estado.sinEscalones) p.set('sinEscalones', '1');
    if (estado.banio) p.set('banio', '1');
    if (estado.vista === 'lista') p.set('vista', 'lista');
    if (estado.sede) p.set('sede', estado.sede);
    const qs = p.toString();
    history.replaceState({}, '', qs ? `/mapa?${qs}` : '/mapa');
  }

  // ---------- Controles: búsqueda, filtros y vista ----------

  function pintarControles() {
    const inputBuscar = h('input', {
      id: 'mapa-q',
      type: 'search',
      placeholder: 'Buscar sede',
      value: estado.q,
      autocomplete: 'off',
    });
    let temporizador = null;
    inputBuscar.addEventListener('input', () => {
      estado.q = inputBuscar.value;
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        sincronizarUrl();
        void cargarSedes();
      }, 240);
    });

    const pildora = (texto, activa, alPulsar, nombreIcono) =>
      h(
        'button',
        { type: 'button', class: `pildora ${activa ? 'activa' : ''}`, 'aria-pressed': String(activa), onclick: alPulsar },
        nombreIcono ? icono(nombreIcono, 'icono-xs') : null,
        texto,
      );

    const alternarFiltro = (aplicar) => () => {
      aplicar();
      sincronizarUrl();
      pintarControles();
      void cargarSedes();
    };

    // «Funciones del día»: hoy por defecto en hora de Loja; otros días = días con funciones de la edición (M-05, M-06).
    const opcionesDia = dias.includes(reference.date) ? dias : [reference.date, ...dias].sort((a, b) => a.localeCompare(b));
    const selectDia = h(
      'select',
      {
        id: 'mapa-dia',
        onchange: () => {
          estado.dia = selectDia.value;
          sincronizarUrl();
          void cargarSedes();
        },
      },
      opcionesDia.map((d) =>
        h(
          'option',
          { value: d, selected: d === estado.dia },
          `${d === reference.date ? 'Hoy, ' : ''}${formatoFechaCorta(d)}${dias.includes(d) ? '' : ' (sin funciones)'}`,
        ),
      ),
    );

    const botonVista = (vista, texto, nombreIcono) =>
      h(
        'button',
        {
          type: 'button',
          class: `segmento ${estado.vista === vista ? 'activo' : ''}`,
          'aria-pressed': String(estado.vista === vista),
          onclick: () => {
            if (estado.vista === vista) return;
            estado.vista = vista;
            sincronizarUrl();
            pintarControles();
            pintarVista();
          },
        },
        icono(nombreIcono, 'icono-xs'),
        texto,
      );

    const hijos = [
      h(
        'div',
        { class: 'buscador-caja' },
        h('label', { for: 'mapa-q', class: 'sr-only' }, 'Buscar sede'),
        icono('buscar', 'icono-buscar'),
        inputBuscar,
      ),
      h('p', { class: 'ayuda-buscador' }, 'Busca por nombre de sede. Para buscar una obra o una función, usa la ', h('a', { href: '/agenda', 'data-enlace': true }, 'Agenda'), '.'),
      h(
        'div',
        { class: 'pildoras-scroll', role: 'group', 'aria-label': 'Filtros del mapa' },
        pildora(
          'Funciones del día',
          Boolean(estado.dia),
          alternarFiltro(() => {
            estado.dia = estado.dia ? '' : reference.date;
          }),
          'calendario',
        ),
        CARACTERISTICAS.map((c) =>
          pildora(
            c.nombre,
            estado[c.param],
            alternarFiltro(() => {
              estado[c.param] = !estado[c.param];
            }),
            c.icono,
          ),
        ),
      ),
      estado.dia ? h('div', { class: 'filtro-campo filtro-dia' }, h('label', { for: 'mapa-dia' }, 'Día consultado'), selectDia) : null,
      h('div', { class: 'selector-vista', role: 'group', 'aria-label': 'Forma de ver las sedes' }, botonVista('mapa', 'Mapa', 'mapa'), botonVista('lista', 'Lista', 'lista')),
    ];
    // replaceChildren convierte null en texto: se quitan los vacíos.
    zonaControles.replaceChildren(...hijos.filter(Boolean));
  }

  // ---------- Vista ilustrada con desplazamiento y zoom ----------

  const vista2D = (() => {
    const imagen = h('img', { class: 'mapa-imagen', src: ilustracion.src, alt: '', draggable: 'false', width: ilustracion.width, height: ilustracion.height });
    const capaMarcadores = h('div', { class: 'mapa-marcadores' });
    const lienzo = h('div', { class: 'mapa-lienzo' }, imagen, capaMarcadores);
    const marco = h(
      'div',
      {
        class: 'mapa-marco',
        tabindex: '0',
        role: 'group',
        'aria-roledescription': 'mapa ilustrado',
        'aria-label': 'Mapa ilustrado de sedes. Usa las flechas para desplazarte y las teclas más y menos para acercar o alejar.',
      },
      lienzo,
    );

    // La ilustración cubre el marco (como `object-fit: cover`) y conserva su proporción, así los marcadores,
    // colocados en fracciones de su ancho y alto, siempre caen en su sitio.
    // En pantallas anchas se abre algo acercado sobre el centro (el circuito del festival) para que las sedes no se amontonen.
    const ZOOM_INICIAL = globalThis.matchMedia?.('(min-width: 56rem)').matches ? 1.6 : 1;
    const vista = { zoom: ZOOM_INICIAL, x: 0, y: 0, centrar: true };
    const base = { w: 0, h: 0 };
    const medir = () => {
      const escala = Math.max(marco.clientWidth / ilustracion.width, marco.clientHeight / ilustracion.height);
      base.w = ilustracion.width * escala;
      base.h = ilustracion.height * escala;
      lienzo.style.width = `${base.w}px`;
      lienzo.style.height = `${base.h}px`;
    };
    const limitar = () => {
      vista.x = Math.min(0, Math.max(marco.clientWidth - base.w * vista.zoom, vista.x));
      vista.y = Math.min(0, Math.max(marco.clientHeight - base.h * vista.zoom, vista.y));
    };
    const aplicar = () => {
      medir();
      // Se centra cuando el marco ya tiene tamaño (antes de estar en la página mide 0).
      if (vista.centrar && marco.clientWidth > 0) {
        vista.x = (marco.clientWidth - base.w * vista.zoom) / 2;
        vista.y = (marco.clientHeight - base.h * vista.zoom) / 2;
        vista.centrar = false;
      }
      limitar();
      lienzo.style.transform = `translate(${vista.x}px, ${vista.y}px) scale(${vista.zoom})`;
      lienzo.style.setProperty('--zoom', String(vista.zoom));
      botonAlejar.disabled = vista.zoom <= ZOOM_MIN;
      botonAcercar.disabled = vista.zoom >= ZOOM_MAX;
    };
    const zoomEn = (nuevo, cx = marco.clientWidth / 2, cy = marco.clientHeight / 2) => {
      const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nuevo));
      vista.x = cx - (cx - vista.x) * (z / vista.zoom);
      vista.y = cy - (cy - vista.y) * (z / vista.zoom);
      vista.zoom = z;
      aplicar();
    };

    const botonAcercar = h('button', { type: 'button', class: 'mapa-boton', 'aria-label': 'Acercar', onclick: () => zoomEn(vista.zoom * 1.5) }, icono('mas', 'icono-sm'));
    const botonAlejar = h('button', { type: 'button', class: 'mapa-boton', 'aria-label': 'Alejar', onclick: () => zoomEn(vista.zoom / 1.5) }, icono('menos', 'icono-sm'));
    const botonCentrar = h(
      'button',
      {
        type: 'button',
        class: 'mapa-boton',
        'aria-label': 'Ver todo el mapa',
        onclick: () => {
          vista.zoom = 1;
          vista.centrar = true;
          aplicar();
        },
      },
      icono('centrar', 'icono-sm'),
    );

    // Arrastre y pellizco con pointer events; rueda del ratón; teclado.
    const punteros = new Map();
    let distanciaInicial = 0;
    let zoomInicial = 1;
    let movido = false;
    marco.addEventListener('pointerdown', (e) => {
      movido = false;
      if (e.target.closest('.marcador-sede')) return;
      marco.setPointerCapture(e.pointerId);
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (punteros.size === 2) {
        const [a, b] = [...punteros.values()];
        distanciaInicial = Math.hypot(a.x - b.x, a.y - b.y);
        zoomInicial = vista.zoom;
      }
    });
    marco.addEventListener('pointermove', (e) => {
      const previo = punteros.get(e.pointerId);
      if (!previo) return;
      const actual = { x: e.clientX, y: e.clientY };
      punteros.set(e.pointerId, actual);
      if (punteros.size === 1) {
        const dx = actual.x - previo.x;
        const dy = actual.y - previo.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) movido = true;
        vista.x += dx;
        vista.y += dy;
        aplicar();
      } else if (punteros.size === 2 && distanciaInicial > 0) {
        const [a, b] = [...punteros.values()];
        const caja = marco.getBoundingClientRect();
        movido = true;
        zoomEn(zoomInicial * (Math.hypot(a.x - b.x, a.y - b.y) / distanciaInicial), (a.x + b.x) / 2 - caja.left, (a.y + b.y) / 2 - caja.top);
      }
    });
    const soltar = (e) => {
      punteros.delete(e.pointerId);
      if (punteros.size < 2) distanciaInicial = 0;
    };
    marco.addEventListener('pointerup', soltar);
    marco.addEventListener('pointercancel', soltar);
    marco.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const caja = marco.getBoundingClientRect();
        zoomEn(vista.zoom * Math.exp(-e.deltaY * 0.0015), e.clientX - caja.left, e.clientY - caja.top);
      },
      { passive: false },
    );
    marco.addEventListener('keydown', (e) => {
      if (e.target !== marco) return;
      const movimientos = { ArrowLeft: [PASO_TECLADO, 0], ArrowRight: [-PASO_TECLADO, 0], ArrowUp: [0, PASO_TECLADO], ArrowDown: [0, -PASO_TECLADO] };
      if (movimientos[e.key]) {
        e.preventDefault();
        vista.x += movimientos[e.key][0];
        vista.y += movimientos[e.key][1];
        aplicar();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomEn(vista.zoom * 1.5);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomEn(vista.zoom / 1.5);
      } else if (e.key === '0') {
        e.preventDefault();
        botonCentrar.click();
      }
    });
    new ResizeObserver(() => aplicar()).observe(marco);

    const sinMarcador = h('p', { class: 'mapa-sin-marcador' });
    const contenedor = h(
      'div',
      { class: 'mapa-contenedor' },
      marco,
      h('div', { class: 'mapa-botones', role: 'group', 'aria-label': 'Zoom del mapa' }, botonAcercar, botonAlejar, botonCentrar),
      ilustracion.provisional ? h('p', { class: 'mapa-provisional' }, icono('aviso', 'icono-xs'), 'Ilustración provisional: no es el plano de Loja') : null,
      !ilustracion.provisional && ilustracion.credit ? h('p', { class: 'mapa-credito' }, ilustracion.credit) : null,
    );

    return {
      elemento: h('div', { class: 'mapa-ilustrado' }, contenedor, sinMarcador),
      pintar(lista) {
        const conMarcador = lista.filter((s) => s.marker);
        capaMarcadores.replaceChildren(
          ...conMarcador.map((s) => {
            const boton = h(
              'button',
              {
                type: 'button',
                class: `marcador-sede ${s.id === estado.sede ? 'activo' : ''}`,
                'aria-pressed': String(s.id === estado.sede),
                'aria-label': [numeroDe(s) ? `Lugar ${numeroDe(s)}: ${s.name}` : s.name, s.dayFunctionCount ? textoFuncionesDia(s.dayFunctionCount) : null]
                  .filter(Boolean)
                  .join(', '),
                onclick: () => {
                  if (movido) return;
                  void abrirSede(s.id);
                },
              },
              numeroDe(s) ? h('span', { class: 'marcador-numero' }, String(numeroDe(s))) : icono(s.kind === 'route' ? 'recorrido' : 'sede', 'icono-sm'),
              h('span', { class: 'marcador-nombre' }, s.name),
            );
            boton.style.left = `${s.marker.x * 100}%`;
            boton.style.top = `${s.marker.y * 100}%`;
            return boton;
          }),
        );
        const faltan = lista.length - conMarcador.length;
        sinMarcador.replaceChildren(
          ...(faltan > 0
            ? [
                `${faltan} ${faltan === 1 ? 'sede no tiene' : 'sedes no tienen'} marcador en la ilustración. `,
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'enlace-boton',
                    onclick: () => {
                      estado.vista = 'lista';
                      sincronizarUrl();
                      pintarControles();
                      pintarVista();
                    },
                  },
                  'Ver todas en la lista',
                ),
              ]
            : []),
        );
        requestAnimationFrame(aplicar);
      },
    };
  })();

  // ---------- Maqueta 3D (Three.js) con la ilustración isométrica como respaldo ----------

  const quiere3D = !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches && hayWebGL();
  let vistaMapa = quiere3D ? crearVista3D() : vista2D;

  function crearVista3D() {
    const capa = h('div', { class: 'mapa-3d-marcadores' });
    const aviso = h('p', { class: 'mapa-3d-cargando' }, 'Preparando la maqueta 3D…');
    const marco = h(
      'div',
      {
        class: 'mapa-marco mapa-marco-3d',
        tabindex: '0',
        role: 'group',
        'aria-roledescription': 'mapa 3D',
        'aria-label': 'Maqueta 3D del centro de Loja. Arrastra para girar, usa la rueda o los botones para acercar y las flechas para desplazarte. Cada lugar numerado es un botón.',
      },
      capa,
      aviso,
    );
    let api = null;
    let ultima = null;
    const boton = (etiqueta, nombreIcono, accion) =>
      h('button', { type: 'button', class: 'mapa-boton', 'aria-label': etiqueta, onclick: () => api?.[accion]() }, icono(nombreIcono, 'icono-sm'));
    const TECLAS = { '+': 'acercar', '=': 'acercar', '-': 'alejar', _: 'alejar', 0: 'centrar' };
    marco.addEventListener('keydown', (e) => {
      if (!api || e.target !== marco || !TECLAS[e.key]) return;
      e.preventDefault();
      api[TECLAS[e.key]]();
    });
    import('./mapa-3d.js')
      .then(({ crearMapa3D }) => {
        api = crearMapa3D({ marco, capa, numeroDe, alElegir: (id) => void abrirSede(id) });
        aviso.remove();
        if (ultima) api.pintar(ultima, estado.sede);
      })
      .catch(() => {
        // Sin 3D (WebGL bloqueado o error al cargar): se usa la ilustración isométrica.
        vistaMapa = vista2D;
        if (estado.vista === 'mapa') pintarVista();
      });
    const contenedor = h(
      'div',
      { class: 'mapa-contenedor' },
      marco,
      h(
        'div',
        { class: 'mapa-botones', role: 'group', 'aria-label': 'Zoom del mapa' },
        boton('Acercar', 'mas', 'acercar'),
        boton('Alejar', 'menos', 'alejar'),
        boton('Volver a la vista inicial', 'centrar', 'centrar'),
      ),
      h('p', { class: 'mapa-3d-leyenda' }, h('span', { class: 'leyenda-desfile', 'aria-hidden': 'true' }), 'Desfile de inauguración por la calle Bolívar'),
    );
    return {
      elemento: h('div', { class: 'mapa-ilustrado mapa-ilustrado-3d' }, contenedor, ilustracion.credit ? h('p', { class: 'mapa-credito' }, ilustracion.credit) : null),
      pintar(lista) {
        ultima = lista;
        api?.pintar(lista, estado.sede);
      },
    };
  }

  /** Lista numerada de los lugares del Circuito Cultural, bajo el mapa. */
  function listaCircuito(lista) {
    const lugares = lista
      .map((s) => ({ s, n: numeroDe(s) }))
      .filter((x) => x.n)
      .sort((a, b) => a.n - b.n);
    if (!lugares.length) return null;
    return h(
      'section',
      { class: 'circuito-lugares', 'aria-labelledby': 'titulo-circuito' },
      h('h2', { id: 'titulo-circuito', class: 'circuito-titulo' }, 'Circuito Cultural'),
      h(
        'ol',
        { class: 'circuito-lista' },
        lugares.map(({ s, n }) =>
          h(
            'li',
            {},
            h(
              'button',
              { type: 'button', class: `circuito-lugar ${s.id === estado.sede ? 'activo' : ''}`, 'aria-pressed': String(s.id === estado.sede), onclick: () => void abrirSede(s.id) },
              h('span', { class: 'circuito-numero', 'aria-hidden': 'true' }, String(n)),
              h('span', { class: 'circuito-nombre' }, s.name),
            ),
          ),
        ),
      ),
    );
  }


  // ---------- Lista equivalente (FR-015, FR-016) ----------

  function vistaLista(lista) {
    return h(
      'ul',
      { class: 'lista-sedes' },
      lista.map((s) =>
        h(
          'li',
          {},
          h(
            'button',
            {
              type: 'button',
              class: `fila-sede ${s.id === estado.sede ? 'activa' : ''}`,
              'aria-pressed': String(s.id === estado.sede),
              onclick: () => void abrirSede(s.id),
            },
            h('span', { class: 'fila-sede-icono' }, icono(s.kind === 'route' ? 'recorrido' : 'sede', 'icono-sm')),
            h(
              'span',
              { class: 'fila-sede-texto' },
              h('span', { class: 'fila-sede-nombre' }, s.name, s.kind === 'route' ? h('span', { class: 'chip-sutil' }, 'Recorrido') : null),
              h('span', { class: 'fila-sede-direccion' }, direccionDe(s)),
              s.dayFunctionCount ? h('span', { class: 'fila-sede-funciones' }, textoFuncionesDia(s.dayFunctionCount)) : null,
              listaAccesibilidad(s.accessibility, true),
            ),
          ),
        ),
      ),
    );
  }

  function pintarVista() {
    if (estado.vista === 'lista') {
      zonaVista.replaceChildren(sedes.length ? vistaLista(sedes) : estadoSinSedes());
    } else {
      zonaVista.replaceChildren(...[vistaMapa.elemento, listaCircuito(sedes)].filter(Boolean));
      vistaMapa.pintar(sedes);
    }
  }

  function estadoSinSedes() {
    const filtros = estado.q.trim() || estado.dia || estado.sinEscalones || estado.banio;
    return h(
      'div',
      { class: 'estado-vacio' },
      h('h2', {}, filtros ? 'Sin resultados' : 'Aún no hay sedes registradas'),
      h('p', {}, filtros ? 'Ninguna sede cumple con la búsqueda o los filtros elegidos.' : 'Cuando el equipo registre las sedes de la programación aparecerán aquí.'),
    );
  }

  // ---------- Carga de sedes ----------

  async function cargarSedes() {
    const id = ++consultaId;
    const p = new URLSearchParams();
    if (estado.q.trim()) p.set('q', estado.q.trim());
    if (estado.dia) p.set('day', estado.dia);
    for (const c of CARACTERISTICAS) if (estado[c.param]) p.set(c.api, 'true');
    const r = await apiProgramacion('GET', conConsulta('/map/venues', p));
    if (id !== consultaId) return;
    if (!r.ok) {
      zonaEstado.replaceChildren();
      zonaVista.replaceChildren(
        h(
          'div',
          { class: 'estado-vacio estado-error' },
          h('h2', {}, 'No pudimos cargar las sedes'),
          h('p', {}, r.datos?.message ?? 'Inténtalo nuevamente en unos segundos.'),
          h('button', { type: 'button', onclick: cargarSedes }, 'Reintentar'),
        ),
      );
      return;
    }
    sedes = r.datos.items ?? [];
    const avisoDiaSinFunciones = dias.length ? ' · Ese día no hay funciones publicadas. Elige otro día de la edición.' : ' · Ese día no hay funciones publicadas.';
    const partes = [`${sedes.length} ${sedes.length === 1 ? 'sede' : 'sedes'}`];
    if (estado.dia) partes.push(`con funciones el ${formatoFecha(estado.dia)}`);
    zonaEstado.replaceChildren(
      ...[
        partes.join(' '),
        estado.dia && r.datos.dayHasFunctions === false ? h('span', { class: 'aviso-dia' }, avisoDiaSinFunciones) : null,
      ].filter(Boolean),
    );
    pintarVista();
    if (estado.sede) void abrirSede(estado.sede, false);
  }

  // ---------- Tarjeta de sede (FR-011 a FR-013, FR-025) ----------

  function cerrarSede() {
    estado.sede = '';
    zonaSede.hidden = true;
    zonaSede.replaceChildren();
    sincronizarUrl();
    pintarVista();
  }

  async function abrirSede(id, enfocar = true) {
    const consulta = ++consultaSede;
    if (estado.sede !== id) {
      estado.sede = id;
      sincronizarUrl();
      pintarVista();
    }
    zonaSede.hidden = false;
    zonaSede.replaceChildren(h('p', { class: 'cargando' }, 'Cargando la sede…'));
    const r = await apiProgramacion('GET', conConsulta(`/map/venues/${encodeURIComponent(id)}`, new URLSearchParams(estado.dia ? { day: estado.dia } : {})));
    if (consulta !== consultaSede) return;
    if (!r.ok) {
      zonaSede.replaceChildren(
        h('div', { class: 'estado-vacio estado-error' }, h('h2', {}, 'No encontramos esta sede'), h('p', {}, r.datos?.message ?? 'Puede que ya no esté registrada.')),
      );
      return;
    }
    const s = r.datos;
    const textoSinFunciones = estado.dia ? 'Esta sede no tiene funciones ese día.' : 'No hay funciones próximas en esta sede.';
    const titulo = h('h2', { class: 'panel-sede-titulo', tabindex: '-1' }, s.name);
    const funciones = s.functions ?? [];

    zonaSede.replaceChildren(
      h(
        'article',
        { class: 'tarjeta-sede' },
        s.photo
          ? h(
              'figure',
              { class: 'foto-sede' },
              h('img', { src: s.photo.url, alt: s.photo.alt, loading: 'lazy' }),
              h('figcaption', {}, `Foto: ${s.photo.credit}`),
            )
          : null,
        h(
          'div',
          { class: 'tarjeta-sede-cuerpo' },
          h(
            'div',
            { class: 'tarjeta-sede-cabecera' },
            titulo,
            h('button', { type: 'button', class: 'boton-cerrar-sede', 'aria-label': 'Cerrar la sede', onclick: cerrarSede }, icono('cerrar', 'icono-sm')),
          ),
          s.kind === 'route' ? h('span', { class: 'chip-sutil' }, icono('recorrido', 'icono-xs'), 'Recorrido') : null,
          h('p', { class: 'meta-item direccion-sede' }, icono('sede', 'icono-xs'), direccionDe(s)),
          h('h3', { class: 'subtitulo-sede' }, 'Accesibilidad'),
          listaAccesibilidad(s.accessibility),
          s.directionsUrl
            ? h(
                'a',
                { href: s.directionsUrl, target: '_blank', rel: 'noopener noreferrer', class: 'boton boton-como-llegar' },
                icono('externo', 'icono-sm'),
                'Cómo llegar',
                h('span', { class: 'sr-only' }, ' (abre Google Maps en otra pestaña)'),
              )
            : null,
          h('h3', { class: 'subtitulo-sede' }, estado.dia ? `Funciones del ${formatoFecha(estado.dia)}` : 'Funciones desde hoy'),
          funciones.length
            ? h(
                'ul',
                { class: 'funciones-sede' },
                funciones.map((f) => {
                  const tiempo = etiquetaTiempo(f.status === 'cancelled' ? 'cancelled' : f.timeStatus);
                  return h(
                    'li',
                    {},
                    h(
                      'a',
                      { href: `/actividad/${encodeURIComponent(f.activityId)}`, 'data-enlace': true, class: `funcion-sede ${f.status === 'cancelled' ? 'cancelada' : ''}` },
                      h('span', { class: 'funcion-sede-titulo' }, f.title),
                      h('span', { class: 'funcion-sede-hora' }, icono('calendario', 'icono-xs'), `${formatoFechaCorta(f.date)} · ${formatoHorarioFuncion(f)}`),
                      tiempo ? h('span', { class: `insignia-estado ${tiempo.clase}` }, tiempo.texto) : null,
                    ),
                  );
                }),
              )
            : h('p', { class: 'sin-funciones' }, textoSinFunciones),
        ),
      ),
    );
    if (enfocar) {
      titulo.focus({ preventScroll: true });
      zonaSede.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // ---------- Montaje ----------

  if (estado.dia && !/^\d{4}-\d{2}-\d{2}$/.test(estado.dia)) estado.dia = '';
  pagina.append(
    hero,
    h('div', { class: 'hoja-contenido' }, zonaControles, zonaEstado, h('div', { class: 'mapa-cuerpo' }, zonaVista, zonaSede)),
  );
  pintarControles();
  await cargarSedes();
  return pagina;
}
