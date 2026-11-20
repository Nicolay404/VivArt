import { conflict, notFound, validation } from '../http/errors.js';
import { salesRepo, historyRepo } from '../repositories/sales.js';
import { precioCentavos } from './cart.js';
import { estadoVisible } from './orders.js';

// Administración de la venta (FR-012, FR-019 a FR-022, FR-033, FR-037, FR-039). Todo exige `sales.configure`
// (solo administrador): publicar nunca activa ventas (RF-04, RF-22).

const textoObligatorio = (v, max = 2000) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export function createAdmin({ db, programacion, permisos, clock }) {
  const permitir = (sesion) => permisos.permitir(sesion, 'sales.configure');
  const ahoraIso = () => clock().toISOString();

  return {
    async ajustes(sesion) {
      await permitir(sesion);
      return salesRepo(db).settings();
    },

    /** Los plazos nuevos aplican a pedidos nuevos; las retenciones ya iniciadas no cambian (FR-012). */
    async guardarAjustes(sesion, cuerpo = {}) {
      await permitir(sesion);
      const campos = {};
      if (!Number.isInteger(cuerpo.holdMinutes) || cuerpo.holdMinutes < 1 || cuerpo.holdMinutes > 120) {
        campos.holdMinutes = 'El plazo de retención debe ser un número entero de 1 a 120 minutos.';
      }
      if (!Number.isInteger(cuerpo.saleCloseMinutes) || cuerpo.saleCloseMinutes < 0 || cuerpo.saleCloseMinutes > 1440) {
        campos.saleCloseMinutes = 'El cierre de venta debe ser un número entero de 0 a 1440 minutos.';
      }
      if (Object.keys(campos).length) throw validation(campos);
      const momento = ahoraIso();
      await db.transaction(null, async (tx) => {
        const antes = await salesRepo(tx).settings();
        await tx.run('UPDATE settings SET hold_minutes = $1, sale_close_minutes = $2, updated_at = $3, updated_by = $4 WHERE id = 1', [
          cuerpo.holdMinutes,
          cuerpo.saleCloseMinutes,
          momento,
          sesion.userId,
        ]);
        await historyRepo(tx).add({
          at: momento,
          actorId: sesion.userId,
          action: 'settings.changed',
          entityType: 'settings',
          entityId: '1',
          details: { from: { holdMinutes: antes.holdMinutes, saleCloseMinutes: antes.saleCloseMinutes }, to: cuerpo },
        });
      });
      return salesRepo(db).settings();
    },

    /** Resumen de venta de una función: vendidas, retenidas, usadas, pedidos e incidencias (FR-020, FR-033). */
    async resumen(sesion, functionId) {
      await permitir(sesion);
      const f = await programacion.function(functionId);
      if (!f) throw notFound('La función no existe o no está publicada.');
      const repo = salesRepo(db);
      const ahora = ahoraIso();
      const venta = (await repo.sales([functionId])).get(functionId) ?? null;
      const { sold, held } = (await repo.committed([functionId], ahora)).get(functionId);
      const [cuentas] = await db.query(
        `SELECT COUNT(*) FILTER (WHERE used_at IS NOT NULL)::int AS usadas,
                COUNT(*) FILTER (WHERE status = 'invalidated')::int AS invalidadas
           FROM tickets WHERE function_id = $1`,
        [functionId],
      );
      const pedidos = await db.query(
        `SELECT o.*, i.quantity FROM orders o JOIN order_items i ON i.order_id = o.id
          WHERE i.function_id = $1 ORDER BY o.created_at DESC`,
        [functionId],
      );
      const entradas = await db.query(
        'SELECT id, order_id, seq, status, used_at, invalidation_reason FROM tickets WHERE function_id = $1 ORDER BY issued_at, seq',
        [functionId],
      );
      const [{ n: incidencias }] = await db.query(
        `SELECT COUNT(*)::int AS n FROM incidents x JOIN order_items i ON i.order_id = x.order_id
          WHERE i.function_id = $1 AND x.status = 'open'`,
        [functionId],
      );
      const precio = precioCentavos(f);
      return {
        functionId,
        title: f.title,
        date: f.date,
        startTime: f.startTime,
        cancelled: f.status === 'cancelled',
        capacity: venta?.capacity ?? null,
        enabled: venta?.enabled ?? false,
        sellable: precio !== null,
        priceUsd: precio === null ? null : precio / 100,
        sold,
        held,
        used: cuentas.usadas,
        invalidated: cuentas.invalidadas,
        orders: pedidos.map((o) => ({ id: o.id, status: estadoVisible(o, ahora), quantity: o.quantity, totalCents: o.total_cents, createdAt: o.created_at })),
        tickets: entradas.map((t) => ({
          id: t.id,
          orderId: t.order_id,
          seq: t.seq,
          state: t.status === 'invalidated' ? 'invalidated' : t.used_at ? 'used' : 'valid',
          usedAt: t.used_at,
          invalidationReason: t.invalidation_reason,
        })),
        incidents: incidencias,
      };
    },

    /** Cupo y habilitación. No se baja el cupo por debajo de vendidas + retenidas (FR-021). */
    async configurar(sesion, functionId, cuerpo = {}) {
      await permitir(sesion);
      const campos = {};
      if (!Number.isInteger(cuerpo.capacity) || cuerpo.capacity < 0 || cuerpo.capacity > 100000) {
        campos.capacity = 'El cupo debe ser un número entero mayor o igual que cero.';
      }
      if (typeof cuerpo.enabled !== 'boolean') campos.enabled = 'Indica si la venta queda habilitada.';
      if (Object.keys(campos).length) throw validation(campos);
      const f = await programacion.function(functionId);
      if (!f) throw notFound('La función no existe o no está publicada.');
      if (cuerpo.enabled && precioCentavos(f) === null) {
        throw conflict('not_sellable', 'Solo se puede vender una función de una actividad de pago con precio confirmado.');
      }
      if (cuerpo.enabled && f.status === 'cancelled') throw conflict('function_cancelled', 'La función está cancelada.');

      const momento = ahoraIso();
      await db.transaction(null, async (tx) => {
        await tx.run(
          `INSERT INTO sales (function_id, capacity, enabled, updated_at, updated_by) VALUES ($1, 0, FALSE, $2, $3)
           ON CONFLICT (function_id) DO NOTHING`,
          [functionId, momento, sesion.userId],
        );
        const repo = salesRepo(tx);
        await repo.lock([functionId]);
        const { sold, held } = (await repo.committed([functionId], momento)).get(functionId);
        if (cuerpo.capacity < sold + held) {
          throw conflict('capacity_below_committed', `El cupo no puede ser menor que las ${sold + held} entradas vendidas o retenidas.`, {
            sold,
            held,
          });
        }
        await tx.run('UPDATE sales SET capacity = $2, enabled = $3, updated_at = $4, updated_by = $5 WHERE function_id = $1', [
          functionId,
          cuerpo.capacity,
          cuerpo.enabled,
          momento,
          sesion.userId,
        ]);
        await historyRepo(tx).add({
          at: momento,
          actorId: sesion.userId,
          action: 'sale.configured',
          entityType: 'function',
          entityId: functionId,
          details: { capacity: cuerpo.capacity, enabled: cuerpo.enabled },
        });
      });
      return this.resumen(sesion, functionId);
    },

    /** Invalida una entrada válida y no usada, con motivo; no repone cupo ni reembolsa (FR-037). */
    async invalidar(sesion, ticketId, cuerpo = {}) {
      await permitir(sesion);
      const motivo = textoObligatorio(cuerpo.reason);
      if (!motivo) throw validation({ reason: 'Escribe el motivo de la invalidación.' });
      const momento = ahoraIso();
      return db.transaction(`entrada:${ticketId}`, async (tx) => {
        const [t] = await tx.query('SELECT status, used_at FROM tickets WHERE id = $1 FOR UPDATE', [ticketId]);
        if (!t) throw notFound('La entrada no existe.');
        if (t.used_at) throw conflict('already_used', 'La entrada ya se usó: no se puede invalidar.');
        if (t.status === 'invalidated') throw conflict('already_invalidated', 'La entrada ya estaba invalidada.');
        await tx.run(
          `UPDATE tickets SET status = 'invalidated', invalidated_at = $2, invalidated_by = $3, invalidation_reason = $4 WHERE id = $1`,
          [ticketId, momento, sesion.userId, motivo],
        );
        await historyRepo(tx).add({ at: momento, actorId: sesion.userId, action: 'ticket.invalidated', entityType: 'ticket', entityId: ticketId, details: { reason: motivo } });
        return { id: ticketId, state: 'invalidated', invalidationReason: motivo };
      });
    },

    async incidencias(sesion) {
      await permitir(sesion);
      const filas = await db.query(
        `SELECT x.*, o.user_id, o.total_cents FROM incidents x JOIN orders o ON o.id = x.order_id ORDER BY x.status, x.created_at DESC`,
      );
      return {
        items: filas.map((x) => ({
          id: x.id,
          orderId: x.order_id,
          kind: x.kind,
          status: x.status,
          totalCents: x.total_cents,
          createdAt: x.created_at,
          resolution: x.resolution,
          resolvedAt: x.resolved_at,
        })),
      };
    },

    /** Registra la resolución: no emite entradas, no recupera cupos ni reembolsa (FR-022, P-02). */
    async resolver(sesion, id, cuerpo = {}) {
      await permitir(sesion);
      const texto = textoObligatorio(cuerpo.resolution);
      if (!texto) throw validation({ resolution: 'Describe cómo se resolvió la incidencia.' });
      const momento = ahoraIso();
      return db.transaction(`incidencia:${id}`, async (tx) => {
        const [x] = await tx.query('SELECT status FROM incidents WHERE id = $1', [id]);
        if (!x) throw notFound('La incidencia no existe.');
        if (x.status === 'resolved') throw conflict('already_resolved', 'La incidencia ya estaba resuelta.');
        await tx.run(`UPDATE incidents SET status = 'resolved', resolution = $2, resolved_at = $3, resolved_by = $4 WHERE id = $1`, [
          id,
          texto,
          momento,
          sesion.userId,
        ]);
        await historyRepo(tx).add({ at: momento, actorId: sesion.userId, action: 'incident.resolved', entityType: 'incident', entityId: id, details: { resolution: texto } });
        return { id, status: 'resolved', resolution: texto, resolvedAt: momento };
      });
    },

    /** Impacto para el panel de programación (FR-042): entradas válidas no usadas y pedidos con retención vigente. */
    async impacto(functionId) {
      const [{ n: entradas }] = await db.query(
        `SELECT COUNT(*)::int AS n FROM tickets WHERE function_id = $1 AND status = 'valid' AND used_at IS NULL`,
        [functionId],
      );
      const [{ n: pedidos }] = await db.query(
        `SELECT COUNT(DISTINCT o.id)::int AS n FROM orders o JOIN order_items i ON i.order_id = o.id
          WHERE i.function_id = $1 AND o.status = 'pending' AND o.expires_at > $2`,
        [functionId, ahoraIso()],
      );
      // issuedTickets cuenta toda entrada emitida (también usada o invalidada): decide quién puede cancelar (FR-030).
      const [{ n: emitidas }] = await db.query('SELECT COUNT(*)::int AS n FROM tickets WHERE function_id = $1', [functionId]);
      return { soldTickets: entradas, pendingOrders: pedidos, issuedTickets: emitidas };
    },
  };
}
