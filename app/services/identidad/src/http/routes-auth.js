import { SESSION_COOKIE, sessionCookieOptions } from './guards.js';
import { tooManyRequests } from './errors.js';
import { normalizeEmail } from '../domain/accounts.js';

const cuerpo = (request) => (request.body && typeof request.body === 'object' && !Array.isArray(request.body) ? request.body : {});

export function publicPerson(persona) {
  return {
    id: persona.userId,
    email: persona.email,
    emailVerified: persona.emailVerified,
    roles: persona.roles,
    functionIds: persona.functionIds,
  };
}

export function registerAuthRoutes(app, { accounts, limiter, config, guards }) {
  const limitar = (clave, regla) => {
    if (!limiter.allow(clave, regla)) throw tooManyRequests();
  };

  app.post('/auth/register', async (request, reply) => {
    limitar(`register|${request.ip}`, config.limits.register);
    const { email, password } = cuerpo(request);
    return reply.code(202).send(await accounts.register({ email, password }));
  });

  app.post('/auth/verify-email', async (request, reply) => {
    await accounts.verifyEmail(cuerpo(request).token);
    return reply.code(200).send({ verified: true });
  });

  app.post('/auth/resend-verification', async (request, reply) => {
    limitar(`resend|${request.ip}`, config.limits.resend);
    return reply.code(202).send(await accounts.resendVerification(cuerpo(request).email));
  });

  app.post('/auth/login', async (request, reply) => {
    const { email, password } = cuerpo(request);
    limitar(`login|${request.ip}|${normalizeEmail(email)}`, config.limits.login);
    const { token, persona } = await accounts.login({ email, password });
    reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions(config));
    return reply.code(200).send(publicPerson(persona));
  });

  app.post('/auth/logout', async (request, reply) => {
    await accounts.logout(request.cookies?.[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });

  app.post('/auth/password-reset/request', async (request, reply) => {
    limitar(`reset|${request.ip}`, config.limits.reset);
    return reply.code(202).send(await accounts.requestReset(cuerpo(request).email));
  });

  app.post('/auth/password-reset/confirm', async (request, reply) => {
    const { token, password } = cuerpo(request);
    await accounts.confirmReset({ token, password });
    return reply.code(204).send();
  });

  app.post('/auth/activate', async (request, reply) => {
    const { token, password } = cuerpo(request);
    await accounts.activate({ token, password });
    return reply.code(204).send();
  });

  app.get('/me', async (request, reply) => {
    return reply.code(200).send(publicPerson(await guards.requireSession(request)));
  });
}
