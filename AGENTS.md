# AGENTS.md: reglas de trabajo de VIVART

Fuente común para Claude Code, Codex, Antigravity y otros agentes. Los requisitos del producto **no** están aquí: viven en `context/`. Si algo de este archivo choca con `context/`, pregunta antes de decidir.

## Qué es VIVART

Aplicación web para el Festival Internacional de Artes Vivas de Loja: web pública (celular primero) y panel interno (escritorio primero). Pagos de prueba, sin cobros reales.

## Dónde leer el contexto

1. `context/README.md` (orden de lectura y encargo para Spec Kit).
2. `context/idea/idea.md`, `context/requirements/funcionales.md` (RF y RC, y «Decisiones pendientes»), `context/requirements/no-funcionales.md`, `context/design/navegacion.md`.
3. `context/assets/PROGRAMACION 2026 digital.pdf` solo para contrastar la programación. **No viene con el clon** (Git lo ignora); si no está, no lo busques ni lo reconstruyas: pide el archivo y consulta `context/assets/README.md`. Los mockups son referencia visual: si contradicen un requisito, prevalece el requisito.

Reglas de contenido:

- No inventes precios, cupos, duraciones, horarios, accesibilidad ni decisiones. Si falta un dato, repórtalo como pendiente.
- No cambies los IDs RF, RC ni RNF; añade nuevos al final del bloque que corresponda.
- Integración del contexto: rama `docs/contexto-inicial` → PR a `main`. Esa rama no es uno de los ocho specs.
- Cada regla tiene **un solo RF dueño**; los demás requisitos remiten a él en lugar de repetirla (por ejemplo, la cancelación con ventas vive en RF-24).
- Una decisión pendiente (`funcionales.md`, «Decisiones pendientes») se pregunta al equipo, no se resuelve en un spec.
- No uses la ilustración de Alforjita como avatar sin autorización.

## Spec Kit

- **Máximo ocho specs.** El estilo arquitectónico no es un noveno spec.
- Primero se propone el reparto de los ocho specs; solo después se genera cada uno.
- Las skills o comandos de Spec Kit se instalan **por proyecto** con `specify init` o `specify integration`; no existe una instalación global de skills.
- No ejecutes `specify init`, `specify integration install|switch|uninstall|upgrade`, `specify extension add` ni actualices `specify` sin acuerdo explícito del equipo.
- No instales la extensión `agent-context` sin acuerdo: escribe un bloque dentro de `AGENTS.md` o `CLAUDE.md`.
- Revisa la extensión `git` antes de habilitarla: puede crear ramas y hacer commits automáticos.
- **Preferencia del equipo (no probada ni inicializada):** base neutra con `specify init --integration none` e integraciones locales por persona con `specify integration switch <clave>`. Antes de aplicarla hay que comprobar su comportamiento en una copia de prueba.
- No edites a mano las skills o comandos que Spec Kit genera; las personalizaciones se hacen con presets o sobrescrituras del proyecto.

## Ramas

- **Una rama por spec**, con tres dígitos y nombre descriptivo: `001-identidad-y-permisos`.
- Si Spec Kit crea la rama, se reutiliza. No trabajes dos specs en la misma rama.
- No hagas commit, push, merge ni crees ramas sin que el equipo lo pida.
- **Sin coautoría de IA:** no añadas `Co-Authored-By`, «Generated with» ni créditos de ningún agente en commits, PR o archivos.
- **Sin basura local:** no crees copias del repositorio ni carpetas de prueba. Verifica en una rama y revierte con Git lo que no sirva.

## Restricciones académicas

- Specification-Driven Development con Spec Kit.
- Una arquitectura compartida, documentada en **cuatro vistas** con Mermaid o DeepWiki.
- **No se permite el monolito modular.**
- El estilo arquitectónico se elige aparte, antes de los planes técnicos. No lo decidas en los specs.
- No implementes el aplicativo hasta que el equipo lo indique.

## Qué se versiona y qué no (propuesta, sujeta a comprobar tras `specify init`)

- Se versiona: `AGENTS.md`, `.gitignore`, `context/` (incluidos los mockups y el afiche, pero **no** el PDF de programación) y la base compartida de Spec Kit (`.specify/` y los specs que genere).
- No se versiona por defecto: skills o comandos generados para un agente (`.claude/skills/speckit-*`, `.agents/skills/speckit-*`), preferencias o permisos locales (`.claude/settings.local.json`), credenciales, `.env` y datos personales.

## Compatibilidad entre agentes

- Antigravity lee `AGENTS.md` y `.agents/skills/` (documentación local de AGY).
- Codex lee `AGENTS.md` en la raíz del proyecto (documentación de Codex; no probado en este repositorio).
- Claude Code lee `AGENTS.md` si no hay ningún `CLAUDE.md` en el directorio de trabajo ni por encima, desde la versión 2.1.277 (documentación de Claude Code; no probado en este repositorio). Por ahora no existe `CLAUDE.md`. Si una prueba en una sesión nueva (`/memory`) muestra que hace falta, se crea un puente mínimo con solo `@AGENTS.md`.
- Codex y Antigravity comparten `.agents/skills/`; Antigravity no está declarado como compatible con instalaciones múltiples de Spec Kit.
