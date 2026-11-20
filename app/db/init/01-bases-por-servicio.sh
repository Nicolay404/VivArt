#!/bin/sh
# Crea o actualiza una base de datos y un usuario propio por servicio. Es IDEMPOTENTE: lo ejecuta el contenedor
# `db-preparar` en cada `docker compose up`, así quien ya tenía la demo recibe las bases nuevas sin perder datos.
# Cada servicio solo puede conectarse a SU base: comparten el servidor, no los datos (no es un monolito con base común).
# Las contraseñas llegan por variables de entorno desde app/.env (no se versionan).
#
# Variables: PGHOST, PGUSER, PGPASSWORD (superusuario) y <SERVICIO>_DB_PASSWORD por servicio.
set -eu

psql_admin() {
  psql -v ON_ERROR_STOP=1 --dbname postgres "$@"
}

preparar_servicio() {
  usuario="$1"
  clave="$2"
  if [ -z "$clave" ]; then
    echo "Falta la contraseña del servicio $usuario (revisa app/.env)." >&2
    exit 1
  fi
  # Crea el usuario si no existe y deja su contraseña igual a la de app/.env.
  psql_admin -v usuario="$usuario" -v clave="$clave" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN', :'usuario')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'usuario') \gexec
ALTER ROLE :"usuario" WITH LOGIN PASSWORD :'clave';
SQL
  for base in "$usuario" "${usuario}_pruebas"; do
    psql_admin -v usuario="$usuario" -v base="$base" <<'SQL'
SELECT format('CREATE DATABASE %I OWNER %I', :'base', :'usuario')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'base') \gexec
REVOKE ALL ON DATABASE :"base" FROM PUBLIC;
GRANT CONNECT, CREATE, TEMPORARY ON DATABASE :"base" TO :"usuario";
SQL
  done
  echo "Base y usuario del servicio $usuario listos."
}

# Nadie más que el superusuario entra a las bases administrativas.
psql_admin <<'SQL'
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;
SQL

preparar_servicio identidad "${IDENTIDAD_DB_PASSWORD:-}"      # spec 001
preparar_servicio programacion "${PROGRAMACION_DB_PASSWORD:-}" # spec 002
preparar_servicio participacion "${PARTICIPACION_DB_PASSWORD:-}" # spec 005
