import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEdge, rangoPedido } from '../server.js';

// Los videos se sirven por partes (Range) para reproducir, avanzar y repetir en bucle sin descargarlos enteros.
const BYTES = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256));
let dir;
let edge;
let url;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'vivart-web-'));
  mkdirSync(join(dir, 'video'));
  writeFileSync(join(dir, 'video', 'prueba.mp4'), BYTES);
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>VIVART</title>');
  edge = createEdge({ webDir: dir, routes: [] });
  await new Promise((ok) => edge.listen(0, '127.0.0.1', ok));
  url = `http://127.0.0.1:${edge.address().port}/video/prueba.mp4`;
});

after(() => {
  edge.close();
  rmSync(dir, { recursive: true, force: true });
});

test('un video completo se sirve como video/mp4 y anuncia que admite partes', async () => {
  const r = await fetch(url);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'video/mp4');
  assert.equal(r.headers.get('accept-ranges'), 'bytes');
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), BYTES);
});

test('una parte pedida con Range llega con 206 y Content-Range', async () => {
  const r = await fetch(url, { headers: { range: 'bytes=100-199' } });
  assert.equal(r.status, 206);
  assert.equal(r.headers.get('content-range'), 'bytes 100-199/1000');
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), BYTES.subarray(100, 200));
  const fin = await fetch(url, { headers: { range: 'bytes=-10' } });
  assert.deepEqual(Buffer.from(await fin.arrayBuffer()), BYTES.subarray(990));
  const fuera = await fetch(url, { headers: { range: 'bytes=5000-' } });
  assert.deepEqual([fuera.status, fuera.headers.get('content-range')], [416, 'bytes */1000']);
});

test('rangoPedido interpreta un solo rango y rechaza lo que no se puede servir', () => {
  assert.deepEqual(rangoPedido('bytes=0-', 10), { inicio: 0, fin: 9 });
  assert.deepEqual(rangoPedido('bytes=2-50', 10), { inicio: 2, fin: 9 });
  assert.deepEqual(rangoPedido('bytes=-3', 10), { inicio: 7, fin: 9 });
  for (const malo of ['bytes=-', 'bytes=5-2', 'bytes=0-1,4-5', 'items=0-1', '']) assert.equal(rangoPedido(malo, 10), null, malo);
});
