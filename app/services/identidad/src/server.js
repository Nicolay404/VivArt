import { loadConfig } from './config.js';
import { buildApp } from './app.js';

const config = loadConfig();

// FR-030: en el entorno de despliegue no hay buzón de pruebas; los correos salen con el proveedor real.
if (config.production && config.mailTransport === 'test') {
  console.error('Error: MAIL_TRANSPORT=test no se admite con NODE_ENV=production. Usa MAIL_TRANSPORT=brevo.');
  process.exit(1);
}
if (config.serviceKeys.size === 0) {
  console.warn('Aviso: SERVICE_KEYS vacío; ningún servicio podrá usar la introspección.');
}

const { app } = await buildApp({
  config,
  logger: {
    level: 'info',
    redact: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-service-key"]'],
  },
});

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
