// Pasaporte Vivo (spec 006): Mi pasaporte (/pasaporte), detalle de un sello (/pasaporte/sello/{id}) y canje
// (/pasaporte/canje/{ref}). Celular primero. Sin meta global, porcentaje ni casillero bloqueado (M-01).
// El texto del sello siempre es texto (textContent), nunca HTML (M-12). Sin ubicación del dispositivo.
import { h, icono } from './dom.js';
import { apiParticipacion, apiIdentidad } from './api.js';
import { formatoFecha, formatoFechaCorta, formatoFechaHoraIso, partesFecha } from './format.js';

function resaltarTitulo(titulo) {
  if (titulo === 'Pasaporte Vivo') return ['Pasaporte ', h('span', { class: 'resalte' }, 'Vivo')];
  if (titulo === 'Ruta cultural') return ['Ruta ', h('span', { class: 'resalte' }, 'cultural')];
  if (titulo === 'Tu sello') return ['Tu ', h('span', { class: 'resalte' }, 'sello')];
  if (titulo === 'Reclamar sello') return ['Reclamar ', h('span', { class: 'resalte' }, 'sello')];
  return [titulo];
}

function libretaIlustrada() {
  const hojaInterior = (clase, iconoSello, codigo) =>
    h(
      'div',
      { class: `libreta-hoja ${clase}` },
      h('span', { class: 'libreta-hoja-cabecera' }, codigo),
      h('span', { class: 'libreta-hoja-sello' }, icono(iconoSello, 'icono-xs')),
      h('span', { class: 'libreta-hoja-linea l1' }),
      h('span', { class: 'libreta-hoja-linea l2' }),
      h('span', { class: 'libreta-hoja-linea l3' }),
    );

  return h(
    'div',
    { class: 'pasaporte-libreta', 'aria-hidden': 'true' },
    hojaInterior('libreta-hoja-atras', 'musica', 'VISA · 01'),
    hojaInterior('libreta-hoja-medio', 'teatro', 'SELLO · 02'),
    h(
      'div',
      { class: 'libreta-tapa' },
      h('span', { class: 'libreta-lomo' }),
      h('span', { class: 'libreta-marca' }, 'VIVART'),
      h('span', { class: 'libreta-sub' }, 'Pasaporte Vivo'),
      h('div', { class: 'libreta-emblema' }, icono('pasaporte', 'icono-libreta')),
      h('span', { class: 'libreta-ciudad' }, 'Loja · Artes Vivas'),
      h('span', { class: 'libreta-sello-dorado' }, icono('estrella', 'icono-xs')),
    ),
  );
}

/** Composición visual propia del encabezado de Pasaporte Vivo: escenario tridimensional con libreta, órbita dorada, matasellos y timbres postales. */
function vitrinaHeroPasaporte() {
  const timbre = (clase, nombreIcono, titulo, lugar) =>
    h(
      'div',
      { class: `hero-timbre ${clase}` },
      h('span', { class: 'hero-timbre-icono' }, icono(nombreIcono, 'icono-sm')),
      h(
        'div',
        { class: 'hero-timbre-textos' },
        h('span', { class: 'hero-timbre-titulo' }, titulo),
        h('span', { class: 'hero-timbre-lugar' }, lugar),
      ),
    );

  return h(
    'div',
    { class: 'hero-pasaporte-arte', 'aria-hidden': 'true' },
    h('div', { class: 'hero-resplandor-solar' }),
    h('div', { class: 'hero-brujula-anillo' }),
    h('div', { class: 'hero-brujula-anillo-interno' }),
    h(
      'div',
      { class: 'hero-pasaporte-centro' },
      libretaIlustrada(),
      h(
        'div',
        { class: 'hero-matasellos' },
        h('span', { class: 'matasellos-arriba' }, 'FESTIVAL · ARTES VIVAS'),
        h('div', { class: 'matasellos-centro' }, icono('artes-vivas', 'icono-matasellos')),
        h('span', { class: 'matasellos-abajo' }, 'LOJA · 2026'),
      ),
    ),
    timbre('timbre-1', 'teatro', 'Artes Escénicas', 'QR · Sede'),
    timbre('timbre-2', 'musica', 'Música en Vivo', 'Sello oficial'),
    timbre('timbre-3', 'estrella', 'Insignias FIAVL', 'Rutas culturales'),
  );
}

