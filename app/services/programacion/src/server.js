import { loadConfig } from './config.js';
import { buildApp } from './app.js';

const config = loadConfig();

if (config.clockIgnored) console.warn('Aviso: CLOCK_FIXED se ignora en producción; se usa el reloj real (RC-07).');
if (config.clockFixed) console.warn(`Aviso: reloj fijado para pruebas o demo en ${config.clock().toISOString()}.`);
if (!config.identidadServiceKey) console.warn('Aviso: IDENTIDAD_SERVICE_KEY vacío; el panel no podrá comprobar permisos.');
if (!config.participacionUrl) console.warn('Aviso: sin PARTICIPACION_URL; el conteo de entradas se informará como «no disponible».');

const { app } = await buildApp({
  config,
  logger: { level: 'info', redact: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-service-key"]'] },
});

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
