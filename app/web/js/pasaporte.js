// Pasaporte Vivo (spec 006): Mi pasaporte (/pasaporte), detalle de un sello (/pasaporte/sello/{id}) y canje
// (/pasaporte/canje/{ref}). Celular primero. Sin meta global, porcentaje ni casillero bloqueado (M-01).
// El texto del sello siempre es texto (textContent), nunca HTML (M-12). Sin ubicación del dispositivo.
import { h, icono } from './dom.js';
import { apiParticipacion, apiIdentidad } from './api.js';
import { formatoFecha, formatoFechaCorta, formatoFechaHoraIso } from './format.js';

const cabecera = (titulo, subtitulo) =>
  h(
    'section',
    { class: 'hero-festival hero-pasaporte' },
    h(
      'div',
      { class: 'hero-contenido' },
      h('p', { class: 'hero-eyebrow' }, 'Festival Internacional de Artes Vivas de Loja'),
      h('h1', { class: 'hero-titulo' }, titulo),
      subtitulo ? h('p', { class: 'hero-subtitulo' }, subtitulo) : null,
    ),
  );

const textoSellos = (n) => `${n} ${n === 1 ? 'sello' : 'sellos'}`;

/** Apartado de insignias obtenidas (spec 007, US3). */
function seccionInsignias(insignias) {
  if (!insignias || insignias.length === 0) return null;
  return h(
    'section',
    { class: 'pila seccion-insignias' },
    h('h2', {}, icono('estrella', 'icono-sm'), 'Mis insignias'),
    h(
      'ul',
      { class: 'rejilla-insignias' },
      insignias.map((ins) =>
        h(
          'li',
          { class: 'item-insignia' },
          h(
            'div',
            { class: `insignia-plantilla insignia-color-${ins.color ?? 'violeta'}` },
            h('div', { class: 'insignia-emblema' }, icono(ins.icon ?? 'estrella', 'icono-insignia')),
            h(
              'div',
              { class: 'insignia-datos' },
              h('h3', { class: 'insignia-titulo' }, ins.title),
              h('p', { class: 'insignia-desc' }, ins.description),
              h('span', { class: 'insignia-fecha' }, `Obtenida el ${formatoFechaHoraIso(ins.unlockedAt)}`),
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
        h('div', { class: 'insignia-emblema' }, icono(rt.badge?.icon ?? 'teatro', 'icono-insignia')),
        h(
          'div',
          { class: 'insignia-datos' },
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
          : h('span', { class: 'ruta-meta-texto' }, `Meta: ${rt.goal} ${rt.goal === 1 ? 'sello' : 'sellos'}`),
        h('span', { class: 'enlace-accion' }, 'Ver recorrido →'),
      ),
    ),
  );
}

/** Rutas culturales públicas (spec 007, US1). */
async function seccionRutas() {
  const r = await apiParticipacion('GET', '/passport/routes');
  const rutas = r.ok ? r.datos.items ?? [] : [];
  if (rutas.length === 0) {
    return h(
      'section',
      { class: 'tarjeta pila' },
      h('h2', {}, icono('recorrido', 'icono-sm'), 'Rutas culturales'),
      h('p', { class: 'ayuda' }, 'Aún no hay rutas culturales publicadas.'),
    );
  }
  return h(
    'section',
    { class: 'pila' },
    h('h2', {}, icono('recorrido', 'icono-sm'), 'Rutas culturales'),
    h('p', { class: 'ayuda' }, 'Explora propuestas artísticas y reúne los sellos de cada recorrido para desbloquear su insignia.'),
    h('ul', { class: 'rejilla-rutas' }, rutas.map(tarjetaRuta)),
  );
}

/** Emblema de la plantilla común de VIVART: el sello siempre se muestra, aunque no tenga imagen ni texto (FR-022). */
function emblema(s, grande = false) {
  if (s.content?.image) {
    return h('img', { class: `sello-imagen ${grande ? 'grande' : ''}`, src: s.content.image.url, alt: s.content.image.alt, loading: 'lazy' });
  }
  return h('div', { class: `sello-plantilla ${grande ? 'grande' : ''}`, 'aria-hidden': 'true' }, h('span', { class: 'sello-plantilla-marca' }, 'VIVART'), icono('estrella', 'icono-sello'));
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
    {},
    h(
      'a',
      { href: `/pasaporte/sello/${encodeURIComponent(s.id)}`, 'data-enlace': true, class: 'tarjeta-sello' },
      emblema(s),
      h('span', { class: 'tarjeta-sello-titulo' }, s.title ?? 'Función sin confirmar'),
      h('span', { class: 'tarjeta-sello-fecha' }, s.date ? formatoFechaCorta(s.date) : 'Fecha sin confirmar'),
      cancelada(s) ? h('span', { class: 'insignia-estado estado-cancelada' }, 'Función cancelada') : null,
    ),
  );
}

export async function pantallaPasaporte({ persona }) {
  const pagina = h('div', { class: 'pasaporte-pagina' });
  const hoja = h('div', { class: 'hoja-contenido' });
  pagina.append(cabecera('Pasaporte Vivo', 'Colecciona un sello en cada función: escanea el QR del Pasaporte en la sede.'), hoja);

  if (!persona) {
    hoja.append(
      h(
        'section',
        { class: 'tarjeta pila' },
        h('h2', {}, 'Mi pasaporte'),
        h('p', {}, 'Ingresa con tu cuenta para ver tus sellos y registrar tu progreso.'),
        h('div', { class: 'acciones-fila' }, h('a', { href: '/ingresar', 'data-enlace': true, class: 'boton' }, 'Ingresar'), h('a', { href: '/registro', 'data-enlace': true, class: 'boton secundario' }, 'Crear cuenta')),
      ),
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

  hoja.append(
    h(
      'section',
      { class: 'pila' },
      h('div', { class: 'mi-pasaporte-cabecera' }, h('h2', {}, 'Mi pasaporte'), h('p', { class: 'total-sellos' }, textoSellos(total))),
      verified ? null : h('p', { class: 'aviso alerta-caja' }, 'Datos de las funciones sin confirmar: no pudimos consultar la programación.'),
      items.length
        ? h('ul', { class: 'rejilla-sellos' }, items.map(tarjetaSello))
        : h('div', { class: 'estado-vacio' }, h('h3', {}, 'Aún no tienes sellos'), h('p', {}, 'Escanea el QR del Pasaporte en la sede de una función para reclamar tu primer sello.')),
    ),
    await seccionRutas(),
  );
  return pagina;
}

/** Detalle público de una ruta cultural (spec 007, US1 y US2). */
export async function pantallaRuta({ persona, id }) {
  const pagina = h('div', { class: 'pasaporte-pagina' });
  const hoja = h('div', { class: 'hoja-contenido' });
  pagina.append(cabecera('Ruta cultural'), hoja);

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
    h('h1', { class: 'ruta-detalle-titulo' }, ruta.title),
    h('p', { class: 'ruta-detalle-desc' }, ruta.description),
    ruta.inReview
      ? h(
          'p',
          { class: 'aviso alerta-caja', role: 'alert' },
          h('strong', {}, 'Ruta en revisión: '),
          'Algunas funciones elegibles fueron canceladas y la meta temporalmente no puede completarse con las opciones activas restantes. Tus sellos ya obtenidos siguen contando.',
        )
      : null,
    h(
      'div',
      { class: `insignia-plantilla insignia-color-${ruta.badge.color}` },
      h('div', { class: 'insignia-emblema' }, icono(ruta.badge.icon, 'icono-insignia')),
      h(
        'div',
        { class: 'insignia-datos' },
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
          { class: 'tarjeta pila ruta-invitacion' },
          h('h2', {}, 'Registra tu progreso'),
          h('p', {}, 'Ingresa con tu cuenta para registrar los sellos que colecciones y desbloquear la insignia de esta ruta.'),
          h(
            'div',
            { class: 'acciones-fila' },
            h('a', { href: '/ingresar', 'data-enlace': true, class: 'boton' }, 'Ingresar'),
            h('a', { href: '/registro', 'data-enlace': true, class: 'boton secundario' }, 'Crear cuenta'),
          ),
        ),
    h(
      'section',
      { class: 'pila' },
      h('h2', {}, `Funciones elegibles (${ruta.functions.length})`),
      h(
        'ul',
        { class: 'lista-funciones-elegibles' },
        ruta.functions.map((f) =>
          h(
            'li',
            { class: 'tarjeta funcion-elegible-card' },
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
          ),
        ),
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
