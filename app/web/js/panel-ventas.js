// Panel de ventas del administrador (spec 005: FR-012, FR-019 a FR-022, FR-033, FR-037, FR-039). Escritorio primero.
import { h, aviso, campo, formulario, abrirDialogo, campoTextarea } from './dom.js';
import { apiParticipacion, apiProgramacion } from './api.js';
import { formatoFecha, formatoFechaHoraIso } from './format.js';
import { usd, etiquetaPedido } from './carrito.js';
import { requiereSesion } from './cuenta.js';

const esAdmin = (p) => Boolean(p?.roles?.includes('administrador'));
const sinPermiso = () => h('section', { class: 'tarjeta-centrada' }, h('h1', {}, 'Ventas'), h('p', {}, 'Solo el administrador gestiona la venta de entradas.'));

function formularioAjustes(ajustes) {
  const retencion = campo({ id: 'holdMinutes', etiqueta: 'Retención del pedido (minutos)', tipo: 'number', valor: ajustes.holdMinutes, min: 1, max: 120, ayuda: 'Aplica a pedidos nuevos.' });
  const cierre = campo({ id: 'saleCloseMinutes', etiqueta: 'Cierre de venta antes del inicio (minutos)', tipo: 'number', valor: ajustes.saleCloseMinutes, min: 0, max: 1440 });
  return h(
    'section',
    { class: 'tarjeta pila' },
    h('h2', {}, 'Plazos'),
    formulario({
      campos: [retencion, cierre],
      boton: 'Guardar plazos',
      alEnviar: async (v) => {
        const r = await apiParticipacion('PUT', '/panel/settings', { holdMinutes: Number(v.holdMinutes), saleCloseMinutes: Number(v.saleCloseMinutes) });
        if (r.ok) aviso('Plazos guardados. Aplican a pedidos nuevos.', 'ok');
        return r;
      },
    }),
  );
}

function bloqueIncidencias(items, refrescar) {
  const abiertas = items.filter((x) => x.status === 'open');
  const resolver = (x) =>
    abrirDialogo({
      titulo: 'Resolver incidencia de pago tardío',
      contenido: (cerrar) => {
        const texto = campoTextarea({ id: 'resolucion', etiqueta: 'Resolución', requerido: true, ayuda: 'No emite entradas, no recupera cupos ni reembolsa.' });
        return formulario({
          campos: [texto],
          boton: 'Registrar resolución',
          alEnviar: async (v) => {
            const r = await apiParticipacion('POST', `/panel/incidents/${encodeURIComponent(x.id)}/resolve`, { resolution: v.resolucion });
            if (r.ok) {
              cerrar();
              aviso('Incidencia resuelta.', 'ok');
              refrescar();
            }
            return r;
          },
        });
      },
    });
  return h(
    'section',
    { class: 'tarjeta pila' },
    h('h2', {}, `Incidencias de pago (${abiertas.length} abiertas)`),
    items.length
      ? h(
          'ul',
          { class: 'lista-carrito' },
          items.map((x) =>
            h(
              'li',
              { class: 'carrito-item' },
              h('div', { class: 'carrito-item-datos' }, h('strong', {}, `Pedido ${x.orderId.slice(0, 8)} · ${usd(x.totalCents)}`), h('span', { class: 'ayuda' }, formatoFechaHoraIso(x.createdAt)), x.resolution ? h('span', {}, `Resuelta: ${x.resolution}`) : null),
              x.status === 'open' ? h('button', { type: 'button', class: 'secundario boton-sm', onclick: () => resolver(x) }, 'Resolver') : h('span', { class: 'insignia-estado' }, 'Resuelta'),
            ),
          ),
        )
      : h('p', { class: 'ayuda' }, 'Sin incidencias.'),
  );
}

export async function pantallaVentas({ persona, barraPanel, navegar }) {
  if (!persona) return requiereSesion();
  if (!esAdmin(persona)) return sinPermiso();
  const [ra, ri, rg] = await Promise.all([
    apiParticipacion('GET', '/panel/settings'),
    apiParticipacion('GET', '/panel/incidents'),
    apiProgramacion('GET', '/agenda'),
  ]);
  const refrescar = () => navegar('/panel/ventas', false, false);
  const actividades = rg.ok ? rg.datos.items.filter((a) => a.access?.mode === 'paid') : [];
  return [
    barraPanel('/panel/ventas'),
    h('h1', {}, 'Ventas'),
    h('p', { class: 'ayuda' }, 'Pagos de prueba: no se cobra dinero. El precio es el de la actividad; aquí se configuran cupo y habilitación de cada función.'),
    h(
      'div',
      { class: 'rejilla-panel' },
      ra.ok ? formularioAjustes(ra.datos) : h('p', { class: 'aviso error-caja' }, ra.datos?.message ?? 'No se pudieron cargar los plazos.'),
      ri.ok ? bloqueIncidencias(ri.datos.items, refrescar) : null,
    ),
    h(
      'section',
      { class: 'tarjeta pila' },
      h('h2', {}, 'Actividades de pago'),
      actividades.length
        ? h('ul', { class: 'lista-carrito' }, actividades.map((a) => h('li', { class: 'carrito-item' }, h('div', { class: 'carrito-item-datos' }, h('strong', {}, a.title), h('span', {}, a.access.label)), h('a', { href: `/panel/ventas/actividad/${encodeURIComponent(a.id)}`, 'data-enlace': true, class: 'boton secundario boton-sm' }, 'Ver funciones'))))
        : h('p', { class: 'ayuda' }, 'No hay actividades de pago publicadas.'),
    ),
  ];
}

