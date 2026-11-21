import { createHash } from 'node:crypto';
import { enLoja, fechaValida } from '../clock.js';
import { textoONulo } from './text.js';
import { validation, notFound } from '../http/errors.js';
import { CARACTERISTICAS, destinoDeFila, accesibilidadCompleta, resumenSede, ILUSTRACION } from './mapa.js';

// Mantenimiento de las sedes por el administrador (spec 003, FR-017, FR-018, FR-021, FR-023, FR-025).
// Sin revisión editorial y sin aviso público (RC-06); cada cambio queda en el historial con lo que cambió.
// Todas las operaciones exigen `catalog.manage` (administrador), verificado en identidad con fallo cerrado.

export const FOTO_MAX_BYTES = 1024 * 1024;
const ESTADOS = new Set(['confirmed', 'unavailable', 'unconfirmed']);
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Tipo real de la imagen por sus bytes iniciales: solo JPEG, PNG o WebP. SVG, GIF y lo demás se rechazan. */
export function tipoDeImagen(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return 'image/png';
  if (bytes.length >= 12 && bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** Fecha de verificación válida y no posterior a hoy en Loja. */
function fechaVerificacion(valor, hoy, campo) {
  if (!fechaValida(valor)) return { error: { [campo]: 'Indica la fecha de verificación (AAAA-MM-DD).' } };
  if (valor > hoy) return { error: { [campo]: 'La fecha de verificación no puede ser posterior a hoy.' } };
  return { valor };
}

/** Valida el destino de «Cómo llegar» (FR-023): latitud, longitud, fuente y fecha, todos juntos. */
export function validarDestino(cuerpo, hoy) {
  const errores = {};
  const lat = typeof cuerpo?.lat === 'number' ? cuerpo.lat : Number.NaN;
  const lng = typeof cuerpo?.lng === 'number' ? cuerpo.lng : Number.NaN;
  if (!(Number.isFinite(lat) && lat >= -90 && lat <= 90)) errores.lat = 'La latitud debe ser un número entre −90 y 90.';
  if (!(Number.isFinite(lng) && lng >= -180 && lng <= 180)) errores.lng = 'La longitud debe ser un número entre −180 y 180.';
  const source = textoONulo(cuerpo?.source, 500);
  if (!source || source.length < 3) errores.source = 'Indica la fuente de la verificación.';
  const fecha = fechaVerificacion(cuerpo?.verifiedOn, hoy, 'verifiedOn');
  Object.assign(errores, fecha.error);
  if (Object.keys(errores).length) throw validation(errores);
  return { lat, lng, source, verifiedOn: fecha.valor };
}

/** Valida una característica de accesibilidad (FR-018). La nota es libre y nunca controla el filtro. */
export function validarAccesibilidad(cuerpo, hoy) {
  const errores = {};
  const status = cuerpo?.status;
  if (!ESTADOS.has(status)) errores.status = 'Elige confirmada, no disponible o por confirmar.';
  const source = textoONulo(cuerpo?.source, 500);
  const note = textoONulo(cuerpo?.note, 1000);
  let verifiedOn = null;
  if (status === 'confirmed' || status === 'unavailable') {
    if (!source || source.length < 3) errores.source = 'Indica la fuente de la verificación.';
    const fecha = fechaVerificacion(cuerpo?.verifiedOn, hoy, 'verifiedOn');
    Object.assign(errores, fecha.error);
    verifiedOn = fecha.valor ?? null;
  } else if (cuerpo?.verifiedOn !== undefined && cuerpo?.verifiedOn !== null && cuerpo?.verifiedOn !== '') {
    const fecha = fechaVerificacion(cuerpo.verifiedOn, hoy, 'verifiedOn');
    Object.assign(errores, fecha.error);
    verifiedOn = fecha.valor ?? null;
  }
  if (Object.keys(errores).length) throw validation(errores);
  return { status, source, verifiedOn, note };
}

/** Valida la foto (FR-025): base64 de JPEG, PNG o WebP de hasta 1 MB, con texto alternativo y autoría. */
export function validarFoto(cuerpo) {
  const errores = {};
  const alt = textoONulo(cuerpo?.alt, 300);
  const credit = textoONulo(cuerpo?.credit, 300);
  if (!alt || alt.length < 3) errores.alt = 'Describe la foto para quien no puede verla (texto alternativo).';
  if (!credit || credit.length < 3) errores.credit = 'Indica la fuente o la autoría de la foto.';
  const datos = typeof cuerpo?.dataBase64 === 'string' ? cuerpo.dataBase64.replace(/\s/g, '') : '';
  let bytes = null;
  let mime = null;
  if (!datos || datos.length % 4 !== 0 || !BASE64.test(datos)) {
    errores.photo = 'Elige una foto en JPEG, PNG o WebP.';
  } else {
    bytes = Buffer.from(datos, 'base64');
    mime = tipoDeImagen(bytes);
    if (!mime) errores.photo = 'La foto debe ser JPEG, PNG o WebP.';
    else if (bytes.length > FOTO_MAX_BYTES) errores.photo = 'La foto pesa más de 1 MB.';
  }
  if (Object.keys(errores).length) throw validation(errores);
  return { bytes, mime, alt, credit, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export function createSedes({ repos, permisos, auditar, clock, ilustracion = ILUSTRACION }) {
  const hoy = () => enLoja(clock()).date;
  const ahora = () => clock().toISOString();

  async function fila(id) {
    const f = await repos.sedes.findVenue(id);
    if (!f) throw notFound('Esta sede no existe.');
    return f;
  }

  /** Vista completa para el panel: lo público más el marcador guardado, el destino y el detalle de accesibilidad. */
  async function vista(id) {
    const f = await fila(id);
    const [accesibilidad, fotos] = await Promise.all([repos.sedes.accessibility([id]), repos.sedes.photos([id])]);
    const acc = accesibilidad.get(id);
    return {
      ...resumenSede(f, { accesibilidad: acc, foto: fotos.get(id), ilustracion }),
      storedMarker: f.marker ?? null,
      destination: destinoDeFila(f),
      accessibilityDetail: Object.fromEntries(Object.entries(accesibilidadCompleta(acc)).map(([k, v]) => [CARACTERISTICAS[k], v])),
    };
  }

  const permitir = (sesion) => permisos.permitir(sesion, 'catalog.manage');

  return {
    async ver(sesion, id) {
      await permitir(sesion);
      return vista(id);
    },

    async guardarDestino(sesion, id, cuerpo) {
      await permitir(sesion);
      const f = await fila(id);
      if (f.kind === 'route') throw validation({ kind: 'Un recorrido no tiene un destino único: «Cómo llegar» no se ofrece.' });
      const nuevo = validarDestino(cuerpo, hoy());
      await repos.sedes.setDestination(id, nuevo, ahora());
      await auditar(sesion.userId, 'venue.destination.set', 'venue', id, { before: destinoDeFila(f), after: nuevo });
      return vista(id);
    },

    async quitarDestino(sesion, id) {
      await permitir(sesion);
      const f = await fila(id);
      const antes = destinoDeFila(f);
      if (antes || f.dest_lat !== null) {
        await repos.sedes.setDestination(id, null, ahora());
        await auditar(sesion.userId, 'venue.destination.removed', 'venue', id, { before: antes, after: null });
      }
      return vista(id);
    },

    async guardarAccesibilidad(sesion, id, feature, cuerpo) {
      await permitir(sesion);
      if (!Object.hasOwn(CARACTERISTICAS, feature)) throw notFound('Esa característica de accesibilidad no existe.');
      await fila(id);
      const antes = accesibilidadCompleta((await repos.sedes.accessibility([id])).get(id))[feature];
      const nueva = validarAccesibilidad(cuerpo, hoy());
      await repos.sedes.setAccessibility(id, feature, nueva, ahora());
      const sinFecha = ({ status, source, verifiedOn, note }) => ({ status, source, verifiedOn, note });
      await auditar(sesion.userId, 'venue.accessibility.set', 'venue', id, { feature, before: sinFecha(antes), after: nueva });
      return vista(id);
    },

    async guardarFoto(sesion, id, cuerpo) {
      await permitir(sesion);
      await fila(id);
      const antes = (await repos.sedes.photos([id])).get(id) ?? null;
      const foto = validarFoto(cuerpo);
      await repos.sedes.setPhoto(id, foto, ahora());
      const meta = (p) => p && { alt: p.alt, credit: p.credit, mime: p.mime, size: p.size ?? p.bytes?.length, sha: p.sha256 };
      await auditar(sesion.userId, 'venue.photo.set', 'venue', id, { before: meta(antes), after: meta(foto) });
      return vista(id);
    },

    async quitarFoto(sesion, id) {
      await permitir(sesion);
      await fila(id);
      const antes = (await repos.sedes.photos([id])).get(id) ?? null;
      if (antes) {
        await repos.sedes.deletePhoto(id);
        await auditar(sesion.userId, 'venue.photo.removed', 'venue', id, {
          before: { alt: antes.alt, credit: antes.credit, mime: antes.mime, size: antes.size, sha: antes.sha256 },
          after: null,
        });
      }
      return vista(id);
    },

    async historial(sesion, id) {
      await permitir(sesion);
      await fila(id);
      return { items: await repos.history.of('venue', id) };
    },
  };
}
