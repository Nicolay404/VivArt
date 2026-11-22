# Tasks: Rutas culturales e insignias

**Input**: Design documents from `specs/007-rutas-e-insignias/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md  
**Tests**: Sí. Cada criterio de éxito (SC-001 a SC-013) tiene pruebas asociadas, incluida la concurrencia para el desbloqueo de insignias (RC-05, RNF-06).  
**Organization**: por historia de usuario. Rutas relativas a la raíz del repositorio; `P/` = `app/services/participacion/` y `W/` = `app/web/`.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [x] T001 [P] Acción de política `panel.routes` en `app/services/identidad/src/domain/policy.js` (asignada al rol `administrador`) con pruebas unitarias en `app/services/identidad/test/unit/policy.test.js`
- [x] T002 [P] Cliente interno en `P/src/clients/programacion.js` para consultar funciones elegibles (`GET /internal/functions?ids=`) y verificar que tengan `passport_enabled = true` y conocer su estado vigente (`active` o `cancelled`)

---

## Phase 2: Foundational

- [x] T003 Esquema idempotente en `P/src/db.js`: tablas `routes` (`title`, `description`, `badge_title`, `badge_description`, `badge_icon`, `badge_color`, `goal > 0`, `status IN ('draft', 'published')`), `route_functions` (`PRIMARY KEY (route_id, function_id)`, `FK route_id REFERENCES routes(id) ON DELETE CASCADE`) y `user_badges` (`UNIQUE (user_id, route_id)`, `FK route_id REFERENCES routes(id) ON DELETE RESTRICT`)
- [x] T004 [P] Repositorio `P/src/repositories/routes.js`: operaciones CRUD para rutas, asociación de funciones elegibles, consulta de sellos coincidentes, inserción atómica de insignias con `ON CONFLICT (user_id, route_id) DO NOTHING` e historial
- [x] T005 [P] Funciones puras de dominio en `P/src/domain/routes.js`: validación de campos de ruta, iconos temáticos permitidos (`teatro`, `musica`, `danza`, `artes-vivas`, `patrimonio`, `estrella`, `brujula`), colores oficiales (`violeta`, `atardecer`, `terracota`, `esmeralda`), validación de meta alcanzable ($\text{meta} \le \text{total\_elegibles}$) y cálculo de estado dinámico «Ruta en revisión»
- [x] T006 Registrar repositorios y servicios de rutas en `P/src/services.js` y configurar fixtures en `P/test/helpers.js` para rutas e insignias

**Checkpoint**: El servicio arranca con las 3 tablas nuevas de forma idempotente sin borrar datos previos y la suite de pruebas base pasa limpia.

---

## Phase 3: User Story 4 - El administrador crea y publica rutas (P2)

**Goal**: El administrador crea una ruta, selecciona funciones elegibles con Pasaporte habilitado, fija una meta alcanzable ($\le$ elegibles), asigna la plantilla de insignia y la publica o guarda como borrador.

**Independent Test**: Crear una ruta con funciones elegibles y meta 3, intentar guardar con meta 4 (debe ser rechazada con 422), publicar con meta 3 y verificar que queda registrada en el historial (SC-007, SC-008, SC-010).

> Se implementa primero porque sin rutas creadas no hay catálogo para consulta ni sellos que computar.

- [x] T007 [P] [US4] Pruebas del panel de rutas en `P/test/integration/routes-admin.test.js`: crear ruta borrador, publicar ruta, validar que `goal > functionIds.length` responde 422, validar que funciones sin pasaporte habilitado o franjas responden 422, verificar control de permisos (401 sin sesión, 403 usuario sin rol administrador) y verificar inserciones en `history` (SC-006, SC-007, SC-008, SC-010)
- [x] T008 [US4] Métodos de administración en `P/src/domain/routes.js`: `crearRuta`, `editarRuta`, `listarRutasAdmin`, `verRutaAdmin`, con validaciones y registro en `history` (`route.created`, `route.updated`)
- [x] T009 [US4] Endpoints administrativos en `P/src/http/routes.js`: `GET /panel/routes`, `POST /panel/routes`, `GET /panel/routes/:id`, `PUT /panel/routes/:id`
- [x] T010 [US4] Pantalla del panel `W/js/panel-rutas.js` y ruta `/panel/rutas` en `W/app.js` (con enlace en `W/js/panel-bandeja.js`): listado de rutas con estado borrador/publicada y alerta si está en revisión; formulario para crear/editar con selector de funciones elegibles, meta, nombre de insignia, icono SVG y color

---

## Phase 4: User Story 1 - Consultar las rutas (P1) 🎯 MVP

**Goal**: Un visitante, con o sin cuenta, abre Pasaporte, ve las rutas publicadas y sus funciones, sabe cuántos sellos pide cada ruta y ve alertas de «Ruta en revisión» si aplica.

**Independent Test**: Sin sesión iniciada, abrir `/pasaporte` y `/pasaporte/ruta/:id`, verificar que se muestran las rutas publicadas y sus funciones elegibles, mientras que las rutas en borrador no aparecen (SC-001).

- [x] T011 [P] [US1] Pruebas de consulta pública en `P/test/integration/routes-public.test.js`: visitante sin sesión consulta rutas publicadas (`GET /passport/routes`); rutas no publicadas no se listan ni se consultan (404); detalle de ruta (`GET /passport/routes/:id`) con funciones elegibles; función cancelada se marca; ruta con $\text{activas} < \text{goal}$ devuelve `inReview: true` (SC-001, SC-011)
- [x] T012 [US1] Lógica pública en `P/src/domain/routes.js` y registro de endpoints `GET /passport/routes` y `GET /passport/routes/:id` en `P/src/http/routes.js`
- [x] T013 [US1] Pestaña `/pasaporte` en `W/js/pasaporte.js` (reemplaza `seccionRutas` provisional) y vista `/pasaporte/ruta/:id` en `W/app.js`: listado de rutas públicas con tarjeta descriptiva, detalle de funciones con fecha y sede, aviso de cancelación y badge «Ruta en revisión»
- [x] T014 [P] [US1] Estilos en `W/styles.css` para las tarjetas de rutas culturales, distintivo «Ruta en revisión» y detalles de funciones

---

## Phase 5: User Story 2 - Ver mi progreso en una ruta (P1)

**Goal**: Un usuario registrado ve cuántos sellos distintos de funciones elegibles ha reunido en una ruta con su denominador propio («2 de 3») y qué funciones le faltan.

**Independent Test**: Con dos sellos de una ruta de meta 3, consultar la ruta y comprobar que se muestra «2 de 3», que sellos repetidos no suman dos veces y que sellos de funciones no elegibles no se cuentan (SC-002, SC-003).

- [x] T015 [P] [US2] Pruebas de progreso en `P/test/integration/routes-progress.test.js`: cálculo exacto de sellos distintos (`COUNT(DISTINCT function_id)`); sellos de funciones ajenas no suman; dos sellos de la misma función cuentan 1 vez; sellos de función cancelada se conservan y siguen sumando; aislamiento de progreso entre usuarios (SC-002, SC-009, SC-012)
- [x] T016 [US2] Lógica de cómputo de progreso en `P/src/domain/routes.js`: cruce de `stamps` del usuario con `route_functions`, formateo de denominador «X de Y» sin proyectarlo a la meta global del pasaporte (M-01, FR-015)
- [x] T017 [US2] Enriquecer endpoints `GET /passport/routes` y `GET /passport/routes/:id` en `P/src/http/routes.js` con el bloque `progress` cuando el request cuenta con sesión de usuario
- [x] T018 [US2] Actualizar interfaz en `W/js/pasaporte.js`: renderizar la barra de progreso y denominador «X de Y» en las tarjetas de rutas y marcar con icono de check las funciones que el usuario ya canjeó en el detalle de la ruta

---

## Phase 6: User Story 3 - Desbloquear la insignia (P1)

**Goal**: Al alcanzar la meta de una ruta, el usuario obtiene su insignia una sola vez (a prueba de peticiones simultáneas), recibe aviso de logro y la visualiza en el apartado Insignias de `/pasaporte`.

**Independent Test**: Reunir los sellos requeridos de una ruta y verificar que se otorga la insignia exactamente 1 vez, aun con dos peticiones de canje simultáneas (SC-004, RC-05, RNF-06).

- [x] T019 [P] [US3] Pruebas de desbloqueo e idempotencia en `P/test/integration/badges.test.js`: usuario alcanza meta y se crea `user_badges`; prueba de concurrencia contra PostgreSQL con 10 llamadas concurrentes que completan la meta (debe otorgar exactamente 1 fila en `user_badges`); editar la ruta posteriormente retira 0 insignias (SC-004, SC-005)
- [x] T020 [US3] Dominio de insignias en `P/src/domain/badges.js` e integración en `P/src/domain/pasaporte.js`: evaluar rutas elegibles en la transacción de canje (`POST /passport/claims`), insertar en `user_badges` si se alcanzó la meta, registrar en `history` (`badge.unlocked`) y retornar `badgeUnlocked` en la respuesta JSON del canje
- [x] T021 [US3] Endpoint `GET /passport/badges` en `P/src/http/routes.js` para consultar las insignias obtenidas por el usuario en sesión (SC-009)
- [x] T022 [US3] Apartado **«Mis insignias»** en `W/js/pasaporte.js`: galería de insignias con icono temático oficial SVG, nombre, fecha de desbloqueo, y notificación modal o aviso inmediato al momento del canje cuando se desbloquea una insignia

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T023 [P] Prueba de integración de extremo a extremo en `app/edge/test/e2e-rutas.test.js` con los servicios reales: administrador publica ruta con meta 2, usuario canjea 2 sellos, recibe la insignia en el segundo canje, y consulta su progreso e insignias
- [x] T024 [P] Verificación responsiva a 360 px (móvil) y 1440 px (escritorio), contraste y accesibilidad por teclado en `W/js/pasaporte.js` y `W/js/panel-rutas.js`
- [x] T025 [P] Actualizar documentación de arquitectura en `docs/arquitectura/02-servicios.md` y `docs/arquitectura/04-comportamiento.md` reflejando la implementación de rutas e insignias
- [x] T026 Ejecutar la verificación final de reglas del equipo con `bash .github/scripts/verificar-reglas.sh` y la suite global de pruebas `npm test` en todos los servicios y en `app/edge`
