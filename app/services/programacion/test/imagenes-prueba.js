// Imágenes mínimas con estructura válida, generadas para las pruebas (nunca fotos reales).
// Las variantes «conMetadatos» llevan EXIF, XMP o texto con un dato que no debe sobrevivir a la subida.

export const SECRETO = 'GPS-LATITUD-PRIVADA';

const seg = (marcador, contenido) => {
  const largo = Buffer.alloc(2);
  largo.writeUInt16BE(contenido.length + 2);
  return Buffer.concat([Buffer.from([0xff, marcador]), largo, contenido]);
};
const chunkPng = (tipo, datos) => {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  return Buffer.concat([largo, Buffer.from(tipo, 'latin1'), datos, Buffer.alloc(4)]); // CRC no se valida aquí
};
const chunkWebp = (tipo, datos) => {
  const largo = Buffer.alloc(4);
  largo.writeUInt32LE(datos.length);
  return Buffer.concat([Buffer.from(tipo, 'latin1'), largo, datos, datos.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
};
const riff = (cuerpo) => {
  const cab = Buffer.alloc(12);
  cab.write('RIFF', 0, 'latin1');
  cab.writeUInt32LE(cuerpo.length + 4, 4);
  cab.write('WEBP', 8, 'latin1');
  return Buffer.concat([cab, cuerpo]);
};

const SOI = Buffer.from([0xff, 0xd8]);
const APP0 = seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1'));
const SOS = Buffer.concat([seg(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0])), Buffer.from([0x12, 0x34, 0xff, 0xd9])]);

export function jpeg({ conMetadatos = false, extra = 0 } = {}) {
  const exif = conMetadatos ? [seg(0xe1, Buffer.from(`Exif\0\0${SECRETO}`, 'latin1')), seg(0xfe, Buffer.from(`Comentario ${SECRETO}`))] : [];
  return Buffer.concat([SOI, APP0, ...exif, SOS, Buffer.alloc(extra)]);
}

const IHDR = chunkPng('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]));
export function png({ conMetadatos = false } = {}) {
  const meta = conMetadatos ? [chunkPng('tEXt', Buffer.from(`Autor\0${SECRETO}`)), chunkPng('eXIf', Buffer.from(SECRETO))] : [];
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), IHDR, ...meta, chunkPng('IDAT', Buffer.from([1, 2, 3])), chunkPng('IEND', Buffer.alloc(0))]);
}

export function webp({ conMetadatos = false } = {}) {
  const vp8x = Buffer.alloc(10);
  vp8x[0] = conMetadatos ? 0x0c : 0; // marcas EXIF (0x08) y XMP (0x04)
  const partes = [chunkWebp('VP8X', vp8x), chunkWebp('VP8 ', Buffer.from([1, 2, 3, 4]))];
  if (conMetadatos) partes.push(chunkWebp('EXIF', Buffer.from(SECRETO)), chunkWebp('XMP ', Buffer.from(`<x>${SECRETO}</x>`)));
  return riff(Buffer.concat(partes));
}
