import { identityUnavailable } from '../http/errors.js';

/**
 * Cliente del servicio de identidad (spec 001). Cada operación protegida pregunta el permiso VIGENTE:
 * un rol revocado deja de autorizar en la siguiente acción. Si identidad no responde, no se autoriza nada
 * (fallo cerrado, regla de la arquitectura) y la consulta pública sigue funcionando porque no lo usa.
 */
export function createIdentidadClient({ url, serviceKey, timeoutMs = 3000, fetchImpl = fetch }) {
  async function llamar(ruta, cuerpo) {
    let respuesta;
    try {
      respuesta = await fetchImpl(`${url}${ruta}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-service-key': serviceKey },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw identityUnavailable();
    }
    if (!respuesta.ok) throw identityUnavailable();
    return respuesta.json();
  }

  return {
    /** Persona de la sesión o null: { active, userId, email, roles, functionIds, emailVerified }. */
    async introspect(sessionToken) {
      if (!sessionToken) return null;
      const r = await llamar('/internal/introspect', { sessionToken });
      return r.active ? r : null;
    },
    /** { allowed } o { allowed: false, reason, missingRole, acceptedRoles }. */
    authorize: (sessionToken, action, context = {}) => llamar('/internal/authorize', { sessionToken, action, context }),
  };
}
