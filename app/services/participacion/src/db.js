import pg from 'pg';

// Esquema del servicio de participación (ver specs/005-compra-y-entradas/data-model.md).
// Importes en centavos de USD (enteros). Instantes en texto ISO 8601 UTC.
// Los ids de función y de persona son de programación e identidad: aquí no hay claves foráneas hacia otras bases.
const ESQUEMA = `
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  hold_minutes INTEGER NOT NULL CHECK (hold_minutes > 0),
  sale_close_minutes INTEGER NOT NULL CHECK (sale_close_minutes >= 0),
  updated_at TEXT,
  updated_by TEXT
);
-- Valores iniciales del spec: retención de 10 minutos (P-07) y cierre de venta 30 minutos antes (FR-039).
INSERT INTO settings (id, hold_minutes, sale_close_minutes) VALUES (1, 10, 30) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS sales (
  function_id TEXT PRIMARY KEY,
  capacity INTEGER NOT NULL CHECK (capacity >= 0),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed', 'expired', 'in_review')),
  total_cents INTEGER NOT NULL CHECK (total_cents > 0),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  closed_at TEXT
);
CREATE INDEX IF NOT EXISTS orders_persona ON orders (user_id, created_at);
CREATE INDEX IF NOT EXISTS orders_pendientes ON orders (status, expires_at);

CREATE TABLE IF NOT EXISTS order_items (
  order_id TEXT NOT NULL REFERENCES orders(id),
  function_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 6),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0),
  function_title TEXT NOT NULL,
  function_date TEXT NOT NULL,
  function_start TEXT NOT NULL,
  PRIMARY KEY (order_id, function_id)
);
CREATE INDEX IF NOT EXISTS order_items_funcion ON order_items (function_id);

CREATE TABLE IF NOT EXISTS payments (
  reference TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  result TEXT NOT NULL CHECK (result IN ('confirmed', 'failed', 'confirmed_late')),
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  user_id TEXT NOT NULL,
  function_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  secret_hash TEXT NOT NULL UNIQUE,
  code_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'invalidated')),
  used_at TEXT,
  used_by TEXT,
  invalidated_at TEXT,
  invalidated_by TEXT,
  invalidation_reason TEXT,
  issued_at TEXT NOT NULL,
  UNIQUE (order_id, seq),
  CHECK (status <> 'invalidated' OR (invalidation_reason IS NOT NULL AND invalidated_by IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS tickets_persona ON tickets (user_id);
CREATE INDEX IF NOT EXISTS tickets_funcion ON tickets (function_id);

CREATE TABLE IF NOT EXISTS access_controls (
  function_id TEXT PRIMARY KEY,
  open BOOLEAN NOT NULL,
  changed_at TEXT NOT NULL,
  changed_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  kind TEXT NOT NULL CHECK (kind IN ('late_payment')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TEXT NOT NULL,
  resolution TEXT,
  resolved_at TEXT,
  resolved_by TEXT
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

-- El historial es de solo anexar (RC-06): no se modifica, no se borra y no se vacía.
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

-- Spec 006 (Pasaporte Vivo y sellos). Ver specs/006-pasaporte-y-sellos/data-model.md.
-- Ventanas en hora local de Loja 'AAAA-MM-DD HH:MM'; instantes en ISO UTC.
CREATE TABLE IF NOT EXISTS passport_qrs (
  id TEXT PRIMARY KEY,
  function_id TEXT NOT NULL,
  ref_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('inactive', 'active', 'replaced')),
  inactive_cause TEXT CHECK (inactive_cause IS NULL OR inactive_cause IN ('manual', 'function_changed')),
  window_start TEXT CHECK (window_start IS NULL OR window_start ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}$'),
  window_end TEXT CHECK (window_end IS NULL OR window_end ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}$'),
  confirmed_for JSONB,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  CHECK ((window_start IS NULL) = (window_end IS NULL)),
  CHECK (window_start IS NULL OR window_end > window_start),
  -- Activar exige ventana confirmada (M-10).
  CHECK (status <> 'active' OR (window_start IS NOT NULL AND confirmed_for IS NOT NULL))
);
-- Un solo QR vigente por función (FR-014, M-13).
CREATE UNIQUE INDEX IF NOT EXISTS passport_qrs_vigente ON passport_qrs (function_id) WHERE status <> 'replaced';

CREATE TABLE IF NOT EXISTS stamp_images (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes BYTEA NOT NULL CHECK (octet_length(bytes) <= 1048576),
  alt TEXT NOT NULL,
  credit TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stamp_contents (
  id TEXT PRIMARY KEY,
  function_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  text TEXT CHECK (text IS NULL OR char_length(text) <= 280),
  image_id TEXT REFERENCES stamp_images(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE (function_id, version)
);

CREATE TABLE IF NOT EXISTS stamps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  function_id TEXT NOT NULL,
  qr_id TEXT NOT NULL REFERENCES passport_qrs(id),
  content_id TEXT REFERENCES stamp_contents(id) ON DELETE RESTRICT,
  obtained_at TEXT NOT NULL,
  -- Un sello por persona y función (RC-05, RNF-06).
  UNIQUE (user_id, function_id)
);

-- Spec 007 (Rutas culturales e insignias). Ver specs/007-rutas-e-insignias/data-model.md.
CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 10 AND 500),
  badge_title TEXT NOT NULL CHECK (char_length(badge_title) BETWEEN 3 AND 80),
  badge_description TEXT NOT NULL CHECK (char_length(badge_description) BETWEEN 5 AND 280),
  badge_icon TEXT NOT NULL CHECK (badge_icon IN ('teatro', 'musica', 'danza', 'artes-vivas', 'patrimonio', 'estrella', 'brujula')),
  badge_color TEXT NOT NULL CHECK (badge_color IN ('violeta', 'atardecer', 'terracota', 'esmeralda')),
  goal INTEGER NOT NULL CHECK (goal > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS routes_estado ON routes (status);

CREATE TABLE IF NOT EXISTS route_functions (
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  function_id TEXT NOT NULL,
  added_at TEXT NOT NULL,
  added_by TEXT NOT NULL,
  PRIMARY KEY (route_id, function_id)
);
CREATE INDEX IF NOT EXISTS route_functions_funcion ON route_functions (function_id);

CREATE TABLE IF NOT EXISTS user_badges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE RESTRICT,
  unlocked_at TEXT NOT NULL,
  stamp_count_at_unlock INTEGER NOT NULL CHECK (stamp_count_at_unlock > 0),
  -- Una sola insignia por persona y ruta (RC-05, RNF-06, SC-004).
  UNIQUE (user_id, route_id)
);
CREATE INDEX IF NOT EXISTS user_badges_persona ON user_badges (user_id);
`;

