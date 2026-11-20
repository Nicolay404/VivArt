import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, crearUsuario, json, cookieDe, tokenDe, CLAVE_VALIDA } from '../helpers.js';

const juntar = (...partes) => partes.filter(Boolean).join('; ');

async function guardar(ctx, cuerpo) {
  const r = await ctx.app.inject(json('POST', '/auth/pending-actions', cuerpo));
  return { r, cookie: cookieDe(r, 'vivart_pa') };
}

test('FR-031 y SC-003: conserva tipo y referencia sin sesión y los devuelve tras identificarse, sin ejecutar nada', async () => {
  const ctx = await crearApp();
  const { r, cookie: pa } = await guardar(ctx, { type: 'canje', ref: 'QR_funcion-12' });
  assert.equal(r.statusCode, 201);
  assert.ok(pa);

  const u = await crearUsuario(ctx, 'ana@vivart.test');
  const res = await ctx.app.inject({ method: 'GET', url: '/auth/resume', headers: { cookie: juntar(u.cookie, pa) } });
  assert.equal(res.statusCode, 200);
  const cuerpo = res.json();
  assert.equal(cuerpo.found, true);
  assert.equal(cuerpo.type, 'canje');
  assert.equal(cuerpo.ref, 'QR_funcion-12');
  assert.equal(cuerpo.destination, '/pasaporte/canje/QR_funcion-12'); // lo fija el servicio
  assert.equal(cuerpo.executed, false); // FR-033, SC-017
  assert.equal(cuerpo.canProceed, true);
  assert.equal(cuerpo.blockedReason, null);
  assert.deepEqual(cuerpo.revalidation, { owner: 'participacion', operation: 'revalidar-canje' });
});

test('una compra vuelve al carrito, también sin ejecutar nada', async () => {
  const ctx = await crearApp();
  const { cookie: pa } = await guardar(ctx, { type: 'compra' });
  const u = await crearUsuario(ctx, 'luz@vivart.test');
  const res = await ctx.app.inject({ method: 'GET', url: '/auth/resume', headers: { cookie: juntar(u.cookie, pa) } });
  assert.equal(res.json().destination, '/carrito');
  assert.equal(res.json().executed, false);
  assert.deepEqual(res.json().revalidation, { owner: 'participacion', operation: 'revalidar-compra' });
});

test('FR-035 y SC-012: con el correo sin verificar se bloquea; tras verificar e iniciar sesión se retoma', async () => {
  const ctx = await crearApp();
  const { cookie: pa } = await guardar(ctx, { type: 'canje', ref: 'abc123' });
  await ctx.app.inject(json('POST', '/auth/register', { email: 'nuevo@vivart.test', password: CLAVE_VALIDA }));
  const login1 = await ctx.app.inject(json('POST', '/auth/login', { email: 'nuevo@vivart.test', password: CLAVE_VALIDA }));
  const sesion1 = cookieDe(login1);

  const bloqueado = await ctx.app.inject({ method: 'GET', url: '/auth/resume', headers: { cookie: juntar(sesion1, pa) } });
  assert.equal(bloqueado.json().canProceed, false);
  assert.equal(bloqueado.json().blockedReason, 'email_not_verified');
  assert.equal(bloqueado.json().executed, false);

  const token = tokenDe(ctx.correos.last('nuevo@vivart.test', 'verify'));
  await ctx.app.inject(json('POST', '/auth/verify-email', { token }));
  const login2 = await ctx.app.inject(json('POST', '/auth/login', { email: 'nuevo@vivart.test', password: CLAVE_VALIDA }));
  const retomada = await ctx.app.inject({ method: 'GET', url: '/auth/resume', headers: { cookie: juntar(cookieDe(login2), pa) } });
  assert.equal(retomada.json().found, true);
  assert.equal(retomada.json().canProceed, true);
  assert.equal(retomada.json().executed, false);
});

test('FR-032: el destino lo fija el servicio y las referencias peligrosas se rechazan (sin redirecciones abiertas)', async () => {
  const ctx = await crearApp();
  for (const ref of ['../../etc/passwd', 'https://sitio-malicioso.example', 'a/b', 'con espacio', 'x'.repeat(65), '//evil.com']) {
    const { r } = await guardar(ctx, { type: 'canje', ref });
    assert.equal(r.statusCode, 422, ref);
    assert.equal(r.json().field, 'ref');
  }
  const mal = await guardar(ctx, { type: 'pagar' });
  assert.equal(mal.r.statusCode, 422);
  assert.equal(mal.r.json().field, 'type');
  const sinRef = await guardar(ctx, { type: 'canje' });
  assert.equal(sinRef.r.statusCode, 422);
});

test('FR-034: una acción vencida o descartada no se retoma', async () => {
  let ahora = new Date('2026-11-20T10:00:00Z');
  const ctx = await crearApp({ reloj: () => ahora });
  const u = await crearUsuario(ctx, 'tiempo@vivart.test');
  const { cookie: pa } = await guardar(ctx, { type: 'canje', ref: 'vence' });
  ahora = new Date('2026-11-21T11:00:00Z'); // pasaron 24 horas
  const login = await ctx.app.inject(json('POST', '/auth/login', { email: 'tiempo@vivart.test', password: CLAVE_VALIDA }));
  const res = await ctx.app.inject({ method: 'GET', url: '/auth/resume', headers: { cookie: juntar(cookieDe(login), pa) } });
  assert.deepEqual(res.json(), { found: false, executed: false });

  const { cookie: pa2 } = await guardar(ctx, { type: 'compra' });
  await ctx.app.inject({ method: 'DELETE', url: '/auth/pending-actions/current', headers: { cookie: pa2 } });
  const tras = await ctx.app.inject({ method: 'GET', url: '/auth/resume', headers: { cookie: juntar(cookieDe(login), pa2) } });
  assert.equal(tras.json().found, false);
  assert.ok(u.id);
});

test('una acción pendiente no la retoma otra persona en el mismo navegador ni sin cookie', async () => {
  const ctx = await crearApp();
  const { cookie: pa } = await guardar(ctx, { type: 'compra' });
  const a = await crearUsuario(ctx, 'a@vivart.test');
  const b = await crearUsuario(ctx, 'b@vivart.test');
  assert.equal((await ctx.app.inject({ method: 'GET', url: '/auth/resume', headers: { cookie: juntar(a.cookie, pa) } })).json().found, true);
  assert.equal((await ctx.app.inject({ method: 'GET', url: '/auth/resume', headers: { cookie: juntar(b.cookie, pa) } })).json().found, false);
  assert.deepEqual((await ctx.app.inject({ method: 'GET', url: '/auth/resume', headers: { cookie: a.cookie } })).json(), { found: false, executed: false });
});

test('retomar exige sesión', async () => {
  const ctx = await crearApp();
  const { cookie: pa } = await guardar(ctx, { type: 'compra' });
  assert.equal((await ctx.app.inject({ method: 'GET', url: '/auth/resume', headers: { cookie: pa } })).statusCode, 401);
});
