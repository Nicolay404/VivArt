import { createHash, randomBytes, randomUUID } from 'node:crypto';

/** Token opaco de 32 bytes aleatorios. Solo el hash se guarda en la base de datos. */
export function newToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function newId() {
  return randomUUID();
}

export function newShortId() {
  return randomBytes(16).toString('hex');
}

export function iso(date) {
  return date.toISOString();
}

export function expiresAt(now, ttlMs) {
  return new Date(now.getTime() + ttlMs).toISOString();
}