const NOMBRE_ESQUEMA = /^[a-z_][a-z0-9_]{0,62}$/;

/**
 * Abre la conexión a PostgreSQL y crea el esquema si no existe.
 * `schema` (opcional) aísla las tablas en un esquema propio: lo usan las pruebas.
 * Devuelve: `query` (filas), `run` (filas afectadas), `transaction(clave, trabajo)` y `close`.
 */
export async function openDb({ url, schema, max = 10, idleTimeoutMillis = 10000 } = {}) {
  if (!url) throw new Error('Falta DATABASE_URL: el servicio de participación necesita su base de datos PostgreSQL.');
  if (schema !== undefined && !NOMBRE_ESQUEMA.test(schema)) throw new Error('Nombre de esquema no válido.');

  const pool = new pg.Pool({ connectionString: url, max, idleTimeoutMillis, ...(schema ? { options: `-c search_path=${schema}` } : {}) });

  const cliente = await pool.connect();
  try {
    if (schema) await cliente.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await cliente.query('BEGIN');
    await cliente.query("SELECT pg_advisory_xact_lock(hashtext('vivart-participacion-esquema'))");
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
     * Ejecuta `trabajo(tx)` en una transacción; si falla, se deshace todo. Con `clave`, además toma un bloqueo
     * consultivo por esa clave. Las filas de venta se bloquean con SELECT … FOR UPDATE dentro del trabajo.
     */
    async transaction(clave, trabajo) {
      const conexion = await pool.connect();
      try {
        await conexion.query('BEGIN');
        if (clave) await conexion.query('SELECT pg_advisory_xact_lock(hashtext($1))', [clave]);
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
