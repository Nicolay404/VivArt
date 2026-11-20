import { INTERNAL_ROLES } from './policy.js';
import { iso } from './tokens.js';
import { validation, notFound, AppError } from '../http/errors.js';

const FUNCTION_RE = /^[A-Za-z0-9_-]{1,64}$/;

// Gestión de roles y de funciones del personal de acceso. Sin alcance por organización (FR-016).
// Revocar un rol solo quita sus acciones: no toca contenido de otros servicios (FR-018 a FR-021).
export function createRoles({ repos, audit, clock }) {
  const persona = (user) => ({
    id: user.id,
    email: user.email,
    status: user.status,
    emailVerified: Boolean(user.email_verified_at),
    roles: ['usuario_registrado', ...repos.roles.listRoles(user.id)],
    functionIds: repos.roles.listFunctions(user.id),
  });

  function existente(userId) {
    const user = repos.users.findById(userId);
    if (!user) throw notFound();
    return user;
  }

  function validarRol(role) {
    if (!INTERNAL_ROLES.includes(role)) throw validation('role', 'El rol no existe.');
  }

  return {
    search: (prefijo) => repos.users.searchByEmailPrefix(String(prefijo ?? '').trim().toLowerCase()).map(persona),
    get: (userId) => persona(existente(userId)),

    assignRole(actorId, userId, role) {
      validarRol(role);
      existente(userId);
      if (repos.roles.addRole(userId, role, actorId, iso(clock()))) {
        audit(actorId, 'role.assigned', 'user', userId, { role });
      }
    },

    revokeRole(actorId, userId, role) {
      validarRol(role);
      existente(userId);
      if (repos.roles.removeRole(userId, role)) {
        audit(actorId, 'role.revoked', 'user', userId, { role });
        if (role === 'personal_acceso') {
          const quitadas = repos.roles.removeAllFunctions(userId);
          if (quitadas > 0) audit(actorId, 'function.revoked', 'user', userId, { all: true, count: quitadas });
        }
      }
    },

    assignFunction(actorId, userId, functionId) {
      if (!FUNCTION_RE.test(String(functionId))) throw validation('functionId', 'El identificador de función no es válido.');
      existente(userId);
      if (!repos.roles.listRoles(userId).includes('personal_acceso')) {
        throw new AppError(409, 'not_access_staff', 'La cuenta necesita el rol de personal de acceso para recibir funciones.');
      }
      if (repos.roles.addFunction(userId, functionId, actorId, iso(clock()))) {
        audit(actorId, 'function.assigned', 'user', userId, { functionId });
      }
    },

    revokeFunction(actorId, userId, functionId) {
      existente(userId);
      if (repos.roles.removeFunction(userId, String(functionId))) {
        audit(actorId, 'function.revoked', 'user', userId, { functionId });
      }
    },
  };
}
