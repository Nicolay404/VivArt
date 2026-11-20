#!/usr/bin/env bash
# Genera la cobertura de pruebas de cada servicio y de la entrada común en formato lcov, con rutas
# relativas a la raíz del repositorio para que SonarCloud las relacione con el código.
# Uso: bash .github/scripts/cobertura.sh   (desde la raíz; deja los informes en cobertura/)
set -euo pipefail

raiz="$(pwd)"
salida="$raiz/cobertura"
rm -rf "$salida"
mkdir -p "$salida"

# medir <carpeta> <nombre> <patrón de pruebas> <patrón del código propio>
# Solo se mide el código propio de la carpeta: no las pruebas, ni dependencias, ni otros servicios.
medir() {
  local carpeta="$1" nombre="$2" patron="$3" incluir="$4"
  (cd "$carpeta" && node --test --experimental-test-coverage \
    --test-coverage-include="$incluir" --test-coverage-exclude="test/**" \
    --test-reporter=lcov --test-reporter-destination="$salida/$nombre.lcov" \
    --test-reporter=dot --test-reporter-destination=stdout \
    "$patron")
  # Las rutas salen relativas a la carpeta probada: se prefijan con la carpeta desde la raíz
  # y se normalizan las barras para que funcione igual en Windows.
  sed -i -e "s#^SF:#SF:$carpeta/#" -e '/^SF:/s#\\#/#g' "$salida/$nombre.lcov"
}

for servicio in app/services/*/; do
  servicio="${servicio%/}"
  if [ -f "$servicio/package.json" ]; then
    medir "$servicio" "$(basename "$servicio")" "test/**/*.test.js" "{src,bin}/**/*.js"
  fi
done

if [ -d app/edge/test ]; then
  medir app/edge entrada "test/**/*.test.js" "*.js"
fi

# Lista de informes separada por comas, para sonar.javascript.lcov.reportPaths
find cobertura -name '*.lcov' | sort | paste -sd, -
