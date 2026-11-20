import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { createServices } from './services.js';
import { RateLimiter, registerSecurity } from './http/security.js';
import { createGuards } from './http/guards.js';
import { errorHandler, AppError } from './http/errors.js';
import { registerAuthRoutes } from './http/routes-auth.js';
import { registerPendingRoutes } from './http/routes-pending.js';
import { registerRoleRoutes } from './http/routes-roles.js';
import { registerAuditRoutes } from './http/routes-audit.js';
import { registerInternalRoutes } from './http/routes-internal.js';

/**
 * Fábrica de la aplicación. Devuelve la app de Fastify y los servicios (útil para pruebas y para el script interno).
 * No hay en este servicio ninguna ruta de carrito, pago, canje ni Pasaporte: son de otros specs.
 */
export async function buildApp({ config, services = createServices({ config }), logger = false } = {}) {
  const app = Fastify({ logger, trustProxy: config.trustProxy, bodyLimit: 16 * 1024 });
  await app.register(cookie);

  // Acepta cuerpos JSON vacíos (por ejemplo, un cierre de sesión enviado con tipo JSON y sin cuerpo).
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, cuerpo, done) => {
    try {
      done(null, cuerpo ? JSON.parse(cuerpo) : {});
    } catch {
      done(new AppError(400, 'invalid_json', 'El cuerpo no es un JSON válido.'));
    }
  });

  registerSecurity(app, config);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((request, reply) => reply.code(404).send({ error: 'not_found', message: 'No se encontró lo que buscas.' }));

  const guards = createGuards(services);
  const deps = { ...services, config, guards, limiter: new RateLimiter(services.clock) };

  app.get('/health', async () => ({ status: 'ok', service: 'identidad' }));
  registerAuthRoutes(app, deps);
  registerPendingRoutes(app, deps);
  registerRoleRoutes(app, deps);
  registerAuditRoutes(app, deps);
  registerInternalRoutes(app, deps);

  // Buzón de pruebas: solo con el transporte de pruebas y fuera de producción (demo y pruebas, sin correos reales).
  if (config.mailTransport === 'test' && !config.production) {
    app.get('/dev/mailbox', async () => ({ messages: services.mailer.list() }));
    app.delete('/dev/mailbox', async (request, reply) => {
      services.mailer.clear();
      return reply.code(204).send();
    });
  }

  return { app, deps };
}
