import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../../src/http/security.js';
import { crearApp, json } from '../helpers.js';

test('el limitador permite hasta el máximo y luego bloquea', () => {
  let ahora = new Date('2026-11-20T10:00:00Z');
  const limitador = new RateLimiter(() => ahora);
  const regla = { max: 3, windowMs: 60_000 };
  assert.equal(limitador.allow('k', regla), true);
  assert.equal(limitador.allow('k', regla), true);
  assert.equal(limitador.allow('k', regla), true);
  assert.equal(limitador.allow('k', regla), false);
  assert.equal(limitador.allow('otra', regla), true); // claves independientes
  ahora = new Date('2026-11-20T10:02:00Z'); // pasó la ventana
  assert.equal(limitador.allow('k', regla), true);
});

test('un Origin no permitido se rechaza en métodos que cambian estado', async () => {
  const { app } = await crearApp();
  const r = await app.inject({
    ...json('POST', '/auth/login', { email: 'a@b.co', password: 'x' }),
    headers: { 'content-type': 'application/json', origin: 'https://sitio-malicioso.example' },
  });
  assert.equal(r.statusCode, 403);
  assert.equal(r.json().error, 'forbidden_origin');
});

test('un cuerpo que no es JSON se rechaza con 415', async () => {
  const { app } = await crearApp();
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    headers: { 'content-type': 'text/plain' },
    payload: 'email=a@b.co&password=x',
  });
  assert.equal(r.statusCode, 415);
});

test('un Origin permitido y las respuestas llevan cabeceras seguras', async () => {
  const { app, config } = await crearApp();
  const r = await app.inject({
    ...json('POST', '/auth/login', { email: 'nadie@vivart.test', password: 'clave de prueba larga' }),
    headers: { 'content-type': 'application/json', origin: config.allowedOrigins[0] },
  });
  assert.equal(r.statusCode, 401);
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  assert.equal(r.headers['cache-control'], 'no-store');
});
