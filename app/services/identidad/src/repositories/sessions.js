// Sesiones opacas: en la base solo se guarda el hash del token, nunca el token.
export function sessionsRepo(db) {
  return {
    create: (id, userId, createdAt, expiresAt) =>
      db.run('INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at) VALUES ($1, $2, $3, $4, $3)', [
        id, userId, createdAt, expiresAt,
      ]),
    touch: (id, now) => db.run('UPDATE sessions SET last_seen_at = $1 WHERE id = $2', [now, id]),
    find: async (id) => (await db.query('SELECT * FROM sessions WHERE id = $1', [id]))[0],
    delete: (id) => db.run('DELETE FROM sessions WHERE id = $1', [id]),
    deleteForUser: (userId) => db.run('DELETE FROM sessions WHERE user_id = $1', [userId]),
    deleteExpired: (now) => db.run('DELETE FROM sessions WHERE expires_at <= $1', [now]),
  };
}
