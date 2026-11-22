# Implementation Plan: Alforjita, asistente del festival

**Branch**: `008-alforjita` | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-alforjita/spec.md`

## Summary

Alforjita **no crea un servicio nuevo**. La arquitectura la asigna al **servicio de programación y consulta pública** (`app/services/programacion`), que ya es dueño del catálogo publicado, de las sedes con su accesibilidad (spec 003) y del reloj común (RC-07). Este spec amplía ese servicio:

- **Intérprete de reglas simples** (sin IA generativa): convierte una pregunta rápida o un texto libre de hasta 200 caracteres en criterios (día, horas, categoría, sede, acceso, título) o en una intención (precio, hora de fin, accesibilidad, Pasaporte y rutas, fuera de alcance). Las categorías, sedes y títulos se reconocen por su nombre en el catálogo, sin listas manuales.
- **Respuestas sobre el catálogo vigente**: se leen las mismas actividades publicadas que usa la Agenda (la misma función interna), así que no hay catálogo propio. Cada respuesta es de un tipo: coincidencias, sin coincidencias, dato no confirmado, fuera de alcance, no entendida o información (Pasaporte y rutas). La falla del servicio la muestra la web cuando la API no responde.
- **Una sola ruta pública sin sesión**: `POST /assistant/answers`. Va por POST para que el texto escrito viaje en el cuerpo y **no quede en el registro de solicitudes** (el servidor registra la URL). Nada se guarda en la base.
- **Interfaz web**: el botón «Pregúntale a Alforjita» en la Agenda abre un panel (`<dialog>`), lateral en escritorio y a pantalla completa en celular, con preguntas rápidas, campo de texto y respuestas con enlaces a las fichas. El módulo se importa al abrir el panel, para que la Agenda no lo espere (RNF-07). Se añade la página `/rutas` con «Próximamente», que el spec 007 sustituirá.

## Technical Context

**Language/Version**: JavaScript (módulos ES) sobre Node.js 24

**Primary Dependencies**: las del servicio de programación (Fastify 5 y `pg`). No se añade ninguna dependencia. En la web, módulos ES propios, sin frameworks (CSP `default-src 'self'`)

**Storage**: ninguno nuevo. Alforjita solo lee las tablas existentes (`activities`, `functions`, `opening_slots`, `notices`, `venues`, `categories`, `venue_accessibility`). No guarda consultas ni conversaciones (M-17)

**Testing**: `node:test` con `inject` de Fastify y reloj fijado (como en el 002 y el 003): pruebas unitarias del intérprete y de las respuestas, de integración de la API (incluida una que captura el registro y comprueba que el texto no aparece) y una de punta a punta en `app/edge`. La web se comprueba en Chrome sin ventana a 360 px y a 1440 px, también solo con teclado

**Target Platform**: servidor Node.js 24 en contenedor Linux. Público en celular primero

**Project Type**: ampliación de un servicio web HTTP existente, más una pantalla (panel) en la web común

**Performance Goals**: no se fijan metas (el contexto no las pide). El catálogo del MVP cabe en memoria de una consulta: se leen las actividades publicadas una vez por pregunta, igual que la Agenda

**Constraints**:
- No inventar ni deducir datos (RNF-08): un precio, una hora de fin o una característica de accesibilidad sin confirmar se dicen «por confirmar».
- Sin datos personales ni ubicación (RNF-05): la API no recibe sesión ni la usa; el texto no se guarda ni se registra; las respuestas nunca repiten el texto escrito.
- Nunca borradores, propuestas ni versiones pendientes: solo `published_content` de actividades activas (como la Agenda).
- Reloj común en hora de Loja, fijable solo en pruebas y demo (RC-07, RNF-10).
- Cuerpos de solicitud solo en JSON y con `Origin` permitido (defensa CSRF actual).

**Scale/Scope**: MVP académico. 1 endpoint público nuevo, 0 tablas nuevas, 2 módulos de dominio nuevos, 1 módulo web nuevo y 1 ruta web nueva (`/rutas`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Desarrollo guiado por especificaciones | **Cumple.** El spec está clarificado (sesiones del 2026-11-20 y 2026-11-21); este plan precede a las tareas y al código |
| II. El contexto es la fuente de verdad | **Cumple.** Las decisiones nuevas están en `context/` (M-14 a M-17). Los textos fijos de Alforjita (explicación del Pasaporte y las rutas, mensajes) no contienen horarios, precios ni sedes (FR-019) |
| III. Máximo ocho specs | **Cumple.** Solo spec 008 |
| IV. Arquitectura compartida, sin monolito modular | **Cumple.** Se amplía el servicio que la arquitectura asigna a los specs 002, 003 y 008. No consulta participación (entradas, sellos) ni identidad |
| V. Cada spec es verificable | **Cumple.** Cada SC tiene su prueba (mapa en `research.md`) |
| Flujo: una rama por spec | **Cumple.** Todo en `008-alforjita` |
| Sin coautoría de IA; secretos fuera de Git | **Cumple.** No hay secretos nuevos |

**Cambios en otros specs:** ninguno de contrato. Dentro del servicio de programación, `createAgenda` expone la lectura de actividades publicadas que ya usa, para que Alforjita lea exactamente lo mismo (FR-006). La web añade `/rutas` («Próximamente»), que el spec 007 reemplazará; no se toca la Agenda salvo para añadir el botón.

**Re-evaluación tras el diseño (Fase 1):** sin cambios. No se añadió servicio, tabla, librería externa ni acceso a datos de otro servicio.

## Project Structure

### Documentation (this feature)

```text
specs/008-alforjita/
├── plan.md              # este archivo
├── research.md          # decisiones técnicas, reglas del intérprete y mapa de pruebas
├── data-model.md        # consulta, criterios y respuesta (sin persistencia)
├── quickstart.md        # cómo probarlo
├── contracts/
│   └── alforjita.openapi.yaml   # POST /assistant/answers
├── checklists/
│   └── requirements.md
└── tasks.md             # (/speckit-tasks)
```

### Source Code (repository root)

```text
app/
├── services/programacion/
│   ├── src/
│   │   ├── domain/
│   │   │   ├── alforjita-interprete.js  # NUEVO: reglas puras texto → criterios o intención (días, horas, acceso, alcance)
│   │   │   ├── alforjita.js             # NUEVO: respuestas sobre el catálogo vigente (coincidencias, cuatro casos, info)
│   │   │   └── agenda.js                # expone la lectura de actividades publicadas que ya usa la Agenda
│   │   ├── services.js                  # crea alforjita con agenda, catálogos, sedes y reloj
│   │   └── http/routes.js               # POST /assistant/answers (sin sesión; el cuerpo no se registra)
│   └── test/
│       ├── unit/alforjita-interprete.test.js  # frases → criterios (horas, días, tildes, alcance, límites)
│       ├── unit/alforjita.test.js             # respuestas sobre actividades en memoria (RC-03, gratuidad, por confirmar)
│       └── integration/alforjita.test.js      # API: preguntas rápidas, ejemplo de danza, cuatro casos, borradores, registro
├── edge/test/e2e-alforjita.test.js     # pregunta a través de la entrada común y compara con la Agenda
└── web/
    ├── js/alforjita.js                  # NUEVO: panel de conversación; se importa al abrirlo
    ├── js/publico.js                    # botón «Pregúntale a Alforjita» en la cabecera de la Agenda
    ├── js/dom.js                        # icono neutro «alforja» en la tabla de trazos
    ├── app.js                           # ruta /rutas («Próximamente») y enlace del menú sin cambios
    └── styles.css                       # estilos del panel con los tokens existentes
```

**Structure Decision**: se amplía el servicio de programación, como hizo el 003. El intérprete va en un módulo aparte y puro (sin base ni reloj) para probar cada regla con frases sueltas; las respuestas reciben el reloj y las actividades ya leídas.

## Complexity Tracking

| Elección | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| POST para una consulta de solo lectura | El registro de Fastify guarda la URL; con GET el texto escrito, que puede tener datos personales, quedaría registrado (M-17) | GET con `?q=` y ocultar la URL en el registro (también ocultaría las demás rutas y es fácil de romper) |
| Interpretar en el servidor y no en el navegador | El servidor ya tiene el reloj fijable (RC-07), el catálogo y la accesibilidad; la Agenda y Alforjita comparten una sola lógica y se prueba sin navegador | Interpretar en la web (duplicaría el reloj y las reglas de estado temporal) |
