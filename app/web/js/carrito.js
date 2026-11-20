// Carrito, pago de prueba y pedidos (spec 005: FR-001 a FR-013, FR-036, FR-038, FR-039).
// El carrito vive en este navegador (FR-006) y el servidor siempre vuelve a cotizar: aquí no se confía en precios.
import { h, icono, aviso, confirmarAccion } from './dom.js';
import { apiParticipacion, apiIdentidad } from './api.js';
import { formatoFecha } from './format.js';

const CLAVE = 'vivart.carrito.v1';
const LIMITE = 6;

export function leerCarrito() {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    return Array.isArray(datos) ? datos.filter((i) => typeof i?.functionId === 'string' && Number.isInteger(i.quantity) && i.quantity > 0) : [];
  } catch {
    return [];
  }
}

function guardarCarrito(items) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(items));
  } catch {
    // Sin almacenamiento (modo privado): el carrito dura lo que dure la página.
  }
  document.dispatchEvent(new CustomEvent('vivart:carrito'));
}

export const unidadesEnCarrito = () => leerCarrito().reduce((s, i) => s + i.quantity, 0);

/** Agrega una unidad; respeta el límite de seis por pedido (FR-038). */
export function agregarAlCarrito(functionId) {
  const items = leerCarrito();
  if (items.reduce((s, i) => s + i.quantity, 0) >= LIMITE) {
    aviso(`Un pedido admite como máximo ${LIMITE} entradas.`, 'alerta');
    return false;
  }
  const existente = items.find((i) => i.functionId === functionId);
  if (existente) existente.quantity += 1;
  else items.push({ functionId, quantity: 1 });
  guardarCarrito(items);
  aviso('Entrada agregada al carrito.', 'ok');
  return true;
}

export const usd = (centavos) => (centavos === null || centavos === undefined ? 'Precio por confirmar' : `USD ${(centavos / 100).toFixed(2).replace('.', ',')}`);

const MOTIVOS = {
  free: 'Es gratuita: no necesita entrada.',
  no_price: 'Precio por confirmar: todavía no se vende.',
  not_enabled: 'La venta no está habilitada.',
  sold_out: 'Agotada.',
  sale_closed: 'La venta ya cerró.',
  function_cancelled: 'Función cancelada.',
  not_found: 'La función ya no está publicada.',
  limit_reached: `Llegaste al máximo de ${LIMITE} entradas por pedido.`,
};

