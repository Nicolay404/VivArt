# Tasks: Mapa isométrico de sedes

**Input**: Design documents from `specs/003-mapa-de-sedes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Sí. Cada criterio de éxito tiene su prueba; el mapa está en `research.md`.

**Organization**: por historia de usuario. Rutas relativas a la raíz del repositorio; `G/` = `app/services/programacion/` y `W/` = `app/web/`.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [x] T001 [P] Crear la ilustración provisional propia `W/img/mapa-provisional.svg` (manzanas isométricas genéricas con la paleta de `W/styles.css`, proporción 1600 × 1000, leyenda «Ilustración provisional»; sin calles reales de Loja ni texto del mockup)
- [x] T002 [P] Añadir `.jpg` y `.webp` a los tipos de `app/edge/server.js` solo si la web los necesita como archivos estáticos (la foto de sede llega por la API; si no hace falta, no se toca). **No hizo falta: no se tocó.**

## Phase 2: Foundational

**⚠️ Punto de control obligatorio antes de T004:** confirmar con María Paula y Rafa las dos decisiones que cambian el modelo de datos: (1) la foto de sede (campo opcional con texto alternativo y fuente o autoría) y (2) el destino de «Cómo llegar» (latitud y longitud con fuente y fecha, y enlace de Google Maps). No se modifica `G/src/db.js` hasta tener la confirmación.

- [x] T003 Confirmar con el equipo las decisiones de modelo de la foto de sede (M-09) y del destino de «Cómo llegar» (M-08), y anotar la confirmación en `specs/003-mapa-de-sedes/spec.md` (Clarifications)
- [x] T004 Ampliar el esquema en `G/src/db.js` de forma idempotente: en `venues`, `dest_lat` y `dest_lng` numéricos («latitud entre −90 y 90», «longitud entre −180 y 180»), `dest_source` («hasta 500 caracteres») y `dest_verified_on` (AAAA-MM-DD), con un `CHECK` que exige «los cuatro campos `dest_*` todos o ninguno»; tabla `venue_accessibility` (clave `(venue_id, feature)`, `feature` ∈ `step_free|accessible_toilet`, `status` ∈ `confirmed|unavailable|unconfirmed`, `source` «hasta 500 caracteres», `note` «hasta 1000 caracteres», `CHECK` que exige fuente y fecha con `confirmed` o `unavailable`); tabla `venue_photos` (clave `venue_id`, `mime` ∈ `image/jpeg|image/png|image/webp`, `bytes` bytea «hasta 1 MB», `alt` y `credit` «de 3 a 300 caracteres», `sha256`); borrado en cascada desde `venues`
- [x] T005 [P] Crear `G/src/domain/mapa.js` con la ilustración vigente (`id`, `src`, `width`, `height`, `provisional: true`), el validador de marcador (`{ illustrationId, x, y }`, «`x` e `y` entre 0 y 1»; otro `illustrationId` = sin marcador) y `enlaceComoLlegar(lat, lng)` (`https://www.google.com/maps/search/?api=1&query={lat},{lng}` con seis decimales; `null` sin destino verificado o en recorridos)
- [x] T006 [P] Crear `G/src/repositories/sedes.js`: funciones visibles (actividad publicada, no archivada, de edición activa o sin edición; franjas excluidas), días elegibles, accesibilidad por sede, foto (metadatos y bytes) y lectura de historial por sede
- [x] T007 Registrar el repositorio en `G/src/services.js` y añadir a `G/test/helpers.js` utilidades para crear sedes con marcador, destino, accesibilidad, foto y funciones en días concretos con reloj fijo
- [x] T008 [P] Pruebas unitarias en `G/test/unit/mapa.test.js`: marcador válido, fuera de rango y de otra ilustración; coordenadas en los límites y fuera de rango; enlace de Google Maps (SC-006, SC-011, SC-012)

**Checkpoint**: el servicio arranca con el esquema ampliado sin perder datos y `npm test` sigue en verde.

