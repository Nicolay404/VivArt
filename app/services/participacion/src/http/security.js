import { AppError } from './errors.js';

const METODOS_QUE_CAMBIAN_ESTADO = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Defensa CSRF sencilla y cabeceras seguras, igual que en el servicio de identidad:
 * - en métodos que cambian estado, si llega `Origin` debe estar en la lista permitida;
 * - si hay cuerpo debe ser `application/json`;
 * - las rutas internas entre servicios usan credencial de servicio y no cookies.
 */
export function registerSecurity(app, config) {
  app.addHook('onRequest', async (request) => {
    if (!METODOS_QUE_CAMBIAN_ESTADO.has(request.method)) return;
    if (request.url.startsWith('/internal/')) return;
    const origen = request.headers.origin;
    if (origen && !config.allowedOrigins.includes(origen)) {
      throw new AppError(403, 'forbidden_origin', 'Origen no permitido.');
    }
    const tipo = String(request.headers['content-type'] ?? '').toLowerCase();
    const tieneCuerpo = Number(request.headers['content-length'] ?? 0) > 0 || Boolean(request.headers['transfer-encoding']);
    if (tieneCuerpo && !tipo.startsWith('application/json')) {
      throw new AppError(415, 'unsupported_media_type', 'Se esperaba contenido application/json.');
    }
  });

  app.addHook('onSend', async (request, reply) => {
    // La consulta pública puede guardarse en caché un momento; el panel y lo interno nunca.
    // Solo el estado de venta es público y cacheable unos segundos; pedidos, entradas y panel nunca.
    const publica = request.method === 'GET' && request.url.startsWith('/sale-status');
    reply.header('cache-control', publica ? 'public, max-age=10' : 'no-store');
    reply.header('x-content-type-options', 'nosniff');
  });
}
