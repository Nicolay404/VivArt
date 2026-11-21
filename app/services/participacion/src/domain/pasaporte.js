import { createHmac, randomBytes } from 'node:crypto';
import { AppError, notFound, validation } from '../http/errors.js';
import { PREFIJO_QR, huella } from './codes.js';
import { pasaporteRepo } from '../repositories/pasaporte.js';
import { historyRepo } from '../repositories/sales.js';

// Pasaporte Vivo (spec 006): canje del sello con el enlace del QR, colección y detalle del sello.
// La función nunca se copia: sus datos vigentes se piden a programación (P-14 pendiente; research.md, decisión 9).

// ---------- Utilidades puras ----------

/** `ref` del enlace /pasaporte/canje/{ref}: HMAC del id del QR, 128 bits en base64url (22 caracteres). */
export function createRefs(ticketKey) {
  if (!ticketKey || ticketKey.length < 16) throw new Error('Falta TICKET_KEY (al menos 16 caracteres): ejecuta node preparar-entorno.mjs.');
  return { ref: (qrId) => createHmac('sha256', ticketKey).update(`pasaporte:${qrId}`).digest().subarray(0, 16).toString('base64url') };
}

const REF_RE = /^[A-Za-z0-9_-]{22}$/;

/** 'entrada' (QR de entrada, RC-04) | 'valido' | 'invalido'. */
export function clasificarRef(ref) {
  const texto = String(ref ?? '').trim();
  let decodificado = texto;
  try {
    decodificado = decodeURIComponent(texto);
  } catch {
    decodificado = texto;
  }
  if (decodificado.startsWith(PREFIJO_QR)) return 'entrada';
  return REF_RE.test(texto) ? 'valido' : 'invalido';
}

const dos = (n) => String(n).padStart(2, '0');

/** Fecha y hora local de Loja (UTC−5 todo el año, RC-07) como 'AAAA-MM-DD HH:MM'. */
export function horaLoja(instante) {
  const l = new Date(instante.getTime() - 5 * 3600 * 1000);
  return `${l.getUTCFullYear()}-${dos(l.getUTCMonth() + 1)}-${dos(l.getUTCDate())} ${dos(l.getUTCHours())}:${dos(l.getUTCMinutes())}`;
}

const MOMENTO_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

function momentoValido(texto) {
  const m = MOMENTO_RE.exec(String(texto ?? ''));
  if (!m) return false;
  const [, a, mes, d, h, min] = m.map(Number);
  const fecha = new Date(Date.UTC(a, mes - 1, d));
  return fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === d && h < 24 && min < 60;
}

/** Ventana de canje en hora de Loja; sin valor por defecto (M-10). */
export function validarVentana(cuerpo) {
  const start = typeof cuerpo?.start === 'string' ? cuerpo.start.trim() : '';
  const end = typeof cuerpo?.end === 'string' ? cuerpo.end.trim() : '';
  const errores = {};
  if (!momentoValido(start)) errores.start = 'Indica el inicio de la ventana (AAAA-MM-DD HH:MM, hora de Loja).';
  if (!momentoValido(end)) errores.end = 'Indica el fin de la ventana (AAAA-MM-DD HH:MM, hora de Loja).';
  if (!errores.start && !errores.end && end <= start) errores.end = 'El fin de la ventana debe ser posterior al inicio.';
  if (Object.keys(errores).length) throw validation(errores);
  return { start, end };
}

/** 'not_open' | 'open' | 'expired'. Los extremos cuentan como abiertos. */
export function estadoVentana(qr, ahora) {
  const actual = horaLoja(ahora);
  if (actual < qr.window_start) return 'not_open';
  if (actual > qr.window_end) return 'expired';
  return 'open';
}

/** Lo que se guarda de la función al confirmar la ventana, para detectar un cambio (P-03). */
export const huellaFuncion = (f) => ({ date: f.date, startTime: f.startTime, venueId: f.venueId });

export function funcionCambio(confirmada, f) {
  if (!confirmada) return false;
  const actual = huellaFuncion(f);
  return confirmada.date !== actual.date || confirmada.startTime !== actual.startTime || confirmada.venueId !== actual.venueId;
}

