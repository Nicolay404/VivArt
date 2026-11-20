import { loadConfig } from './config.js';
import { buildApp } from './app.js';

const config = loadConfig();

if (config.clockIgnored) console.warn('Aviso: CLOCK_FIXED se ignora en producción; se usa el reloj real (RC-07).');
if (config.clockFixed) console.warn(`Aviso: reloj fijado para pruebas o demo en ${config.clock().toISOString()}.`);
if (!config.identidadServiceKey) console.warn('Aviso: IDENTIDAD_SERVICE_KEY vacío; no se podrán comprobar sesiones ni permisos.');
if (config.paymentSimulator) console.warn('Aviso: simulador de pago de prueba activo (solo demo o pruebas; no procesa dinero).');

const { app } = await buildApp({
  config,
  // RNF-05: ni cookies, ni credenciales, ni cuerpos (códigos de entradas) en los registros.
  logger: { level: 'info', redact: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-service-key"]'] },
});

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