## Phase 3: User Story 1 - Explorar las sedes en el mapa (P1) 🎯 MVP

**Goal**: ver la ilustración con marcadores neutros, desplazar, hacer zoom y seleccionar una sede, sin cuenta ni ubicación.

**Independent Test**: abrir `/mapa` a 360 px sin sesión, desplazar, hacer zoom con botones y seleccionar un marcador.

- [x] T009 [P] [US1] Pruebas de `GET /map` y `GET /map/venues` sin cookie en `G/test/integration/mapa.test.js`: ilustración vigente con `provisional`, todas las sedes con `marker` válido o `null` (SC-001, SC-012)
- [x] T010 [US1] Dominio público del mapa (`datos()` y `sedes()` sin filtros) en `G/src/domain/mapa.js`, con el objeto `VenueSummary` del contrato
- [x] T011 [US1] Rutas públicas `GET /map` y `GET /map/venues` en `G/src/http/routes.js`
- [x] T012 [US1] Crear `W/js/mapa.js`: cabecera «Mapa del Festival», vista con la ilustración y marcadores como `<button>` con `aria-label`, desplazamiento (pointer events), zoom (rueda, pellizco, botones «+» y «−», teclas) de 1× a 4× con marcadores de tamaño fijo, leyenda «Ilustración provisional» si `provisional`; sin botón «ubicarme» ni `navigator.geolocation`
- [x] T013 [US1] En `W/app.js`, la ruta `/mapa` importa `js/mapa.js` con `import()`; si falla, muestra un error con enlace a la Agenda (FR-004, SC-010)
- [x] T014 [P] [US1] Estilos del mapa en `W/styles.css` con los tokens existentes (sin colores nuevos), sin desbordamiento horizontal a 360 px

**Checkpoint**: el mapa se explora y se selecciona una sede.

## Phase 4: User Story 2 - Ver la sede y sus funciones (P1)

**Goal**: tarjeta con nombre, dirección o referencia, foto opcional, accesibilidad, funciones desde hoy y «Cómo llegar» solo con destino verificado.

**Independent Test**: seleccionar una sede con funciones (una cancelada), abrir una ficha y probar «Cómo llegar» con y sin destino.

- [x] T015 [P] [US2] Pruebas de `GET /map/venues/{id}` y de la foto en `G/test/integration/mapa.test.js`: funciones desde hoy y no las de ayer; solo las del día con `day`; cancelada con `status: cancelled`; `timeStatus` como en el 002; `directionsUrl` con destino y `null` sin él o en recorridos; accesibilidad `unconfirmed` sin fila; `photo` con `alt` y `credit` o `null`; 404 de sede inexistente (SC-004, SC-006, SC-007, SC-013)
- [x] T016 [US2] Ficha de sede y foto pública en `G/src/domain/mapa.js` (reutiliza `estadoTemporal` de `G/src/domain/now.js`)
- [x] T017 [US2] Rutas `GET /map/venues/:id` y `GET /map/venues/:id/photo` (tipo guardado, `?v=` con la huella) en `G/src/http/routes.js`
- [x] T018 [US2] Tarjeta de sede en `W/js/mapa.js`: foto con `alt` y autoría (sin hueco si no hay), «Dirección por confirmar» o descripción del recorrido, accesibilidad con icono y texto («Confirmada», «No disponible», «Por confirmar»), funciones con enlace a `/actividad/{id}` y etiqueta «Cancelada», «No hay funciones próximas», y «Cómo llegar» con `target="_blank" rel="noopener"` solo si hay `directionsUrl`
- [x] T019 [US2] Estado `?sede={id}` en la URL de `/mapa`, compatible con «atrás»

**Checkpoint**: la sede conecta con la programación y con Google Maps.

## Phase 5: User Story 3 - Buscar sedes (P1)

**Goal**: «Buscar sede» encuentra sedes registradas, sin mayúsculas ni tildes, y nunca funciones.

**Independent Test**: buscar por nombre parcial sin tildes; buscar el título de una función.

