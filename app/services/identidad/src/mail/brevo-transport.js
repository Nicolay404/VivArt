// Transporte real de correo con Brevo (https://developers.brevo.com/reference/sendtransacemail), por HTTP y sin dependencias.
// Solo se usa en el entorno de despliegue (MAIL_TRANSPORT=brevo). La clave de la API viene del entorno y no se versiona.
//
// Un fallo de envío NO se propaga a quien llama: registro y recuperación responden siempre el mismo mensaje exista o no
// el correo (RNF-05), y un error aquí revelaría esa diferencia. Se registra solo el estado HTTP, nunca el mensaje ni el
// enlace (son secretos de un solo uso); la persona puede pedir un reenvío.
const URL_API = 'https://api.brevo.com/v3/smtp/email';

export function createBrevoTransport({ apiKey, fromEmail, fromName = 'VIVART', fetchImpl = fetch, log = console, timeoutMs = 8000 }) {
  if (!apiKey) throw new Error('MAIL_TRANSPORT=brevo necesita BREVO_API_KEY.');
  if (!fromEmail) throw new Error('MAIL_TRANSPORT=brevo necesita MAIL_FROM_EMAIL (remitente verificado en Brevo).');

  return {
    name: 'brevo',
    async send({ to, subject, text, link }) {
      const contenido = link ? `${text}\n\n${link}\n` : text;
      try {
        const r = await fetchImpl(URL_API, {
          method: 'POST',
          headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ sender: { name: fromName, email: fromEmail }, to: [{ email: to }], subject, textContent: contenido }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!r.ok) log.error(`[correo] Brevo respondió ${r.status}; el correo no se envió.`);
      } catch (error) {
        log.error(`[correo] No se pudo contactar a Brevo (${error?.name ?? 'error'}); el correo no se envió.`);
      }
    },
    list: () => [],
    last: () => undefined,
    count: () => 0,
    clear: () => {},
  };
}
