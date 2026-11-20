// Acceso a datos de cuentas. Capa reemplazable: el resto del servicio solo usa estas funciones.
export function usersRepo(db) {
  const porEmail = db.prepare('SELECT * FROM users WHERE email = ?');
  const porId = db.prepare('SELECT * FROM users WHERE id = ?');
  const crear = db.prepare(
    `INSERT INTO users (id, email, password_hash, status, email_verified_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const fijarClave = db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?');
  const verificar = db.prepare('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?');
  const activar = db.prepare(
    `UPDATE users SET password_hash = ?, status = 'active',
       email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?`,
  );
  const buscar = db.prepare('SELECT * FROM users WHERE email LIKE ? ESCAPE \'\\\' ORDER BY email LIMIT 20');
  const administradoresActivos = db.prepare(
    `SELECT COUNT(*) AS n FROM users u JOIN role_assignments r ON r.user_id = u.id
     WHERE r.role = 'administrador' AND u.status = 'active'`,
  );

  return {
    findByEmail: (email) => porEmail.get(email),
    findById: (id) => porId.get(id),
    create: ({ id, email, passwordHash = null, status, emailVerifiedAt = null, now }) =>
      crear.run(id, email, passwordHash, status, emailVerifiedAt, now, now),
    setPassword: (id, hash, now) => fijarClave.run(hash, now, id),
    markVerified: (id, now) => verificar.run(now, now, id),
    activate: (id, hash, now) => activar.run(hash, now, now, id),
    searchByEmailPrefix: (prefijo) => buscar.all(`${prefijo.replace(/[\\%_]/g, '\\$&')}%`),
    countActiveAdmins: () => administradoresActivos.get().n,
  };
}
