import { createTestTransport } from './test-transport.js';
import { createConsoleTransport } from './console-transport.js';
import { createBrevoTransport } from './brevo-transport.js';

// Puerto de correo. Desarrollo y pruebas usan el buzón de pruebas, el procedimiento interno del primer
// administrador usa la consola y el entorno de despliegue envía con Brevo (decisión P-12). Cada transporte
// implementa `send`: el resto del servicio no cambia.
export function createMailer(config) {
  const nombre = config.mailTransport;
  if (nombre === 'test') return createTestTransport();
  if (nombre === 'console') return createConsoleTransport();
  if (nombre === 'brevo') return createBrevoTransport(config.brevo);
  throw new Error(`MAIL_TRANSPORT no soportado: ${nombre}. Usa "test", "console" o "brevo".`);
}
