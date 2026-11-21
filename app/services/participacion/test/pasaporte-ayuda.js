import { pedir } from './helpers.js';

// Ayudas de las pruebas del Pasaporte (spec 006). El reloj de las pruebas empieza el 2026-11-21 a las 18:00 en Loja.

export const VENTANA = { start: '2026-11-21 17:00', end: '2026-11-22 23:00' };

/** El administrador genera el QR de una función, fija la ventana y lo activa. Devuelve la vista del panel y el ref. */
export async function qrActivo(ctx, functionId, ventana = VENTANA) {
  const pasos = [
    ['POST', `/panel/functions/${functionId}/passport/qr`],
    ['PUT', `/panel/functions/${functionId}/passport/window`, ventana],
    ['POST', `/panel/functions/${functionId}/passport/activate`],
  ];
  let r;
  for (const [metodo, url, cuerpo] of pasos) {
    r = await pedir(ctx, 'admin', metodo, url, cuerpo);
    if (r.status >= 300) throw new Error(`${metodo} ${url}: ${r.status} ${r.body}`);
  }
  return { vista: r.json, ref: refDe(r.json) };
}

export const refDe = (vista) => vista.qr.url.split('/pasaporte/canje/')[1];

export const reclamar = (ctx, quien, ref) => pedir(ctx, quien, 'POST', '/passport/claims', { ref });
