import { AppError } from './errors.js';

const METODOS_QUE_CAMBIAN_ESTADO = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Limitador de intentos en memoria (se reinicia al reiniciar el servicio; basta para el MVP de una instancia). */
export class RateLimiter {
  constructor(clock = () => new Date()) {
    this.clock = clock;
    this.hits = new Map();
  }

  /** Devuelve true si el intento está permitido y lo registra. */
  allow(clave, { max, windowMs }) {
    const ahora = this.clock().getTime();
    const recientes = (this.hits.get(clave) ?? []).filter((t) => t > ahora - windowMs);
    if (recientes.length >= max) {
      this.hits.set(clave, recientes);
      return false;
    }
    recientes.push(ahora);
    this.hits.set(clave, recientes);
    return true;
  }

  reset() {
    this.hits.clear();
  }
}

/**
 * Defensa CSRF sencilla y cabeceras seguras:
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
    reply.header('cache-control', 'no-store');
    reply.header('x-content-type-options', 'nosniff');
  });
}
