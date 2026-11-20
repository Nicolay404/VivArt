import { createHmac, createHash } from 'node:crypto';

// Secretos de las entradas (research.md, decisión 13). El QR lleva `VIVART-E1:<secreto>` y el personal puede
// escribir un código alternativo de 10 caracteres. Ambos se derivan con HMAC de TICKET_KEY y el id de la entrada,
// así el dueño puede volver a verlos, y la base solo guarda su huella SHA-256 (RNF-05: códigos privados fuera de registros).

export const PREFIJO_QR = 'VIVART-E1:';
// Sin 0/O ni 1/I/L para que no se confundan al escribirlos a mano.
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export const huella = (texto) => createHash('sha256').update(String(texto)).digest('hex');

export function createCodes(ticketKey) {
  if (!ticketKey || ticketKey.length < 16) throw new Error('Falta TICKET_KEY (al menos 16 caracteres): ejecuta node preparar-entorno.mjs.');
  const mac = (etiqueta, id) => createHmac('sha256', ticketKey).update(`${etiqueta}:${id}`).digest();

  return {
    /** Secreto del QR (128 bits en base64url). */
    secreto: (id) => mac('qr', id).subarray(0, 16).toString('base64url'),
    /** Código alternativo de 10 caracteres. */
    codigo(id) {
      const bytes = mac('code', id);
      let texto = '';
      for (let i = 0; i < 10; i += 1) texto += ALFABETO[bytes[i] % ALFABETO.length];
      return texto;
    },
  };
}

/**
 * Clasifica lo escaneado o escrito: { tipo: 'qr', secreto } | { tipo: 'codigo', codigo } | { tipo: 'otro' }.
 * Un QR de Pasaporte (spec 06) o cualquier enlace no es una entrada (RC-04, FR-027).
 */
export function clasificar(texto) {
  const limpio = String(texto ?? '').trim();
  if (limpio.startsWith(PREFIJO_QR)) {
    const secreto = limpio.slice(PREFIJO_QR.length);
    return /^[A-Za-z0-9_-]{16,64}$/.test(secreto) ? { tipo: 'qr', secreto } : { tipo: 'otro' };
  }
  const codigo = limpio.toUpperCase().replace(/[\s-]/g, '');
  if (codigo.length === 10 && [...codigo].every((c) => ALFABETO.includes(c))) return { tipo: 'codigo', codigo };
  return { tipo: 'otro' };
}
