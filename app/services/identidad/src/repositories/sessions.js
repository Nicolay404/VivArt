// Sesiones opacas: en la base solo se guarda el hash del token, nunca el token.
export function sessionsRepo(db) {
  const crear = db.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)');
  const buscar = db.prepare('SELECT * FROM sessions WHERE id = ?');
  const borrar = db.prepare('DELETE FROM sessions WHERE id = ?');
  const borrarDeUsuario = db.prepare('DELETE FROM sessions WHERE user_id = ?');
  const borrarVencidas = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');

  return {
    create: (id, userId, createdAt, expiresAt) => crear.run(id, userId, createdAt, expiresAt),
    find: (id) => buscar.get(id),
    delete: (id) => borrar.run(id),
    deleteForUser: (userId) => Number(borrarDeUsuario.run(userId).changes),
    deleteExpired: (now) => Number(borrarVencidas.run(now).changes),
  };
}
