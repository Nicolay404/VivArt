import { AppError } from '../http/errors.js';

/** Si programación no responde, nada se vende ni se admite: se informa que no se pudo verificar (RNF-07, FR-018). */
export const noVerificable = () =>
  new AppError(503, 'not_verifiable', 'No se pudo verificar la programación en este momento. Inténtalo de nuevo en unos minutos.');

/**
 * Cliente del servicio de programación (spec 002). Participación no copia la programación: consulta el estado
 * vigente de la función (fecha, hora, sede, cancelada, precio) cada vez que lo necesita (research.md, decisión 3).
 */
export function createProgramacionClient({ url, serviceKey, timeoutMs = 3000, fetchImpl = fetch }) {
  async function obtener(ruta) {
    let r;
    try {
      r = await fetchImpl(`${url}${ruta}`, { headers: { 'x-service-key': serviceKey }, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      throw noVerificable();
    }
    if (r.status === 404) return null;
    if (!r.ok) throw noVerificable();
    return r.json();
  }

  return {
    /** Función publicada o null si no existe o no está publicada. */
    function: (id) => obtener(`/internal/functions/${encodeURIComponent(id)}`),
    /** Map id -> función para varias a la vez; las que no existen no aparecen. */
    async functions(ids) {
      const unicos = [...new Set(ids)].filter(Boolean);
      if (unicos.length === 0) return new Map();
      const datos = await obtener(`/internal/functions?ids=${unicos.map(encodeURIComponent).join(',')}`);
      return new Map((datos?.items ?? []).map((f) => [f.id, f]));
    },
  };
}
