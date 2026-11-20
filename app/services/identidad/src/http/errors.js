// Errores con forma uniforme. Los rechazos por permisos indican el rol que falta y nunca contenido protegido
// (FR-022, FR-023): no hay campos de título, texto ni autor en ninguna respuesta de error.

export class AppError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const validation = (field, message) => new AppError(422, 'validation', message, { field });
export const invalidToken = () =>
  new AppError(400, 'invalid_token', 'El enlace no es válido, ya se usó o venció. Puedes pedir uno nuevo.', { canRequestNew: true });
export const invalidCredentials = () => new AppError(401, 'invalid_credentials', 'Correo o contraseña incorrectos.');
export const unauthenticated = () => new AppError(401, 'unauthenticated', 'Inicia sesión para continuar.');
export const tooManyRequests = () => new AppError(429, 'too_many_requests', 'Demasiados intentos. Espera un momento e inténtalo de nuevo.');
export const notFound = () => new AppError(404, 'not_found', 'No se encontró lo que buscas.');

/** `acceptedRoles` son los roles que concederían la acción; `missingRole` es el primero de ellos. */
export function forbidden(acceptedRoles, reason = 'missing_role') {
  const missingRole = acceptedRoles[0];
  return new AppError(403, 'forbidden', `Para hacer esto falta el rol de ${missingRole.replaceAll('_', ' ')}.`, {
    reason,
    missingRole,
    acceptedRoles,
  });
}

export function errorHandler(error, request, reply) {
  if (error instanceof AppError) {
    return reply.code(error.status).send({ error: error.code, message: error.message, ...error.extra });
  }
  if (error.statusCode && error.statusCode < 500) {
    return reply.code(error.statusCode).send({ error: error.code ?? 'bad_request', message: 'Solicitud no válida.' });
  }
  request.log.error({ err: { message: error.message, name: error.name } }, 'error interno');
  return reply.code(500).send({ error: 'internal', message: 'No se pudo completar la operación. Inténtalo de nuevo.' });
}
