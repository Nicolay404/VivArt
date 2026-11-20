import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Esquema del servicio de identidad (ver specs/001-identidad-y-permisos/data-model.md).
// Las restricciones viven también en la base de datos para que no dependan solo del código.
const ESQUEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE CHECK (email = lower(trim(email))),
  password_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending_activation', 'active')),
  email_verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('editor', 'publicador', 'administrador', 'personal_acceso')),
  assigned_by TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS function_assignments (
  user_id TEXT NOT NULL REFERENCES users(id),
  function_id TEXT NOT NULL CHECK (length(function_id) BETWEEN 1 AND 64),
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
  ref TEXT CHECK (ref IS NULL OR length(ref) BETWEEN 1 AND 64),
  user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details TEXT
);

-- El historial es de solo anexar: no se modifica ni se borra.
CREATE TRIGGER IF NOT EXISTS audit_log_no_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log es de solo anexar'); END;
CREATE TRIGGER IF NOT EXISTS audit_log_no_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log es de solo anexar'); END;
`;

export function openDb(archivo = ':memory:') {
  if (archivo !== ':memory:') mkdirSync(dirname(archivo), { recursive: true });
  const db = new DatabaseSync(archivo);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(ESQUEMA);
  return db;
}
