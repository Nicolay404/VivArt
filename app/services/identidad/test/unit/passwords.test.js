import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePassword, hashPassword, verifyPassword, MIN_LENGTH, MAX_LENGTH } from '../../src/domain/passwords.js';

const PARAMS = { N: 1024, r: 8, p: 1 };

test('SC-011: 14 caracteres se rechazan y 15 se aceptan', () => {
  assert.equal(validatePassword('a'.repeat(14)).ok, false);
  assert.equal(validatePassword('a'.repeat(14)).code, 'too_short');
  assert.equal(validatePassword('a'.repeat(MIN_LENGTH)).ok, true);
});

test('SC-011: se aceptan 64 y 128 caracteres y se rechazan 129', () => {
  assert.equal(validatePassword('b'.repeat(64)).ok, true);
  assert.equal(validatePassword('b'.repeat(MAX_LENGTH)).ok, true);
  assert.equal(validatePassword('b'.repeat(MAX_LENGTH + 1)).code, 'too_long');
});

test('SC-011: espacios permitidos y sin reglas de composición', () => {
  assert.equal(validatePassword('esto es una frase larga').ok, true); // sin mayúsculas, números ni símbolos
  assert.equal(validatePassword('               ').ok, true); // quince espacios cuentan como caracteres
});

test('una contraseña que no es texto se rechaza', () => {
  assert.equal(validatePassword(undefined).ok, false);
  assert.equal(validatePassword(12345678901234567890).ok, false);
});

test('el hash no contiene la contraseña y guarda sus parámetros', async () => {
  const clave = 'una clave suficientemente larga';
  const hash = await hashPassword(clave, PARAMS);
  assert.match(hash, /^scrypt\$1024\$8\$1\$/);
  assert.ok(!hash.includes(clave));
});

test('verifica la contraseña correcta y rechaza la incorrecta', async () => {
  const hash = await hashPassword('clave número uno larga', PARAMS);
  assert.equal(await verifyPassword('clave número uno larga', hash), true);
  assert.equal(await verifyPassword('clave número dos larga', hash), false);
});

test('la normalización NFKC trata de igual forma textos equivalentes', async () => {
  const hash = await hashPassword('ｃｌａｖｅ ancha de ejemplo', PARAMS); // caracteres de ancho completo
  assert.equal(await verifyPassword('clave ancha de ejemplo', hash), true);
});

test('dos hashes de la misma contraseña son distintos (sal aleatoria)', async () => {
  const a = await hashPassword('misma contraseña larga', PARAMS);
  const b = await hashPassword('misma contraseña larga', PARAMS);
  assert.notEqual(a, b);
});

test('un hash mal formado no se acepta', async () => {
  assert.equal(await verifyPassword('x', 'no-es-un-hash'), false);
  assert.equal(await verifyPassword('x', null), false);
});
