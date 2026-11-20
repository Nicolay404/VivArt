#!/bin/sh
# Crea una base de datos y un usuario propio por servicio, la primera vez que arranca el contenedor de PostgreSQL.
# Cada servicio solo puede conectarse a SU base: comparten el servidor, no los datos (no es un monolito con base común).
# Las contraseñas llegan por variables de entorno desde app/.env (no se versionan).
set -eu

crear_servicio() {
  usuario="$1"
  clave="$2"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
    -v usuario="$usuario" -v clave="$clave" <<'SQL'
CREATE ROLE :"usuario" LOGIN PASSWORD :'clave';
SQL
  for base in "$usuario" "${usuario}_pruebas"; do
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres -v usuario="$usuario" -v base="$base" <<'SQL'
CREATE DATABASE :"base" OWNER :"usuario";
REVOKE ALL ON DATABASE :"base" FROM PUBLIC;
GRANT CONNECT, CREATE, TEMPORARY ON DATABASE :"base" TO :"usuario";
SQL
  done
}

# Nadie más que el superusuario entra a las bases administrativas.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<'SQL'
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;
SQL

# Servicio de identidad (spec 001). Los servicios de los specs siguientes se añaden aquí con su propia variable.
crear_servicio identidad "$IDENTIDAD_DB_PASSWORD"