const cabecera = (titulo, subtitulo, conArte = false) =>
  h(
    'section',
    { class: `hero-festival hero-pasaporte ${conArte ? 'hero-pasaporte-portada' : ''}` },
    h(
      'div',
      { class: 'hero-pasaporte-interior' },
      h(
        'div',
        { class: 'hero-contenido' },
        h(
          'p',
          { class: 'hero-eyebrow' },
          h('span', { class: 'hero-eyebrow-punto', 'aria-hidden': 'true' }),
          'Festival Internacional de Artes Vivas de Loja',
        ),
        h('h1', { class: 'hero-titulo' }, ...resaltarTitulo(titulo)),
        subtitulo ? h('p', { class: 'hero-subtitulo' }, subtitulo) : null,
        conArte
          ? h(
              'div',
              { class: 'pasaporte-pasos', 'aria-label': 'Cómo funciona el Pasaporte Vivo' },
              h(
                'div',
                { class: 'pasaporte-paso' },
                h('span', { class: 'paso-num', 'aria-hidden': 'true' }, '01'),
                icono('camara', 'icono-xs'),
                h('span', {}, 'Escanea el QR en la sede'),
              ),
              h(
                'div',
                { class: 'pasaporte-paso' },
                h('span', { class: 'paso-num', 'aria-hidden': 'true' }, '02'),
                icono('pasaporte', 'icono-xs'),
                h('span', {}, 'Colecciona tu sello'),
              ),
              h(
                'div',
                { class: 'pasaporte-paso' },
                h('span', { class: 'paso-num', 'aria-hidden': 'true' }, '03'),
                icono('estrella', 'icono-xs'),
                h('span', {}, 'Completa rutas e insignias'),
              ),
            )
          : null,
      ),
      conArte ? vitrinaHeroPasaporte() : null,
    ),
  );

const textoSellos = (n) => `${n} ${n === 1 ? 'sello' : 'sellos'}`;

/** Apartado de insignias obtenidas (spec 007, US3). */
function seccionInsignias(insignias) {
  if (!insignias || insignias.length === 0) return null;
  return h(
    'section',
    { class: 'pila seccion-insignias' },
    h(
      'div',
      { class: 'seccion-encabezado' },
      h('p', { class: 'eyebrow' }, 'Logros desbloqueados'),
      h('h2', { class: 'titulo-seccion' }, icono('estrella', 'icono-sm'), 'Mis ', h('span', { class: 'resalte' }, 'insignias')),
    ),
    h(
      'ul',
      { class: 'rejilla-insignias' },
      insignias.map((ins) =>
        h(
          'li',
          { class: 'item-insignia' },
          h(
            'div',
            { class: `insignia-plantilla insignia-ganada-card insignia-color-${ins.color ?? 'violeta'}` },
            h('div', { class: 'insignia-emblema' }, icono(ins.icon ?? 'estrella', 'icono-insignia')),
            h(
              'div',
              { class: 'insignia-datos' },
              h('span', { class: 'insignia-cinta-oro', 'aria-hidden': 'true' }, icono('estrella', 'icono-xs'), ' Insignia oficial'),
              h('h3', { class: 'insignia-titulo' }, ins.title),
              h('p', { class: 'insignia-desc' }, ins.description),
              h('span', { class: 'insignia-fecha' }, icono('check', 'icono-xs'), ` Obtenida el ${formatoFechaHoraIso(ins.unlockedAt)}`),
            ),
          ),
        ),
      ),
    ),
  );
}

/** Tarjeta de ruta cultural en la lista pública (spec 007, US1). */
function tarjetaRuta(rt) {
  return h(
    'li',
    { class: 'tarjeta-ruta-item' },
    h(
      'a',
      { href: `/pasaporte/ruta/${encodeURIComponent(rt.id)}`, 'data-enlace': true, class: 'tarjeta-ruta-enlace' },
      h(
        'div',
        { class: `insignia-plantilla insignia-color-${rt.badge?.color ?? 'violeta'}` },
        h('span', { class: 'portada-patron', 'aria-hidden': 'true' }),
        h('span', { class: 'tarjeta-agenda-flecha', 'aria-hidden': 'true' }, '↗'),
        h('div', { class: 'insignia-emblema' }, icono(rt.badge?.icon ?? 'teatro', 'icono-insignia')),
        h(
          'div',
          { class: 'insignia-datos' },
          h('span', { class: 'ruta-card-eyebrow' }, `Insignia · ${rt.badge?.title ?? 'Ruta cultural'}`),
          h('h3', { class: 'insignia-titulo' }, rt.title),
          h('p', { class: 'insignia-desc' }, rt.description),
        ),
      ),
      h(
        'div',
        { class: 'tarjeta-ruta-pie' },
        rt.inReview
          ? h('span', { class: 'insignia-estado estado-cancelada' }, 'Ruta en revisión')
          : null,
        rt.progress
          ? h(
              'span',
              { class: `ruta-progreso-texto ${rt.progress.completed ? 'progreso-completo' : ''}` },
              rt.progress.unlockedBadge
                ? `¡Insignia obtenida! (${rt.progress.formatted})`
                : `Progreso: ${rt.progress.formatted}`,
            )
          : h('span', { class: 'ruta-meta-texto' }, icono('pasaporte', 'icono-xs'), `Meta: ${rt.goal} ${rt.goal === 1 ? 'sello' : 'sellos'}`),
        h('span', { class: 'enlace-accion' }, 'Ver recorrido →'),
      ),
    ),
  );
}