export async function pantallaCarrito({ persona, navegar }) {
  const caja = h('section', { class: 'pila carrito' }, h('h1', {}, 'Tu carrito'), h('p', { class: 'ayuda' }, 'Cargando…'));
  const items = leerCarrito();
  if (items.length === 0) {
    caja.replaceChildren(
      h('h1', {}, 'Tu carrito'),
      h('div', { class: 'estado-vacio' }, h('p', {}, 'Tu carrito está vacío.'), h('a', { href: '/', 'data-enlace': true, class: 'boton' }, 'Explorar la Agenda')),
    );
    return caja;
  }

  const r = await apiParticipacion('POST', '/cart/quote', { items });
  if (!r.ok) {
    caja.replaceChildren(
      h('h1', {}, 'Tu carrito'),
      h('p', { class: 'aviso error-caja' }, r.datos?.message ?? 'No se pudo revisar tu carrito. Inténtalo de nuevo.'),
    );
    return caja;
  }
  const cot = r.datos;
  const titulos = new Map(cot.items.map((i) => [i.functionId, i.title]));

  const cambiar = (functionId, delta) => {
    const actuales = leerCarrito();
    const it = actuales.find((i) => i.functionId === functionId);
    if (!it) return;
    it.quantity += delta;
    guardarCarrito(actuales.filter((i) => i.quantity > 0));
    navegar('/carrito', false, false);
  };

  const filas = cot.items.map((i) =>
    h(
      'li',
      { class: `carrito-item ${i.sellable ? '' : 'carrito-item-inactivo'}` },
      h(
        'div',
        { class: 'carrito-item-datos' },
        h('strong', {}, i.title ?? 'Función no disponible'),
        i.date ? h('span', { class: 'ayuda' }, `${formatoFecha(i.date)} · ${i.startTime} (hora de Loja)${i.venueName ? ` · ${i.venueName}` : ''}`) : null,
        h('span', {}, `${usd(i.unitPriceCents)} c/u`),
        i.reason ? h('span', { class: 'aviso-linea' }, MOTIVOS[i.reason] ?? 'No disponible.') : null,
        i.sellable && i.quantity < i.requested ? h('span', { class: 'aviso-linea' }, `Solo hay ${i.quantity} disponibles para ti.`) : null,
      ),
      h(
        'div',
        { class: 'carrito-cantidad', role: 'group', 'aria-label': `Cantidad de ${i.title ?? 'la función'}` },
        h('button', { type: 'button', class: 'secundario boton-sm', 'aria-label': 'Quitar una', onclick: () => cambiar(i.functionId, -1) }, '−'),
        h('span', { class: 'carrito-numero', 'aria-live': 'polite' }, String(i.requested)),
        h(
          'button',
          { type: 'button', class: 'secundario boton-sm', 'aria-label': 'Agregar una', disabled: cot.totalUnits >= LIMITE || !i.sellable, onclick: () => cambiar(i.functionId, 1) },
          '+',
        ),
      ),
    ),
  );

  const cruces = cot.overlaps.length
    ? h(
        'div',
        { class: 'aviso alerta-caja' },
        h('strong', {}, 'Horarios que se cruzan: '),
        cot.overlaps.map(([a, b]) => `${titulos.get(a)} y ${titulos.get(b)}`).join('; '),
        '. Puedes comprarlas igual.',
      )
    : null;

  async function pagar() {
    if (cot.totalUnits === 0) return aviso('No hay entradas que se puedan comprar en tu carrito.', 'alerta');
    if (!persona) {
      // Se conserva la compra y, tras identificarse, se vuelve aquí (spec 001, RF-03).
      await apiIdentidad('POST', '/auth/pending-actions', { type: 'compra' });
      aviso('Ingresa o crea tu cuenta para pagar. Tu carrito te espera.', 'info');
      return navegar('/ingresar');
    }
    if (!persona.emailVerified) return aviso('Verifica tu correo para poder pagar (Mi cuenta → Reenviar enlace).', 'alerta');
    const ok = await confirmarAccion({
      titulo: 'Confirmar el total',
      mensaje: `Vas a pagar ${usd(cot.totalCents)} por ${cot.totalUnits} entradas. Es un pago de prueba: no se cobra dinero.`,
      botonConfirmar: 'Aceptar y continuar',
    });
    if (!ok) return;
    const vendibles = cot.items.filter((i) => i.sellable).map((i) => ({ functionId: i.functionId, quantity: i.quantity }));
    const p = await apiParticipacion('POST', '/orders', { items: vendibles, acceptedTotalCents: cot.totalCents });
    if (p.ok) {
      guardarCarrito([]);
      return navegar(`/pedido/${encodeURIComponent(p.datos.id)}`);
    }
    aviso(p.datos?.message ?? 'No se pudo iniciar el pago.', 'error');
    if (p.status === 409) navegar('/carrito', false, false);
  }

  caja.replaceChildren(
    ...[
    h('h1', {}, 'Tu carrito'),
    h('p', { class: 'ayuda' }, `Máximo ${LIMITE} entradas por pedido. Los precios se confirman al pagar.`),
    h('ul', { class: 'lista-carrito' }, filas),
    cruces,
    h(
      'div',
      { class: 'carrito-total' },
      h('span', {}, 'Total'),
      h('strong', { class: 'carrito-total-valor' }, usd(cot.totalCents)),
    ),
    h(
      'div',
      { class: 'fila-acciones' },
      h('button', { type: 'button', onclick: pagar, disabled: cot.totalUnits === 0 }, icono('check', 'icono-sm'), 'Ir a pagar'),
      h('button', { type: 'button', class: 'secundario', onclick: () => { guardarCarrito([]); navegar('/carrito', false, false); } }, 'Vaciar carrito'),
    ),
    ].filter(Boolean),
  );
  return caja;
}

const ESTADOS_PEDIDO = {
  pending: 'Pendiente de pago',
  confirmed: 'Pagado',
  failed: 'Pago fallido',
  expired: 'Retención vencida',
  in_review: 'En revisión (pago tardío)',
};

