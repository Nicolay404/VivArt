import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createEdge } from '../server.js';

const WEB = fileURLToPath(new URL('../../web/', import.meta.url));
let upstream;
let edge;
let urlEdge;
let ultimo;

const escuchar = (servidor) => new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(servidor.address().port)));

before(async () => {
  upstream = http.createServer((req, res) => {
    const trozos = [];
    req.on('data', (t) => trozos.push(t));
    req.on('end', () => {
      ultimo = { method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(trozos).toString() };
      res.writeHead(200, { 'content-type': 'application/json', 'set-cookie': 'vivart_sid=abc; HttpOnly; Path=/' });
      res.end(JSON.stringify({ visto: req.url }));
    });
  });
  const puertoUpstream = await escuchar(upstream);
  edge = createEdge({ routes: [{ prefix: '/api/identidad', target: `http://127.0.0.1:${puertoUpstream}` }] });
  urlEdge = `http://127.0.0.1:${await escuchar(edge)}`;
});

after(() => {
  edge.close();
  upstream.close();
});

test('SC-002: sirve la web y las pantallas de la aplicación sin exigir sesión', async () => {
  for (const ruta of ['/', '/registro', '/ingresar', '/perfil', '/recorrido']) {
    const r = await fetch(urlEdge + ruta);
    assert.equal(r.status, 200, ruta);
    assert.match(r.headers.get('content-type'), /text\/html/);
    assert.match(await r.text(), /VIVART/);
  }
  assert.match((await fetch(`${urlEdge}/app.js`)).headers.get('content-type'), /javascript/);
  assert.match((await fetch(`${urlEdge}/styles.css`)).headers.get('content-type'), /css/);
});

test('SC-002: las cabeceras impiden pedir la ubicación y limitan el origen del contenido', async () => {
  const r = await fetch(`${urlEdge}/`);
  assert.match(r.headers.get('permissions-policy'), /geolocation=\(\)/);
  assert.match(r.headers.get('permissions-policy'), /camera=\(self\)/);
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
});

test('SC-002: la web no usa geolocalización ni inserta HTML dinámico', () => {
  const listarArchivos = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
      const ruta = join(dir, entrada.name);
      return entrada.isDirectory() ? listarArchivos(ruta) : [ruta];
    });
  for (const archivo of listarArchivos(WEB)) {
    const texto = readFileSync(archivo, 'utf8');
    assert.ok(!/geolocation/i.test(texto), `${archivo} usa geolocalización`);
    assert.ok(!/innerHTML|outerHTML|document\.write|insertAdjacentHTML/.test(texto), `${archivo} inserta HTML dinámico`);
  }
});

test('un archivo que no existe da 404 y no se puede salir de la carpeta web', async () => {
  assert.equal((await fetch(`${urlEdge}/nada.png`)).status, 404);
  for (const ruta of ['/..%2f..%2fpackage.json', '/%2e%2e/%2e%2e/package.json', '/..%5c..%5cpackage.json']) {
    const r = await fetch(urlEdge + ruta);
    assert.notEqual(r.status, 200, ruta);
    assert.ok(!(await r.text()).includes('"name"'), ruta);
  }
});

test('solo se sirven métodos GET y HEAD para la web', async () => {
  const r = await fetch(`${urlEdge}/`, { method: 'POST', body: 'x' });
  assert.equal(r.status, 405);
});

test('enruta /api/identidad al servicio quitando el prefijo y conserva cookies y cuerpo', async () => {
  const r = await fetch(`${urlEdge}/api/identidad/auth/login?x=1`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:8080' },
    body: JSON.stringify({ email: 'a@b.co' }),
  });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { visto: '/auth/login?x=1' });
  assert.match(r.headers.get('set-cookie'), /vivart_sid=abc; HttpOnly/);
  assert.equal(ultimo.method, 'POST');
  assert.equal(ultimo.url, '/auth/login?x=1');
  assert.equal(JSON.parse(ultimo.body).email, 'a@b.co');
  assert.equal(ultimo.headers.origin, 'http://localhost:8080');
  assert.ok(ultimo.headers['x-forwarded-for']);
  assert.notEqual(ultimo.headers.host, urlEdge.replace('http://', '')); // no reenvía el host de la entrada

  const raiz = await fetch(`${urlEdge}/api/identidad`);
  assert.equal(raiz.status, 200);
  assert.equal(ultimo.url, '/');
});

test('un prefijo parecido no se enruta al servicio', async () => {
  const r = await fetch(`${urlEdge}/api/identidadx/loquesea`);
  assert.equal(r.status, 404);
});

test('si el servicio no responde, la entrada devuelve 502 sin detalles internos', async () => {
  const caida = createEdge({ routes: [{ prefix: '/api/identidad', target: 'http://127.0.0.1:1' }] });
  const puerto = await escuchar(caida);
  try {
    const r = await fetch(`http://127.0.0.1:${puerto}/api/identidad/health`);
    assert.equal(r.status, 502);
    assert.equal((await r.json()).error, 'upstream_unavailable');
    // la web sigue disponible aunque el servicio esté caído
    assert.equal((await fetch(`http://127.0.0.1:${puerto}/`)).status, 200);
  } finally {
    caida.close();
  }
});
