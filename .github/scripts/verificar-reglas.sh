#!/usr/bin/env bash
# Reglas del equipo (AGENTS.md y constitución). Se ejecuta en la integración continua y también en local:
#   bash .github/scripts/verificar-reglas.sh
# En un pull request, la integración continua define BASE_SHA, HEAD_SHA y PR_BODY.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fallos=0
fallar() {
  echo "::error::$1"
  fallos=$((fallos + 1))
}

BASE="${BASE_SHA:-}"
if [ -z "$BASE" ] && git rev-parse --verify -q origin/main >/dev/null; then
  BASE="$(git merge-base origin/main HEAD)"
fi
CABEZA="${HEAD_SHA:-HEAD}"

PATRON_IA='co-authored-by:.*(claude|anthropic|copilot|codex|openai|chatgpt|gemini|cursor|devin)|generated with .*(claude|codex|copilot|gemini)'

# 1. Sin coautoría ni créditos de IA en commits ni en la descripción del PR.
if [ -n "$BASE" ] && [ "$BASE" != "$(git rev-parse "$CABEZA")" ]; then
  if git log --format=%B "$BASE..$CABEZA" | grep -i -E -q "$PATRON_IA"; then
    fallar "Hay coautoría o créditos de IA en los mensajes de commit. Retíralos (regla de AGENTS.md)."
  fi
fi
if [ -n "${PR_BODY:-}" ] && printf '%s' "$PR_BODY" | grep -i -E -q "$PATRON_IA"; then
  fallar "La descripción del PR contiene créditos de IA. Retíralos (regla de AGENTS.md)."
fi

# 2. El PDF de programación no se versiona (se conserva en una carpeta compartida).
if git ls-files | grep -i -E -q 'PROGRAMACION.*\.pdf$'; then
  fallar "El PDF de programación está versionado. Debe quedar fuera de Git (context/assets/README.md)."
fi

# 3. La base de Spec Kit se versiona en su estado neutro: las integraciones por agente son locales.
#    Se comprueba lo que está en el commit, no tu copia de trabajo (que tus agentes pueden modificar).
if git cat-file -e "$CABEZA:.specify/integration.json" 2>/dev/null; then
  if ! git show "$CABEZA:.specify/integration.json" | node -e '
    const j = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const lista = j.installed_integrations ?? [];
    process.exit(lista.length === 1 && lista[0] === "none" && j.default_integration === "none" ? 0 : 1);
  '; then
    fallar ".specify/integration.json no está en estado neutro (solo \"none\"). No lo incluyas en tus commits."
  fi
fi

# 4. Nada local ni secreto versionado.
if git ls-files | grep -E -q '(^|/)\.env($|\.[^e])|(^|/)\.env\.(local|production|staging)$'; then
  fallar "Hay archivos .env versionados. Solo se permite .env.example."
fi
if git ls-files | grep -E -q '\.sqlite($|-)'; then
  fallar "Hay bases de datos SQLite versionadas."
fi
if git ls-files | grep -E -q '(^|/)node_modules/'; then
  fallar "node_modules está versionado."
fi
if git ls-files | grep -E -q '(^|/)\.claude/skills/speckit-|(^|/)\.agents/skills/speckit-|(^|/)\.claude/settings\.local\.json$'; then
  fallar "Hay archivos locales de agentes versionados (skills de Spec Kit o ajustes locales)."
fi

if [ "$fallos" -gt 0 ]; then
  echo "Reglas del equipo: $fallos problema(s)."
  exit 1
fi
echo "Reglas del equipo: todo en orden."