export const etiquetaPedido = (s) => ESTADOS_PEDIDO[s] ?? s;

/** Pedido pendiente con la cuenta regresiva de la retención y el simulador de pago de prueba (FR-036). */
export async function pantallaPedido({ id, persona, navegar }) {
  if (!persona) return h('section', { class: 'tarjeta-centrada' }, h('h1', {}, 'Tu pedido'), h('p', {}, 'Ingresa para ver tu pedido.'));
  const r = await apiParticipacion('GET', `/orders/${encodeURIComponent(id)}`);
  if (!r.ok) return h('section', { class: 'tarjeta-centrada' }, h('h1', {}, 'Pedido no encontrado'), h('p', {}, r.datos?.message ?? ''));
  const p = r.datos;

  const reloj = h('strong', { class: 'cuenta-regresiva', 'aria-live': 'polite' });
  if (p.status === 'pending') {
    const fin = new Date(p.expiresAt).getTime();
    const tic = () => {
      const resta = Math.max(0, fin - Date.now());
      const m = Math.floor(resta / 60000);
      const s = Math.floor((resta % 60000) / 1000);
      reloj.textContent = resta > 0 ? `${m}:${String(s).padStart(2, '0')}` : 'vencida';
      if (resta > 0 && reloj.isConnected !== false) setTimeout(tic, 1000);
    };
    tic();
  }

  async function simular(result) {
    const s = await apiParticipacion('POST', `/orders/${encodeURIComponent(p.id)}/simulate-payment`, { result });
    if (!s.ok) {
      aviso(s.datos?.message ?? 'No se pudo registrar el pago.', 'error');
      return navegar(`/pedido/${encodeURIComponent(p.id)}`, false, false);
    }
    if (s.datos.status === 'confirmed') {
      aviso('Pago de prueba confirmado. Tus entradas ya están en Mis entradas.', 'ok');
      return navegar('/mis-entradas');
    }
    aviso(s.datos.status === 'in_review' ? 'El pago llegó tarde: queda en revisión, sin entradas.' : 'El pago falló y el cupo se liberó.', 'alerta');
    return navegar(`/pedido/${encodeURIComponent(p.id)}`, false, false);
  }

  return h(
    'section',
    { class: 'pila pedido' },
    h('h1', {}, 'Tu pedido'),
    h('p', {}, h('span', { class: `insignia-estado pedido-${p.status}` }, etiquetaPedido(p.status))),
    h(
      'ul',
      { class: 'lista-carrito' },
      p.items.map((i) => h('li', { class: 'carrito-item' }, h('div', { class: 'carrito-item-datos' }, h('strong', {}, i.title), h('span', { class: 'ayuda' }, `${formatoFecha(i.date)} · ${i.startTime}`)), h('span', {}, `${i.quantity} × ${usd(i.unitPriceCents)}`))),
    ),
    h('div', { class: 'carrito-total' }, h('span', {}, 'Total'), h('strong', { class: 'carrito-total-valor' }, usd(p.totalCents))),
    p.status === 'pending'
      ? h(
          'div',
          { class: 'tarjeta pila' },
          h('p', {}, 'Tus entradas están apartadas. Tiempo restante: ', reloj),
          p.simulatorAvailable
            ? [
                h('h2', {}, 'Pago de prueba'),
                h('p', { class: 'ayuda' }, 'Entorno de demostración: elige el resultado. No se cobra dinero ni se piden datos de tarjeta.'),
                h(
                  'div',
                  { class: 'fila-acciones' },
                  h('button', { type: 'button', onclick: () => simular('confirmed') }, 'Pago confirmado'),
                  h('button', { type: 'button', class: 'secundario', onclick: () => simular('failed') }, 'Pago fallido'),
                  h('button', { type: 'button', class: 'secundario', onclick: () => simular('confirmed_late') }, 'Confirmado después de vencer'),
                ),
              ]
            : h('p', { class: 'aviso alerta-caja' }, 'El pago no está disponible en este entorno.'),
        )
      : null,
    h('p', {}, h('a', { href: '/mis-entradas', 'data-enlace': true }, 'Ver Mis entradas y pedidos')),
  );
}
