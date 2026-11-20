import { loadConfig } from './config.js';
import { buildApp } from './app.js';

const config = loadConfig();

if (config.production && config.mailTransport === 'test') {
  console.warn('Aviso: MAIL_TRANSPORT=test en producción; el buzón de pruebas no envía correos reales.');
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
