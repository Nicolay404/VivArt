// Configuración del servicio de programación. Todo sale de variables de entorno.
// Ningún secreto tiene valor por defecto: las credenciales se definen en el entorno y no se versionan.

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
  const production = env.NODE_ENV === 'production';
  // RC-07 / RNF-10: el reloj solo puede fijarse en pruebas y demo, nunca en producción.
  const fijo = !production && env.CLOCK_FIXED ? new Date(env.CLOCK_FIXED) : null;
  const relojFijo = fijo && !Number.isNaN(fijo.getTime()) ? fijo : null;

  const base = {
    port: Number(env.PORT ?? 3002),
    host: env.HOST ?? '127.0.0.1',
    production,
    databaseUrl: env.DATABASE_URL,
    dbSchema: env.DB_SCHEMA || undefined,
    identidadUrl: (env.IDENTIDAD_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, ''),
    identidadServiceKey: env.IDENTIDAD_SERVICE_KEY ?? '',
    participacionUrl: env.PARTICIPACION_URL ? env.PARTICIPACION_URL.replace(/\/$/, '') : '',
    serviceKeys: parseServiceKeys(env.SERVICE_KEYS),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? 'http://localhost:8080').split(',').map((s) => s.trim()).filter(Boolean),
    clockIgnored: production && Boolean(env.CLOCK_FIXED),
    clock: relojFijo ? () => new Date(relojFijo) : () => new Date(),
    clockFixed: Boolean(relojFijo),
    timeoutMs: Number(env.SERVICE_TIMEOUT_MS ?? 3000),
  };
  return { ...base, ...overrides };
}
