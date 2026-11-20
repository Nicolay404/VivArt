import { authorize } from '../domain/policy.js';
import { forbidden, unauthenticated } from './errors.js';

export const SESSION_COOKIE = 'vivart_sid';
export const PENDING_COOKIE = 'vivart_pa';

export function sessionCookieOptions(config) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.production,
    path: '/',
    maxAge: Math.floor(config.ttl.session / 1000),
  };
}

export function pendingCookieOptions(config) {
  return { ...sessionCookieOptions(config), maxAge: Math.floor(config.ttl.pending / 1000) };
}

/** Funciones de protección que usan las rutas. La verificación ocurre siempre en el servidor. */
export function createGuards({ accounts }) {
  function optionalSession(request) {
    return accounts.getContext(request.cookies?.[SESSION_COOKIE]);
  }

  function requireSession(request) {
    const persona = optionalSession(request);
    if (!persona) throw unauthenticated();
    return persona;
  }

  function requireAction(request, action, context = {}) {
    const persona = requireSession(request);
    const resultado = authorize(persona, action, context);
    if (!resultado.allowed) throw forbidden(resultado.acceptedRoles, resultado.reason);
    return persona;
  }

  return { optionalSession, requireSession, requireAction };
}