/** Texto breve del sello: texto plano de hasta 280 caracteres; null si queda vacío (M-12). */
export function textoBreve(valor) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') throw validation({ text: 'El texto del sello debe ser texto.' });
  // Sin caracteres de control (salvo el salto de línea). Nunca se interpreta como HTML: la web usa textContent.
  const limpio = [...valor].filter((c) => c === '\n' || c.codePointAt(0) >= 0x20).join('').trim();
  if ([...limpio].length > 280) throw validation({ text: 'El texto del sello puede tener hasta 280 caracteres.' });
  return limpio || null;
}

export const nuevoId = (prefijo) => `${prefijo}_${randomBytes(12).toString('hex')}`;

// ---------- Rechazos del canje (FR-007, FR-009) ----------

const MENSAJES = {
  wrong_code_type: 'Tipo de código incorrecto: este código no es un QR del Pasaporte.',
  qr_not_found: 'Este QR del Pasaporte no es válido.',
  qr_replaced: 'Este QR fue reemplazado y ya no está vigente.',
  qr_inactive: 'El canje de esta función no está activo.',
  qr_inactive_function_changed: 'El canje se desactivó porque la función cambió de fecha, hora o sede.',
  window_not_open: 'El canje de esta función aún no está abierto.',
  window_expired: 'La ventana de canje de esta función ya terminó.',
  function_cancelled: 'Esta función fue cancelada o ya no está en la programación: no se entregan sellos nuevos.',
  email_not_verified: 'Verifica tu correo para reclamar el sello.',
  not_verifiable: 'No se pudo verificar el canje: el sello no está confirmado. Inténtalo de nuevo en unos minutos.',
};
const ESTADOS = { email_not_verified: 403, not_verifiable: 503 };

export function rechazo(motivo, cause = null) {
  const mensaje = MENSAJES[cause ? `${motivo}_${cause}` : motivo] ?? MENSAJES[motivo];
  return new AppError(ESTADOS[motivo] ?? 409, motivo, mensaje, motivo === 'qr_inactive' ? { cause: cause ?? 'manual' } : {});
}

/** Desactiva un QR activo cuya función cambió de fecha, hora o sede, y lo deja en el historial (P-03). */
export async function desactivarPorCambio(db, qr, f, momento) {
  const cambiadas = await pasaporteRepo(db).desactivar(qr.id, 'function_changed', momento, 'sistema');
  if (cambiadas > 0) {
    await historyRepo(db).add({
      at: momento,
      actorId: 'sistema',
      action: 'passport.qr.deactivated',
      entityType: 'function',
      entityId: qr.function_id,
      details: JSON.stringify({ qrId: qr.id, cause: 'function_changed', before: qr.confirmed_for, after: huellaFuncion(f) }),
    });
  }
}

// ---------- Canje y colección ----------

