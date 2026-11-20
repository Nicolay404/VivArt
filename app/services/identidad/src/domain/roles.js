import { INTERNAL_ROLES } from './policy.js';
import { iso } from './tokens.js';
import { validation, notFound, AppError } from '../http/errors.js';

const FUNCTION_RE = /^[A-Za-z0-9_-]{1,64}$/;

// Gestión de roles y de funciones del personal de acceso. Sin alcance por organización (FR-016).
// Revocar un rol solo quita sus acciones: no toca contenido de otros servicios (FR-018 a FR-021).
export function createRoles({ repos, audit, clock }) {
  const persona = async (user) => ({
    id: user.id,
    email: user.email,
    status: user.status,
    emailVerified: Boolean(user.email_verified_at),
    roles: ['usuario_registrado', ...(await repos.roles.listRoles(user.id))],
    functionIds: await repos.roles.listFunctions(user.id),
  });

  async function existente(userId) {
    const user = await repos.users.findById(userId);
    if (!user) throw notFound();
    return user;
  }

  function validarRol(role) {
    if (!INTERNAL_ROLES.includes(role)) throw validation('role', 'El rol no existe.');
  }

  return {
    search: async (prefijo) =>
      Promise.all((await repos.users.searchByEmailPrefix(String(prefijo ?? '').trim().toLowerCase())).map(persona)),
    get: async (userId) => persona(await existente(userId)),

    async assignRole(actorId, userId, role) {
      validarRol(role);
      await existente(userId);
      if (await repos.roles.addRole(userId, role, actorId, iso(clock()))) {
        await audit(actorId, 'role.assigned', 'user', userId, { role });
      }
    },

    async revokeRole(actorId, userId, role) {
      validarRol(role);
      await existente(userId);
      if (await repos.roles.removeRole(userId, role)) {
        await audit(actorId, 'role.revoked', 'user', userId, { role });
        if (role === 'personal_acceso') {
          const quitadas = await repos.roles.removeAllFunctions(userId);
          if (quitadas > 0) await audit(actorId, 'function.revoked', 'user', userId, { all: true, count: quitadas });
        }
      }
    },

    async assignFunction(actorId, userId, functionId) {
      if (!FUNCTION_RE.test(String(functionId))) throw validation('functionId', 'El identificador de función no es válido.');
      await existente(userId);
      if (!(await repos.roles.listRoles(userId)).includes('personal_acceso')) {
        throw new AppError(409, 'not_access_staff', 'La cuenta necesita el rol de personal de acceso para recibir funciones.');
      }
      if (await repos.roles.addFunction(userId, functionId, actorId, iso(clock()))) {
        await audit(actorId, 'function.assigned', 'user', userId, { functionId });
      }
    },

    async revokeFunction(actorId, userId, functionId) {
      await existente(userId);
      if (await repos.roles.removeFunction(userId, String(functionId))) {
        await audit(actorId, 'function.revoked', 'user', userId, { functionId });
      }
    },
  };
}
