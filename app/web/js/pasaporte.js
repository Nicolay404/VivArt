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

/** Rutas culturales: llegan con el spec 007 (M-13). */
const seccionRutas = () =>
  h(
    'section',
    { class: 'tarjeta pila rutas-proximamente' },
    h('h2', {}, icono('recorrido', 'icono-sm'), 'Rutas culturales'),
    h('p', { class: 'ayuda' }, 'Próximamente: recorridos por funciones del festival con su progreso e insignias.'),
  );

/** Emblema de la plantilla común de VIVART: el sello siempre se muestra, aunque no tenga imagen ni texto (FR-022). */
function emblema(s, grande = false) {
  if (s.content?.image) {
    return h('img', { class: `sello-imagen ${grande ? 'grande' : ''}`, src: s.content.image.url, alt: s.content.image.alt, loading: 'lazy' });
  }
  return h('div', { class: `sello-plantilla ${grande ? 'grande' : ''}`, 'aria-hidden': 'true' }, h('span', { class: 'sello-plantilla-marca' }, 'VIVART'), icono('estrella', 'icono-sello'));
}

const cancelada = (s) => s.functionStatus === 'cancelled';

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
        h('p', {}, 'Ingresa con tu cuenta para ver tus sellos.'),
        h('div', { class: 'acciones-fila' }, h('a', { href: '/ingresar', 'data-enlace': true, class: 'boton' }, 'Ingresar'), h('a', { href: '/registro', 'data-enlace': true, class: 'boton secundario' }, 'Crear cuenta')),
      ),
      seccionRutas(),
    );
    return pagina;
  }

  const r = await apiParticipacion('GET', '/passport');
  if (!r.ok) {
    hoja.append(h('div', { class: 'estado-vacio estado-error', role: 'alert' }, h('h2', {}, 'No pudimos cargar tu pasaporte'), h('p', {}, r.datos?.message ?? 'Inténtalo de nuevo en unos minutos.')));
    return pagina;
  }
  const { total, items, verified } = r.datos;
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
    seccionRutas(),
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
      h('li', {}, icono('calendario', 'icono-xs'), s.date ? `${formatoFecha(s.date)}${s.startTime ? ` · ${s.startTime}` : ''}` : 'Fecha sin confirmar'),
      h('li', {}, icono('sede', 'icono-xs'), s.venueName ?? 'Sede sin confirmar'),
      h('li', {}, icono('check', 'icono-xs'), `Obtenido el ${formatoFechaHoraIso(s.obtainedAt)}`),
    ),
    // El texto breve se pinta como texto: nunca se interpreta como HTML.
    s.content?.text ? h('p', { class: 'sello-texto' }, s.content.text) : null,
    cancelada(s) || s.notice
      ? h(
          'p',
          { class: `aviso ${cancelada(s) ? 'error-caja' : 'alerta-caja'}` },
          h('strong', {}, cancelada(s) ? 'Función cancelada. ' : 'Aviso: '),
          s.notice?.text ?? 'Tu sello se conserva.',
        )
      : null,
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
    hoja.append(
      h('p', { class: 'aviso ok-caja', role: 'status' }, r.datos.created ? '¡Sello obtenido! Ya está en tu pasaporte.' : 'Ya tenías este sello: aquí está.'),
      detalleSello(r.datos.stamp),
      h('a', { href: '/pasaporte', 'data-enlace': true, class: 'boton' }, 'Ver Mi pasaporte'),
    );
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
