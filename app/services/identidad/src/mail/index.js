import { createTestTransport } from './test-transport.js';
import { createConsoleTransport } from './console-transport.js';

// Puerto de correo. En esta rama no hay transporte real: la demo y las pruebas usan el buzón de pruebas
// y el procedimiento interno del primer administrador usa la consola. Un transporte real se añade
// después implementando `send` sin cambiar el resto del servicio.
export function createMailer(config) {
  const nombre = config.mailTransport;
  if (nombre === 'test') return createTestTransport();
  if (nombre === 'console') return createConsoleTransport();
  throw new Error(`MAIL_TRANSPORT no soportado: ${nombre}. Usa "test" o "console".`);
}
