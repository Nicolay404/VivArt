// Historial de cambios (RC-06, RNF-09): quién, cuándo y sobre qué registro. Solo anexar.
const CAMPOS_PROHIBIDOS = /pass|token|secret|clave|hash|cookie/i;

function limpiar(detalles) {
  if (!detalles || typeof detalles !== 'object') return null;
  const limpio = {};
  for (const [k, v] of Object.entries(detalles)) if (!CAMPOS_PROHIBIDOS.test(k)) limpio[k] = v;
  return JSON.stringify(limpio);
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
        limpiar(details),
      ]),
    async of(entityType, entityId) {
      const filas = await db.query(
        'SELECT * FROM history WHERE entity_type = $1 AND entity_id = $2 ORDER BY id DESC LIMIT 500',
        [entityType, entityId],
      );
      return filas.map((f) => ({ id: Number(f.id), at: f.at, actorId: f.actor_id, action: f.action, details: f.details ?? null }));
    },
  };
}
