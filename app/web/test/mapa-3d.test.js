import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sueloDeMarcador } from '../js/mapa-3d.js';
import { ESCENA } from '../js/mapa-escena.js';

// Los marcadores se guardan sobre la ilustración isométrica de respaldo; la maqueta 3D los lleva al suelo.
const MARCADORES = JSON.parse(readFileSync(new URL('../../services/programacion/ejemplos/marcadores-centro-2026.json', import.meta.url), 'utf8'));

test('un marcador de la ilustración cae en su sitio del suelo de la maqueta 3D', () => {
  // Plaza San Francisco: en el mapa oficial, entre Colón e Imbabura, junto a la Bolívar (suelo u≈158, v≈276).
  const { u, v } = sueloDeMarcador(MARCADORES['Plaza San Francisco']);
  assert.ok(Math.abs(u - 158) < 1, `u=${u}`);
  assert.ok(Math.abs(v - 276) < 1, `v=${v}`);
});

test('los 9 lugares del circuito caen dentro de la maqueta', () => {
  assert.equal(Object.keys(MARCADORES).length, 9);
  for (const [nombre, m] of Object.entries(MARCADORES)) {
    const { u, v } = sueloDeMarcador(m);
    assert.ok(u > 0 && u < ESCENA.limites.u && v > 0 && v < ESCENA.limites.v, nombre);
  }
});
