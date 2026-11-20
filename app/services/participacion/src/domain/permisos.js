import { forbidden } from '../http/errors.js';

/**
 * Permisos verificados en el servidor contra el servicio de identidad, en cada operación (RNF-04, FR-017 del spec 001).
 * `sesion` es { token, userId } de la persona que hace la solicitud.
 */
export function createPermisos(identidad) {
  return {
    async puede(sesion, accion, contexto = {}) {
      return (await identidad.authorize(sesion.token, accion, contexto)).allowed === true;
    },
    async permitir(sesion, accion, contexto = {}) {
      const r = await identidad.authorize(sesion.token, accion, contexto);
      if (!r.allowed) throw forbidden(r);
    },
  };
}
