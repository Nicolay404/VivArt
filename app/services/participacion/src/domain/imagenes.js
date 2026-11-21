// Imágenes subidas por el administrador (foto de sede, M-09; imagen del sello, M-12).
// Solo JPEG, PNG o WebP, reconocidos por sus bytes (nunca por lo que diga el cliente), de hasta 1 MB y SIN metadatos:
// se quitan EXIF, XMP, IPTC y comentarios en el servidor, porque limpiarlos solo en el navegador se salta con una
// llamada directa a la API. Sin dependencias externas.
// Este archivo se repite a propósito en cada servicio que recibe imágenes (no hay librería compartida entre servicios);
// por eso está en sonar.cpd.exclusions.

export const IMAGEN_MAX_BYTES = 1024 * 1024;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Tipo real de la imagen por sus bytes iniciales: solo JPEG, PNG o WebP. SVG, GIF y lo demás se rechazan. */
export function tipoDeImagen(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(FIRMA_PNG)) return 'image/png';
  if (bytes.length >= 12 && bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

// JPEG: se quitan APP1 (EXIF y XMP), APP13 (IPTC) y los comentarios; se conservan APP0 (JFIF) y APP2 (perfil de color).
const JPEG_QUITAR = new Set([0xe1, 0xed, 0xfe]);

function limpiarJpeg(b) {
  const partes = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marcador = b[i + 1];
    if (marcador === 0xda) {
      partes.push(b.subarray(i)); // inicio de los datos de imagen: el resto se copia tal cual
      return Buffer.concat(partes);
    }
    const largo = b.readUInt16BE(i + 2);
    if (largo < 2 || i + 2 + largo > b.length) return null;
    if (!JPEG_QUITAR.has(marcador)) partes.push(b.subarray(i, i + 2 + largo));
    i += 2 + largo;
  }
  return null;
}

// PNG: se quitan los fragmentos de metadatos; los demás se copian con su CRC intacto.
const PNG_QUITAR = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']);

function limpiarPng(b) {
  const partes = [FIRMA_PNG];
  let i = 8;
  while (i + 12 <= b.length) {
    const largo = b.readUInt32BE(i);
    const tipo = b.toString('latin1', i + 4, i + 8);
    const fin = i + 12 + largo;
    if (fin > b.length) return null;
    if (!PNG_QUITAR.has(tipo)) partes.push(b.subarray(i, fin));
    i = fin;
    if (tipo === 'IEND') return Buffer.concat(partes);
  }
  return null;
}

// WebP: se quitan los fragmentos EXIF y XMP, se apagan sus marcas en VP8X y se recalcula el tamaño RIFF.
function limpiarWebp(b) {
  const partes = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const tipo = b.toString('latin1', i, i + 4);
    const largo = b.readUInt32LE(i + 4);
    const fin = i + 8 + largo + (largo % 2);
    if (i + 8 + largo > b.length) return null;
    if (tipo !== 'EXIF' && tipo !== 'XMP ') {
      const fragmento = Buffer.from(b.subarray(i, Math.min(fin, b.length)));
      if (tipo === 'VP8X' && fragmento.length > 8) fragmento[8] &= ~(0x08 | 0x04);
      partes.push(fragmento);
    }
    i = fin;
  }
  const cuerpo = Buffer.concat(partes);
  const cabecera = Buffer.alloc(12);
  cabecera.write('RIFF', 0, 'latin1');
  cabecera.writeUInt32LE(cuerpo.length + 4, 4);
  cabecera.write('WEBP', 8, 'latin1');
  return Buffer.concat([cabecera, cuerpo]);
}

/** Copia de la imagen sin metadatos, o null si su estructura no es válida. */
export function quitarMetadatos(bytes, mime) {
  if (mime === 'image/jpeg') return limpiarJpeg(bytes);
  if (mime === 'image/png') return limpiarPng(bytes);
  if (mime === 'image/webp') return limpiarWebp(bytes);
  return null;
}

/**
 * Lee una imagen en base64 (sin prefijo data:): `{ bytes, mime }` ya sin metadatos, o `{ error }` con el mensaje.
 * El límite de 1 MB se comprueba sobre la imagen recibida.
 */
export function leerImagen(base64) {
  const datos = typeof base64 === 'string' ? base64.replace(/\s/g, '') : '';
  if (!datos || datos.length % 4 !== 0 || !BASE64.test(datos)) return { error: 'Elige una imagen en JPEG, PNG o WebP.' };
  const original = Buffer.from(datos, 'base64');
  const mime = tipoDeImagen(original);
  if (!mime) return { error: 'La imagen debe ser JPEG, PNG o WebP.' };
  if (original.length > IMAGEN_MAX_BYTES) return { error: 'La imagen pesa más de 1 MB.' };
  const bytes = quitarMetadatos(original, mime);
  if (!bytes) return { error: 'No se pudo leer la imagen: el archivo está dañado.' };
  return { bytes, mime };
}
