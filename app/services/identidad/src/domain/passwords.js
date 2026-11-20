import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// FR-028: al menos 15 caracteres, longitud máxima admitida de al menos 64 (aquí 128),
// espacios permitidos, sin reglas de composición.
export const MIN_LENGTH = 15;
export const MAX_LENGTH = 128;
const LONGITUD_CLAVE = 64;

export function normalize(password) {
  return password.normalize('NFKC');
}

export function validatePassword(password) {
  if (typeof password !== 'string') {
    return { ok: false, code: 'required', message: 'Escribe una contraseña.' };
  }
  const largo = [...normalize(password)].length;
  if (largo < MIN_LENGTH) {
    return { ok: false, code: 'too_short', message: `La contraseña debe tener al menos ${MIN_LENGTH} caracteres.` };
  }
  if (largo > MAX_LENGTH) {
    return { ok: false, code: 'too_long', message: `La contraseña admite como máximo ${MAX_LENGTH} caracteres.` };
  }
  return { ok: true };
}

function derivar(password, sal, { N, r, p }) {
  return scryptAsync(normalize(password), sal, LONGITUD_CLAVE, { N, r, p, maxmem: 256 * N * r });
}

/** Devuelve `scrypt$N$r$p$sal$hash`, con los parámetros guardados junto al hash. */
export async function hashPassword(password, params) {
  const sal = randomBytes(16);
  const clave = await derivar(password, sal, params);
  return `scrypt$${params.N}$${params.r}$${params.p}$${sal.toString('base64')}$${clave.toString('base64')}`;
}

export async function verifyPassword(password, guardado) {
  if (typeof guardado !== 'string') return false;
  const partes = guardado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, N, r, p, sal, hash] = partes;
  const esperado = Buffer.from(hash, 'base64');
  const obtenido = await derivar(password, Buffer.from(sal, 'base64'), { N: Number(N), r: Number(r), p: Number(p) });
  return esperado.length === obtenido.length && timingSafeEqual(esperado, obtenido);
}

/** Gasta el mismo tiempo que una verificación real, para no distinguir cuentas existentes de inexistentes. */
export async function dummyVerify(params) {
  await derivar('contraseña-ficticia-sin-uso', Buffer.alloc(16), params);
  return false;
}
