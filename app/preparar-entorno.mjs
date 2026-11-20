#!/usr/bin/env node
// Crea o completa app/.env con contraseñas y claves aleatorias para la demo local.
// Si app/.env ya existe, solo AÑADE las variables que falten (por ejemplo, las de un servicio nuevo) y no toca las demás.
// Cada persona genera las suyas: nada de esto se versiona (app/.env está en .gitignore).
//
//   node preparar-entorno.mjs        (desde la carpeta app/)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const destino = fileURLToPath(new URL('./.env', import.meta.url));
const aleatorio = (bytes = 24) => randomBytes(bytes).toString('hex');

// [nombre, comentario, valor]
const VARIABLES = [
  ['POSTGRES_PASSWORD', 'Superusuario del contenedor de PostgreSQL (solo lo usa el script que prepara las bases).', aleatorio],
  ['IDENTIDAD_DB_PASSWORD', 'Usuario propio del servicio de identidad: solo entra a sus bases (identidad e identidad_pruebas).', aleatorio],
  ['PROGRAMACION_DB_PASSWORD', 'Usuario propio del servicio de programación: solo entra a sus bases (programacion y programacion_pruebas).', aleatorio],
  ['DB_PUERTO_LOCAL', 'Puerto local de PostgreSQL (solo en 127.0.0.1), para las pruebas y para conectar un cliente como DBeaver.', () => '55432'],
  ['PROGRAMACION_SERVICE_KEY', 'Credencial del servicio de programación ante identidad (introspección y permisos).', () => aleatorio(16)],
  ['PARTICIPACION_SERVICE_KEY', 'Credencial del servicio de participación (spec 05) ante identidad y programación.', () => aleatorio(16)],
];

const actual = existsSync(destino) ? readFileSync(destino, 'utf8') : '';
const definidas = new Set(actual.split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=/)?.[1]).filter(Boolean));
const faltan = VARIABLES.filter(([nombre]) => !definidas.has(nombre));

if (faltan.length === 0) {
  console.log('app/.env ya tiene todas las variables: no se modifica.');
  process.exit(0);
}

const bloque = faltan.map(([nombre, comentario, valor]) => `# ${comentario}\n${nombre}=${valor()}`).join('\n');
const cabecera = actual ? '' : '# Generado por preparar-entorno.mjs. Valores solo para tu demo local: no lo subas a Git.\n';
const separador = actual && !actual.endsWith('\n') ? '\n' : '';
writeFileSync(destino, `${actual}${separador}${cabecera}${bloque}\n`, { mode: 0o600 });

console.log(`Listo: ${actual ? 'se completó' : 'se creó'} app/.env (${faltan.map(([n]) => n).join(', ')}). Ahora: docker compose up -d --build`);
