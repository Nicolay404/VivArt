// Consultas de venta compartidas por el carrito, los pedidos, la administración y el impacto.
// `db` puede ser la base o una transacción. `ahora` es un instante ISO: las retenciones vencidas no cuentan.

export function salesRepo(db) {
  return {
    async settings() {
      const [s] = await db.query('SELECT hold_minutes, sale_close_minutes, updated_at, updated_by FROM settings WHERE id = 1');
      return { holdMinutes: s.hold_minutes, saleCloseMinutes: s.sale_close_minutes, updatedAt: s.updated_at, updatedBy: s.updated_by };
    },

    async sales(ids) {
      if (ids.length === 0) return new Map();
      const filas = await db.query('SELECT function_id, capacity, enabled FROM sales WHERE function_id = ANY($1)', [ids]);
      return new Map(filas.map((f) => [f.function_id, { capacity: f.capacity, enabled: f.enabled }]));
    },

    /** Bloquea las filas de venta en orden de id para evitar interbloqueos (research.md, decisión 6). */
    async lock(ids) {
      const ordenados = [...new Set(ids)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      if (ordenados.length === 0) return new Map();
      const filas = await db.query(
        'SELECT function_id, capacity, enabled FROM sales WHERE function_id = ANY($1) ORDER BY function_id FOR UPDATE',
        [ordenados],
      );
      return new Map(filas.map((f) => [f.function_id, { capacity: f.capacity, enabled: f.enabled }]));
    },

    /** Vendidas (toda entrada emitida: una invalidada no repone cupo, FR-037) y retenidas vigentes, por función. */
    async committed(ids, ahora) {
      const resultado = new Map(ids.map((id) => [id, { sold: 0, held: 0 }]));
      if (ids.length === 0) return resultado;
      const vendidas = await db.query(
        'SELECT function_id, COUNT(*)::int AS n FROM tickets WHERE function_id = ANY($1) GROUP BY function_id',
        [ids],
      );
      for (const f of vendidas) resultado.get(f.function_id).sold = f.n;
      const retenidas = await db.query(
        `SELECT i.function_id, SUM(i.quantity)::int AS n FROM order_items i JOIN orders o ON o.id = i.order_id
          WHERE i.function_id = ANY($1) AND o.status = 'pending' AND o.expires_at > $2 GROUP BY i.function_id`,
        [ids, ahora],
      );
      for (const f of retenidas) resultado.get(f.function_id).held = f.n;
      return resultado;
    },
  };
}

export function historyRepo(db) {
  return {
    add: ({ at, actorId, action, entityType, entityId, details }) =>
      db.run('INSERT INTO history (at, actor_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)', [
        at,
        actorId,
        action,
        entityType,
        entityId,
        details ?? null,
      ]),
  };
}
