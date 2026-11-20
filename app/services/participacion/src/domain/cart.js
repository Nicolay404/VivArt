import { inicioFuncion, finFuncion } from '../clock.js';
import { validation } from '../http/errors.js';
import { salesRepo } from '../repositories/sales.js';

// Carrito y estado de venta (FR-001 a FR-006, FR-038, FR-039, FR-041).
// El carrito vive en el navegador; aquí solo se cotiza con datos vigentes y nunca se confía en precios del cliente.

export const LIMITE_POR_PEDIDO = 6;

/** Precio en centavos si la actividad es de pago con precio confirmado; si no, null (la falta de precio no es gratuidad). */
export function precioCentavos(f) {
  const a = f?.access;
  if (!a || a.mode !== 'paid' || typeof a.priceUsd !== 'number' || !(a.priceUsd > 0)) return null;
  return Math.round(a.priceUsd * 100);
}

/** Normaliza los ítems pedidos: suma repetidos y valida la forma (FR-001). */
export function normalizarItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw validation({ items: 'El carrito está vacío.' });
  const porFuncion = new Map();
  for (const it of items) {
    const id = typeof it?.functionId === 'string' ? it.functionId.trim() : '';
    const q = it?.quantity;
    if (!id || id.length > 100 || !Number.isInteger(q) || q < 1) {
      throw validation({ items: 'Cada ítem necesita una función y una cantidad entera mayor que cero.' });
    }
    porFuncion.set(id, (porFuncion.get(id) ?? 0) + q);
  }
  if (porFuncion.size > LIMITE_POR_PEDIDO) throw validation({ items: `Un pedido admite como máximo ${LIMITE_POR_PEDIDO} entradas.` });
  return [...porFuncion].map(([functionId, quantity]) => ({ functionId, quantity }));
}

/**
 * Evalúa una función para la venta. Devuelve { estado, motivo, disponible, precio }.
 * estado: available | sold_out | closed | null (sin venta interna).
 */
export function evaluar({ f, venta, comprometido, ajustes, ahora }) {
  if (!f) return { estado: null, motivo: 'not_found', disponible: 0, precio: null };
  if (f.access?.mode === 'free') return { estado: null, motivo: 'free', disponible: 0, precio: null };
  const precio = precioCentavos(f);
  if (precio === null) return { estado: null, motivo: 'no_price', disponible: 0, precio: null };
  if (!venta?.enabled) return { estado: null, motivo: 'not_enabled', disponible: 0, precio };
  if (f.status === 'cancelled' || f.activityStatus === 'archived') {
    return { estado: 'closed', motivo: 'function_cancelled', disponible: 0, precio };
  }
  const cierre = inicioFuncion(f).getTime() - ajustes.saleCloseMinutes * 60000;
  if (ahora.getTime() >= cierre) return { estado: 'closed', motivo: 'sale_closed', disponible: 0, precio };
  const usados = comprometido ?? { sold: 0, held: 0 };
  const disponible = Math.max(0, venta.capacity - usados.sold - usados.held);
  if (disponible <= 0) return { estado: 'sold_out', motivo: 'sold_out', disponible: 0, precio };
  return { estado: 'available', motivo: null, disponible, precio };
}

/** Pares de funciones que se cruzan, solo si ambas tienen fin conocido (RC-02: no se inventan duraciones). */
export function cruces(funciones) {
  const conIntervalo = funciones
    .filter(Boolean)
    .map((f) => ({ id: f.id, inicio: inicioFuncion(f).getTime(), fin: finFuncion(f)?.getTime() ?? null }))
    .filter((x) => x.fin !== null);
  const pares = [];
  for (let i = 0; i < conIntervalo.length; i += 1) {
    for (let j = i + 1; j < conIntervalo.length; j += 1) {
      const a = conIntervalo[i];
      const b = conIntervalo[j];
      if (a.inicio < b.fin && b.inicio < a.fin) pares.push([a.id, b.id]);
    }
  }
  return pares;
}

export function createCart({ db, programacion, clock }) {
  /** Cotiza con la base o una transacción. `funciones` ya se consultaron a programación; `ventas` puede venir bloqueada. */
  async function cotizarCon(conexion, items, funciones, ventasBloqueadas) {
    const repo = salesRepo(conexion);
    const ids = items.map((i) => i.functionId);
    const ahora = clock();
    const ajustes = await repo.settings();
    const ventas = ventasBloqueadas ?? (await repo.sales(ids));
    const comprometidas = await repo.committed(ids, ahora.toISOString());

    let unidades = 0;
    let cambiado = false;
    const salida = items.map((it) => {
      const f = funciones.get(it.functionId) ?? null;
      const ev = evaluar({ f, venta: ventas.get(it.functionId), comprometido: comprometidas.get(it.functionId), ajustes, ahora });
      const vendible = ev.estado === 'available';
      const cantidad = vendible ? Math.max(0, Math.min(it.quantity, ev.disponible, LIMITE_POR_PEDIDO - unidades)) : 0;
      if (cantidad !== it.quantity) cambiado = true;
      unidades += cantidad;
      let motivo = ev.motivo;
      if (vendible && cantidad === 0) motivo = 'limit_reached';
      return {
        functionId: it.functionId,
        title: f?.title ?? null,
        date: f?.date ?? null,
        startTime: f?.startTime ?? null,
        venueName: f?.venueName ?? null,
        requested: it.quantity,
        quantity: cantidad,
        unitPriceCents: ev.precio,
        sellable: vendible && cantidad > 0,
        reason: vendible && cantidad > 0 ? null : motivo,
      };
    });
    const vendibles = salida.filter((x) => x.sellable);
    return {
      items: salida,
      totalCents: vendibles.reduce((s, x) => s + x.quantity * x.unitPriceCents, 0),
      totalUnits: unidades,
      limit: LIMITE_POR_PEDIDO,
      overlaps: cruces(vendibles.map((x) => funciones.get(x.functionId))),
      changed: cambiado,
    };
  }

  return {
    cotizarCon,

    async cotizar(cuerpo) {
      const items = normalizarItems(cuerpo?.items);
      const funciones = await programacion.functions(items.map((i) => i.functionId));
      return cotizarCon(db, items, funciones);
    },

    /** Estado de venta público, sin número de cupos (FR-041). Solo funciones con venta interna habilitada. */
    async estados(ids) {
      const unicos = [...new Set(ids)].filter((x) => typeof x === 'string' && x && x.length <= 100).slice(0, 100);
      const repo = salesRepo(db);
      const ventas = await repo.sales(unicos);
      const conVenta = unicos.filter((id) => ventas.get(id)?.enabled);
      if (conVenta.length === 0) return { items: [] };
      const ahora = clock();
      const funciones = await programacion.functions(conVenta);
      const ajustes = await repo.settings();
      const comprometidas = await repo.committed(conVenta, ahora.toISOString());
      const items = [];
      for (const id of conVenta) {
        const ev = evaluar({ f: funciones.get(id), venta: ventas.get(id), comprometido: comprometidas.get(id), ajustes, ahora });
        if (ev.estado) items.push({ functionId: id, state: ev.estado });
      }
      return { items };
    },
  };
}
