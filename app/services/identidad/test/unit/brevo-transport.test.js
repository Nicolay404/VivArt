import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrevoTransport } from '../../src/mail/brevo-transport.js';
import { createMailer } from '../../src/mail/index.js';
import { loadConfig } from '../../src/config.js';

// Transporte de correo real (P-12). Todas las pruebas usan un fetch simulado: nunca se contacta a Brevo.

const base = { apiKey: 'clave-de-prueba', fromEmail: 'festival@example.test', fromName: 'VIVART' };
const registro = () => {
  const mensajes = [];
  return { mensajes, log: { error: (m) => mensajes.push(m) } };
};

test('envía a la API de Brevo con la clave en la cabecera y el enlace dentro del texto', async () => {
  let pedido;
  const t = createBrevoTransport({ ...base, fetchImpl: async (url, init) => { pedido = { url, init }; return { ok: true, status: 201 }; } });
  await t.send({ to: 'persona@example.test', subject: 'Verifica tu correo', text: 'Abre el enlace.', link: 'https://vivart.example/verificar?token=abc' });

  assert.equal(pedido.url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(pedido.init.method, 'POST');
  assert.equal(pedido.init.headers['api-key'], 'clave-de-prueba');
  const cuerpo = JSON.parse(pedido.init.body);
  assert.deepEqual(cuerpo.sender, { name: 'VIVART', email: 'festival@example.test' });
  assert.deepEqual(cuerpo.to, [{ email: 'persona@example.test' }]);
  assert.equal(cuerpo.subject, 'Verifica tu correo');
  assert.match(cuerpo.textContent, /Abre el enlace\.\n\nhttps:\/\/vivart\.example\/verificar\?token=abc/);
});

test('un fallo de Brevo no se propaga y el registro no incluye el enlace ni la clave (RNF-05)', async () => {
  const caso = registro();
  const rechazado = createBrevoTransport({ ...base, log: caso.log, fetchImpl: async () => ({ ok: false, status: 401 }) });
  await assert.doesNotReject(rechazado.send({ to: 'a@example.test', subject: 's', text: 't', link: 'https://x.example/?token=secreto' }));

  const caido = createBrevoTransport({ ...base, log: caso.log, fetchImpl: async () => { throw new Error('sin red con token=secreto'); } });
  await assert.doesNotReject(caido.send({ to: 'a@example.test', subject: 's', text: 't', link: 'https://x.example/?token=secreto' }));

  assert.equal(caso.mensajes.length, 2);
  for (const m of caso.mensajes) assert.doesNotMatch(m, /secreto|clave-de-prueba|a@example\.test/);
  assert.match(caso.mensajes[0], /401/);
});

test('exige la clave y el remitente al crearlo', () => {
  assert.throws(() => createBrevoTransport({ fromEmail: 'a@example.test' }), /BREVO_API_KEY/);
  assert.throws(() => createBrevoTransport({ apiKey: 'k' }), /MAIL_FROM_EMAIL/);
});

test('MAIL_TRANSPORT=brevo se elige por configuración y no tiene buzón de pruebas', () => {
  const config = loadConfig({ MAIL_TRANSPORT: 'brevo', BREVO_API_KEY: 'k', MAIL_FROM_EMAIL: 'f@example.test' });
  const mailer = createMailer(config);
  assert.equal(mailer.name, 'brevo');
  assert.deepEqual(mailer.list(), []);
  assert.throws(() => createMailer(loadConfig({ MAIL_TRANSPORT: 'brevo' })), /BREVO_API_KEY/);
  assert.throws(() => createMailer(loadConfig({ MAIL_TRANSPORT: 'otro' })), /no soportado/);
});
