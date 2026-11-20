import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// FR-026, FR-027 y SC-015: el repositorio no contiene credenciales, claves ni contraseñas fijas.
// Recorre los archivos que Git versionaría (rastreados o nuevos y no ignorados), excluyendo las pruebas,
// que usan valores de ejemplo a propósito.
const RAIZ = fileURLToPath(new URL('../../../../../', import.meta.url));

function archivosVersionables() {
  const salida = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: RAIZ, encoding: 'utf8' });
  return salida.split('\0').filter(Boolean);
}

const ES_PRUEBA = /(^|\/)test\//;
const BINARIO = /\.(png|jpe?g|pdf|ico|gif|woff2?)$/i;
const PATRONES = [
  [/-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/, 'clave privada'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'clave de acceso de AWS'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, 'token de GitHub'],
  [/\bsk-[A-Za-z0-9]{32,}\b/, 'clave de API'],
  [/\b(password|contrase[nñ]a|passwd|secret|api[_-]?key|service[_-]?key)\s*[:=]\s*['"][^'"\s]{8,}['"]/i, 'credencial fija'],
  [/SERVICE_KEYS\s*=\s*\S*:[A-Za-z0-9_-]{6,}/, 'claves de servicio con valor'],
];

test('SC-015: ningún archivo versionable contiene credenciales fijas', () => {
  const hallazgos = [];
  for (const archivo of archivosVersionables()) {
    if (ES_PRUEBA.test(archivo) || BINARIO.test(archivo) || archivo.startsWith('specs/') || archivo.startsWith('context/') || archivo.startsWith('docs/')) continue;
    let texto;
    try { texto = readFileSync(join(RAIZ, archivo), 'utf8'); } catch { continue; }
    for (const [patron, nombre] of PATRONES) {
      if (patron.test(texto)) hallazgos.push(`${archivo}: ${nombre}`);
    }
  }
  assert.deepEqual(hallazgos, []);
});

test('SC-015: el archivo de ejemplo de variables no trae secretos y .env no se versiona', () => {
  const ejemplo = readFileSync(join(RAIZ, 'app/services/identidad/.env.example'), 'utf8');
  assert.match(ejemplo, /^SERVICE_KEYS=\s*$/m); // vacío: cada entorno define sus claves
  const versionables = archivosVersionables();
  assert.ok(!versionables.some((a) => /(^|\/)\.env$/.test(a)));
  assert.ok(!versionables.some((a) => /\.sqlite/.test(a)));
  assert.ok(!versionables.some((a) => /\.pdf$/i.test(a) && /PROGRAMACION/i.test(a)));
});

test('FR-027: ningún archivo de código define una contraseña de administrador por defecto', () => {
  for (const archivo of ['app/services/identidad/bin/crear-primer-administrador.js', 'app/services/identidad/src/domain/accounts.js']) {
    const texto = readFileSync(join(RAIZ, archivo), 'utf8');
    assert.ok(!/admin(istrador)?\w*\s*[:=]\s*['"][^'"]{6,}['"]\s*[,;]?\s*\/\/\s*contrase/i.test(texto), archivo);
    assert.ok(!/defaultPassword|PASSWORD_POR_DEFECTO|admin123/i.test(texto), archivo);
  }
});
