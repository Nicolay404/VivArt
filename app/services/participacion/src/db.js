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
`;

const NOMBRE_ESQUEMA = /^[a-z_][a-z0-9_]{0,62}$/;

/**
 * Abre la conexión a PostgreSQL y crea el esquema si no existe.
 * `schema` (opcional) aísla las tablas en un esquema propio: lo usan las pruebas.
 * Devuelve: `query` (filas), `run` (filas afectadas), `transaction(clave, trabajo)` y `close`.
 */
export async function openDb({ url, schema } = {}) {
  if (!url) throw new Error('Falta DATABASE_URL: el servicio de participación necesita su base de datos PostgreSQL.');
  if (schema !== undefined && !NOMBRE_ESQUEMA.test(schema)) throw new Error('Nombre de esquema no válido.');

  const pool = new pg.Pool({ connectionString: url, max: 10, ...(schema ? { options: `-c search_path=${schema}` } : {}) });

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
