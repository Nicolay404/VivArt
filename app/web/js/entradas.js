// Mis entradas y pedidos (spec 005: FR-017, FR-032, FR-035, FR-040).
// Con conexión se guarda una copia en este navegador; sin conexión se muestra esa copia con el aviso de que el
// estado puede haber cambiado. El ingreso lo decide siempre el servidor en la puerta.
import { h, icono } from './dom.js';
import { apiParticipacion } from './api.js';
import { formatoFecha, formatoFechaHoraIso, etiquetaAviso } from './format.js';
import { usd, etiquetaPedido } from './carrito.js';

const ESTADOS = {
  valid: { texto: 'Válida', clase: 'entrada-valida' },
  used: { texto: 'Usada', clase: 'entrada-usada' },
  invalidated: { texto: 'Invalidada', clase: 'entrada-invalida' },
  function_cancelled: { texto: 'Función cancelada', clase: 'entrada-invalida' },
  unverified: { texto: 'Estado sin confirmar', clase: 'entrada-sin-confirmar' },
};

const texto = (v, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Solo se guardan los campos conocidos, como texto acotado: nada de lo recibido se guarda tal cual. */
function copiaSegura(t) {
  return {
    id: texto(t.id, 64),
    functionId: texto(t.functionId, 64),
    title: texto(t.title, 200),
    date: texto(t.date, 10),
    startTime: texto(t.startTime, 5),
    venueName: t.venueName ? texto(t.venueName, 200) : null,
    state: Object.hasOwn(ESTADOS, t.state) ? t.state : 'unverified',
    usedAt: t.usedAt ? texto(t.usedAt, 40) : null,
    invalidationReason: t.invalidationReason ? texto(t.invalidationReason, 500) : null,
    notice: t.notice ? { kind: texto(t.notice.kind, 20), text: texto(t.notice.text, 2000) } : null,
    qrSvg: texto(t.qrSvg, 20000),
    code: texto(t.code, 10),
  };
}

const CACHE = 'vivart-entradas-v1';
const URL_COPIA = '/__copia-entradas';

/** Copia local para ver las entradas sin conexión (FR-040). Usa la Cache API; si no existe, no hay copia. */
async function guardarCopia(usuario, items) {
  try {
    const seguros = Array.isArray(items) ? items.map(copiaSegura) : [];
    const cuerpo = JSON.stringify({ usuario: texto(usuario, 64), guardado: new Date().toISOString(), items: seguros });
    const cache = await caches.open(CACHE);
    await cache.put(URL_COPIA, new Response(cuerpo, { headers: { 'content-type': 'application/json' } }));
  } catch {
    // Sin Cache API (navegador antiguo o sin HTTPS): no habrá copia sin conexión.
  }
}

async function leerCopia(usuario) {
  try {
    const cache = await caches.open(CACHE);
    const r = await cache.match(URL_COPIA);
    const c = r ? await r.json() : null;
    return c && c.usuario === usuario && Array.isArray(c.items) ? { ...c, items: c.items.map(copiaSegura) } : null;
  } catch {
    return null;
  }
}

/** Convierte el SVG del QR (generado por el servicio) en nodos, sin insertar HTML. */
function nodoQr(svg) {
  try {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const raiz = doc.documentElement;
    if (raiz.nodeName.toLowerCase() !== 'svg' || doc.querySelector('script, foreignObject')) return null;
    raiz.setAttribute('role', 'img');
    raiz.setAttribute('aria-label', 'Código QR de la entrada');
    raiz.setAttribute('class', 'entrada-qr');
    return document.importNode(raiz, true);
  } catch {
    return null;
  }
}

function tarjetaEntrada(t, sinConexion) {
  const estado = sinConexion ? ESTADOS.unverified : (ESTADOS[t.state] ?? ESTADOS.unverified);
  const mostrarCodigo = t.state === 'valid' || sinConexion || t.state === 'unverified';
  return h(
    'article',
    { class: `tarjeta entrada ${estado.clase}` },
    h(
      'div',
      { class: 'entrada-cabecera' },
      h('h2', { class: 'entrada-titulo' }, t.title),
      h('span', { class: 'insignia-estado' }, estado.texto),
    ),
    h(
      'p',
      { class: 'entrada-meta' },
      icono('calendario', 'icono-xs'),
      `${formatoFecha(t.date)} · ${t.startTime} (hora de Loja)`,
      t.venueName ? [' · ', icono('sede', 'icono-xs'), t.venueName] : null,
    ),
    t.notice ? h('p', { class: 'aviso alerta-caja' }, h('strong', {}, `${etiquetaAviso(t.notice.kind)}: `), t.notice.text) : null,
    t.state === 'invalidated' && t.invalidationReason ? h('p', { class: 'ayuda' }, `Motivo: ${t.invalidationReason}`) : null,
    t.state === 'used' && t.usedAt ? h('p', { class: 'ayuda' }, `Usada el ${formatoFechaHoraIso(t.usedAt)}.`) : null,
    mostrarCodigo
      ? h(
          'div',
          { class: 'entrada-codigos' },
          nodoQr(t.qrSvg),
          h('p', { class: 'entrada-codigo' }, h('span', { class: 'ayuda' }, 'Código alternativo'), h('strong', {}, t.code.replace(/(.{5})/, '$1 '))),
        )
      : null,
  );
}

export async function pantallaEntradas({ persona }) {
  if (!persona) {
    return h(
      'section',
      { class: 'tarjeta-centrada' },
      h('h1', {}, 'Mis entradas'),
      h('p', {}, 'Ingresa para ver tus entradas.'),
      h('a', { href: '/ingresar', 'data-enlace': true, class: 'boton' }, 'Ingresar'),
    );
  }
  const [rt, rp] = await Promise.all([apiParticipacion('GET', '/tickets'), apiParticipacion('GET', '/orders')]);

  let entradas;
  let sinConexion = false;
  let nota = null;
  if (rt.ok) {
    entradas = rt.datos.items;
    if (rt.datos.verified) await guardarCopia(persona.id, entradas);
    else nota = 'No se pudo confirmar el estado de las funciones: se muestra sin confirmar.';
  } else {
    const copia = await leerCopia(persona.id);
    entradas = copia?.items ?? [];
    sinConexion = true;
    nota = copia
      ? `Sin conexión: se muestra la copia guardada el ${formatoFechaHoraIso(copia.guardado)}. Estado sin confirmar: puede haber cambiado.`
      : 'Sin conexión y sin copia guardada en este navegador.';
  }

  const pedidos = rp.ok ? rp.datos.items.filter((p) => p.status !== 'confirmed') : [];

  return h(
    'section',
    { class: 'pila' },
    h('h1', {}, 'Mis entradas'),
    nota ? h('p', { class: 'aviso alerta-caja', role: 'status' }, nota) : null,
    entradas.length
      ? h('div', { class: 'rejilla-entradas' }, entradas.map((t) => tarjetaEntrada(t, sinConexion)))
      : h('div', { class: 'estado-vacio' }, h('p', {}, 'Todavía no tienes entradas.'), h('a', { href: '/', 'data-enlace': true, class: 'boton' }, 'Explorar la Agenda')),
    pedidos.length
      ? h(
          'section',
          { class: 'pila' },
          h('h2', {}, 'Otros pedidos'),
          h(
            'ul',
            { class: 'lista-carrito' },
            pedidos.map((p) =>
              h(
                'li',
                { class: 'carrito-item' },
                h('div', { class: 'carrito-item-datos' }, h('strong', {}, etiquetaPedido(p.status)), h('span', { class: 'ayuda' }, formatoFechaHoraIso(p.createdAt))),
                h('a', { href: `/pedido/${encodeURIComponent(p.id)}`, 'data-enlace': true }, usd(p.totalCents)),
              ),
            ),
          ),
        )
      : null,
  );
}
