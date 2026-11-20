import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../../services/identidad/src/config.js';
import { buildApp } from '../../services/identidad/src/app.js';
import { createEdge } from '../server.js';

// Recorrido real por HTTP: entrada común -> servicio de identidad -> buzón de pruebas.
// Comprueba SC-016 (sin correos reales), SC-003 y SC-017 (retorno a la acción sin ejecutar nada).
const ORIGEN = 'http://localhost:8080';
let app;
let edge;
let base;

const escuchar = (servidor) => new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(servidor.address().port)));

function nuevoNavegador() {
  const galletas = new Map();
  return async (ruta, { metodo = 'GET', cuerpo } = {}) => {
    const r = await fetch(base + ruta, {
      method: metodo,
      headers: {
        origin: ORIGEN,
        ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(galletas.size ? { cookie: [...galletas].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
    for (const c of r.headers.getSetCookie()) {
      const [par] = c.split(';');
      const [k, v] = par.split('=');
      if (/max-age=0|expires=thu, 01 jan 1970/i.test(c) || v === '') galletas.delete(k);
      else galletas.set(k, v);
    }
    const texto = await r.text();
    return { status: r.status, json: texto ? JSON.parse(texto) : null, galletas };
  };
}

before(async () => {
  const config = loadConfig(
    { MAIL_TRANSPORT: 'test', DB_FILE: ':memory:' },
    { scrypt: { N: 1024, r: 8, p: 1 }, allowedOrigins: [ORIGEN] },
  );
  ({ app } = await buildApp({ config }));
  const puertoServicio = await app.listen({ port: 0, host: '127.0.0.1' }).then(() => app.server.address().port);
  edge = createEdge({ routes: [{ prefix: '/api/identidad', target: `http://127.0.0.1:${puertoServicio}` }] });
  base = `http://127.0.0.1:${await escuchar(edge)}`;
});

after(async () => {
  edge.close();
  await app.close();
});

test('de punta a punta: registro, buzón de pruebas, verificación, sesión y retorno a la acción sin ejecutar nada', async () => {
  const navegador = nuevoNavegador();
  const clave = 'una clave larga para la prueba';

  // 1. Una persona sin sesión intenta una acción que exige identificarse: se conserva la acción.
  const guardada = await navegador('/api/identidad/auth/pending-actions', { metodo: 'POST', cuerpo: { type: 'canje', ref: 'QR-DEMO-1' } });
  assert.equal(guardada.status, 201);

  // 2. Se registra; la respuesta es neutra y el correo llega al buzón de pruebas (no se envía nada real).
  const alta = await navegador('/api/identidad/auth/register', { metodo: 'POST', cuerpo: { email: 'demo@vivart.test', password: clave } });
  assert.equal(alta.status, 202);
  const buzon = await navegador('/api/identidad/dev/mailbox');
  const mensaje = buzon.json.messages.find((m) => m.to === 'demo@vivart.test' && m.kind === 'verify');
  assert.ok(mensaje);

  // 3. Inicia sesión con el correo sin verificar: la acción queda bloqueada, sin ejecutarse.
  const sesion = await navegador('/api/identidad/auth/login', { metodo: 'POST', cuerpo: { email: 'demo@vivart.test', password: clave } });
  assert.equal(sesion.status, 200);
  assert.equal(sesion.json.emailVerified, false);
  const bloqueada = await navegador('/api/identidad/auth/resume');
  assert.equal(bloqueada.json.canProceed, false);
  assert.equal(bloqueada.json.executed, false);

  // 4. Verifica su correo con el enlace del buzón y vuelve a la acción original.
  const token = new URL(mensaje.link).searchParams.get('token');
  assert.equal((await navegador('/api/identidad/auth/verify-email', { metodo: 'POST', cuerpo: { token } })).status, 200);
  await navegador('/api/identidad/auth/login', { metodo: 'POST', cuerpo: { email: 'demo@vivart.test', password: clave } });
  const retomada = await navegador('/api/identidad/auth/resume');
  assert.equal(retomada.json.found, true);
  assert.equal(retomada.json.destination, '/pasaporte/canje/QR-DEMO-1');
  assert.equal(retomada.json.canProceed, true);
  assert.equal(retomada.json.executed, false);

  // 5. Cierra sesión.
  assert.equal((await navegador('/api/identidad/auth/logout', { metodo: 'POST' })).status, 204);
  assert.equal((await navegador('/api/identidad/me')).status, 401);
});

test('la entrada rechaza un origen distinto en las operaciones que cambian estado', async () => {
  const r = await fetch(`${base}/api/identidad/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://sitio-malicioso.example' },
    body: JSON.stringify({ email: 'x@y.co', password: 'una clave larga para la prueba' }),
  });
  assert.equal(r.status, 403);
});