/** Rutas culturales públicas (spec 007, US1). */
async function seccionRutas() {
  const r = await apiParticipacion('GET', '/passport/routes');
  const rutas = r.ok ? r.datos.items ?? [] : [];
  const encabezado = h(
    'div',
    { class: 'seccion-encabezado' },
    h('p', { class: 'eyebrow' }, 'Recorridos temáticos por Loja'),
    h('h2', { class: 'titulo-seccion' }, icono('recorrido', 'icono-sm'), 'Rutas ', h('span', { class: 'resalte' }, 'culturales')),
    h('p', { class: 'ayuda' }, 'Explora propuestas artísticas y reúne los sellos de cada recorrido para desbloquear su insignia.'),
  );
  if (rutas.length === 0) {
    return h(
      'section',
      { class: 'pila seccion-rutas-bloque' },
      encabezado,
      h(
        'div',
        { class: 'pasaporte-rutas-vacio' },
        h('div', { class: 'rutas-vacio-icono', 'aria-hidden': 'true' }, icono('brujula', 'icono-insignia')),
        h(
          'div',
          { class: 'rutas-vacio-texto' },
          h('h3', {}, 'Aún no hay rutas culturales publicadas.'),
          h('p', { class: 'ayuda' }, 'Cuando el equipo publique recorridos temáticos del festival, aparecerán aquí con sus funciones elegibles e insignias.'),
        ),
        h('a', { href: '/agenda', 'data-enlace': true, class: 'boton secundario boton-sm' }, icono('calendario', 'icono-xs'), 'Explorar la Agenda'),
      ),
    );
  }
  return h(
    'section',
    { class: 'pila seccion-rutas-bloque' },
    encabezado,
    h('ul', { class: 'rejilla-rutas' }, rutas.map(tarjetaRuta)),
  );
}

/** Emblema de la plantilla común de VIVART: el sello siempre se muestra, aunque no tenga imagen ni texto (FR-022). */
function emblema(s, grande = false) {
  if (s.content?.image) {
    return h('img', { class: `sello-imagen ${grande ? 'grande' : ''}`, src: s.content.image.url, alt: s.content.image.alt, loading: 'lazy' });
  }
  return h(
    'div',
    { class: `sello-plantilla ${grande ? 'grande' : ''}`, 'aria-hidden': 'true' },
    h('span', { class: 'portada-patron' }),
    h('span', { class: 'sello-plantilla-marca' }, 'VIVART'),
    icono('estrella', 'icono-sello'),
  );
}

const cancelada = (s) => s.functionStatus === 'cancelled';

/** «dom, 22 nov 2026 · 17:00», o lo que se sepa. */
function fechaDelSello(s) {
  if (!s.date) return 'Fecha sin confirmar';
  return s.startTime ? `${formatoFecha(s.date)} · ${s.startTime}` : formatoFecha(s.date);
}

/** Aviso de cancelación o de cambio de la función, si lo hay. */
function avisoDelSello(s) {
  if (!cancelada(s) && !s.notice) return null;
  const clase = cancelada(s) ? 'error-caja' : 'alerta-caja';
  const etiqueta = cancelada(s) ? 'Función cancelada. ' : 'Aviso: ';
  return h('p', { class: `aviso ${clase}` }, h('strong', {}, etiqueta), s.notice?.text ?? 'Tu sello se conserva.');
}

function tarjetaSello(s) {
  return h(
    'li',
    { class: 'item-sello' },
    h(
      'a',
      { href: `/pasaporte/sello/${encodeURIComponent(s.id)}`, 'data-enlace': true, class: 'tarjeta-sello' },
      h('span', { class: 'tarjeta-agenda-flecha', 'aria-hidden': 'true' }, '↗'),
      emblema(s),
      h('span', { class: 'tarjeta-sello-titulo' }, s.title ?? 'Función sin confirmar'),
      h('span', { class: 'tarjeta-sello-fecha' }, s.date ? formatoFechaCorta(s.date) : 'Fecha sin confirmar'),
      cancelada(s) ? h('span', { class: 'insignia-estado estado-cancelada' }, 'Función cancelada') : null,
    ),
  );
}

const SELLOS_POR_PAGINA = 4;

/** Parte los sellos en hojas de visado de hasta 4 sellos cada una (siempre al menos 1 hoja). */
function partirSellosEnPaginas(items) {
  if (!items || items.length === 0) return [[]];
  const paginas = [];
  for (let i = 0; i < items.length; i += SELLOS_POR_PAGINA) {
    paginas.push(items.slice(i, i + SELLOS_POR_PAGINA));
  }
  return paginas;
}

/**
 * Construye el librito abierto del Pasaporte Vivo:
 * - En escritorio (>= 56rem): el libro está limpio a doble página (sin botones externos).
 * - En celular (< 56rem): muestra una página a la vez y el cambio de hoja está integrado
 *   discretamente en el pie interno de la propia hoja de papel (además de permitir deslizar con el dedo).
 */
