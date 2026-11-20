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
  const anexar = db.prepare(
    'INSERT INTO audit_log (at, actor_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const listar = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?');

  return {
    add: ({ at, actorId, action, targetType, targetId, details }) =>
      anexar.run(at, actorId, action, targetType, targetId, limpiar(details)),
    list(limit = 50) {
      const n = Math.min(Math.max(Number(limit) || 50, 1), 200);
      return listar.all(n).map((f) => ({ ...f, details: f.details ? JSON.parse(f.details) : null }));
    },
  };
}