function bloqueFuncion(fn, resumen, refrescar) {
  const capacidad = campo({ id: `cap-${fn.id}`, etiqueta: 'Cupo', tipo: 'number', valor: resumen.capacity ?? 0, min: 0 });
  const habilitar = h('input', { type: 'checkbox', id: `hab-${fn.id}`, checked: resumen.enabled, disabled: !resumen.sellable });

  async function guardar(ev) {
    ev.preventDefault();
    const r = await apiParticipacion('PUT', `/panel/functions/${encodeURIComponent(fn.id)}/sale`, { capacity: Number(capacidad.input.value), enabled: habilitar.checked });
    if (!r.ok) return aviso(r.datos?.message ?? 'No se pudo guardar.', 'error');
    aviso('Venta guardada.', 'ok');
    refrescar();
  }

  const invalidar = (t) =>
    abrirDialogo({
      titulo: 'Invalidar entrada',
      contenido: (cerrar) =>
        formulario({
          campos: [campoTextarea({ id: 'motivo', etiqueta: 'Motivo', requerido: true, ayuda: 'No reembolsa ni repone el cupo.' })],
          boton: 'Invalidar',
          alEnviar: async (v) => {
            const r = await apiParticipacion('POST', `/panel/tickets/${encodeURIComponent(t.id)}/invalidate`, { reason: v.motivo });
            if (r.ok) {
              cerrar();
              aviso('Entrada invalidada.', 'ok');
              refrescar();
            }
            return r;
          },
        }),
    });

  return h(
    'article',
    { class: 'tarjeta pila' },
    h('h2', {}, `${formatoFecha(fn.date)} · ${fn.startTime}`),
    resumen.cancelled ? h('p', { class: 'aviso error-caja' }, 'Función cancelada.') : null,
    !resumen.sellable ? h('p', { class: 'aviso alerta-caja' }, 'La actividad no tiene precio confirmado: no se puede vender.') : null,
    h(
      'dl',
      { class: 'ficha-datos-clave' },
      [
        ['Precio', resumen.priceUsd === null ? 'Por confirmar' : usd(Math.round(resumen.priceUsd * 100))],
        ['Vendidas', resumen.sold],
        ['Retenidas', resumen.held],
        ['Usadas', resumen.used],
        ['Invalidadas', resumen.invalidated],
      ].map(([k, v]) => h('div', { class: 'dato-par' }, h('dt', {}, k), h('dd', {}, String(v)))),
    ),
    h(
      'form',
      { class: 'fila-acciones', onsubmit: guardar },
      capacidad.el,
      h('label', { class: 'casilla', for: habilitar.id }, habilitar, ' Venta habilitada'),
      h('button', { type: 'submit' }, 'Guardar venta'),
    ),
    resumen.orders.length
      ? h('details', {}, h('summary', {}, `Pedidos (${resumen.orders.length})`), h('ul', { class: 'lista-simple' }, resumen.orders.map((o) => h('li', {}, `${etiquetaPedido(o.status)} · ${o.quantity} entradas · ${formatoFechaHoraIso(o.createdAt)}`))))
      : null,
    resumen.tickets.length
      ? h(
          'details',
          {},
          h('summary', {}, `Entradas (${resumen.tickets.length})`),
          h(
            'ul',
            { class: 'lista-carrito' },
            resumen.tickets.map((t) =>
              h(
                'li',
                { class: 'carrito-item' },
                h('span', {}, `#${t.seq} pedido ${t.orderId.slice(0, 8)} · ${t.state === 'valid' ? 'Válida' : t.state === 'used' ? 'Usada' : `Invalidada (${t.invalidationReason})`}`),
                t.state === 'valid' ? h('button', { type: 'button', class: 'peligro boton-sm', onclick: () => invalidar(t) }, 'Invalidar') : null,
              ),
            ),
          ),
        )
      : null,
  );
}

export async function pantallaVentasActividad({ id, persona, barraPanel, navegar }) {
  if (!persona) return requiereSesion();
  if (!esAdmin(persona)) return sinPermiso();
  const ra = await apiProgramacion('GET', `/activities/${encodeURIComponent(id)}`);
  if (!ra.ok) return [barraPanel('/panel/ventas'), h('p', { class: 'aviso error-caja' }, 'No se encontró la actividad publicada.')];
  const a = ra.datos;
  const resumenes = await Promise.all(a.functions.map((fn) => apiParticipacion('GET', `/panel/functions/${encodeURIComponent(fn.id)}/sale`)));
  const refrescar = () => navegar(`/panel/ventas/actividad/${encodeURIComponent(id)}`, false, false);
  return [
    barraPanel('/panel/ventas'),
    h('p', { class: 'migas' }, h('a', { href: '/panel/ventas', 'data-enlace': true }, 'Volver a Ventas')),
    h('h1', {}, a.title),
    a.functions.length
      ? h(
          'div',
          { class: 'rejilla-panel' },
          a.functions.map((fn, i) => (resumenes[i].ok ? bloqueFuncion(fn, resumenes[i].datos, refrescar) : h('p', { class: 'aviso error-caja' }, resumenes[i].datos?.message ?? 'No se pudo cargar la venta.'))),
        )
      : h('p', {}, 'Esta actividad no tiene funciones con fecha y hora.'),
  ];
}
