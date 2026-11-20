import pg from 'pg';

// Esquema del servicio de programación (ver specs/002-programacion-y-publicacion/data-model.md).
// Fechas y horas de funciones y franjas: texto LOCAL de Loja (AAAA-MM-DD y HH:MM), que se ordena bien como texto.
// Instantes de auditoría: texto ISO 8601 en UTC.
const ESQUEMA = `
CREATE TABLE IF NOT EXISTS editions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  year INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('place', 'route')),
  address TEXT,
  route_description TEXT,
  marker JSONB,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  edition_id TEXT REFERENCES editions(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  published_at TEXT,
  published_content JSONB,
  working_content JSONB,
  editorial_state TEXT NOT NULL CHECK (editorial_state IN ('none', 'draft', 'in_review', 'returned')),
  review_notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  import_key TEXT UNIQUE,
  source JSONB,
  search_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS activities_owner ON activities (owner_id);
CREATE INDEX IF NOT EXISTS activities_publicas ON activities (status, published_at);

CREATE TABLE IF NOT EXISTS functions (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  date TEXT NOT NULL CHECK (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  start_time TEXT NOT NULL CHECK (start_time ~ '^[0-9]{2}:[0-9]{2}$'),
  end_time TEXT CHECK (end_time IS NULL OR end_time ~ '^[0-9]{2}:[0-9]{2}$'),
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  venue_id TEXT NOT NULL REFERENCES venues(id),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS functions_fecha ON functions (date, start_time);
CREATE INDEX IF NOT EXISTS functions_actividad ON functions (activity_id);

CREATE TABLE IF NOT EXISTS opening_slots (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  venue_id TEXT NOT NULL REFERENCES venues(id),
  dates JSONB,
  from_date TEXT,
  to_date TEXT,
  weekdays JSONB,
  opens TEXT NOT NULL,
  closes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS slots_actividad ON opening_slots (activity_id);

CREATE TABLE IF NOT EXISTS notices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  function_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('rescheduled', 'cancelled', 'changed')),
  public_text TEXT NOT NULL,
  internal_reason TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  filename TEXT,
  edition_id TEXT REFERENCES editions(id),
  status TEXT NOT NULL CHECK (status IN ('preview', 'accepted'))
);

CREATE TABLE IF NOT EXISTS import_records (
  batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  import_key TEXT,
  source_ref JSONB,
  data JSONB,
  errors JSONB NOT NULL DEFAULT '[]',
  duplicate_of TEXT,
  outcome TEXT NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'loaded', 'skipped_existing', 'skipped_error')),
  activity_id TEXT,
  PRIMARY KEY (batch_id, position)
);

CREATE TABLE IF NOT EXISTS history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details JSONB
);
CREATE INDEX IF NOT EXISTS history_entidad ON history (entity_type, entity_id);

-- El historial es de solo anexar (RC-06, RNF-09): no se modifica, no se borra y no se vacía.
CREATE OR REPLACE FUNCTION history_solo_anexar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'history es de solo anexar';
END
$$;
DROP TRIGGER IF EXISTS history_sin_cambios ON history;
CREATE TRIGGER history_sin_cambios BEFORE UPDATE OR DELETE ON history
  FOR EACH ROW EXECUTE FUNCTION history_solo_anexar();
DROP TRIGGER IF EXISTS history_sin_vaciar ON history;
CREATE TRIGGER history_sin_vaciar BEFORE TRUNCATE ON history
  FOR EACH STATEMENT EXECUTE FUNCTION history_solo_anexar();

-- Spec 003 (mapa de sedes): destino verificado de «Cómo llegar», accesibilidad por característica y foto.
-- Cambios idempotentes que no borran datos (ver specs/003-mapa-de-sedes/data-model.md).
ALTER TABLE venues ADD COLUMN IF NOT EXISTS dest_lat DOUBLE PRECISION;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS dest_lng DOUBLE PRECISION;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS dest_source TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS dest_verified_on TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'venues_destino_completo' AND conrelid = 'venues'::regclass) THEN
    -- Los cuatro datos del destino van juntos o no va ninguno (FR-023).
    ALTER TABLE venues ADD CONSTRAINT venues_destino_completo CHECK (
      (dest_lat IS NULL AND dest_lng IS NULL AND dest_source IS NULL AND dest_verified_on IS NULL)
      OR (dest_lat BETWEEN -90 AND 90 AND dest_lng BETWEEN -180 AND 180
          AND dest_source IS NOT NULL AND dest_verified_on ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS venue_accessibility (
  venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (feature IN ('step_free', 'accessible_toilet')),
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'unavailable', 'unconfirmed')),
  source TEXT,
  verified_on TEXT CHECK (verified_on IS NULL OR verified_on ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  note TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (venue_id, feature),
  -- Confirmada o no disponible exige fuente y fecha de verificación (FR-018).
  CHECK (status = 'unconfirmed' OR (source IS NOT NULL AND verified_on IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS venue_photos (
  venue_id TEXT PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes BYTEA NOT NULL CHECK (octet_length(bytes) <= 1048576),
  alt TEXT NOT NULL,
  credit TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

const NOMBRE_ESQUEMA = /^[a-z_][a-z0-9_]{0,62}$/;

/**
 * Abre la conexión a PostgreSQL y crea el esquema si no existe.
 * `schema` (opcional) aísla las tablas en un esquema propio: lo usan las pruebas.
 * Devuelve: `query` (filas), `run` (filas afectadas), `transaction(clave, trabajo)` y `close`.
 */
export async function openDb({ url, schema, max = 10, idleTimeoutMillis = 10000 } = {}) {
  if (!url) throw new Error('Falta DATABASE_URL: el servicio de programación necesita su base de datos PostgreSQL.');
  if (schema !== undefined && !NOMBRE_ESQUEMA.test(schema)) throw new Error('Nombre de esquema no válido.');

  const pool = new pg.Pool({ connectionString: url, max, idleTimeoutMillis, ...(schema ? { options: `-c search_path=${schema}` } : {}) });

  const cliente = await pool.connect();
  try {
    if (schema) await cliente.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await cliente.query('BEGIN');
    await cliente.query("SELECT pg_advisory_xact_lock(hashtext('vivart-programacion-esquema'))");
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
    /** Ejecuta `trabajo(tx)` en una transacción con un bloqueo por `clave`; si falla, se deshace todo. */
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

export const esDuplicado = (error) => error?.code === '23505';
