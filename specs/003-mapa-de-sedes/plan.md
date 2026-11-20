# Implementation Plan: Mapa isométrico de sedes

**Branch**: `003-mapa-de-sedes` | **Date**: 2026-11-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-mapa-de-sedes/spec.md`

## Summary

El mapa **no crea un servicio nuevo**. La arquitectura asigna las sedes y los datos del mapa al **servicio de programación y consulta pública** (`app/services/programacion`), que ya es dueño de las sedes (`venues`), las funciones publicadas y el historial. Este spec amplía ese servicio:

- **Datos de la sede:** marcador sobre la ilustración, destino verificado (latitud y longitud con fuente y fecha), las dos características de accesibilidad con estado, fuente y fecha, y una foto opcional con texto alternativo y autoría.
- **API pública sin sesión** (`/map`):
  - la ilustración vigente y los días elegibles;
  - las sedes con búsqueda y filtros que se combinan con «y» («Funciones del día», «acceso sin escalones», «baño accesible»);
  - la ficha de una sede con sus funciones desde hoy, o solo las del día;
  - la foto.
- **API del panel** (solo administrador, acción `catalog.manage`, que ya existe): corregir datos y marcador, registrar el destino y la accesibilidad, subir o quitar la foto y ver el historial de la sede. Todo sin revisión editorial y con historial.
- **Interfaz web:** la pestaña Mapa (vista isométrica con desplazamiento y zoom, marcadores neutros, tarjeta de sede, lista equivalente y búsqueda) y la ficha de sede en el panel de catálogos, con el sistema visual de `app/web`.

El mapa usa el catálogo y las funciones publicadas **del mismo servicio**: no se duplica nada. La ilustración definitiva está pendiente (P-13); mientras tanto se usa una **ilustración provisional** propia, marcada como tal.

## Technical Context

**Language/Version**: JavaScript (módulos ES) sobre Node.js 24

**Primary Dependencies**: las del servicio de programación (Fastify 5 y `pg`). No se añade ninguna dependencia. En la web, módulos ES propios, sin frameworks ni librerías de mapas: la CSP (`default-src 'self'`) no permite cargar nada externo

**Storage**: PostgreSQL 17, base `programacion` del propio servicio. Columnas nuevas en `venues` y dos tablas nuevas (`venue_accessibility`, `venue_photos`), creadas de forma idempotente al arrancar, sin borrar datos

**Testing**: `node:test` con `inject` de Fastify e identidad simulada (como en el 002), y una prueba de punta a punta en `app/edge`. La web se comprueba en Chrome sin ventana a 360 px y a 1440 px

**Target Platform**: servidor Node.js 24 en contenedor Linux. Público en celular primero y panel en escritorio primero

**Project Type**: ampliación de un servicio web HTTP existente, más pantallas en la web común

**Performance Goals**: no se fijan metas (el contexto no las pide). El mapa se carga **solo al abrir la pestaña** (importación dinámica), para que la Agenda y las fichas no lo esperen (FR-004)

**Constraints**:
- No inventar sedes, coordenadas ni accesibilidad (RNF-08): los datos de ejemplo no llevan destino y su accesibilidad queda «por confirmar».
- No pedir ubicación (RNF-05): la entrada común ya envía `geolocation=()`.
- Autorización en el servidor (RNF-04).
- Historial de solo anexar (RNF-09).
- Reloj común en hora de Loja (RC-07).
- Cuerpos de solicitud solo en JSON (defensa CSRF actual) y como máximo de 2 MB.

**Scale/Scope**: MVP académico, con decenas de sedes. 4 endpoints públicos nuevos, 7 del panel nuevos (y uno ampliado), 2 tablas nuevas y 4 columnas nuevas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Desarrollo guiado por especificaciones | **Cumple.** El spec está clarificado (dos sesiones del 2026-11-20); este plan precede a las tareas y al código |
| II. El contexto es la fuente de verdad | **Cumple.** Las decisiones nuevas se registraron en `context/` (M-06 a M-09 y P-13). No se inventan coordenadas ni accesibilidad: los datos de ejemplo dejan el destino vacío y la accesibilidad «por confirmar». La ilustración provisional se marca como tal y no representa la geografía de Loja |
| III. Máximo ocho specs | **Cumple.** Solo spec 003 |
| IV. Arquitectura compartida, sin monolito modular | **Cumple.** Se amplía el servicio que la arquitectura asigna a los specs 002, 003 y 008. No hay servicio nuevo ni acceso a datos ajenos; los permisos se consultan por HTTP a identidad |
| V. Cada spec es verificable | **Cumple.** Cada SC tiene su prueba (mapa en `research.md`) |
| Flujo: una rama por spec | **Cumple.** Todo en `003-mapa-de-sedes` |
| Sin coautoría de IA; secretos fuera de Git | **Cumple.** No hay secretos nuevos |

**Cambios en otros specs:** ninguno de contrato. Se reutiliza la acción `catalog.manage` de identidad (administrador). `PUT /panel/venues/{id}` del spec 002 sigue funcionando: los campos nuevos son opcionales y el marcador pasa a validarse con un formato fijo (ver `data-model.md`). Las sedes que aparecen en la Agenda conservan el mismo objeto `Venue`.

**Re-evaluación tras el diseño (Fase 1):** sin cambios. No se añadió servicio, broker, gateway, librería externa ni acceso a datos de otro servicio.

## Project Structure

### Documentation (this feature)

```text
specs/003-mapa-de-sedes/
├── plan.md              # este archivo
├── research.md          # decisiones técnicas y mapa de pruebas
├── data-model.md        # columnas y tablas nuevas, reglas y validaciones
├── quickstart.md        # cómo probarlo
├── contracts/
│   └── mapa.openapi.yaml   # API pública del mapa y API del panel de sedes
├── checklists/
│   └── requirements.md
└── tasks.md             # (/speckit-tasks)
```

### Source Code (repository root)

```text
app/
├── services/programacion/
│   ├── src/
│   │   ├── db.js                      # columnas nuevas en venues; tablas venue_accessibility y venue_photos
│   │   ├── domain/
│   │   │   ├── mapa.js                # NUEVO: ilustración vigente, días, filtros, ficha de sede, enlace de Google Maps
│   │   │   ├── sedes.js               # NUEVO: validación y cambios del administrador (marcador, destino, accesibilidad, foto)
│   │   │   └── catalogs.js            # el marcador usa el validador común; el historial registra los campos cambiados
│   │   ├── repositories/
│   │   │   └── sedes.js               # NUEVO: accesibilidad, fotos y consultas del mapa
│   │   └── http/routes.js             # rutas /map y /panel/venues/{id}/...
│   ├── bin/cargar-ejemplo.js          # marcadores de ejemplo sobre la ilustración provisional; sin destino ni accesibilidad
│   └── test/
│       ├── unit/mapa.test.js          # coordenadas, marcador, enlace de Google Maps, foto (tipos y tamaño)
│       └── integration/
│           ├── mapa.test.js           # API pública: búsqueda, filtros, días, ficha, foto, sin sesión
│           └── sedes-admin.test.js    # API del panel: permisos, validaciones e historial
├── edge/test/e2e-mapa.test.js         # recorrido de punta a punta a través de la entrada común
└── web/
    ├── img/mapa-provisional.svg       # NUEVO: ilustración provisional propia (sin geografía de Loja)
    ├── js/mapa.js                     # NUEVO: pestaña Mapa (vista, tarjeta, lista, búsqueda y filtros); se importa al abrirla
    ├── js/panel-catalogos.js          # ficha de sede del administrador: marcador, destino, accesibilidad, foto, historial
    ├── app.js                         # la ruta /mapa importa js/mapa.js de forma dinámica
    └── styles.css                     # estilos del mapa con los tokens existentes
```

**Structure Decision**: se amplía el servicio de programación, igual que el spec 005 amplió programación con su API interna. La interfaz se desarrolla dentro de este plan, como en el 005, porque el sistema visual ya está definido en `app/web`.

## Complexity Tracking

| Elección | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| Marcador con identificador de ilustración | Cuando llegue la ilustración definitiva (P-13), los marcadores colocados sobre la provisional quedan sin efecto en lugar de aparecer en un sitio equivocado | Guardar solo `x` e `y` (los marcadores quedarían mal colocados en silencio) |
| Tabla aparte para la accesibilidad | Cada característica tiene estado, fuente, fecha y observación propios, y se añadirán más características después del MVP | Ocho columnas en `venues` (difícil de ampliar y de validar) |
| Foto en la base (`bytea`) y servida por la API | El servicio es dueño de sus datos, el contenedor no tiene volumen de archivos y la CSP solo admite imágenes del mismo sitio | Volumen de archivos (otra pieza que respaldar y desplegar) o un servicio de imágenes externo (bloqueado por la CSP) |
| Pan y zoom propios en la web | La CSP impide cargar librerías externas y la vista es una sola imagen con botones encima | Copiar una librería de mapas al repositorio (pensada para mosaicos geográficos, no para una ilustración) |