function construirCuadernoPasaporte({ hojaIdentidad, hojasVisados }) {
  const totalMovil = 1 + hojasVisados.length;
  let indiceMovil = 0;
  let indiceVisado = 0;

  const contenedorCubierta = h(
    'div',
    { class: 'pasaporte-libro-cubierta', 'data-pagina-movil': '0' },
    hojaIdentidad,
    h('div', { class: 'pasaporte-lomo-central', 'aria-hidden': 'true' }, h('span', { class: 'pasaporte-costura' })),
    ...hojasVisados,
  );

  // Enlace discreto en el pie de cada página para pasar de hoja en celular (como al hojear una libreta)
  const pieHojaIzq = h(
    'div',
    { class: 'pasaporte-pie-hoja-movil' },
    h('span', { class: 'pasaporte-pie-indicador' }, `Hoja 1 de ${totalMovil}`),
    h(
      'button',
      { type: 'button', class: 'pasaporte-enlace-hoja', onclick: () => irAPaginaMovil(1) },
      'Hojear sellos · Pág. 02 →',
    ),
  );
  hojaIdentidad.append(pieHojaIzq);

  hojasVisados.forEach((hojaNode, idx) => {
    const numActual = idx + 2;
    const pieHojaDer = h(
      'div',
      { class: 'pasaporte-pie-hoja-movil' },
      h(
        'button',
        { type: 'button', class: 'pasaporte-enlace-hoja', onclick: () => irAPaginaMovil(idx) },
        idx === 0 ? '← Pág. 01 · Titular' : `← Pág. ${String(numActual - 1).padStart(2, '0')}`,
      ),
      h('span', { class: 'pasaporte-pie-indicador' }, `Hoja ${numActual} de ${totalMovil}`),
      idx + 1 < hojasVisados.length
        ? h(
            'button',
            { type: 'button', class: 'pasaporte-enlace-hoja', onclick: () => irAPaginaMovil(idx + 2) },
            `Pág. ${String(numActual + 1).padStart(2, '0')} →`,
          )
        : null,
    );
    hojaNode.append(pieHojaDer);
  });

  function sincronizarVista(direccion = 'adelante') {
    contenedorCubierta.setAttribute('data-pagina-movil', String(indiceMovil));
    contenedorCubierta.setAttribute('data-direccion', direccion);

    hojaIdentidad.classList.toggle('activa-movil', indiceMovil === 0);
    hojasVisados.forEach((hojaNode, idx) => {
      hojaNode.classList.toggle('activa-movil', indiceMovil === idx + 1);
      hojaNode.classList.toggle('activa-escritorio', indiceVisado === idx);
    });
  }

  function irAPaginaMovil(nuevo) {
    if (nuevo < 0 || nuevo >= totalMovil || nuevo === indiceMovil) return;
    const dir = nuevo > indiceMovil ? 'adelante' : 'atras';
    indiceMovil = nuevo;
    if (nuevo >= 1) indiceVisado = nuevo - 1;
    sincronizarVista(dir);
  }

  // Soporte táctil para deslizar el dedo horizontalmente (swipe) y pasar la página en celular
  let touchX = null;
  let touchY = null;
  contenedorCubierta.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length === 1) {
        touchX = e.touches[0].clientX;
        touchY = e.touches[0].clientY;
      }
    },
    { passive: true },
  );
  contenedorCubierta.addEventListener(
    'touchend',
    (e) => {
      if (touchX === null || touchY === null || e.changedTouches.length === 0) return;
      const dx = e.changedTouches[0].clientX - touchX;
      const dy = e.changedTouches[0].clientY - touchY;
      touchX = null;
      touchY = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        if (dx < 0) irAPaginaMovil(indiceMovil + 1);
        else irAPaginaMovil(indiceMovil - 1);
      }
    },
    { passive: true },
  );

  sincronizarVista('adelante');

  return h('div', { class: 'pasaporte-libro' }, contenedorCubierta);
}