- [x] T020 [P] [US3] Pruebas de `q` en `G/test/integration/mapa.test.js`: parcial, sin tildes y en mayúsculas; sede sin funciones aparece; título de función no devuelve sedes por esa razón; sin coincidencias (SC-005, SC-014)
- [x] T021 [US3] Filtro `q` sobre `name_key` con `normalizar` en `G/src/domain/mapa.js` (escapar `%` y `_`, «hasta 100 caracteres»)
- [x] T022 [US3] Campo «Buscar sede» con mensaje de sin resultados y estado `?q=` en `W/js/mapa.js`

## Phase 6: User Story 5 - Consultar las sedes en una lista (P1)

**Goal**: lista equivalente con todas las sedes registradas, usable con teclado y sin depender del color.

**Independent Test**: consultar una sede sin marcador y un recorrido solo con teclado, sin abrir el mapa gráfico.

- [x] T023 [P] [US5] Prueba de lista completa en `G/test/integration/mapa.test.js`: sedes con y sin funciones, con y sin marcador, con marcador de otra ilustración y recorrido (SC-002, SC-012)
- [x] T024 [US5] Alternar «Mapa» y «Lista» (`?vista=lista`) en `W/js/mapa.js`: `<ul>` de botones con nombre, dirección o referencia y accesibilidad en texto; abre la misma tarjeta; foco visible y orden de tabulación correcto (SC-008)

**Checkpoint**: las historias P1 están completas: es el MVP del mapa.

## Phase 7: User Story 4 - Filtrar por «Funciones del día» y por accesibilidad (P2)

**Goal**: filtros combinados con «y»; «Funciones del día» por defecto hoy en Loja, con días elegibles; accesibilidad solo confirmada.

**Independent Test**: con reloj fijado, activar el filtro, cambiar de día y combinarlo con accesibilidad.

- [x] T025 [P] [US4] Pruebas de filtros en `G/test/integration/mapa.test.js`: función que aún no empieza cuenta; solo franjas no cuenta; cancelada no cuenta; otro día cambia el resultado; día sin funciones da lista vacía y `dayHasFunctions: false`; días elegibles solo con funciones programadas de la edición activa; `stepFree` y `accessibleToilet` solo con `confirmed` (`unavailable`, `unconfirmed`, sin fila y nota que dice «accesible» no entran); combinación de filtros con «y» (SC-003, SC-004, SC-007)
- [x] T026 [US4] Parámetros `day` (fecha válida o 422), `stepFree` y `accessibleToilet`, `dayFunctionCount` y `days` en `G/src/domain/mapa.js`
- [x] T027 [US4] Controles en `W/js/mapa.js`: «Funciones del día» (activa con `reference.date`), selector con los días elegibles, «Acceso sin escalones» y «Baño accesible»; aviso «Hoy no hay funciones» con los días disponibles; estado en la URL (`?dia=`, `?sinEscalones=1`, `?banio=1`); los marcadores filtrados se ocultan también en la vista gráfica

## Phase 8: User Story 6 - El administrador mantiene los datos de las sedes (P2)

**Goal**: el administrador corrige datos y marcador, registra destino, accesibilidad y foto, sin aviso público y con historial.

**Independent Test**: corregir una dirección y un marcador, registrar accesibilidad y destino, subir y quitar una foto, y ver el historial; un no administrador es rechazado.

