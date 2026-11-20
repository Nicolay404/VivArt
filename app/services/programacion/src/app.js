import Fastify from 'fastify';
import { createServices } from './services.js';
import { registerSecurity } from './http/security.js';
import { errorHandler, AppError } from './http/errors.js';
import { registerRoutes } from './http/routes.js';

/**
 * Fábrica de la aplicación. Devuelve la app de Fastify y los servicios (útil para pruebas y scripts).
 * No hay en este servicio ninguna ruta ni dato de venta: publicar no activa ventas (FR-014; la venta es del spec 05).
 */
export async function buildApp({ config, services, logger = false } = {}) {
  services ??= await createServices({ config });
  // Los lotes de carga pueden pesar algo más que el resto de solicitudes.
  const app = Fastify({ logger, bodyLimit: 2 * 1024 * 1024 });
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
      return { status: 'ok', service: 'programacion' };
    } catch {
      return reply.code(503).send({ status: 'error', service: 'programacion', message: 'La base de datos no responde.' });
    }
  });
  registerRoutes(app, services, config);
  return { app, services };
}
