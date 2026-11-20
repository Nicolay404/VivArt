import { PENDING_COOKIE, pendingCookieOptions } from './guards.js';

// Contrato de acción pendiente: conserva, retoma y descarta. NO hay aquí ninguna ruta de pago ni de canje.
export function registerPendingRoutes(app, { pending, config, guards }) {
  app.post('/auth/pending-actions', async (request, reply) => {
    const cuerpo = request.body && typeof request.body === 'object' ? request.body : {};
    const { id, expiresAt } = pending.create({ type: cuerpo.type, ref: cuerpo.ref });
    reply.setCookie(PENDING_COOKIE, id, pendingCookieOptions(config));
    return reply.code(201).send({ expiresAt });
  });

  app.get('/auth/resume', async (request, reply) => {
    const persona = guards.requireSession(request);
    return reply.code(200).send(pending.resume(request.cookies?.[PENDING_COOKIE], persona));
  });

  app.delete('/auth/pending-actions/current', async (request, reply) => {
    pending.discard(request.cookies?.[PENDING_COOKIE]);
    reply.clearCookie(PENDING_COOKIE, { path: '/' });
    return reply.code(204).send();
  });
}
