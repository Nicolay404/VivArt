import { createHash, timingSafeEqual } from 'node:crypto';
import { authorize, ACTION_NAMES } from '../domain/policy.js';
import { AppError, validation } from './errors.js';

const huella = (texto) => createHash('sha256').update(String(texto)).digest();

// Contrato de introspección entre servicios. Lee el estado ACTUAL en cada consulta: un rol revocado deja de autorizar
// en la siguiente llamada. Cada servicio consumidor tiene su propia credencial en X-Service-Key.
export function registerInternalRoutes(app, { accounts, config }) {
  function servicioAutenticado(request) {
    const recibida = request.headers['x-service-key'];
    if (typeof recibida === 'string' && recibida.length > 0) {
      for (const [clave, nombre] of config.serviceKeys) {
        if (timingSafeEqual(huella(recibida), huella(clave))) return nombre;
      }
    }
    throw new AppError(401, 'invalid_service_key', 'Credencial de servicio inválida.');
  }

  const cuerpo = (request) => (request.body && typeof request.body === 'object' ? request.body : {});

  app.post('/internal/introspect', async (request, reply) => {
    servicioAutenticado(request);
    const persona = accounts.getContext(cuerpo(request).sessionToken);
    if (!persona) return reply.code(200).send({ active: false });
    return reply.code(200).send({
      active: true,
      userId: persona.userId,
      email: persona.email,
      emailVerified: persona.emailVerified,
      roles: persona.roles,
      functionIds: persona.functionIds,
    });
  });

  app.post('/internal/authorize', async (request, reply) => {
    servicioAutenticado(request);
    const { sessionToken, action, context } = cuerpo(request);
    if (!ACTION_NAMES.includes(action)) throw validation('action', 'La acción no existe.');
    const persona = accounts.getContext(sessionToken);
    const resultado = authorize(persona, action, context && typeof context === 'object' ? context : {});
    return reply.code(200).send(resultado.allowed ? { allowed: true } : resultado);
  });
}
