// Acciones pendientes de identificación. Solo conservan tipo y referencia: nunca ejecutan nada.
export function pendingRepo(db) {
  const crear = db.prepare(
    'INSERT INTO pending_actions (id, type, ref, user_id, created_at, expires_at) VALUES (?, ?, ?, NULL, ?, ?)',
  );
  const buscar = db.prepare('SELECT * FROM pending_actions WHERE id = ?');
  const asociar = db.prepare('UPDATE pending_actions SET user_id = ? WHERE id = ? AND user_id IS NULL');
  const borrar = db.prepare('DELETE FROM pending_actions WHERE id = ?');
  const borrarVencidas = db.prepare('DELETE FROM pending_actions WHERE expires_at <= ?');

  return {
    create: ({ id, type, ref, now, expiresAt }) => crear.run(id, type, ref ?? null, now, expiresAt),
    find: (id) => buscar.get(id),
    attachUser: (id, userId) => asociar.run(userId, id),
    delete: (id) => borrar.run(id),
    deleteExpired: (now) => Number(borrarVencidas.run(now).changes),
  };
}
