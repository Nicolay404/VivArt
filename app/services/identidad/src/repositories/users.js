// Acceso a datos de cuentas. Capa reemplazable: el resto del servicio solo usa estas funciones.
export function usersRepo(db) {
  const una = async (sql, params) => (await db.query(sql, params))[0];

  return {
    findByEmail: (email) => una('SELECT * FROM users WHERE email = $1', [email]),
    findById: (id) => una('SELECT * FROM users WHERE id = $1', [id]),
    create: ({ id, email, passwordHash = null, status, emailVerifiedAt = null, now }) =>
      db.run(
        `INSERT INTO users (id, email, password_hash, status, email_verified_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)`,
        [id, email, passwordHash, status, emailVerifiedAt, now],
      ),
    setPassword: (id, hash, now) => db.run('UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3', [hash, now, id]),
    markVerified: (id, now) =>
      db.run('UPDATE users SET email_verified_at = COALESCE(email_verified_at, $1), updated_at = $1 WHERE id = $2', [now, id]),
    activate: (id, hash, now) =>
      db.run(
        `UPDATE users SET password_hash = $1, status = 'active',
           email_verified_at = COALESCE(email_verified_at, $2), updated_at = $2 WHERE id = $3`,
        [hash, now, id],
      ),
    searchByEmailPrefix: (prefijo) =>
      db.query("SELECT * FROM users WHERE email LIKE $1 ESCAPE '\\' ORDER BY email LIMIT 20", [
        `${prefijo.replace(/[\\%_]/g, '\\$&')}%`,
      ]),
    countActiveAdmins: async () =>
      Number(
        (
          await una(
            `SELECT COUNT(*) AS n FROM users u JOIN role_assignments r ON r.user_id = u.id
             WHERE r.role = 'administrador' AND u.status = 'active'`,
          )
        ).n,
      ),
  };
}
