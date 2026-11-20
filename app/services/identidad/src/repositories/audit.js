// Historial de operaciones sensibles. Es de solo anexar y nunca guarda contraseñas ni tokens.
const CAMPOS_PROHIBIDOS = /pass|token|secret|clave|hash/i;

function limpiar(detalles) {
  if (!detalles || typeof detalles !== 'object') return null;
  const limpio = {};
  for (const [k, v] of Object.entries(detalles)) {
    if (!CAMPOS_PROHIBIDOS.test(k)) limpio[k] = v;
  }
  return JSON.stringify(limpio);
}

export function auditRepo(db) {
  return {
    add: ({ at, actorId, action, targetType, targetId, details }) =>
      db.run(
        'INSERT INTO audit_log (at, actor_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
        [at, actorId, action, targetType, targetId, limpiar(details)],
      ),
    async list(limit = 50) {
      const n = Math.min(Math.max(Number(limit) || 50, 1), 200);
      const filas = await db.query('SELECT * FROM audit_log ORDER BY id DESC LIMIT $1', [n]);
      // El identificador se entrega como número, igual que antes (BIGINT llega como texto desde el driver).
      return filas.map((f) => ({ ...f, id: Number(f.id), details: f.details ?? null }));
    },
  };
}
