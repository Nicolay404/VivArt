import { hashPassword, verifyPassword, dummyVerify, validatePassword } from './passwords.js';
import { newToken, hashToken, newId, iso, expiresAt } from './tokens.js';
import { validation, invalidToken, invalidCredentials, AppError } from '../http/errors.js';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@.]+(?:\.[^\s@.]+)+$/;
export const NEUTRAL_MESSAGE = 'Si el correo es válido, recibirás un mensaje con las instrucciones.';

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/** Cuentas, sesiones, verificación y recuperación. No conoce HTTP: lo usan las rutas y el script interno. */
export function createAccounts({ repos, config, mailer, audit, clock }) {
  const ahora = () => clock();

  async function sendLink({ user, kind, subject, text, path, ttl, purpose }) {
    const now = ahora();
    repos.tokens.invalidateFor(user.id, purpose, iso(now));
    const { token, hash } = newToken();
    repos.tokens.create({ hash, userId: user.id, purpose, expiresAt: expiresAt(now, ttl), now: iso(now) });
    await mailer.send({ to: user.email, kind, subject, text, link: `${config.publicBaseUrl}${path}?token=${token}` });
  }

  const sendVerification = (user) =>
    sendLink({
      user,
      kind: 'verify',
      purpose: 'verify',
      ttl: config.ttl.verify,
      path: '/verificar',
      subject: 'Verifica tu correo en VIVART',
      text: 'Abre el enlace para verificar tu correo. Es de un solo uso y vence pronto.',
    });

  function validarCorreo(email) {
    const e = normalizeEmail(email);
    if (!EMAIL_RE.test(e) || e.length > 254) throw validation('email', 'Escribe un correo electrónico válido.');
    return e;
  }

  function validarClave(password) {
    const v = validatePassword(password);
    if (!v.ok) throw validation('password', v.message);
  }

  /** Contexto de una sesión: persona, roles activos (suma), funciones y si el correo está verificado. */
  function getContext(sessionToken) {
    if (typeof sessionToken !== 'string' || sessionToken.length === 0) return null;
    const sesion = repos.sessions.find(hashToken(sessionToken));
    if (!sesion) return null;
    if (sesion.expires_at <= iso(ahora())) {
      repos.sessions.delete(sesion.id);
      return null;
    }
    const user = repos.users.findById(sesion.user_id);
    if (!user || user.status !== 'active') return null;
    const guardados = repos.roles.listRoles(user.id);
    return {
      userId: user.id,
      email: user.email,
      emailVerified: Boolean(user.email_verified_at),
      roles: ['usuario_registrado', ...guardados],
      functionIds: repos.roles.listFunctions(user.id),
    };
  }

  return {
    getContext,

    async register({ email, password }) {
      const e = validarCorreo(email);
      validarClave(password);
      // Se calcula siempre el hash para no distinguir por tiempo un correo nuevo de uno ya registrado.
      const hash = await hashPassword(password, config.scrypt);
      const existente = repos.users.findByEmail(e);
      if (existente) {
        await mailer.send({
          to: e,
          kind: 'already_registered',
          subject: 'Ya tienes una cuenta en VIVART',
          text: 'Alguien intentó registrar este correo, que ya tiene cuenta. Si fuiste tú, inicia sesión o recupera tu acceso.',
          link: `${config.publicBaseUrl}/recuperar`,
        });
        return { message: NEUTRAL_MESSAGE };
      }
      const user = { id: newId(), email: e };
      try {
        repos.users.create({ id: user.id, email: e, passwordHash: hash, status: 'active', now: iso(ahora()) });
      } catch (error) {
        if (String(error.message).includes('UNIQUE')) return { message: NEUTRAL_MESSAGE };
        throw error;
      }
      await sendVerification(user);
      return { message: NEUTRAL_MESSAGE };
    },

    async verifyEmail(token) {
      const now = iso(ahora());
      const fila = repos.tokens.consume(hashToken(token ?? ''), 'verify', now);
      if (!fila) throw invalidToken();
      repos.users.markVerified(fila.user_id, now);
      return { verified: true };
    },

    async resendVerification(email) {
      const user = repos.users.findByEmail(normalizeEmail(email));
      if (user && user.status === 'active' && !user.email_verified_at) await sendVerification(user);
      return { message: NEUTRAL_MESSAGE };
    },

    async login({ email, password }) {
      const user = repos.users.findByEmail(normalizeEmail(email));
      const claveValida = typeof password === 'string';
      if (!user || user.status !== 'active' || !user.password_hash || !claveValida) {
        await dummyVerify(config.scrypt);
        throw invalidCredentials();
      }
      if (!(await verifyPassword(password, user.password_hash))) throw invalidCredentials();
      const now = ahora();
      repos.sessions.deleteExpired(iso(now));
      const { token, hash } = newToken();
      repos.sessions.create(hash, user.id, iso(now), expiresAt(now, config.ttl.session));
      return { token, persona: getContext(token) };
    },

    logout(sessionToken) {
      if (typeof sessionToken === 'string' && sessionToken) repos.sessions.delete(hashToken(sessionToken));
    },

    async requestReset(email) {
      const user = repos.users.findByEmail(normalizeEmail(email));
      if (user && user.status === 'active') {
        await sendLink({
          user,
          kind: 'reset',
          purpose: 'reset',
          ttl: config.ttl.reset,
          path: '/restablecer',
          subject: 'Recupera tu acceso a VIVART',
          text: 'Abre el enlace para elegir una contraseña nueva. Es de un solo uso y vence pronto.',
        });
      }
      return { message: NEUTRAL_MESSAGE };
    },

    async confirmReset({ token, password }) {
      validarClave(password);
      const hash = await hashPassword(password, config.scrypt);
      const now = iso(ahora());
      const fila = repos.tokens.consume(hashToken(token ?? ''), 'reset', now);
      if (!fila) throw invalidToken();
      repos.users.setPassword(fila.user_id, hash, now);
      // Recibir el enlace en su correo demuestra que es de su titular.
      repos.users.markVerified(fila.user_id, now);
      repos.sessions.deleteForUser(fila.user_id);
      audit(fila.user_id, 'password.reset', 'user', fila.user_id);
    },

    /** Activa una cuenta pendiente (primer administrador) y fija su contraseña. */
    async activate({ token, password }) {
      validarClave(password);
      const hash = await hashPassword(password, config.scrypt);
      const now = iso(ahora());
      const fila = repos.tokens.consume(hashToken(token ?? ''), 'activate', now);
      if (!fila) throw invalidToken();
      repos.users.activate(fila.user_id, hash, now);
      audit(fila.user_id, 'account.activated', 'user', fila.user_id);
    },

    /**
     * Procedimiento interno: crea la cuenta pendiente de activación con rol administrador y emite el enlace.
     * No define ninguna contraseña. Por seguridad no se ejecuta si ya existe un administrador activo,
     * salvo que se pida expresamente.
     */
    async createFirstAdmin(email, { allowAdditional = false } = {}) {
      const e = validarCorreo(email);
      if (!allowAdditional && repos.users.countActiveAdmins() > 0) {
        throw new AppError(409, 'admin_exists', 'Ya existe un administrador activo. Usa la gestión de roles o pide el procedimiento adicional.');
      }
      const now = ahora();
      let user = repos.users.findByEmail(e);
      if (user && user.status === 'active') {
        throw new AppError(409, 'account_exists', 'Ese correo ya tiene una cuenta activa.');
      }
      if (!user) {
        user = { id: newId(), email: e };
        repos.users.create({ id: user.id, email: e, status: 'pending_activation', now: iso(now) });
      }
      repos.roles.addRole(user.id, 'administrador', 'procedimiento-interno', iso(now));
      audit('procedimiento-interno', 'admin.bootstrap', 'user', user.id, { role: 'administrador' });
      await sendLink({
        user,
        kind: 'activate',
        purpose: 'activate',
        ttl: config.ttl.activate,
        path: '/activar',
        subject: 'Activa tu cuenta de administrador en VIVART',
        text: 'Abre el enlace para elegir tu contraseña y activar la cuenta. Es de un solo uso.',
      });
      return { email: e };
    },
  };
}
