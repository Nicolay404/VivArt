// Entrada HTTP común de VIVART: sirve la interfaz web y enruta por prefijo hacia los servicios.
// Es un enrutamiento sencillo, no un gateway dedicado: sin autenticación, sin lógica de negocio y sin dependencias.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

// Los videos se sirven por partes (cabecera Range): el navegador los pide así para empezar a reproducir,
// avanzar y repetir en bucle sin descargar el archivo entero cada vez.
const POR_PARTES = new Set(['.mp4', '.webm']);

/** Interpreta «bytes=inicio-fin» (un solo rango). Devuelve { inicio, fin } o null si no se puede servir. */
export function rangoPedido(cabecera, tamano) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(cabecera ?? '').trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let inicio;
  let fin;
  if (m[1] === '') {
    inicio = Math.max(0, tamano - Number(m[2]));
    fin = tamano - 1;
  } else {
    inicio = Number(m[1]);
    fin = m[2] === '' ? tamano - 1 : Math.min(Number(m[2]), tamano - 1);
  }
  return inicio <= fin && inicio < tamano ? { inicio, fin } : null;
}

// Cabeceras seguras. `geolocation=()` deja explícito que VIVART no pide la ubicación (RNF-05).
// La cámara solo se permite al propio sitio, para escanear entradas en el control de acceso (spec 005).
const CABECERAS_SEGURAS = {
  'content-security-policy': "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'geolocation=(), camera=(self), microphone=()',
};

const DIRECTORIO_WEB = fileURLToPath(new URL('../web/', import.meta.url));

export function createEdge({
  webDir = DIRECTORIO_WEB,
  routes = [
    { prefix: '/api/identidad', target: process.env.IDENTIDAD_URL ?? 'http://127.0.0.1:3001' },
    { prefix: '/api/programacion', target: process.env.PROGRAMACION_URL ?? 'http://127.0.0.1:3002' },
    { prefix: '/api/participacion', target: process.env.PARTICIPACION_URL ?? 'http://127.0.0.1:3003' },
  ],
} = {}) {
  const base = resolve(webDir);

  function proxy(req, res, ruta, resto) {
    const destino = new URL(ruta.target);
    const cabeceras = { ...req.headers };
    delete cabeceras.host;
    cabeceras['x-forwarded-for'] = req.socket.remoteAddress ?? '';
    cabeceras['x-forwarded-host'] = req.headers.host ?? '';
    const salida = http.request(
      { hostname: destino.hostname, port: destino.port || 80, path: resto, method: req.method, headers: cabeceras },
      (respuesta) => {
        res.writeHead(respuesta.statusCode ?? 502, respuesta.headers);
        respuesta.pipe(res);
      },
    );
    salida.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(502, { 'content-type': 'application/json', ...CABECERAS_SEGURAS });
      }
      res.end(JSON.stringify({ error: 'upstream_unavailable', message: 'El servicio no está disponible por ahora.' }));
    });
    req.pipe(salida);
  }

  async function estatico(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD', ...CABECERAS_SEGURAS });
      return res.end();
    }
    let ruta;
    try {
      ruta = decodeURIComponent(pathname);
    } catch {
      res.writeHead(400, CABECERAS_SEGURAS);
      return res.end();
    }
    if (ruta.includes('\0')) {
      res.writeHead(400, CABECERAS_SEGURAS);
      return res.end();
    }
    // Las rutas sin extensión son pantallas de la aplicación: se sirve index.html.
    const archivo = extname(ruta) === '' ? 'index.html' : ruta.replace(/^\/+/, '');
    const completa = resolve(base, archivo);
    if (completa !== base && !completa.startsWith(base + sep)) {
      res.writeHead(404, CABECERAS_SEGURAS);
      return res.end();
    }
    try {
      const info = await stat(completa);
      if (!info.isFile()) throw new Error('no es archivo');
      if (POR_PARTES.has(extname(completa))) return servirPorPartes(req, res, completa, info.size);
      const contenido = await readFile(completa);
      res.writeHead(200, {
        'content-type': TIPOS[extname(completa)] ?? 'application/octet-stream',
        'cache-control': 'no-cache',
        ...CABECERAS_SEGURAS,
      });
      return res.end(req.method === 'HEAD' ? undefined : contenido);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', ...CABECERAS_SEGURAS });
      return res.end('No encontrado');
    }
  }

  function servirPorPartes(req, res, completa, tamano) {
    const comunes = { 'content-type': TIPOS[extname(completa)], 'accept-ranges': 'bytes', 'cache-control': 'no-cache', ...CABECERAS_SEGURAS };
    if (!req.headers.range) {
      res.writeHead(200, { ...comunes, 'content-length': tamano });
      if (req.method === 'HEAD') return res.end();
      return createReadStream(completa).pipe(res);
    }
    const rango = rangoPedido(req.headers.range, tamano);
    if (!rango) {
      res.writeHead(416, { ...CABECERAS_SEGURAS, 'content-range': `bytes */${tamano}` });
      return res.end();
    }
    res.writeHead(206, { ...comunes, 'content-length': rango.fin - rango.inicio + 1, 'content-range': `bytes ${rango.inicio}-${rango.fin}/${tamano}` });
    if (req.method === 'HEAD') return res.end();
    return createReadStream(completa, { start: rango.inicio, end: rango.fin }).pipe(res);
  }

  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    for (const ruta of routes) {
      if (url.pathname === ruta.prefix || url.pathname.startsWith(`${ruta.prefix}/`)) {
        const resto = (url.pathname.slice(ruta.prefix.length) || '/') + url.search;
        return proxy(req, res, ruta, resto);
      }
    }
    // Una ruta /api/ que ningún servicio reclama no es una pantalla: se responde 404 en JSON.
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      res.writeHead(404, { 'content-type': 'application/json', ...CABECERAS_SEGURAS });
      return res.end(JSON.stringify({ error: 'not_found', message: 'No se encontró lo que buscas.' }));
    }
    return estatico(req, res, url.pathname);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const puerto = Number(process.env.PORT ?? 8080);
  createEdge().listen(puerto, process.env.HOST ?? '127.0.0.1', () => {
    console.log(`Entrada común de VIVART en http://localhost:${puerto}`);
  });
}