export async function pantallaPasaporte({ persona }) {
  const pagina = h('div', { class: 'pasaporte-pagina' });
  const hoja = h('div', { class: 'hoja-contenido' });
  pagina.append(cabecera('Pasaporte Vivo', 'Colecciona un sello en cada función: escanea el QR del Pasaporte en la sede.', true), hoja);

  if (!persona) {
    const hojaIzqInv = h(
      'div',
      { class: 'pasaporte-hoja pasaporte-hoja-izq' },
      h('span', { class: 'pasaporte-marca-agua', 'aria-hidden': 'true' }, icono('artes-vivas', 'icono-agua')),
      h(
        'div',
        { class: 'pasaporte-hoja-top' },
        h('div', { class: 'pasaporte-escudo', 'aria-hidden': 'true' }, icono('pasaporte', 'icono-escudo')),
        h('span', { class: 'pasaporte-pagina-num', 'aria-hidden': 'true' }, 'PÁG. 01'),
      ),
      h('p', { class: 'pasaporte-documento-tipo' }, 'Festival Internacional de Artes Vivas'),
      h('h2', { class: 'titulo-seccion pasaporte-libro-titulo' }, 'Mi ', h('span', { class: 'resalte' }, 'pasaporte')),
      h(
        'dl',
        { class: 'pasaporte-campos' },
        h('div', { class: 'pasaporte-campo' }, h('dt', {}, 'Titular'), h('dd', {}, 'Visitante sin sesión')),
        h('div', { class: 'pasaporte-campo' }, h('dt', {}, 'Sede emisora'), h('dd', {}, 'Loja · Ecuador')),
        h('div', { class: 'pasaporte-campo' }, h('dt', {}, 'Edición'), h('dd', {}, 'VIVART · Artes Vivas')),
      ),
      h('p', { class: 'pasaporte-mrz', 'aria-hidden': 'true' }, 'P<ECUVIVART<<PASAPORTE<VIVO<LOJA<<<<<<<<<<<<'),
    );

    const hojaDerInv = h(
      'div',
      { class: 'pasaporte-hoja pasaporte-hoja-der' },
      h('span', { class: 'pasaporte-esquina-doblez', 'aria-hidden': 'true' }),
      h(
        'div',
        { class: 'pasaporte-visas-cabecera' },
        h('span', { class: 'pasaporte-visas-titulo' }, 'Visados y sellos culturales'),
        h('span', { class: 'pasaporte-pagina-num', 'aria-hidden': 'true' }, 'PÁG. 02'),
      ),
      h(
        'div',
        { class: 'pasaporte-invitado-cuerpo' },
        libretaIlustrada(),
        h(
          'div',
          { class: 'pasaporte-invitado-texto' },
          h('p', { class: 'eyebrow' }, 'Abre tu libreta personal'),
          h('p', { class: 'pasaporte-banner-desc' }, 'Ingresa con tu cuenta para ver tus sellos y registrar tu progreso.'),
          h(
            'div',
            { class: 'acciones-fila' },
            h('a', { href: '/ingresar', 'data-enlace': true, class: 'boton' }, 'Ingresar'),
            h('a', { href: '/registro', 'data-enlace': true, class: 'boton secundario' }, 'Crear cuenta'),
          ),
        ),
      ),
    );

    hoja.append(
      construirCuadernoPasaporte({ hojaIdentidad: hojaIzqInv, hojasVisados: [hojaDerInv] }),
      await seccionRutas(),
    );
    return pagina;
  }

  const [rPassport, rBadges] = await Promise.all([
    apiParticipacion('GET', '/passport'),
    apiParticipacion('GET', '/passport/badges'),
  ]);

  if (!rPassport.ok) {
    hoja.append(h('div', { class: 'estado-vacio estado-error', role: 'alert' }, h('h2', {}, 'No pudimos cargar tu pasaporte'), h('p', {}, rPassport.datos?.message ?? 'Inténtalo de nuevo en unos minutos.')));
    return pagina;
  }
  const { total, items, verified } = rPassport.datos;
  const insignias = rBadges.ok ? rBadges.datos.items ?? [] : [];

  const nodoInsignias = seccionInsignias(insignias);
  if (nodoInsignias) hoja.append(nodoInsignias);

  const hojaIzquierda = h(
    'div',
    { class: 'pasaporte-hoja pasaporte-hoja-izq' },
    h('span', { class: 'pasaporte-marca-agua', 'aria-hidden': 'true' }, icono('artes-vivas', 'icono-agua')),
    h(
      'div',
      { class: 'pasaporte-hoja-top' },
      h('div', { class: 'pasaporte-escudo', 'aria-hidden': 'true' }, icono('pasaporte', 'icono-escudo')),
      h('span', { class: 'pasaporte-sello-oficial', 'aria-hidden': 'true' }, 'FIAVL · LOJA'),
      h('span', { class: 'pasaporte-pagina-num', 'aria-hidden': 'true' }, 'PÁG. 01'),
    ),
    h('p', { class: 'pasaporte-documento-tipo' }, 'Documento cultural · VIVART'),
    h(
      'div',
      { class: 'mi-pasaporte-cabecera' },
      h('h2', { class: 'titulo-seccion pasaporte-libro-titulo' }, 'Mi ', h('span', { class: 'resalte' }, 'pasaporte')),
      h('p', { class: 'total-sellos' }, textoSellos(total)),
    ),
    h(
      'dl',
      { class: 'pasaporte-campos' },
      h('div', { class: 'pasaporte-campo' }, h('dt', {}, 'Titular'), h('dd', {}, persona.email ?? 'Cuenta verificada')),
      h('div', { class: 'pasaporte-campo' }, h('dt', {}, 'Sede emisora'), h('dd', {}, 'Loja · Artes Vivas')),
      h('div', { class: 'pasaporte-campo' }, h('dt', {}, 'Insignias ganadas'), h('dd', {}, `${insignias.length} ${insignias.length === 1 ? 'insignia' : 'insignias'}`)),
    ),
    h('p', { class: 'pasaporte-nota-hoja' }, 'Cada función habilitada estampa un sello único en las páginas de tu pasaporte al escanear su QR en la sede.'),
    h('p', { class: 'pasaporte-mrz', 'aria-hidden': 'true' }, 'P<ECUVIVART<<PASAPORTE<VIVO<LOJA<<<<<<<<<<<<'),
  );

  const paginasDeSellos = partirSellosEnPaginas(items);
  const hojasDerechas = paginasDeSellos.map((grupo, idx) => {
    const numPag = String(idx + 2).padStart(2, '0');
    return h(
      'div',
      { class: 'pasaporte-hoja pasaporte-hoja-der' },
      h('span', { class: 'pasaporte-esquina-doblez', 'aria-hidden': 'true' }),
      h(
        'div',
        { class: 'pasaporte-visas-cabecera' },
        h('span', { class: 'pasaporte-visas-titulo' }, 'Visados y sellos estampados'),
        h('span', { class: 'pasaporte-pagina-num', 'aria-hidden': 'true' }, `PÁG. ${numPag}`),
      ),
      grupo.length
        ? h('ul', { class: 'rejilla-sellos rejilla-sellos-libro' }, grupo.map(tarjetaSello))
        : h(
            'div',
            { class: 'estado-vacio pasaporte-sellos-vacio' },
            h('div', { class: 'sellos-vacio-icono', 'aria-hidden': 'true' }, icono('pasaporte', 'icono-insignia')),
            h('h3', {}, 'Aún no tienes sellos'),
            h('p', {}, 'Escanea el QR del Pasaporte en la sede de una función para reclamar tu primer sello.'),
            h('a', { href: '/agenda', 'data-enlace': true, class: 'boton secundario boton-sm' }, icono('calendario', 'icono-xs'), 'Ver programación en la Agenda'),
          ),
    );
  });

  hoja.append(
    h(
      'section',
      { class: 'pila seccion-mi-pasaporte' },
      verified ? null : h('p', { class: 'aviso alerta-caja' }, 'Datos de las funciones sin confirmar: no pudimos consultar la programación.'),
      construirCuadernoPasaporte({ hojaIdentidad: hojaIzquierda, hojasVisados: hojasDerechas }),
    ),
    await seccionRutas(),
  );
  return pagina;
}

