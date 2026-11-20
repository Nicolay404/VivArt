#!/usr/bin/env bash
# Prueba de humo de la demo con contenedores (app/docker-compose.yml). Se usa en CI y también en local:
#   cd app && docker compose up -d --build --wait && bash ../.github/scripts/humo-contenedores.sh
set -euo pipefail
BASE="${1:-http://localhost:8080}"

curl -fsS "$BASE/" | grep -q "VIVART"
echo "ok: la entrada sirve la web"

curl -fsSI "$BASE/" | grep -i -q "permissions-policy: geolocation=()"
echo "ok: la web no puede pedir la ubicación"

curl -fsS "$BASE/api/identidad/health" | grep -q '"identidad"'
echo "ok: la entrada enruta al servicio de identidad"

codigo="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/identidad/me")"
[ "$codigo" = "401" ]
echo "ok: las rutas protegidas piden identificarse"

codigo="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/internal/introspect")"
{ [ "$codigo" = "404" ] || [ "$codigo" = "405" ]; }
echo "ok: las rutas internas entre servicios no se exponen"

curl -fsS "$BASE/api/programacion/health" | grep -q '"programacion"'
echo "ok: la entrada enruta al servicio de programación y su base responde"

curl -fsS "$BASE/api/programacion/agenda" | grep -q '"items"'
echo "ok: la Agenda pública responde sin sesión"

codigo="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/programacion/panel/activities")"
[ "$codigo" = "401" ]
echo "ok: el panel de programación pide identificarse"

codigo="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/programacion/internal/functions/x")"
[ "$codigo" = "401" ]
echo "ok: la API interna de programación exige credencial de servicio"

curl -fsS "$BASE/api/participacion/health" | grep -q '"participacion"'
echo "ok: la entrada enruta al servicio de participación y su base responde"

codigo="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/participacion/tickets")"
[ "$codigo" = "401" ]
echo "ok: Mis entradas pide identificarse"

codigo="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/participacion/internal/functions/x/impact")"
[ "$codigo" = "401" ]
echo "ok: la API interna de participación exige credencial de servicio"

curl -fsSI "$BASE/" | grep -i -q "camera=(self)"
echo "ok: la cámara solo se permite al propio sitio"

echo "Humo de contenedores: todo correcto."
