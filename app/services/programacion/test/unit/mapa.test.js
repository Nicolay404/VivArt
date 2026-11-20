import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ILUSTRACION, validarMarcador, marcadorVigente, enlaceComoLlegar, destinoDeFila } from '../../src/domain/mapa.js';
import { validarDestino, validarAccesibilidad, validarFoto, tipoDeImagen, FOTO_MAX_BYTES } from '../../src/domain/sedes.js';

// Spec 003: reglas puras del mapa de sedes. Las imágenes son bytes mínimos generados aquí, nunca fotos reales.

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([4, 0, 0, 0]), Buffer.from('WEBP')]);

test('marcador: x e y entre 0 y 1 sobre la ilustración vigente; otra ilustración no vale (FR-022, SC-012)', () => {
  assert.deepEqual(validarMarcador({ illustrationId: ILUSTRACION.id, x: 0.5, y: 0.123456789 }), {
    illustrationId: ILUSTRACION.id,
    x: 0.5,
    y: 0.12346,
  });
  assert.equal(validarMarcador(null), null);
  for (const malo of [{ illustrationId: ILUSTRACION.id, x: 1.2, y: 0.5 }, { illustrationId: ILUSTRACION.id, x: -0.1, y: 0 }, { illustrationId: 'otra', x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, [0.5, 0.5], 'centro']) {
    assert.throws(() => validarMarcador(malo), (e) => e.status === 422 && Boolean(e.extra.fields.marker), JSON.stringify(malo));
  }
  // Al leer: un marcador de otra ilustración o con el formato antiguo del spec 002 es «sin marcador».
  assert.equal(marcadorVigente({ illustrationId: 'provisional-vieja', x: 0.5, y: 0.5 }), null);
  assert.equal(marcadorVigente({ lat: -4, lng: -79 }), null);
  assert.equal(marcadorVigente(null), null);
  assert.deepEqual(marcadorVigente({ illustrationId: ILUSTRACION.id, x: 0, y: 1 }), { illustrationId: ILUSTRACION.id, x: 0, y: 1 });
});

test('«Cómo llegar»: enlace de Google Maps solo con destino verificado y nunca en recorridos (SC-006, SC-011)', () => {
  assert.equal(enlaceComoLlegar(-4.5, -79.25), 'https://www.google.com/maps/search/?api=1&query=-4.500000,-79.250000');
  assert.equal(enlaceComoLlegar(91, 0), null);
  assert.equal(enlaceComoLlegar(0, 181), null);
  const fila = { kind: 'place', dest_lat: 1, dest_lng: 2, dest_source: 'Revisión en sitio', dest_verified_on: '2026-11-01' };
  assert.deepEqual(destinoDeFila(fila), { lat: 1, lng: 2, source: 'Revisión en sitio', verifiedOn: '2026-11-01' });
  assert.equal(destinoDeFila({ ...fila, dest_source: null }), null);
  assert.equal(destinoDeFila({ ...fila, dest_verified_on: null }), null);
  assert.equal(destinoDeFila({ ...fila, kind: 'route' }), null);
});

test('destino: coordenadas en rango, fuente y fecha no posterior a hoy (FR-023)', () => {
  const hoy = '2026-11-21';
  assert.deepEqual(validarDestino({ lat: -90, lng: 180, source: 'Responsable de la sede', verifiedOn: hoy }, hoy), {
    lat: -90,
    lng: 180,
    source: 'Responsable de la sede',
    verifiedOn: hoy,
  });
  const campos = (cuerpo) => {
    try {
      validarDestino(cuerpo, hoy);
      return [];
    } catch (e) {
      return Object.keys(e.extra.fields).sort();
    }
  };
  assert.deepEqual(campos({ lat: 90.1, lng: -180.5, source: 'x', verifiedOn: '2026-11-22' }), ['lat', 'lng', 'source', 'verifiedOn']);
  assert.deepEqual(campos({ lat: '-4', lng: -79, source: 'Revisión', verifiedOn: hoy }), ['lat']);
  assert.deepEqual(campos({ lat: -4, lng: -79, source: 'Revisión', verifiedOn: '2026-02-30' }), ['verifiedOn']);
});

test('accesibilidad: confirmada o no disponible exigen fuente y fecha; la nota es libre (FR-018)', () => {
  const hoy = '2026-11-21';
  assert.deepEqual(validarAccesibilidad({ status: 'unconfirmed', note: 'Dicen que es accesible' }, hoy), {
    status: 'unconfirmed',
    source: null,
    verifiedOn: null,
    note: 'Dicen que es accesible',
  });
  assert.equal(validarAccesibilidad({ status: 'confirmed', source: 'Revisión directa', verifiedOn: hoy }, hoy).status, 'confirmed');
  assert.throws(() => validarAccesibilidad({ status: 'confirmed' }, hoy), (e) => Boolean(e.extra.fields.source && e.extra.fields.verifiedOn));
  assert.throws(() => validarAccesibilidad({ status: 'unavailable', source: 'Responsable' }, hoy), (e) => Boolean(e.extra.fields.verifiedOn));
  assert.throws(() => validarAccesibilidad({ status: 'quizás' }, hoy), (e) => Boolean(e.extra.fields.status));
});

test('foto: solo JPEG, PNG o WebP por sus bytes, hasta 1 MB, con texto alternativo y autoría (FR-025)', () => {
  assert.equal(tipoDeImagen(PNG), 'image/png');
  assert.equal(tipoDeImagen(JPEG), 'image/jpeg');
  assert.equal(tipoDeImagen(WEBP), 'image/webp');
  assert.equal(tipoDeImagen(Buffer.from('GIF89a')), null);
  assert.equal(tipoDeImagen(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);

  const ok = validarFoto({ dataBase64: PNG.toString('base64'), alt: 'Fachada de la sede', credit: 'Foto propia del equipo' });
  assert.equal(ok.mime, 'image/png');
  assert.equal(ok.sha256.length, 64);

  const error = (cuerpo) => {
    try {
      validarFoto(cuerpo);
      return null;
    } catch (e) {
      return Object.keys(e.extra.fields).sort();
    }
  };
  assert.deepEqual(error({ dataBase64: PNG.toString('base64') }), ['alt', 'credit']);
  assert.deepEqual(error({ dataBase64: Buffer.from('GIF89a').toString('base64'), alt: 'Algo', credit: 'Alguien' }), ['photo']);
  assert.deepEqual(error({ dataBase64: 'no es base64!', alt: 'Algo', credit: 'Alguien' }), ['photo']);
  const grande = Buffer.concat([PNG, Buffer.alloc(FOTO_MAX_BYTES)]);
  assert.deepEqual(error({ dataBase64: grande.toString('base64'), alt: 'Algo', credit: 'Alguien' }), ['photo']);
});
