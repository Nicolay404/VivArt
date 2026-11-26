// Servicios dormidos en un hospedaje gratis (Render): la entrada los detecta y la web los despierta desde el navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cabecerasSeguras, createEdge, servicioDormido } from '../server.js';

const escuchar = (servidor) => new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(servidor.address().port)));

test('reconoce la respuesta de Render a un servicio dormido y no la confunde con un error del servicio', () => {
  assert.equal(servicioDormido({ statusCode: 502, headers: { 'x-render-routing': 'no-deploy' } }), true);
  assert.equal(servicioDormido({ statusCode: 503, headers: { 'x-render-routing': 'suspended' } }), true);
  // Un 502 o 503 del propio servicio no lleva la cabecera de Render.
  assert.equal(servicioDormido({ statusCode: 502, headers: {} }), false);
  assert.equal(servicioDormido({ statusCode: 200, headers: { 'x-render-routing': 'x' } }), false);
});

test('solo con servicios en otro dominio https se permite llamarlos desde el navegador, y solo a ellos', () => {
  assert.doesNotMatch(cabecerasSeguras()['content-security-policy'], /connect-src/);
  const politica = cabecerasSeguras(['https://vivart-identidad.onrender.com'])['content-security-policy'];
  assert.match(politica, /default-src 'self'; connect-src 'self' https:\/\/vivart-identidad\.onrender\.com;/);
  assert.match(politica, /frame-ancestors 'none'/);
});

test('en la demo con contenedores (servicios por http) la política de contenido no cambia', async () => {
  const edge = createEdge({ routes: [{ prefix: '/api/identidad', target: 'http://127.0.0.1:9' }] });
  const url = `http://127.0.0.1:${await escuchar(edge)}`;
  try {
    const r = await fetch(`${url}/`);
    assert.doesNotMatch(r.headers.get('content-security-policy'), /connect-src/);
  } finally {
    edge.close();
  }
});

test('la web despierta el servicio desde el navegador y repite la petición, solo hacia un /health https', () => {
  const api = readFileSync(new URL('../../web/js/api.js', import.meta.url), 'utf8');
  assert.match(api, /'service_waking'/);
  assert.match(api, /url\.protocol === 'https:' && url\.pathname === '\/health'/);
  assert.match(api, /mode: 'no-cors'/);
  assert.match(api, /credentials: 'omit'/);
  // Mientras la página está abierta los mantiene despiertos, solo con la pestaña visible.
  assert.match(api, /document\.visibilityState !== 'visible'/);
});