- [x] T028 [P] [US6] Pruebas del panel en `G/test/integration/sedes-admin.test.js`: editor, publicador y sin sesión reciben 401 o 403 en cada ruta y nada cambia; identidad caída da 503; destino sin fuente o fecha, fuera de rango, con fecha futura o en recorrido da 422; pasar a recorrido con destino da 409; accesibilidad `confirmed` sin fuente da 422 y `feature` desconocida 404; foto GIF, SVG, bytes que no coinciden, mayor de 1 MB o sin `alt` o `credit` da 422; cada cambio deja una fila en `history` con campos antes y después y sin bytes; ningún cambio crea aviso público (FR-021, FR-025, SC-009, SC-011, SC-013)
- [x] T029 [US6] Crear `G/src/domain/sedes.js`: ver sede para el panel, destino (guardar y quitar), accesibilidad por característica, foto (comprobar bytes iniciales de JPEG, PNG o WebP, «hasta 1 MB», `sha256`) e historial; todas las operaciones exigen `catalog.manage`
- [x] T030 [US6] En `G/src/domain/catalogs.js`, validar el marcador con el validador de `mapa.js`, impedir pasar a recorrido con destino (409 `has_destination`) y registrar en el historial los campos cambiados antes y después
- [x] T031 [US6] Rutas `GET /panel/venues/:id`, `PUT` y `DELETE /panel/venues/:id/destination`, `PUT /panel/venues/:id/accessibility/:feature`, `PUT` y `DELETE /panel/venues/:id/photo` y `GET /panel/venues/:id/history` en `G/src/http/routes.js`
- [x] T032 [US6] Ficha de sede en `W/js/panel-catalogos.js`: colocar el marcador haciendo clic sobre la ilustración (con campos numéricos para teclado), destino con latitud, longitud, fuente y fecha, las dos características con estado, fuente, fecha y nota, foto (reducida en el navegador a «máximo 1600 px de lado» antes de enviarla, con texto alternativo y autoría obligatorios, y botón para quitarla) e historial de la sede

## Phase 9: Polish & Cross-Cutting Concerns

- [x] T033 [P] En `G/bin/cargar-ejemplo.js`, colocar marcadores de ejemplo sobre la ilustración provisional para las sedes ficticias, sin destino, sin accesibilidad (quedan «por confirmar») y sin foto; la segunda ejecución no duplica nada
- [x] T034 [P] Prueba de punta a punta en `app/edge/test/e2e-mapa.test.js`: `/api/programacion/map/venues` sin sesión a través de la entrada; con programación caída, la web sigue sirviendo `/agenda` (SC-010)
- [x] T035 [P] Actualizar `docs/arquitectura/02-servicios.md` (estado de implementación del spec 003) y `README.md` (mapa en la demo)
- [x] T036 Comprobar en Chrome sin ventana a 360 px y 1440 px: mapa, tarjeta, lista con teclado, filtros, foto y panel de sede; sin desbordamiento horizontal ni peticiones de ubicación
- [x] T037 Ejecutar `npm test` en `app/` y la demo con contenedores; registrar los resultados en `specs/003-mapa-de-sedes/quickstart.md`
- [ ] T038 Quitar el borrador del PR, revisar la CI y SonarCloud y corregir lo que falle; no fusionar

## Dependencies & Execution Order

- **Setup (T001 a T002)**: sin dependencias.
- **Foundational (T003 a T008)**: T003 (confirmación del equipo) **bloquea** T004; T004 bloquea todas las historias.
- **US1 (T009 a T014)** → base de las demás pantallas públicas.
- **US2, US3 y US5** dependen de US1 (comparten `mapa.js` y la ruta `/map/venues`), pero no entre sí.
- **US4** depende de US1 y de la ficha de US2 (`day` en la ficha).
- **US6** solo depende de la fase 2: puede hacerse en paralelo con las historias públicas.
- **Polish** al final.

## Parallel Example: User Story 6

```text
T028 pruebas del panel (sedes-admin.test.js)   ← en paralelo con las historias públicas
T029 dominio sedes.js
T030 catalogs.js  (después de T029)
T031 rutas        (después de T029 y T030)
T032 panel web    (después de T031)
```

## Implementation Strategy

1. **MVP**: fases 1 a 6 (explorar, ficha, búsqueda y lista). Es el mapa público usable y accesible.
2. **Incremento 2**: fase 7 (filtros).
3. **Incremento 3**: fase 8 (panel de sedes). Sin él, la demo solo tiene marcadores de ejemplo y todo «por confirmar».
4. **Cierre**: fase 9 y PR listo para revisión.
