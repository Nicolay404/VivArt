// Asignaciones de rol y de función del personal de acceso.
export function rolesRepo(db) {
  const listarRoles = db.prepare('SELECT role FROM role_assignments WHERE user_id = ? ORDER BY role');
  const agregarRol = db.prepare(
    'INSERT OR IGNORE INTO role_assignments (user_id, role, assigned_by, assigned_at) VALUES (?, ?, ?, ?)',
  );
  const quitarRol = db.prepare('DELETE FROM role_assignments WHERE user_id = ? AND role = ?');
  const listarFunciones = db.prepare('SELECT function_id FROM function_assignments WHERE user_id = ? ORDER BY function_id');
  const agregarFuncion = db.prepare(
    'INSERT OR IGNORE INTO function_assignments (user_id, function_id, assigned_by, assigned_at) VALUES (?, ?, ?, ?)',
  );
  const quitarFuncion = db.prepare('DELETE FROM function_assignments WHERE user_id = ? AND function_id = ?');
  const quitarFunciones = db.prepare('DELETE FROM function_assignments WHERE user_id = ?');

  return {
    listRoles: (userId) => listarRoles.all(userId).map((f) => f.role),
    addRole: (userId, role, by, at) => Number(agregarRol.run(userId, role, by, at).changes) > 0,
    removeRole: (userId, role) => Number(quitarRol.run(userId, role).changes) > 0,
    listFunctions: (userId) => listarFunciones.all(userId).map((f) => f.function_id),
    addFunction: (userId, functionId, by, at) => Number(agregarFuncion.run(userId, functionId, by, at).changes) > 0,
    removeFunction: (userId, functionId) => Number(quitarFuncion.run(userId, functionId).changes) > 0,
    removeAllFunctions: (userId) => Number(quitarFunciones.run(userId).changes),
  };
}
