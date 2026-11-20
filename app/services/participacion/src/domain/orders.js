import { randomUUID } from 'node:crypto';
import { AppError, conflict, notFound, validation } from '../http/errors.js';
import { salesRepo, historyRepo } from '../repositories/sales.js';
import { normalizarItems, LIMITE_POR_PEDIDO } from './cart.js';
import { huella } from './codes.js';

// Pedidos con retención de cupos y pago de prueba (FR-007 a FR-018, FR-036, FR-038, FR-039).

const MOTIVOS_CONFLICTO = {
  function_cancelled: 'Una de las funciones fue cancelada. Revisa tu carrito.',
  sale_closed: 'La venta de una de las funciones ya cerró. Revisa tu carrito.',
  sold_out: 'Ya no quedan entradas suficientes para una de las funciones. Revisa tu carrito.',
};

/** Estado visible de un pedido: un pendiente con la retención vencida se muestra vencido (FR-009). */
export const estadoVisible = (o, ahoraIso) => (o.status === 'pending' && o.expires_at <= ahoraIso ? 'expired' : o.status);

export function createOrders({ db, cart, programacion, codes, clock, simulador }) {
  const ahoraIso = () => clock().toISOString();

  async function leerPedido(conexion, id, userId) {
    const [o] = await conexion.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [id, userId]);
    if (!o) throw notFound('No se encontró ese pedido.');
    const items = await conexion.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY function_date, function_start', [id]);
    return { o, items };
  }

  function presentar({ o, items }, ahora = ahoraIso()) {
    return {
      id: o.id,
      status: estadoVisible(o, ahora),
      totalCents: o.total_cents,
      createdAt: o.created_at,
      expiresAt: o.expires_at,
      items: items.map((i) => ({
        functionId: i.function_id,
        title: i.function_title,
        date: i.function_date,
        startTime: i.function_start,
        quantity: i.quantity,
        unitPriceCents: i.unit_price_cents,
      })),
      simulatorAvailable: simulador,
    };
  }

  /** Emite una entrada por unidad (FR-014); la unicidad (pedido, número) impide duplicar (FR-015). */
  async function emitir(tx, o, items, momento) {
    let seq = 0;
    for (const it of items) {
      for (let n = 0; n < it.quantity; n += 1) {
        seq += 1;
        const id = randomUUID();
        await tx.run(
          `INSERT INTO tickets (id, order_id, user_id, function_id, seq, secret_hash, code_hash, issued_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, o.id, o.user_id, it.function_id, seq, huella(codes.secreto(id)), huella(codes.codigo(id)), momento],
        );
      }
    }
    return seq;
  }

  return {
    presentar,
    leerPedido,

    /** Crea un pedido pendiente y retiene sus cupos en una transacción con las filas de venta bloqueadas. */
    async crear(sesion, cuerpo = {}) {
      const items = normalizarItems(cuerpo.items);
      const unidades = items.reduce((s, i) => s + i.quantity, 0);
      if (unidades > LIMITE_POR_PEDIDO) {
        throw conflict('limit_exceeded', `Un pedido admite como máximo ${LIMITE_POR_PEDIDO} entradas en total.`);
      }
      if (!Number.isInteger(cuerpo.acceptedTotalCents)) throw validation({ acceptedTotalCents: 'Falta el total que aceptaste.' });
      const funciones = await programacion.functions(items.map((i) => i.functionId));

      return db.transaction(null, async (tx) => {
        const repo = salesRepo(tx);
        const ventas = await repo.lock(items.map((i) => i.functionId));
        const cotizacion = await cart.cotizarCon(tx, items, funciones, ventas);
        const fallido = cotizacion.items.find((i) => !i.sellable || i.quantity !== i.requested);
        if (fallido) {
          const codigo = MOTIVOS_CONFLICTO[fallido.reason] ? fallido.reason : 'cart_changed';
          throw conflict(codigo, MOTIVOS_CONFLICTO[codigo] ?? 'Tu carrito cambió. Revísalo antes de pagar.', { quote: cotizacion });
        }
        if (cotizacion.totalCents !== cuerpo.acceptedTotalCents) {
          throw conflict('cart_changed', 'El precio cambió. Revisa y acepta el total vigente antes de pagar.', { quote: cotizacion });
        }

        const ajustes = await repo.settings();
        const ahora = clock();
        const id = randomUUID();
        const expira = new Date(ahora.getTime() + ajustes.holdMinutes * 60000).toISOString();
        await tx.run('INSERT INTO orders (id, user_id, status, total_cents, created_at, expires_at) VALUES ($1, $2, $3, $4, $5, $6)', [
          id,
          sesion.userId,
          'pending',
          cotizacion.totalCents,
          ahora.toISOString(),
          expira,
        ]);
        for (const it of cotizacion.items) {
          await tx.run(
            `INSERT INTO order_items (order_id, function_id, quantity, unit_price_cents, function_title, function_date, function_start)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, it.functionId, it.quantity, it.unitPriceCents, it.title ?? '', it.date ?? '', it.startTime ?? ''],
          );
        }
        await historyRepo(tx).add({
          at: ahora.toISOString(),
          actorId: sesion.userId,
          action: 'order.created',
          entityType: 'order',
          entityId: id,
          details: { totalCents: cotizacion.totalCents, units: cotizacion.totalUnits, holdMinutes: ajustes.holdMinutes },
        });
        return presentar(await leerPedido(tx, id, sesion.userId), ahora.toISOString());
      });
    },

    async mios(sesion) {
      const pedidos = await db.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [sesion.userId]);
      const ahora = ahoraIso();
      const salida = [];
      for (const o of pedidos) {
        const items = await db.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY function_date, function_start', [o.id]);
        salida.push(presentar({ o, items }, ahora));
      }
      return { items: salida };
    },

    async ver(sesion, id) {
      return presentar(await leerPedido(db, id, sesion.userId));
    },

    /**
     * Simulador de pago de prueba (FR-036). Una referencia repetida devuelve el resultado anterior (FR-015).
     * Pago tardío: incidencia, sin entradas y sin recuperar cupos (FR-016, P-02).
     */
    async simularPago(sesion, id, cuerpo = {}) {
      if (!simulador) throw notFound();
      const resultado = cuerpo.result;
      if (!['confirmed', 'failed', 'confirmed_late'].includes(resultado)) {
        throw validation({ result: 'Elige confirmado, fallido o confirmado después de vencer.' });
      }
      const referencia =
        typeof cuerpo.reference === 'string' && cuerpo.reference.trim() ? cuerpo.reference.trim().slice(0, 100) : `sim-${id}-${resultado}`;

      // El estado de las funciones se consulta antes de la transacción (llamada HTTP).
      const { items: previos } = await leerPedido(db, id, sesion.userId);
      const funciones = await programacion.functions(previos.map((i) => i.function_id));

      const salida = await db.transaction(`pedido:${id}`, async (tx) => {
        const [pago] = await tx.query('SELECT order_id FROM payments WHERE reference = $1', [referencia]);
        if (pago) {
          if (pago.order_id !== id) throw conflict('reference_used', 'Esa referencia de pago pertenece a otro pedido.');
          return presentar(await leerPedido(tx, id, sesion.userId));
        }
        const { o, items } = await leerPedido(tx, id, sesion.userId);
        if (o.status !== 'pending') throw conflict('not_pending', 'Este pedido ya no está pendiente de pago.');

        const ahora = clock();
        const momento = ahora.toISOString();
        const historial = historyRepo(tx);
        const cerrar = (estado) =>
          tx.run('UPDATE orders SET status = $2, closed_at = $3 WHERE id = $1 AND status = $4', [id, estado, momento, 'pending']);
        const registrarPago = (r) =>
          tx.run('INSERT INTO payments (reference, order_id, result, received_at) VALUES ($1, $2, $3, $4)', [referencia, id, r, momento]);

        if (resultado === 'failed') {
          await registrarPago('failed');
          await cerrar('failed');
          await historial.add({ at: momento, actorId: sesion.userId, action: 'payment.failed', entityType: 'order', entityId: id });
          return presentar(await leerPedido(tx, id, sesion.userId));
        }

        const tardio = resultado === 'confirmed_late' || o.expires_at <= momento;
        if (tardio) {
          await registrarPago('confirmed_late');
          await cerrar('in_review');
          await tx.run('INSERT INTO incidents (id, order_id, kind, created_at) VALUES ($1, $2, $3, $4)', [randomUUID(), id, 'late_payment', momento]);
          await historial.add({ at: momento, actorId: sesion.userId, action: 'payment.late', entityType: 'order', entityId: id });
          return presentar(await leerPedido(tx, id, sesion.userId));
        }

        // Una función cancelada deja el pedido sin poder pagarse (FR-031).
        const cancelada = items.some((i) => {
          const f = funciones.get(i.function_id);
          return !f || f.status === 'cancelled' || f.activityStatus === 'archived';
        });
        if (cancelada) {
          await cerrar('failed');
          await historial.add({ at: momento, actorId: sesion.userId, action: 'order.function_cancelled', entityType: 'order', entityId: id });
          // Se confirma el cierre del pedido y después se informa el rechazo (lanzar aquí desharía el cierre).
          return { cancelada: true };
        }

        await registrarPago('confirmed');
        await cerrar('confirmed');
        const emitidas = await emitir(tx, o, items, momento);
        await historial.add({
          at: momento,
          actorId: sesion.userId,
          action: 'payment.confirmed',
          entityType: 'order',
          entityId: id,
          details: { tickets: emitidas },
        });
        return presentar(await leerPedido(tx, id, sesion.userId));
      });
      if (salida.cancelada) {
        throw new AppError(409, 'function_cancelled', 'Una de las funciones fue cancelada: este pedido ya no se puede pagar.');
      }
      return salida;
    },
  };
}
