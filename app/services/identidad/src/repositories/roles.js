// Asignaciones de rol y de función del personal de acceso.
export function rolesRepo(db) {
  return {
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
