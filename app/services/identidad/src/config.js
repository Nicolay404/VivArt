// Configuración del servicio de identidad. Todo sale de variables de entorno con valores técnicos por defecto.
// Ningún secreto tiene valor por defecto: las credenciales de servicio se definen en el entorno y no se versionan.

const HORA = 3600 * 1000;

function horas(valor, porDefecto) {
  const n = Number(valor ?? porDefecto);
  return (Number.isFinite(n) && n > 0 ? n : porDefecto) * HORA;
}

/** Interpreta SERVICE_KEYS="nombre:clave,otro:clave" y devuelve un Map clave -> nombre del servicio. */
export function parseServiceKeys(texto = '') {
  const claves = new Map();
  for (const par of texto.split(',').map((s) => s.trim()).filter(Boolean)) {
    const i = par.indexOf(':');
    if (i > 0 && i < par.length - 1) claves.set(par.slice(i + 1), par.slice(0, i));
  }
  return claves;
}

export function loadConfig(env = process.env, overrides = {}) {
  const base = {
    port: Number(env.PORT ?? 3001),
    host: env.HOST ?? '127.0.0.1',
    // Base de datos propia del servicio (PostgreSQL). La URL incluye la contraseña: se define en el entorno y no se versiona.
    databaseUrl: env.DATABASE_URL,
    // Esquema opcional dentro de esa base; las pruebas usan uno distinto por aplicación.
    dbSchema: env.DB_SCHEMA || undefined,
    publicBaseUrl: (env.PUBLIC_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, ''),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? 'http://localhost:8080').split(',').map((s) => s.trim()).filter(Boolean),
    mailTransport: env.MAIL_TRANSPORT ?? 'test',
    production: env.NODE_ENV === 'production',
    trustProxy: env.TRUST_PROXY === '1',
    // Vigencias. P-10 y P-11 decididos el 2026-11-20: sesión de 7 días como máximo, acción pendiente de 24 h.
    ttl: {
      session: horas(env.SESSION_TTL_HOURS, 168),
      // Inactividad (P-10, decidido el 2026-11-20): panel interno 2 h; web pública 7 días.
      idleInternal: horas(env.SESSION_IDLE_INTERNAL_HOURS, 2),
      idlePublic: horas(env.SESSION_IDLE_PUBLIC_HOURS, 168),
      verify: horas(env.VERIFY_TTL_HOURS, 24),
      reset: horas(env.RESET_TTL_HOURS, 1),
      activate: horas(env.ACTIVATE_TTL_HOURS, 72),
      pending: horas(env.PENDING_TTL_HOURS, 24),
    },
    scrypt: { N: Number(env.SCRYPT_N ?? 32768), r: 8, p: 1 },
    limits: {
      login: { max: 10, windowMs: 15 * 60 * 1000 },
      register: { max: 5, windowMs: HORA },
      reset: { max: 5, windowMs: HORA },
      resend: { max: 5, windowMs: HORA },
    },
    serviceKeys: parseServiceKeys(env.SERVICE_KEYS),
    clock: () => new Date(),
  };
  return {
    ...base,
    ...overrides,
    ttl: { ...base.ttl, ...(overrides.ttl ?? {}) },
    scrypt: { ...base.scrypt, ...(overrides.scrypt ?? {}) },
    limits: { ...base.limits, ...(overrides.limits ?? {}) },
  };
}
