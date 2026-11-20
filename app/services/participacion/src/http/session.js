import { unauthenticated, AppError } from './errors.js';

export const SESSION_COOKIE = 'vivart_sid';

function leerCookie(cabecera, nombre) {
  for (const parte of String(cabecera ?? '').split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nombre) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return undefined;
}

/**
 * Sesión de quien llama: la cookie del servicio de identidad viaja por la entrada común.
 * Se pregunta a identidad en cada solicitud, así un rol revocado o una sesión cerrada dejan de valer enseguida.
 */
export function createSession(identidad) {
  async function sesion(request) {
    const token = leerCookie(request.headers.cookie, SESSION_COOKIE);
    if (!token) throw unauthenticated();
    const persona = await identidad.introspect(token);
    if (!persona) throw unauthenticated();
    return {
      token,
      userId: persona.userId,
      emailVerified: persona.emailVerified === true,
      functionIds: Array.isArray(persona.functionIds) ? persona.functionIds : [],
    };
  }
  /** Pagar exige correo verificado (RF-03, FR-007). */
  sesion.verificada = async (request) => {
    const s = await sesion(request);
    if (!s.emailVerified) throw new AppError(403, 'email_not_verified', 'Verifica tu correo para poder pagar.');
    return s;
  };
  return sesion;
}