/** Detalle público de una ruta cultural (spec 007, US1 y US2). */
export async function pantallaRuta({ persona, id }) {
  const pagina = h('div', { class: 'pasaporte-pagina' });
  const hoja = h('div', { class: 'hoja-contenido' });
  pagina.append(cabecera('Ruta cultural', 'Recorre las funciones elegibles y colecciona sus sellos para obtener la insignia oficial.'), hoja);

  const r = await apiParticipacion('GET', `/passport/routes/${encodeURIComponent(id)}`);
  if (!r.ok) {
    hoja.append(
      h(
        'div',
        { class: 'estado-vacio estado-error', role: 'alert' },
        h('h2', {}, 'No encontramos esta ruta'),
        h('p', {}, r.datos?.message ?? 'La ruta solicitada no existe o no está publicada.'),
        h('a', { href: '/pasaporte', 'data-enlace': true, class: 'boton' }, 'Volver a Pasaporte'),
      ),
    );
    return pagina;
  }

  const ruta = r.datos;
  hoja.append(
    h('a', { href: '/pasaporte', 'data-enlace': true, class: 'enlace-volver' }, '← Volver a Pasaporte'),
    h(
      'div',
      { class: 'ruta-detalle-encabezado' },
      h('p', { class: 'eyebrow' }, `Meta del recorrido · ${ruta.goal} ${ruta.goal === 1 ? 'sello' : 'sellos'}`),
      h('h1', { class: 'ruta-detalle-titulo' }, ruta.title),
      h('p', { class: 'ruta-detalle-desc' }, ruta.description),
    ),
    ruta.inReview
      ? h(
          'p',
          { class: 'aviso alerta-caja', role: 'alert' },
          h('strong', {}, 'Ruta en revisión: '),
          'Algunas funciones elegibles fueron canceladas y la meta temporalmente no puede completarse con las opciones activas restantes. Tus sellos ya obtenidos siguen contando.',
        )
      : '', // un null aquí se pintaba como el texto «null»
    h(
      'div',
      { class: `insignia-plantilla insignia-destacada insignia-color-${ruta.badge.color}` },
      h('span', { class: 'portada-patron', 'aria-hidden': 'true' }),
      h('div', { class: 'insignia-emblema' }, icono(ruta.badge.icon, 'icono-insignia')),
      h(
        'div',
        { class: 'insignia-datos' },
        h('span', { class: 'ruta-card-eyebrow' }, 'Recompensa de la ruta'),
        h('strong', { class: 'insignia-titulo' }, `Insignia: ${ruta.badge.title}`),
        h('p', { class: 'insignia-desc' }, ruta.badge.description),
      ),
    ),
    persona && ruta.progress
      ? h(
          'div',
          { class: 'tarjeta pila ruta-progreso-caja' },
          h(
            'div',
            { class: 'fila-espaciada' },
            h('h2', {}, 'Tu progreso'),
            h('strong', { class: 'progreso-denominador' }, ruta.progress.formatted),
          ),
          ruta.progress.unlockedBadge
            ? h('p', { class: 'aviso ok-caja' }, '¡Felicitaciones! Has obtenido la insignia de esta ruta.')
            : h('p', { class: 'ayuda' }, `Reúne ${ruta.goal} sellos de las funciones elegibles para desbloquear la insignia.`),
        )
      : h(
          'div',
          { class: 'pasaporte-banner pasaporte-invitado ruta-invitacion' },
          h(
            'div',
            { class: 'pasaporte-banner-texto' },
            h('p', { class: 'eyebrow' }, 'Participa en el recorrido'),
            h('h2', { class: 'titulo-seccion' }, 'Registra tu ', h('span', { class: 'resalte' }, 'progreso')),
            h('p', { class: 'pasaporte-banner-desc' }, 'Ingresa con tu cuenta para registrar los sellos que colecciones y desbloquear la insignia de esta ruta.'),
            h(
              'div',
              { class: 'acciones-fila' },
              h('a', { href: '/ingresar', 'data-enlace': true, class: 'boton boton-descarga' }, 'Ingresar'),
              h('a', { href: '/registro', 'data-enlace': true, class: 'boton secundario' }, 'Crear cuenta'),
            ),
          ),
        ),
    h(
      'section',
      { class: 'pila' },
      h(
        'div',
        { class: 'seccion-encabezado' },
        h('p', { class: 'eyebrow' }, 'Programación de la ruta'),
        h('h2', { class: 'titulo-seccion' }, `Funciones elegibles (${ruta.functions.length})`),
      ),
      h(
        'ul',
        { class: 'lista-funciones-elegibles' },
        ruta.functions.map((f) => {
          const p = f.date ? partesFecha(f.date) : null;
          return h(
            'li',
            { class: `tarjeta funcion-elegible-card ${p ? 'con-dia' : ''}` },
            p
              ? h(
                  'div',
                  { class: `funcion-elegible-dia ${f.status === 'cancelled' ? 'cancelada' : ''}`, 'aria-hidden': 'true' },
                  h('span', { class: 'fecha-semana' }, p.semana),
                  h('span', { class: 'fecha-dia' }, String(p.dia)),
                  h('span', { class: 'fecha-mes' }, p.mes),
                )
              : null,
            h(
              'div',
              { class: 'funcion-elegible-datos' },
              h('h3', { class: 'funcion-elegible-titulo' }, f.title),
              h(
                'p',
                { class: 'funcion-elegible-horario' },
                icono('calendario', 'icono-xs'),
                f.date ? `${formatoFecha(f.date)} · ${f.startTime ?? ''}` : 'Fecha a confirmar',
                f.venueName ? ` · ${f.venueName}` : '',
              ),
              f.status === 'cancelled'
                ? h('span', { class: 'insignia-estado estado-cancelada' }, 'Función cancelada')
                : null,
            ),
            persona && f.hasStamp !== null
              ? h(
                  'div',
                  { class: 'funcion-elegible-estado' },
                  f.hasStamp
                    ? h('span', { class: 'insignia-estado estado-curso' }, icono('check', 'icono-xs'), ' Sello obtenido')
                    : f.status !== 'cancelled'
                      ? h('span', { class: 'insignia-estado estado-pasada' }, 'Pendiente')
                      : null,
                )
              : null,
          );
        }),
      ),
    ),
  );
  return pagina;
}

