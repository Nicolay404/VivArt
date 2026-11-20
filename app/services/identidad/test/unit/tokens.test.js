import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newToken, hashToken, expiresAt } from '../../src/domain/tokens.js';

test('SC-014: los tokens son aleatorios, largos y solo se guarda su hash', () => {
  const a = newToken();
  const b = newToken();
  assert.notEqual(a.token, b.token);
  assert.ok(a.token.length >= 43); // 32 bytes en base64url
  assert.notEqual(a.hash, a.token);
  assert.equal(a.hash, hashToken(a.token));
  assert.match(a.hash, /^[0-9a-f]{64}$/);
});

test('el vencimiento se calcula desde el reloj indicado', () => {
  const ahora = new Date('2026-11-20T10:00:00.000Z');
  assert.equal(expiresAt(ahora, 3600 * 1000), '2026-11-20T11:00:00.000Z');
});