export function createPasaporte({ db, programacion, clock }) {
  const repo = pasaporteRepo(db);

  async function funcionVigente(id) {
    try {
      return await programacion.function(id);
    } catch (error) {
      if (error?.code === 'not_verifiable') throw rechazo('not_verifiable');
      throw error;
    }
  }

  /** Contenido (versión) e imagen de varios sellos: Map contentId -> { text, image }. */
  async function contenidosDe(contentIds) {
    const ids = [...new Set(contentIds.filter(Boolean))];
    if (ids.length === 0) return new Map();
    const contenidos = await repo.contenidos(ids);
    const imagenes = new Map((await repo.imagenesMeta(contenidos.map((c) => c.image_id).filter(Boolean))).map((i) => [i.id, i]));
    return new Map(
      contenidos.map((c) => {
        const img = c.image_id ? imagenes.get(c.image_id) : null;
        return [c.id, { text: c.text, image: img ? { url: `/api/participacion/passport/images/${img.id}`, alt: img.alt, credit: img.credit } : null }];
      }),
    );
  }

  function presentar(s, f, contenidos) {
    const c = s.content_id ? contenidos.get(s.content_id) : null;
    return {
      id: s.id,
      functionId: s.function_id,
      activityId: f?.activityId ?? null,
      title: f?.title ?? null,
      date: f?.date ?? null,
      startTime: f?.startTime ?? null,
      venueName: f?.venueName ?? null,
      functionStatus: f ? f.status : null,
      notice: f?.latestNotice ?? null,
      obtainedAt: s.obtained_at,
      content: c && (c.text || c.image) ? c : null,
    };
  }

  async function presentarUno(s, f) {
    return presentar(s, f, await contenidosDe([s.content_id]));
  }

  return {
    /**
     * Reclamar el sello (orden de comprobaciones: research.md, decisión 10).
     * `obtenerSesion` lanza 401 sin sesión: así un enlace mal formado se rechaza antes de pedir identificarse.
     */
    async reclamar(ref, obtenerSesion) {
      const tipo = clasificarRef(ref);
      if (tipo === 'entrada') throw rechazo('wrong_code_type');
      if (tipo !== 'valido') throw rechazo('qr_not_found');
      const qr = await repo.qrPorHuella(huella(ref));
      if (!qr) throw rechazo('qr_not_found');

      const sesion = await obtenerSesion();
      if (!sesion.emailVerified) throw rechazo('email_not_verified');

      // Reabrir el enlace siempre devuelve el mismo sello, aunque el QR se haya reemplazado o la ventana haya cerrado (FR-003).
      const existente = await repo.selloDe(sesion.userId, qr.function_id);
      if (existente) return { created: false, stamp: await presentarUno(existente, await funcionVigente(qr.function_id).catch(() => null)) };

      if (qr.status === 'replaced') throw rechazo('qr_replaced');
      const f = await funcionVigente(qr.function_id);
      if (!f || f.status === 'cancelled' || f.activityStatus === 'archived') throw rechazo('function_cancelled');
      const momento = clock();
      if (qr.status === 'active' && funcionCambio(qr.confirmed_for, f)) {
        await desactivarPorCambio(db, qr, f, momento.toISOString());
        throw rechazo('qr_inactive', 'function_changed');
      }
      if (qr.status !== 'active') throw rechazo('qr_inactive', qr.inactive_cause ?? 'manual');
      const ventana = estadoVentana(qr, momento);
      if (ventana !== 'open') throw rechazo(ventana === 'not_open' ? 'window_not_open' : 'window_expired');

      const contenido = await repo.contenidoActual(qr.function_id);
      const nuevo = await repo.insertSello({
        id: nuevoId('sello'),
        userId: sesion.userId,
        functionId: qr.function_id,
        qrId: qr.id,
        contentId: contenido?.id ?? null,
        now: momento.toISOString(),
      });
      // Si otra solicitud simultánea ganó la carrera, se devuelve su sello (RC-05).
      const sello = nuevo ?? (await repo.selloDe(sesion.userId, qr.function_id));
      return { created: Boolean(nuevo), stamp: await presentarUno(sello, f) };
    },

    /** Mi pasaporte: total de sellos, sin meta global (M-01). Si programación no responde, verified = false. */
    async coleccion(sesion) {
      const sellos = await repo.sellosDe(sesion.userId);
      let funciones = new Map();
      let verified = true;
      try {
        funciones = await programacion.functions(sellos.map((s) => s.function_id));
      } catch {
        verified = false;
      }
      const contenidos = await contenidosDe(sellos.map((s) => s.content_id));
      return { total: sellos.length, verified, items: sellos.map((s) => presentar(s, funciones.get(s.function_id), contenidos)) };
    },

    /** Detalle de un sello propio; uno ajeno da 404 para no revelar que existe (SC-007). */
    async sello(sesion, id) {
      const s = await repo.sello(id);
      if (!s || s.user_id !== sesion.userId) throw notFound('No encontramos este sello en tu pasaporte.');
      let f = null;
      let verified = true;
      try {
        f = await programacion.function(s.function_id);
      } catch {
        verified = false;
      }
      return { ...(await presentarUno(s, f)), verified };
    },

    async imagen(id) {
      const img = await repo.imagenBytes(String(id).slice(0, 100));
      if (!img) throw notFound('Esta imagen no existe.');
      return img;
    },
  };
}