/** Detalle de un sello: plantilla común con los datos vigentes de la función y su aviso (FR-010, FR-021). */
function detalleSello(s) {
  return h(
    'article',
    { class: 'sello-detalle' },
    emblema(s, true),
    s.content?.image ? h('p', { class: 'sello-credito' }, `Imagen: ${s.content.image.credit}`) : null,
    h('p', { class: 'sello-marca' }, 'Pasaporte Vivo · VIVART'),
    h('h2', { class: 'sello-titulo' }, s.title ?? 'Función sin confirmar'),
    h(
      'ul',
      { class: 'sello-datos' },
      h('li', {}, icono('calendario', 'icono-xs'), fechaDelSello(s)),
      h('li', {}, icono('sede', 'icono-xs'), s.venueName ?? 'Sede sin confirmar'),
      h('li', {}, icono('check', 'icono-xs'), `Obtenido el ${formatoFechaHoraIso(s.obtainedAt)}`),
    ),
    // El texto breve se pinta como texto: nunca se interpreta como HTML.
    s.content?.text ? h('p', { class: 'sello-texto' }, s.content.text) : null,
    avisoDelSello(s),
    s.activityId ? h('a', { href: `/actividad/${encodeURIComponent(s.activityId)}`, 'data-enlace': true, class: 'boton secundario' }, 'Ver la ficha de la actividad') : null,
  );
}

