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
- Los cambios en `context/` van en la rama del spec que los motiva y llegan a `main` con su PR.
- Cada regla tiene **un solo RF dueño**; los demás requisitos remiten a él en lugar de repetirla (por ejemplo, la cancelación con ventas vive en RF-24).
- Una decisión pendiente (`funcionales.md`, «Decisiones pendientes») se pregunta al equipo, no se resuelve en un spec.
- No uses la ilustración de Alforjita como avatar sin autorización.

## Estructura del repositorio

| Carpeta | Qué contiene | ¿Se versiona? |
|---|---|---|
| `app/` | **Todo el código**: `services/<nombre>/` (un servicio por carpeta), `web/` y `edge/` (entrada común) | Sí |
| `context/` | Requisitos, diseño y referencias del producto | Sí (sin el PDF de programación) |
| `specs/` | Un spec por carpeta (`NNN-nombre`), con su plan, tareas y contratos | Sí |
| `docs/` | Arquitectura común y otras decisiones compartidas | Sí |
| `.specify/` | Base neutra de Spec Kit (plantillas, scripts, constitución) | Sí |
| `.github/` | Integración y entrega continuas (GitHub Actions) y Dependabot | Sí |
| `.claude/`, `.agents/` | Skills y ajustes locales de cada agente (la lista común de skills está en `skills-lock.json`) | No (solo locales) |

El código no se mezcla con la documentación ni con las herramientas de agentes: si es código, va bajo `app/`.

## Integración y entrega continuas

- **CI** (`.github/workflows/ci.yml`): en cada pull request y en cada cambio a `main` comprueba las reglas del equipo (`.github/scripts/verificar-reglas.sh`), ejecuta las pruebas de `app/`, audita dependencias y construye y prueba la demo con contenedores.
- **SonarCloud** (`sonar-project.properties`): análisis de calidad y seguridad del código de `app/`. Necesita el secreto `SONAR_TOKEN` y la variable `SONAR_ORGANIZATION` en el repositorio; si faltan, el paso se omite sin fallar. El CI le envía la cobertura real de las pruebas de cada servicio y de la entrada común (`.github/scripts/cobertura.sh`); la web (`app/web`) queda fuera del cálculo de cobertura porque se valida en el navegador. Nunca pongas el token en el código.
- **CD** (`.github/workflows/cd.yml`): al unir cambios de `app/` a `main` publica las imágenes de cada servicio en `ghcr.io`, etiquetadas con el commit. El despliegue a un entorno concreto aún no está definido por el equipo.
- Puedes correr las reglas en local: `bash .github/scripts/verificar-reglas.sh`.
- Un PR no se fusiona con la CI en rojo.

## Spec Kit

- **Máximo ocho specs.** El estilo arquitectónico no es un noveno spec.
- Primero se propone el reparto de los ocho specs; solo después se genera cada uno.
- Las skills o comandos de Spec Kit se instalan **por proyecto** con `specify init` o `specify integration`; no existe una instalación global de skills.
- No actualices `specify`, no cambies ni desinstales integraciones ajenas y no añadas extensiones (`specify extension add`) sin acuerdo explícito del equipo.
- No instales la extensión `agent-context` sin acuerdo: escribe un bloque dentro de `AGENTS.md` o `CLAUDE.md`.
- Revisa la extensión `git` antes de habilitarla: puede crear ramas y hacer commits automáticos.
- **Base neutra (aplicada con Spec Kit 1.4.0):** el repositorio se inicializó con `specify init --here --integration none --script ps`. Solo crea `.specify/` (plantillas, scripts, constitución y flujo); no toca `AGENTS.md` ni crea carpetas de agentes. `.specify/` se versiona; su propio `.specify/.gitignore` deja fuera el estado local. Los scripts generados son de PowerShell (`ps`); quien trabaje en otro sistema debe avisarlo antes de regenerarlos.
- **Cada persona activa su agente en local**, sin versionarlo: `specify integration install claude` (Claude Code), `codex` (Codex) o `agy` (Antigravity). Codex y Antigravity comparten `.agents/skills/` y Antigravity no está declarado como compatible con instalaciones múltiples; instala solo el que uses. Esto modifica `.specify/integration.json` en tu copia: no lo incluyas en tus commits.
- La constitución del proyecto está en `.specify/memory/constitution.md` y prevalece sobre este archivo en las restricciones académicas.
- No edites a mano las skills o comandos que Spec Kit genera; las personalizaciones se hacen con presets o sobrescrituras del proyecto.

## Ramas

- **Una rama por spec**, con tres dígitos y nombre descriptivo: `001-identidad-y-permisos`.
- Si Spec Kit crea la rama, se reutiliza. No trabajes dos specs en la misma rama.
- **Solo `main` y una rama por spec.** Todo el trabajo de un spec (especificación, plan, código, pruebas, CI, documentación y contexto) va en su rama. No crees ramas aparte para CI, documentación o implementación; si alguna vez hace falta una derivada, se borra al fusionarse.
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

## Skills del equipo

Todo el equipo usa las mismas skills, aunque cada persona trabaje con un agente distinto. Se versiona solo la lista (`skills-lock.json`, con la versión exacta de cada skill); los archivos de cada skill **no** se versionan, porque cada agente los lee de su propia carpeta (`.claude/skills/` en Claude Code, `.agents/skills/` en Codex y Antigravity).

| Skill | Para qué | Instalación |
|---|---|---|
| `design-taste-frontend` (taste-skill) | Criterio visual para la interfaz de `app/web` | `npx skills add Leonxlnx/taste-skill` y elegir tu agente |

- Instala solo para el agente que usas y no subas sus carpetas (están en `.gitignore`).
- Si añades o actualizas una skill, acuérdalo antes con el equipo: cambia `skills-lock.json` para todos.
- **taste-skill se usa como guía, no al pie de la letra.** Está pensada para páginas de empresa y choca con VIVART: prohíbe el violeta (es el color del festival), pide fotos de stock (no se hacen pasar fotos de stock por obras ni artistas del festival; las fotos propias o con licencia que permita reutilizarlas sí se admiten, véase M-09) y exige una sección por pantalla (VIVART es una aplicación). Prevalecen los mockups de `context/assets/mockups/` y el sistema visual de `app/web/styles.css`: modo claro, paleta violeta y atardecer, Bricolage Grotesque y Figtree.
- En Claude Code, taste-skill añade un *hook* que, al terminar cada respuesta, revisa la página con Chrome sin ventana. Si te estorba o falla, avísalo; no edites los archivos de la skill.

## Compatibilidad entre agentes

- Antigravity lee `AGENTS.md` y `.agents/skills/` (documentación local de AGY).
- Codex lee `AGENTS.md` en la raíz del proyecto (documentación de Codex; no probado en este repositorio).
- Claude Code lee `AGENTS.md` si no hay ningún `CLAUDE.md` en el directorio de trabajo ni por encima, desde la versión 2.1.277 (documentación de Claude Code; no probado en este repositorio). Por ahora no existe `CLAUDE.md`. Si una prueba en una sesión nueva (`/memory`) muestra que hace falta, se crea un puente mínimo con solo `@AGENTS.md`.
- Codex y Antigravity comparten `.agents/skills/`; Antigravity no está declarado como compatible con instalaciones múltiples de Spec Kit.
