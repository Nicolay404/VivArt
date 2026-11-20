import Fastify from 'fastify';
import { createServices } from './services.js';
import { registerSecurity } from './http/security.js';
import { errorHandler, AppError } from './http/errors.js';
import { registerRoutes } from './http/routes.js';

/**
 * Fábrica de la aplicación. Devuelve la app de Fastify y los servicios (útil para pruebas y scripts).
 * Servicio de participación: venta con pagos de prueba, entradas con QR y control de acceso (spec 005).
 */
export async function buildApp({ config, services, logger = false } = {}) {
  services ??= await createServices({ config });
  const app = Fastify({ logger, bodyLimit: 64 * 1024 });
  app.addHook('onClose', async () => services.db.close());

  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, texto, done) => {
    try {
      done(null, texto ? JSON.parse(texto) : {});
    } catch {
      done(new AppError(400, 'invalid_json', 'El cuerpo no es un JSON válido.'));
    }
  });

  registerSecurity(app, config);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((request, reply) => reply.code(404).send({ error: 'not_found', message: 'No se encontró lo que buscas.' }));

  app.get('/health', async (request, reply) => {
    try {
      await services.db.query('SELECT 1');
      return { status: 'ok', service: 'participacion' };
    } catch {
      return reply.code(503).send({ status: 'error', service: 'participacion', message: 'La base de datos no responde.' });
    }
  });
  registerRoutes(app, services, config);
  return { app, services };
}