export async function pantallaSello({ persona, id }) {
  const pagina = h('div', { class: 'pasaporte-pagina' });
  const hoja = h('div', { class: 'hoja-contenido' });
  pagina.append(cabecera('Tu sello'), hoja);
  if (!persona) {
    hoja.append(h('section', { class: 'tarjeta pila' }, h('p', {}, 'Ingresa con tu cuenta para ver tus sellos.'), h('a', { href: '/ingresar', 'data-enlace': true, class: 'boton' }, 'Ingresar')));
    return pagina;
  }
  const r = await apiParticipacion('GET', `/passport/stamps/${encodeURIComponent(id)}`);
  if (!r.ok) {
    hoja.append(h('div', { class: 'estado-vacio' }, h('h2', {}, 'No encontramos este sello'), h('p', {}, r.datos?.message ?? ''), h('a', { href: '/pasaporte', 'data-enlace': true, class: 'boton' }, 'Ir a Mi pasaporte')));
    return pagina;
  }
  // append convierte null en texto: se quitan los vacíos.
  hoja.append(
    ...[
      r.datos.verified === false ? h('p', { class: 'aviso alerta-caja' }, 'Datos de la función sin confirmar: no pudimos consultar la programación.') : null,
      detalleSello(r.datos),
      h('a', { href: '/pasaporte', 'data-enlace': true, class: 'boton secundario' }, 'Volver a Mi pasaporte'),
    ].filter(Boolean),
  );
  return pagina;
}

/** Canje: se reclama al abrir el enlace. Sin sesión, se guarda la acción pendiente y se vuelve aquí (RF-03). */
export async function pantallaCanje({ persona, ref }) {
  const pagina = h('div', { class: 'pasaporte-pagina' });
  const hoja = h('div', { class: 'hoja-contenido canje' });
  pagina.append(cabecera('Reclamar sello'), hoja);

  const r = await apiParticipacion('POST', '/passport/claims', { ref });
  if (r.ok) {
    const nodos = [
      h('p', { class: 'aviso ok-caja', role: 'status' }, r.datos.created ? '¡Sello obtenido! Ya está en tu pasaporte.' : 'Ya tenías este sello: aquí está.'),
    ];
    if (r.datos.badgeUnlocked) {
      const b = r.datos.badgeUnlocked;
      nodos.push(
        h(
          'div',
          { class: 'tarjeta pila aviso-insignia-desbloqueada', role: 'alert' },
          h('h3', {}, '🏆 ¡Insignia desbloqueada!'),
          h('p', { class: 'ayuda' }, `¡Felicitaciones! Has completado la ruta «${b.routeTitle}».`),
          h(
            'div',
            { class: `insignia-plantilla insignia-color-${b.color ?? 'violeta'}` },
            h('div', { class: 'insignia-emblema' }, icono(b.icon ?? 'estrella', 'icono-insignia')),
            h(
              'div',
              { class: 'insignia-datos' },
              h('strong', { class: 'insignia-titulo' }, b.title),
              h('p', { class: 'insignia-desc' }, b.description ?? `Insignia oficial de la ruta ${b.routeTitle}`),
            ),
          ),
        ),
      );
    }
    nodos.push(
      detalleSello(r.datos.stamp),
      h('a', { href: '/pasaporte', 'data-enlace': true, class: 'boton' }, 'Ver Mi pasaporte'),
    );
    hoja.append(...nodos);
    return pagina;
  }

  const error = r.datos?.error;
  if (error === 'unauthenticated' || (!persona && r.status === 401)) {
    // Se conserva el canje y, tras identificarse, identidad devuelve a /pasaporte/canje/{ref}, que se revalida.
    await apiIdentidad('POST', '/auth/pending-actions', { type: 'canje', ref });
    hoja.append(
      h(
        'section',
        { class: 'tarjeta pila' },
        h('h2', {}, 'Ingresa para reclamar tu sello'),
        h('p', {}, 'Necesitas una cuenta con el correo verificado. Al terminar volverás aquí y comprobaremos que el canje siga vigente.'),
        h('div', { class: 'acciones-fila' }, h('a', { href: '/ingresar', 'data-enlace': true, class: 'boton' }, 'Ingresar'), h('a', { href: '/registro', 'data-enlace': true, class: 'boton secundario' }, 'Crear cuenta')),
      ),
    );
    return pagina;
  }

  const verificar = error === 'email_not_verified';
  hoja.append(
    h(
      'section',
      { class: `tarjeta pila canje-rechazo ${error === 'not_verifiable' ? 'sin-confirmar' : ''}`, role: 'alert' },
      h('h2', {}, icono('aviso', 'icono-sm'), error === 'not_verifiable' ? 'Canje no confirmado' : 'No se pudo reclamar el sello'),
      h('p', {}, r.datos?.message ?? 'Inténtalo de nuevo en unos minutos.'),
      verificar ? h('a', { href: '/perfil', 'data-enlace': true, class: 'boton' }, 'Ir a Mi cuenta para verificar el correo') : null,
      h('a', { href: '/pasaporte', 'data-enlace': true, class: 'boton secundario' }, 'Ir a Mi pasaporte'),
    ),
  );
  return pagina;
}
