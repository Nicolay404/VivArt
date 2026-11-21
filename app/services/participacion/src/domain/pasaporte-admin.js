import { createHash } from 'node:crypto';
import QRCode from 'qrcode';
import { AppError, conflict, notFound, validation } from '../http/errors.js';
import { huella } from './codes.js';
import { leerImagen } from './imagenes.js';
import { pasaporteRepo } from '../repositories/pasaporte.js';
import { historyRepo } from '../repositories/sales.js';
import { validarVentana, huellaFuncion, funcionCambio, textoBreve, nuevoId, desactivarPorCambio } from './pasaporte.js';

// Panel del Pasaporte (spec 006, historias 4 y 5): QR por función, ventana, activación y contenido versionado.
// Solo el administrador (acción passport.manage), verificado en identidad en cada operación con fallo cerrado.

const texto300 = (v) => (typeof v === 'string' ? v.trim().slice(0, 300) : '');

export function createPasaporteAdmin({ db, programacion, permisos, refs, clock, publicBaseUrl }) {
  const repo = pasaporteRepo(db);
  const ahora = () => clock().toISOString();
  const permitir = (sesion) => permisos.permitir(sesion, 'passport.manage');
  const auditar = (tx, sesion, action, functionId, details) =>
    historyRepo(tx).add({ at: ahora(), actorId: sesion.userId, action, entityType: 'function', entityId: functionId, details: JSON.stringify(details) });

  /** La función debe existir y estar publicada en programación; una franja no tiene id de función (FR-016). */
  async function funcion(id) {
    const f = await programacion.function(id);
    if (!f) throw notFound('Esta función no existe o no está publicada: solo las funciones con fecha y hora tienen Pasaporte.');
    return f;
  }

  const enlace = (qr) => `${publicBaseUrl}/pasaporte/canje/${refs.ref(qr.id)}`;

  /** Vista del panel. Si la función cambió desde que se confirmó la ventana, el canje se desactiva aquí también (P-03). */
  async function vista(functionId, f) {
    let qr = await repo.qrVigente(functionId);
    if (qr?.status === 'active' && funcionCambio(qr.confirmed_for, f)) {
      await desactivarPorCambio(db, qr, f, ahora());
      qr = await repo.qrVigente(functionId);
    }
    const contenido = await repo.contenidoActual(functionId);
    const imagen = contenido?.image_id ? (await repo.imagenesMeta([contenido.image_id]))[0] : null;
    const url = qr ? enlace(qr) : null;
    return {
      function: f,
      qr: qr && {
        id: qr.id,
        status: qr.status,
        inactiveCause: qr.status === 'inactive' ? qr.inactive_cause : null,
        functionChanged: Boolean(qr.confirmed_for) && funcionCambio(qr.confirmed_for, f),
        url,
        svg: await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 }),
        window: qr.window_start ? { start: qr.window_start, end: qr.window_end } : null,
      },
      content: contenido && {
        version: contenido.version,
        text: contenido.text,
        image: imagen ? { url: `/api/participacion/passport/images/${imagen.id}`, alt: imagen.alt, credit: imagen.credit } : null,
      },
      stampsCount: (await repo.conteos([functionId])).get(functionId) ?? 0,
    };
  }

  async function qrObligatorio(functionId) {
    const qr = await repo.qrVigente(functionId);
    if (!qr) throw new AppError(409, 'qr_required', 'Genera primero el QR de esta función.');
    return qr;
  }

  return {
    async ver(sesion, functionId) {
      await permitir(sesion);
      return vista(functionId, await funcion(functionId));
    },

    /** Estado de varias funciones para la lista del panel. */
    async estados(sesion, functionIds) {
      await permitir(sesion);
      const ids = [...new Set(functionIds)].slice(0, 100);
      if (ids.length === 0) return { items: [] };
      const [qrs, conteos] = await Promise.all([repo.qrsVigentes(ids), repo.conteos(ids)]);
      const porFuncion = new Map(qrs.map((q) => [q.function_id, q]));
      return {
        items: ids.map((id) => {
          const q = porFuncion.get(id);
          return { functionId: id, qrStatus: q?.status ?? null, inactiveCause: q?.status === 'inactive' ? q.inactive_cause : null, stampsCount: conteos.get(id) ?? 0 };
        }),
      };
    },

    async generar(sesion, functionId) {
      await permitir(sesion);
      const f = await funcion(functionId);
      if (await repo.qrVigente(functionId)) throw conflict('qr_exists', 'Esta función ya tiene un QR vigente: usa «Reemplazar».');
      await db.transaction(`pasaporte:${functionId}`, async (tx) => {
        const id = nuevoId('qr');
        await pasaporteRepo(tx).insertQr({ id, functionId, refHash: huella(refs.ref(id)), now: ahora(), actor: sesion.userId });
        await auditar(tx, sesion, 'passport.qr.generated', functionId, { qrId: id });
      });
      return vista(functionId, f);
    },

    /** El anterior deja de valer y los sellos se conservan (FR-015). El nuevo conserva la ventana, pero hay que activarlo. */
    async reemplazar(sesion, functionId) {
      await permitir(sesion);
      const f = await funcion(functionId);
      await db.transaction(`pasaporte:${functionId}`, async (tx) => {
        const r = pasaporteRepo(tx);
        const anterior = await r.qrVigente(functionId);
        if (anterior) await r.marcarReemplazado(anterior.id, ahora(), sesion.userId);
        const id = nuevoId('qr');
        await r.insertQr({
          id,
          functionId,
          refHash: huella(refs.ref(id)),
          windowStart: anterior?.window_start,
          windowEnd: anterior?.window_end,
          confirmedFor: anterior?.confirmed_for,
          now: ahora(),
          actor: sesion.userId,
        });
        await auditar(tx, sesion, 'passport.qr.replaced', functionId, { before: anterior?.id ?? null, after: id });
      });
      return vista(functionId, f);
    },

    /** Fija o confirma la ventana con los datos vigentes de la función (FR-019). No activa el canje. */
    async ventana(sesion, functionId, cuerpo) {
      await permitir(sesion);
      const f = await funcion(functionId);
      const qr = await qrObligatorio(functionId);
      const v = validarVentana(cuerpo);
      await db.transaction(`pasaporte:${functionId}`, async (tx) => {
        await pasaporteRepo(tx).guardarVentana(qr.id, { ...v, confirmedFor: huellaFuncion(f) }, ahora(), sesion.userId);
        await auditar(tx, sesion, 'passport.qr.window_set', functionId, {
          qrId: qr.id,
          before: qr.window_start ? { start: qr.window_start, end: qr.window_end } : null,
          after: v,
          confirmedFor: huellaFuncion(f),
        });
      });
      return vista(functionId, f);
    },

    async activar(sesion, functionId) {
      await permitir(sesion);
      const f = await funcion(functionId);
      const qr = await qrObligatorio(functionId);
      if (f.status === 'cancelled') throw conflict('function_cancelled', 'La función está cancelada: no se puede activar el canje.');
      if (!qr.window_start) throw new AppError(422, 'window_required', 'Fija la ventana de canje antes de activar el QR.');
      if (funcionCambio(qr.confirmed_for, f)) {
        throw new AppError(422, 'window_required', 'La función cambió de fecha, hora o sede: confirma una ventana nueva antes de activar.');
      }
      await db.transaction(`pasaporte:${functionId}`, async (tx) => {
        await pasaporteRepo(tx).activar(qr.id, ahora(), sesion.userId);
        await auditar(tx, sesion, 'passport.qr.activated', functionId, { qrId: qr.id, window: { start: qr.window_start, end: qr.window_end } });
      });
      return vista(functionId, f);
    },

    async desactivar(sesion, functionId) {
      await permitir(sesion);
      const f = await funcion(functionId);
      const qr = await qrObligatorio(functionId);
      await db.transaction(`pasaporte:${functionId}`, async (tx) => {
        if ((await pasaporteRepo(tx).desactivar(qr.id, 'manual', ahora(), sesion.userId)) > 0) {
          await auditar(tx, sesion, 'passport.qr.deactivated', functionId, { qrId: qr.id, cause: 'manual' });
        }
      });
      return vista(functionId, f);
    },

    /**
     * Nueva versión del contenido (M-11): `text` (texto plano, hasta 280) e `image` (objeto nuevo, null para quitarla,
     * u omitida para conservar la anterior). Los sellos emitidos conservan su versión.
     */
    async contenido(sesion, functionId, cuerpo) {
      await permitir(sesion);
      const f = await funcion(functionId);
      const errores = {};
      let texto = null;
      try {
        texto = textoBreve(cuerpo?.text);
      } catch (e) {
        Object.assign(errores, e.extra?.fields);
      }
      let imagenNueva = null;
      if (cuerpo?.image && typeof cuerpo.image === 'object') {
        const alt = texto300(cuerpo.image.alt);
        const credit = texto300(cuerpo.image.credit);
        if (alt.length < 3) errores.alt = 'Describe la imagen para quien no puede verla (texto alternativo).';
        if (credit.length < 3) errores.credit = 'Indica la fuente o la autoría de la imagen.';
        const leida = leerImagen(cuerpo.image.dataBase64);
        if (leida.error) errores.image = leida.error;
        else imagenNueva = { ...leida, alt, credit, sha256: createHash('sha256').update(leida.bytes).digest('hex') };
      } else if (cuerpo?.image !== undefined && cuerpo?.image !== null) {
        errores.image = 'La imagen no es válida.';
      }
      if (Object.keys(errores).length) throw validation(errores);

      await db.transaction(`pasaporte:${functionId}`, async (tx) => {
        const r = pasaporteRepo(tx);
        const anterior = await r.contenidoActual(functionId);
        let imageId = cuerpo?.image === undefined ? (anterior?.image_id ?? null) : null;
        if (imagenNueva) {
          imageId = nuevoId('img');
          await r.insertImagen({ id: imageId, ...imagenNueva, now: ahora(), actor: sesion.userId });
        }
        const id = nuevoId('cont');
        await r.insertContenido({ id, functionId, text: texto, imageId, now: ahora(), actor: sesion.userId });
        await auditar(tx, sesion, 'passport.content.set', functionId, {
          contentId: id,
          text: texto,
          imageId,
          ...(imagenNueva ? { alt: imagenNueva.alt, credit: imagenNueva.credit, mime: imagenNueva.mime, size: imagenNueva.bytes.length } : {}),
        });
      });
      return vista(functionId, f);
    },
  };
}
