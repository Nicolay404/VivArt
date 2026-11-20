import pg from 'pg';

// Esquema del servicio de identidad en PostgreSQL (ver specs/001-identidad-y-permisos/data-model.md).
// Las restricciones viven también en la base de datos para que no dependan solo del código.
// Las fechas se guardan como texto ISO 8601 en UTC: se comparan como texto igual que antes y no dependen de la zona.
const ESQUEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
  password_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending_activation', 'active')),
  email_verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_assignments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('editor', 'publicador', 'administrador', 'personal_acceso')),
  assigned_by TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS function_assignments (
  user_id TEXT NOT NULL REFERENCES users(id),
  function_id TEXT NOT NULL CHECK (char_length(function_id) BETWEEN 1 AND 64),
  assigned_by TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (user_id, function_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
-- Última actividad, para cerrar sesiones sin uso (P-10). Se añade sin perder las sesiones existentes.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at TEXT;
UPDATE sessions SET last_seen_at = created_at WHERE last_seen_at IS NULL;

CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  purpose TEXT NOT NULL CHECK (purpose IN ('verify', 'reset', 'activate')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_actions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('compra', 'canje')),
  ref TEXT CHECK (ref IS NULL OR char_length(ref) BETWEEN 1 AND 64),
  user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details JSONB
);

-- El historial es de solo anexar: no se modifica, no se borra y no se vacía.
CREATE OR REPLACE FUNCTION audit_log_solo_anexar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es de solo anexar';
END
$$;
DROP TRIGGER IF EXISTS audit_log_sin_cambios ON audit_log;
CREATE TRIGGER audit_log_sin_cambios BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_solo_anexar();
DROP TRIGGER IF EXISTS audit_log_sin_vaciar ON audit_log;
CREATE TRIGGER audit_log_sin_vaciar BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_solo_anexar();
`;

const NOMBRE_ESQUEMA = /^[a-z_][a-z0-9_]{0,62}$/;

/**
 * Abre la conexión a PostgreSQL y crea el esquema si no existe.
 * `schema` (opcional) aísla las tablas en un esquema propio: lo usan las pruebas para no compartir datos.
 * Devuelve una capa mínima: `query` (filas), `run` (filas afectadas) y `close`.
 */
export async function openDb({ url, schema } = {}) {
  if (!url) throw new Error('Falta DATABASE_URL: el servicio de identidad necesita su base de datos PostgreSQL.');
  if (schema !== undefined && !NOMBRE_ESQUEMA.test(schema)) throw new Error('Nombre de esquema no válido.');

  const pool = new pg.Pool({
    connectionString: url,
    max: 10,
    ...(schema ? { options: `-c search_path=${schema}` } : {}),
  });

  // Un solo proceso crea el esquema a la vez (varias réplicas o el script interno pueden arrancar juntos).
  const cliente = await pool.connect();
  try {
    if (schema) await cliente.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await cliente.query('BEGIN');
    await cliente.query("SELECT pg_advisory_xact_lock(hashtext('vivart-identidad-esquema'))");
    await cliente.query(ESQUEMA);
    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }

  const capa = (ejecutor) => ({
    query: async (sql, params = []) => (await ejecutor.query(sql, params)).rows,
    run: async (sql, params = []) => (await ejecutor.query(sql, params)).rowCount,
  });

  return {
    pool,
    ...capa(pool),
    /**
     * Ejecuta `trabajo` dentro de una transacción con un bloqueo por `clave`: dos operaciones con la misma clave
     * no se mezclan (por ejemplo, dos administradores revocándose a la vez). Si `trabajo` falla, se deshace todo.
     */
    async transaction(clave, trabajo) {
      const conexion = await pool.connect();
      try {
        await conexion.query('BEGIN');
        await conexion.query('SELECT pg_advisory_xact_lock(hashtext($1))', [clave]);
        const resultado = await trabajo(capa(conexion));
        await conexion.query('COMMIT');
        return resultado;
      } catch (error) {
        await conexion.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        conexion.release();
      }
    },
    close: () => pool.end(),
  };
}

/** Error de clave duplicada en PostgreSQL. */
export const esDuplicado = (error) => error?.code === '23505';
