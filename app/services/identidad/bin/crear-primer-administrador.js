#!/usr/bin/env node
// Procedimiento interno y documentado para habilitar la primera cuenta administrativa (FR-027).
//
//   node bin/crear-primer-administrador.js --email correo@ejemplo.com [--permitir-adicional]
//
// Crea la cuenta PENDIENTE DE ACTIVACIÓN con rol administrador para el correo designado y emite el enlace de
// activación. El titular abre el enlace y establece su propia contraseña. No define contraseñas ni credenciales
// predeterminadas. El enlace se imprime por consola (no se envía correo real) y es de un solo uso.
import { loadConfig } from '../src/config.js';
import { createServices } from '../src/services.js';

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const email = argumento('--email');
if (!email) {
  console.error('Falta el correo designado. Uso: node bin/crear-primer-administrador.js --email correo@ejemplo.com');
  process.exit(2);
}

const config = loadConfig({ ...process.env, MAIL_TRANSPORT: process.env.MAIL_TRANSPORT ?? 'console' });
if (config.mailTransport === 'test') {
  console.error('MAIL_TRANSPORT=test guarda el enlace en memoria y se pierde al terminar. Usa MAIL_TRANSPORT=console.');
  process.exit(2);
}

try {
  const servicios = createServices({ config });
  await servicios.accounts.createFirstAdmin(email, { allowAdditional: process.argv.includes('--permitir-adicional') });
  console.log(`\nCuenta administrativa pendiente de activación para ${email.trim().toLowerCase()}.`);
  console.log('Entrega el enlace impreso arriba solo a su titular: establecerá su contraseña al abrirlo.');
  servicios.db.close();
} catch (error) {
  console.error(`No se pudo crear la cuenta: ${error.message}`);
  process.exit(1);
}
