import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentidadClient } from '../../src/clients/identidad.js';
import { createParticipacionClient } from '../../src/clients/participacion.js';
import { enLoja, fechaValida } from '../../src/clock.js';

test('identidad: envía la credencial de servicio y falla cerrado si no responde', async () => {
  const llamadas = [];
  const cliente = createIdentidadClient({
    url: 'http://identidad',
    serviceKey: 'clave',
    fetchImpl: async (url, opciones) => {
      llamadas.push({ url, cabeceras: opciones.headers, cuerpo: JSON.parse(opciones.body) });
      return { ok: true, json: async () => ({ allowed: true }) };
    },
  });
  assert.deepEqual(await cliente.authorize('tok', 'publish', { ownerId: 'u' }), { allowed: true });
  assert.equal(llamadas[0].url, 'http://identidad/internal/authorize');
  assert.equal(llamadas[0].cabeceras['x-service-key'], 'clave');
  assert.deepEqual(llamadas[0].cuerpo, { sessionToken: 'tok', action: 'publish', context: { ownerId: 'u' } });

  const caido = createIdentidadClient({ url: 'http://identidad', serviceKey: 'clave', fetchImpl: async () => { throw new Error('ECONNREFUSED'); } });
  await assert.rejects(() => caido.authorize('tok', 'publish'), { code: 'identity_unavailable', status: 503 });
  const error500 = createIdentidadClient({ url: 'http://identidad', serviceKey: 'clave', fetchImpl: async () => ({ ok: false }) });
  await assert.rejects(() => error500.introspect('tok'), { code: 'identity_unavailable' });
  assert.equal(await caido.introspect(''), null, 'sin cookie no se consulta');
});

test('participación: sin servicio configurado o caído, el dato no está disponible y no se inventan cifras', async () => {
  const sinUrl = createParticipacionClient({ url: '', serviceKey: 'k' });
  assert.deepEqual(
    (({ available, soldTickets, pendingOrders }) => ({ available, soldTickets, pendingOrders }))(await sinUrl.impact('f1')),
    { available: false, soldTickets: null, pendingOrders: null },
  );
  const caido = createParticipacionClient({ url: 'http://p', serviceKey: 'k', fetchImpl: async () => { throw new Error('x'); } });
  assert.equal((await caido.impact('f1')).available, false);
  const ok = createParticipacionClient({ url: 'http://p', serviceKey: 'k', fetchImpl: async () => ({ ok: true, json: async () => ({ soldTickets: 4, pendingOrders: 1 }) }) });
  assert.deepEqual((({ available, soldTickets, pendingOrders }) => ({ available, soldTickets, pendingOrders }))(await ok.impact('f1')), {
    available: true,
    soldTickets: 4,
    pendingOrders: 1,
  });
});

test('reloj: hora de Loja y fechas válidas', () => {
  assert.deepEqual(enLoja(new Date('2026-11-22T04:30:00Z')), { date: '2026-11-21', time: '23:30', minutes: 1410, weekday: 6 });
  assert.equal(fechaValida('2026-02-29'), false);
  assert.equal(fechaValida('2028-02-29'), true);
  assert.equal(fechaValida('21/11/2026'), false);
});
