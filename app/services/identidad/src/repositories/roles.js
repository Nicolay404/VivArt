// Asignaciones de rol y de función del personal de acceso.
export function rolesRepo(db) {
  const ADMINS_ACTIVOS_SIN = `SELECT COUNT(*) AS n FROM role_assignments r JOIN users u ON u.id = r.user_id
     WHERE r.role = 'administrador' AND u.status = 'active' AND r.user_id <> $1`;

  return {
    /**
     * Quita el rol de administrador solo si queda al menos otro administrador activo (P-10).
     * Se hace en una transacción con bloqueo para que dos revocaciones simultáneas no dejen el sistema sin ninguno.
     * Devuelve 'revoked', 'absent' (no lo tenía) o 'last_admin' (no se quitó).
     */
    removeAdminRoleKeepingOne: (userId) =>
      db.transaction('vivart-identidad-administradores', async (tx) => {
        const otros = Number((await tx.query(ADMINS_ACTIVOS_SIN, [userId]))[0].n);
        const tiene = (await tx.query("SELECT 1 FROM role_assignments WHERE user_id = $1 AND role = 'administrador'", [userId])).length > 0;
        if (!tiene) return 'absent';
        if (otros === 0) return 'last_admin';
        await tx.run("DELETE FROM role_assignments WHERE user_id = $1 AND role = 'administrador'", [userId]);
        return 'revoked';
      }),
    listRoles: async (userId) =>
      (await db.query('SELECT role FROM role_assignments WHERE user_id = $1 ORDER BY role', [userId])).map((f) => f.role),
    addRole: async (userId, role, by, at) =>
      (await db.run(
        `INSERT INTO role_assignments (user_id, role, assigned_by, assigned_at) VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, role) DO NOTHING`,
        [userId, role, by, at],
      )) > 0,
    removeRole: async (userId, role) =>
      (await db.run('DELETE FROM role_assignments WHERE user_id = $1 AND role = $2', [userId, role])) > 0,
    listFunctions: async (userId) =>
      (await db.query('SELECT function_id FROM function_assignments WHERE user_id = $1 ORDER BY function_id', [userId])).map(
        (f) => f.function_id,
      ),
    addFunction: async (userId, functionId, by, at) =>
      (await db.run(
        `INSERT INTO function_assignments (user_id, function_id, assigned_by, assigned_at) VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, function_id) DO NOTHING`,
        [userId, functionId, by, at],
      )) > 0,
    removeFunction: async (userId, functionId) =>
      (await db.run('DELETE FROM function_assignments WHERE user_id = $1 AND function_id = $2', [userId, functionId])) > 0,
    removeAllFunctions: (userId) => db.run('DELETE FROM function_assignments WHERE user_id = $1', [userId]),
  };
}
