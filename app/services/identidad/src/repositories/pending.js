// Acciones pendientes de identificación. Solo conservan tipo y referencia: nunca ejecutan nada.
export function pendingRepo(db) {
  return {
    create: ({ id, type, ref, now, expiresAt }) =>
      db.run(
        'INSERT INTO pending_actions (id, type, ref, user_id, created_at, expires_at) VALUES ($1, $2, $3, NULL, $4, $5)',
        [id, type, ref ?? null, now, expiresAt],
      ),
    find: async (id) => (await db.query('SELECT * FROM pending_actions WHERE id = $1', [id]))[0],
    attachUser: (id, userId) => db.run('UPDATE pending_actions SET user_id = $1 WHERE id = $2 AND user_id IS NULL', [userId, id]),
    delete: (id) => db.run('DELETE FROM pending_actions WHERE id = $1', [id]),
    deleteExpired: (now) => db.run('DELETE FROM pending_actions WHERE expires_at <= $1', [now]),
  };
}
