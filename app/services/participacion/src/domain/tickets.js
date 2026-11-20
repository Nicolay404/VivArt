import QRCode from 'qrcode';
import { PREFIJO_QR } from './codes.js';

// Mis entradas (FR-017, FR-032, FR-035, FR-040). El estado se calcula con la función VIGENTE en programación:
// una cancelación o reprogramación se ve al instante. Si programación no responde, el estado es «sin confirmar» (RNF-07).

export function estadoEntrada(t, f, verificable) {
  if (t.status === 'invalidated') return 'invalidated';
  if (t.used_at) return 'used';
  if (!verificable) return 'unverified';
  if (!f || f.status === 'cancelled' || f.activityStatus === 'archived') return 'function_cancelled';
  return 'valid';
}

export function createTickets({ db, programacion, codes }) {
  return {
    async mias(sesion) {
      const filas = await db.query(
        `SELECT t.*, i.function_title, i.function_date, i.function_start
           FROM tickets t JOIN order_items i ON i.order_id = t.order_id AND i.function_id = t.function_id
          WHERE t.user_id = $1 ORDER BY i.function_date, i.function_start, t.order_id, t.seq`,
        [sesion.userId],
      );
      let funciones = new Map();
      let verificable = true;
      try {
        funciones = await programacion.functions(filas.map((t) => t.function_id));
      } catch {
        verificable = false;
      }
      const items = [];
      for (const t of filas) {
        const f = funciones.get(t.function_id);
        const contenido = `${PREFIJO_QR}${codes.secreto(t.id)}`;
        items.push({
          id: t.id,
          orderId: t.order_id,
          functionId: t.function_id,
          title: f?.title ?? t.function_title,
          date: f?.date ?? t.function_date,
          startTime: f?.startTime ?? t.function_start,
          venueName: f?.venueName ?? null,
          state: estadoEntrada(t, f, verificable),
          usedAt: t.used_at,
          invalidationReason: t.invalidation_reason,
          notice: f?.latestNotice ?? null,
          qrSvg: await QRCode.toString(contenido, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 }),
          code: codes.codigo(t.id),
          checkedAt: new Date().toISOString(),
        });
      }
      return { items, verified: verificable };
    },
  };
}
