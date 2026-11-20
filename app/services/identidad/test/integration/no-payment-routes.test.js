import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, json } from '../helpers.js';

// SC-017: el servicio de identidad no construye carrito, pago, canje ni Pasaporte (son de los specs 05 y 06).
const PROHIBIDAS = /pag[oa]|carrito|cart|checkout|canje(?!s?\/?$)|sello|stamp|pasaporte|pedido|order|entrada|ticket|ruta|insignia/i;

test('SC-017: ninguna ruta registrada paga, canjea ni construye carrito o Pasaporte', async () => {
  const { app } = await crearApp();
  await app.ready();
  const rutas = app.printRoutes({ commonPrefix: false, includeMeta: false });
  const lineas = rutas.split('\n').filter((l) => l.includes('/'));
  assert.ok(lineas.length > 10);
  // las únicas rutas con «pending» y «resume» son el contrato de retorno, que no ejecuta nada
  const sospechosas = lineas.filter((l) => PROHIBIDAS.test(l));
  assert.deepEqual(sospechosas, []);
});

test('SC-017: probar rutas típicas de pago o canje devuelve 404', async () => {
  const { app } = await crearApp();
  for (const [metodo, url] of [
    ['POST', '/pagos'], ['POST', '/carrito'], ['POST', '/checkout'], ['POST', '/canje'], ['POST', '/pasaporte/canje/abc'],
    ['POST', '/sellos'], ['GET', '/carrito'], ['POST', '/auth/pay'], ['POST', '/auth/redeem'],
  ]) {
    const r = await app.inject(metodo === 'GET' ? { method: 'GET', url } : json(metodo, url, {}));
    assert.equal(r.statusCode, 404, `${metodo} ${url}`);
  }
});

test('el contrato de retorno nunca devuelve executed distinto de false', async () => {
  const ctx = await crearApp();
  const respuestas = [];
  for (const cuerpo of [{ type: 'compra' }, { type: 'canje', ref: 'abc' }]) {
    const g = await ctx.app.inject(json('POST', '/auth/pending-actions', cuerpo));
    const pa = `vivart_pa=${g.cookies[0].value}`;
    await ctx.app.inject(json('POST', '/auth/register', { email: `x${respuestas.length}@vivart.test`, password: 'una clave larga de prueba 1' }));
    const login = await ctx.app.inject(json('POST', '/auth/login', { email: `x${respuestas.length}@vivart.test`, password: 'una clave larga de prueba 1' }));
    const res = await ctx.app.inject({ method: 'GET', url: '/auth/resume', headers: { cookie: `vivart_sid=${login.cookies[0].value}; ${pa}` } });
    respuestas.push(res.json());
  }
  assert.ok(respuestas.every((x) => x.executed === false));
});
