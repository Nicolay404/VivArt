// Errores con forma uniforme. Los rechazos por permisos indican el rol que falta y nunca contenido protegido.

export class AppError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const validation = (fields, message = 'Revisa los datos marcados.') => new AppError(422, 'validation', message, { fields });
export const unauthenticated = () => new AppError(401, 'unauthenticated', 'Inicia sesión para continuar.');
export const notFound = (message = 'No se encontró lo que buscas.') => new AppError(404, 'not_found', message);
export const conflict = (code, message, extra = {}) => new AppError(409, code, message, extra);
export const identityUnavailable = () =>
  new AppError(503, 'identity_unavailable', 'No se pudo comprobar tu permiso en este momento. Inténtalo de nuevo en unos minutos.');

export function forbidden(resultado) {
  const aceptados = resultado.acceptedRoles ?? [];
  const falta = resultado.missingRole ?? aceptados[0] ?? 'administrador';
  return new AppError(403, 'forbidden', `Para hacer esto falta el rol de ${String(falta).replaceAll('_', ' ')}.`, {
    reason: resultado.reason ?? 'missing_role',
    missingRole: falta,
    acceptedRoles: aceptados,
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
