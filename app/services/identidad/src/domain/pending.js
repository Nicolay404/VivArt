import { newShortId, iso, expiresAt } from './tokens.js';
import { validation } from '../http/errors.js';

const TIPOS = new Set(['compra', 'canje']);
const REF_RE = /^[A-Za-z0-9_-]{1,64}$/;

// Contrato de retorno a la acción original (FR-031 a FR-035).
// Este módulo SOLO conserva el tipo y la referencia y calcula el destino de retorno.
// No ejecuta pagos ni canjes: la revalidación y el paso final los define el servicio dueño (spec 05 y spec 06).
export function createPending({ repos, config, clock }) {
  function destino(fila) {
    // El destino lo fija el servicio, nunca la persona: evita redirecciones abiertas.
    return fila.type === 'compra' ? '/carrito' : `/pasaporte/canje/${fila.ref}`;
  }

  return {
    async create({ type, ref }) {
      if (!TIPOS.has(type)) throw validation('type', 'La acción debe ser una compra o un canje.');
      if (ref !== undefined && ref !== null && !REF_RE.test(String(ref))) {
        throw validation('ref', 'La referencia solo admite letras, números, guiones y guiones bajos (hasta 64).');
      }
      if (type === 'canje' && (ref === undefined || ref === null)) {
        throw validation('ref', 'El canje necesita la referencia del código.');
      }
      const now = clock();
      const id = newShortId();
      const vence = expiresAt(now, config.ttl.pending);
      await repos.pending.create({ id, type, ref: ref ?? null, now: iso(now), expiresAt: vence });
      return { id, expiresAt: vence };
    },

    /** Devuelve a la persona al punto de origen. Siempre `executed: false`. */
    async resume(pendingId, persona) {
      const fila = pendingId ? await repos.pending.find(pendingId) : undefined;
      const noEncontrada = { found: false, executed: false };
      if (!fila) return noEncontrada;
      if (fila.expires_at <= iso(clock())) {
        await repos.pending.delete(fila.id);
        return noEncontrada;
      }
      if (fila.user_id && fila.user_id !== persona.userId) return noEncontrada;
      if (!fila.user_id) await repos.pending.attachUser(fila.id, persona.userId);

      const canProceed = persona.emailVerified;
      return {
        found: true,
        type: fila.type,
        ref: fila.ref,
        destination: destino(fila),
        emailVerified: persona.emailVerified,
        canProceed,
        blockedReason: canProceed ? null : 'email_not_verified',
        executed: false,
        revalidation: {
          owner: 'participacion',
          operation: fila.type === 'compra' ? 'revalidar-compra' : 'revalidar-canje',
        },
      };
    },

    async discard(pendingId) {
      if (pendingId) await repos.pending.delete(pendingId);
    },
  };
}
