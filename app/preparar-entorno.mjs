#!/usr/bin/env node
// Crea app/.env con contraseñas y claves aleatorias para la demo local, si todavía no existe.
// Cada persona genera las suyas: nada de esto se versiona (app/.env está en .gitignore).
//
//   node preparar-entorno.mjs        (desde la carpeta app/)
import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const destino = fileURLToPath(new URL('./.env', import.meta.url));
if (existsSync(destino)) {
  console.log('app/.env ya existe: no se modifica. Bórralo si quieres generar valores nuevos (y también el volumen: docker compose down -v).');
  process.exit(0);
}

const aleatorio = (bytes = 24) => randomBytes(bytes).toString('hex');

const contenido = `# Generado por preparar-entorno.mjs. Valores solo para tu demo local: no lo subas a Git.
# Superusuario del contenedor de PostgreSQL (solo lo usa el script que crea las bases).
POSTGRES_PASSWORD=${aleatorio()}
# Usuario propio del servicio de identidad: solo puede entrar a su base (identidad e identidad_pruebas).
IDENTIDAD_DB_PASSWORD=${aleatorio()}
# Puerto local de PostgreSQL (solo en 127.0.0.1), para las pruebas y para conectar un cliente como DBeaver.
DB_PUERTO_LOCAL=55432
# Credenciales de servicio para la introspección (nombre:clave). Se usarán cuando existan los otros servicios.
SERVICE_KEYS=programacion:${aleatorio(16)},participacion:${aleatorio(16)}
`;

writeFileSync(destino, contenido, { mode: 0o600 });
console.log('Listo: se creó app/.env con valores aleatorios. Ahora: docker compose up -d --build');
