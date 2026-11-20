# Tasks: Programación, agenda y publicación

**Input**: Design documents from `/specs/002-programacion-y-publicacion/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Incluidas. El spec exige criterios verificables (SC-001 a SC-015); el mapa está en `research.md`.

**Organization**: por historias de usuario. **Orden por dependencia:** la gestión de catálogos (Historia 7, P2) va primero dentro de las historias porque las fichas necesitan categorías y sedes; el flujo editorial (Historias 3 y 4) va antes que la Agenda (Historia 1) porque solo se ve lo publicado.

**Alcance:** todo el backend. La interfaz no se implementa aquí: T060 deja el encargo para el agente de diseño.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencia pendiente)
- **[Story]**: historia del spec (US1 a US8)
- Rutas relativas a la raíz del repositorio; el código vive bajo `app/`

---

## Phase 1: Setup

- [ ] T001 Crear `app/services/programacion/package.json` (`"type": "module"`, `engines.node >= 24`, dependencias `fastify` ^5 y `pg` ^8, scripts `start` y `test` con `--env-file-if-exists=../../.env`) e instalar dependencias (`package-lock.json`)
- [ ] T002 [P] Crear `app/services/programacion/.env.example` (solo nombres: `DATABASE_URL`, `IDENTIDAD_URL`, `IDENTIDAD_SERVICE_KEY`, `PARTICIPACION_URL`, `SERVICE_KEYS`, `ALLOWED_ORIGINS`, `CLOCK_FIXED`, `PORT`) y `.dockerignore`
- [ ] T003 [P] Añadir el servicio de programación al script de prueba raíz `app/package.json`

---

## Phase 2: Foundational (bloquea todas las historias)

- [ ] T004 Crear `app/services/programacion/src/config.js`: variables de entorno; `CLOCK_FIXED` solo si `NODE_ENV` no es `production`; sin secretos por defecto
- [ ] T005 Crear `app/services/programacion/src/clock.js`: hora de Loja (UTC−5), `today()`, `nowTime()`, conversión de fecha y hora local, reloj fijable (RC-07, FR-007)
- [ ] T006 Crear `app/services/programacion/src/db.js` con el esquema de `data-model.md` (`editions`, `categories`, `venues` con `kind` en `place` o `route`, `activities` con `status` en `active` o `archived` y `editorial_state` en `none`, `draft`, `in_review` o `returned`, `import_key` único, `functions` con `status` en `scheduled` o `cancelled`, `opening_slots`, `notices` con `kind` en `rescheduled`, `cancelled` o `changed`, `import_batches`, `import_records`, `history` de solo anexar con triggers), transacciones y esquema por aplicación para pruebas
- [ ] T007 [P] Crear `app/services/programacion/src/http/errors.js` (forma uniforme; 403 con `missingRole` y `acceptedRoles`; 422 con `fields`)
- [ ] T008 [P] Crear `app/services/programacion/src/http/security.js` (Origin permitido y JSON en métodos que cambian estado)
- [ ] T009 Crear `app/services/programacion/src/clients/identidad.js`: `authorize(sessionToken, action, context)` y `introspect` con `X-Service-Key`; si no responde, error 503 `identity_unavailable` (fallo cerrado)
- [ ] T010 [P] Crear `app/services/programacion/src/clients/participacion.js`: `impact(functionId)`; sin `PARTICIPACION_URL` o sin respuesta devuelve `{ available: false }` sin inventar cifras (FR-017)
- [ ] T011 Crear `app/services/programacion/src/http/session.js`: lee la cookie `vivart_sid` y exige el permiso con el cliente de identidad
- [ ] T012 [P] Crear `app/services/programacion/src/repositories/history.js` y `src/domain/text.js` (normalización sin tildes para búsqueda y unicidad)
- [ ] T013 Crear `app/services/programacion/src/app.js`, `src/services.js` y `src/server.js` (puerto 3002, `/health` que consulta la base, cierre de la base al cerrar)
- [ ] T014 Añadir a `app/services/identidad/src/domain/policy.js` las acciones `schedule.change` (publicador, administrador), `catalog.manage` (administrador) y `activity.archive` (administrador), con su prueba en `app/services/identidad/test/unit/policy.test.js`, y documentarlas en `specs/001-identidad-y-permisos/data-model.md`
- [ ] T015 [P] Crear `app/services/programacion/test/helpers.js`: base de pruebas con esquema propio que se borra al terminar y un servicio de identidad simulado con cuentas por rol
- [ ] T016 [P] Crear `app/services/programacion/test/unit/clock.test.js` (hora de Loja, reloj fijado, ignorado en producción)

**Checkpoint**: el servicio arranca, consulta permisos y tiene su base.

---

## Phase 3: User Story 7 - Gestionar categorías y sedes (Priority: P2, base de las fichas)

**Goal**: el administrador gestiona ediciones, categorías y sedes sin revisión editorial, con historial.

**Independent Test**: crear una categoría y corregir la dirección de una sede; el historial lo registra; otros roles reciben 403.

- [ ] T017 [P] [US7] Crear `app/services/programacion/test/integration/catalogs.test.js` (FR-025; solo administrador; nombres únicos sin distinguir tildes; corregir dirección no crea aviso; historial)
- [ ] T018 [US7] Crear `app/services/programacion/src/repositories/catalogs.js` y `src/domain/catalogs.js`
- [ ] T019 [US7] Crear `app/services/programacion/src/http/routes-catalogs.js` (públicas `GET /categories`, `/venues`, `/editions`; panel `POST`/`PUT` con `catalog.manage`)

---

## Phase 4: User Story 3 - El editor prepara y envía a revisión (Priority: P1)

**Goal**: borradores incompletos, funciones y franjas, vista previa y envío validado; el editor no publica.

**Independent Test**: crear, guardar incompleto, enviar sin campos (422 con cada campo), completar y enviar; no editar en revisión.

- [ ] T020 [P] [US3] Crear `app/services/programacion/test/unit/content.test.js` (normalización del contenido, identificadores estables, validación de envío: título, categoría y al menos una función con fecha, hora y sede o franja con fechas o rango, horario y sede; SC-012)
- [ ] T021 [P] [US3] Crear `app/services/programacion/test/integration/editor.test.js` (FR-008, FR-009, FR-030; SC-005 en lo que toca al editor; SC-012; SC-013; control de versión 409)
- [ ] T022 [US3] Crear `app/services/programacion/src/domain/content.js` (normalizar, validar para enviar con mensajes por campo, comparar funciones y franjas publicadas)
- [ ] T023 [US3] Crear `app/services/programacion/src/repositories/activities.js` (crear, leer, guardar con `version`, listar por dueño y estado)
- [ ] T024 [US3] Crear `app/services/programacion/src/domain/editorial.js` (crear, guardar borrador o versión pendiente, enviar, vista previa; permisos `draft.edit_own` con `ownerId`, `draft.edit_any`, `draft.submit`)
- [ ] T025 [US3] Crear `app/services/programacion/src/http/routes-panel.js` con `GET/POST /panel/activities`, `GET /panel/activities/{id}`, `PUT .../draft`, `GET .../preview`, `POST .../submit`

---

## Phase 5: User Story 4 - Revisar, devolver y publicar (Priority: P1)

**Goal**: publicador y administrador consultan, devuelven con observaciones o publican; la versión publicada sigue visible durante la revisión.

**Independent Test**: devolver, reenviar y publicar; la Agenda muestra solo lo publicado; la revisión pendiente no reemplaza lo publicado.

- [ ] T026 [P] [US4] Crear `app/services/programacion/test/integration/review.test.js` (FR-011, FR-012, FR-014, FR-032; SC-005, SC-006, SC-015; publicar lo propio; descartar revisión; cambios de asistencia exigen aviso al publicar)
- [ ] T027 [US4] Añadir a `src/domain/editorial.js` devolver, publicar (sincroniza `functions` y `opening_slots`, `search_text`), descartar revisión y reasignar (FR-010), y exigir motivo y aviso cuando la revisión cambia la asistencia
- [ ] T028 [US4] Crear `app/services/programacion/src/repositories/published.js` (sincronizar funciones y franjas sin borrar las publicadas: las quitadas se cancelan)
- [ ] T029 [US4] Añadir a `src/http/routes-panel.js` `POST .../return`, `.../publish`, `.../discard-revision`, `.../reassign` y `GET .../history`

---

## Phase 6: User Story 1 - Consultar la Agenda y las fichas (Priority: P1)

**Goal**: Agenda pública con búsqueda y filtros combinados, y ficha con enlace compartible y datos pendientes.

**Independent Test**: con actividades en todos los estados, buscar y filtrar; abrir la ficha sin cuenta.

- [ ] T030 [P] [US1] Crear `app/services/programacion/test/integration/agenda.test.js` (FR-001 a FR-004; SC-001, SC-002, SC-003; Agenda vacía y búsqueda sin coincidencias)
- [ ] T031 [US1] Crear `app/services/programacion/src/domain/agenda.js` y `src/repositories/public.js` (consulta por estado publicado, texto normalizado, fecha con función o franja, categoría, sede y modalidad)
- [ ] T032 [US1] Crear `app/services/programacion/src/domain/presenter.js` (ficha pública: `pending`, `access.label`, avisos, estado temporal de cada función)
- [ ] T033 [US1] Crear `app/services/programacion/src/http/routes-public.js` con `GET /agenda` y `GET /activities/{id}`

---

## Phase 7: User Story 2 - «¿Qué hay ahora?» (Priority: P1)

**Goal**: franjas abiertas y próximas funciones con el reloj común; sin canceladas; hora de inicio pasada sin decir «en curso».

**Independent Test**: con el reloj fijado, comprobar cada lista.

- [ ] T034 [P] [US2] Crear `app/services/programacion/test/unit/now.test.js` (estado temporal: `upcoming`, `in_progress`, `start_passed`, `finished`, `cancelled`; franja por fechas, por rango y por día de la semana; horario partido; RC-03, SC-004)
- [ ] T035 [P] [US2] Crear `app/services/programacion/test/integration/now.test.js` (FR-005 a FR-007; SC-004)
- [ ] T036 [US2] Crear `app/services/programacion/src/domain/now.js` y añadir `GET /now` a `src/http/routes-public.js`

---

## Phase 8: User Story 5 - Reprogramar o cancelar con aviso (Priority: P2)

**Goal**: reprogramar y cancelar funciones con motivo interno y aviso público, mostrando antes el impacto.

**Independent Test**: reprogramar y cancelar; comprobar aviso, ficha, «¿Qué hay ahora?» e historial.

- [ ] T037 [P] [US5] Crear `app/services/programacion/test/integration/changes.test.js` (FR-015 a FR-019; SC-007; impacto «no disponible» sin participación; traslado de sede como reprogramación; correcciones sin aviso)
- [ ] T038 [US5] Crear `app/services/programacion/src/domain/changes.js` y `src/repositories/notices.js` (reprogramar, cancelar, actualizar también la versión pendiente si existe)
- [ ] T039 [US5] Crear `app/services/programacion/src/http/routes-functions.js` con `GET /panel/functions/{id}/impact`, `POST .../reschedule` y `.../cancel` (acción `schedule.change`)

---

## Phase 9: User Story 6 - Cargar la programación desde el PDF (Priority: P2)

**Goal**: archivo estructurado con vista previa, borradores sin publicación automática y publicación confirmada.

**Independent Test**: subir el lote de ejemplo, revisar errores y duplicados, aceptar, recargar sin sobrescribir y publicar solo lo confirmado.

- [ ] T040 [P] [US6] Crear `app/services/programacion/ejemplos/lote-ejemplo.json` con datos **ficticios** para los siete casos de referencia del PDF (horario partido, franjas por rango de días, permanente con función puntual, dos funciones de la misma obra el mismo día, solo hora de inicio, pagadas sin precio, sede como recorrido)
- [ ] T041 [P] [US6] Crear `app/services/programacion/test/unit/import-format.test.js` (conversión de etiquetas FR-024, errores por campo, duplicados)
- [ ] T042 [P] [US6] Crear `app/services/programacion/test/integration/imports.test.js` (FR-020 a FR-024, FR-031, FR-033; SC-008, SC-009, SC-010, SC-014)
- [ ] T043 [US6] Crear `app/services/programacion/src/domain/imports.js` y `src/repositories/imports.js` (vista previa, aceptar, recarga sin sobrescribir, publicación del lote)
- [ ] T044 [US6] Crear `app/services/programacion/src/http/routes-imports.js` (`POST /panel/imports`, `GET /panel/imports/{id}`, `POST .../accept`, `POST /panel/publish-batch`; acción `catalog.load`)
- [ ] T045 [US6] Crear `app/services/programacion/bin/cargar-ejemplo.js` (crea catálogos ficticios, carga y publica el lote de ejemplo en la demo; se niega en producción)

---

## Phase 10: User Story 8 - Archivar una actividad (Priority: P3)

**Goal**: archivar sin perder datos y no borrar lo que pudo tener ventas o sellos.

**Independent Test**: archivar con funciones futuras (409), cancelar y archivar; borrar una publicada (409) y una nunca publicada (204).

- [ ] T046 [P] [US8] Crear `app/services/programacion/test/integration/archive.test.js` (FR-027 a FR-029; SC-011)
- [ ] T047 [US8] Añadir archivar y borrar a `src/domain/editorial.js` y a `src/http/routes-panel.js` (acción `activity.archive`)

---

## Phase 11: Integración, contenedores y documentación

- [ ] T048 Crear `app/services/programacion/src/http/routes-internal.js` con `GET /internal/functions/{id}` (credencial `X-Service-Key`) y su prueba `test/integration/internal.test.js`
- [ ] T049 [P] Crear `app/services/programacion/Dockerfile` (node:24-alpine, sin root, healthcheck)
- [ ] T050 Hacer idempotente `app/db/init/01-bases-por-servicio.sh` y añadir el servicio `db-preparar` en `app/docker-compose.yml`, con las bases `programacion` y `programacion_pruebas`
- [ ] T051 Añadir el contenedor `programacion` a `app/docker-compose.yml` y el prefijo `/api/programacion` a `app/edge/server.js` (con su prueba en `app/edge/test/edge.test.js`)
- [ ] T052 Actualizar `app/preparar-entorno.mjs` y `app/.env.example` con `PROGRAMACION_DB_PASSWORD` y la credencial de servicio compartida con identidad
- [ ] T053 [P] Añadir a `app/edge/test/e2e.test.js` un recorrido de punta a punta con identidad y programación reales (crear, enviar, publicar y ver en la Agenda)
- [ ] T054 Ajustar `.github/workflows/ci.yml` y `.github/scripts/humo-contenedores.sh` para instalar, probar y levantar el nuevo servicio
- [ ] T055 [P] Revisar con `app/services/identidad/test/unit/no-secrets.test.js` que no haya credenciales en los archivos nuevos
- [ ] T056 [P] Actualizar `docs/arquitectura/02-servicios.md` y `03-despliegue.md` (servicio implementado, API interna, cuatro contenedores)
- [ ] T057 [P] Actualizar `README.md` y `AGENTS.md` (cómo levantar y probar, cargar el ejemplo)
- [ ] T058 Ejecutar `npm test` en `app/` y la prueba de humo con contenedores, y anotar el resultado en `specs/002-programacion-y-publicacion/quickstart.md`
- [ ] T059 Marcar las tareas hechas en este archivo
- [ ] T060 Crear `specs/002-programacion-y-publicacion/encargo-frontend.md`: encargo para el agente de diseño (Agenda, ficha, «¿Qué hay ahora?» y panel editorial), con contratos, reglas de datos pendientes, accesibilidad y responsivo (RNF-01, RNF-03)

---

## Dependencies & Execution Order

- Fase 1 → Fase 2 → historias.
- **US7** (catálogos) va primero: las fichas necesitan categorías y sedes.
- **US3** depende de US7. **US4** depende de US3. **US1** y **US2** dependen de US4 (solo se ve lo publicado). **US5** depende de US4. **US6** depende de US7 y US4. **US8** depende de US5 (cancelar antes de archivar).
- Fase 11 al final; T060 se puede escribir en cuanto los contratos estén estables.

### Parallel Opportunities

- Fase 2: T007, T008, T010, T012, T015 y T016.
- Las pruebas de cada historia (T017, T020–T021, T026, T030, T034–T035, T037, T041–T042, T046) son archivos distintos.
- Fase 11: T049, T053, T055, T056 y T057.

## Implementation Strategy

1. Fases 1 y 2.
2. **MVP:** US7 + US3 + US4 + US1 (se crea, revisa, publica y consulta).
3. US2, US5, US6 y US8.
4. Fase 11: contenedores, CI, documentación y encargo de interfaz.

## Cobertura contra requisitos y criterios

| Requisito | Tareas |
|---|---|
| FR-001, FR-002 | T030, T031, T033 |
| FR-003, FR-004 | T030, T032, T033 |
| FR-005, FR-006 | T034, T035, T036 |
| FR-007 | T005, T016, T035 |
| FR-008, FR-009 | T021, T024, T025 |
| FR-010 | T026, T027 |
| FR-011, FR-012 | T026, T027, T029 |
| FR-013 | T012, T021, T026 |
| FR-014 | T026, T027 |
| FR-015 a FR-019 | T037, T038, T039 |
| FR-020 a FR-024 | T041, T042, T043, T044 |
| FR-025 | T017, T018, T019 |
| FR-026 | T042, T044 |
| FR-027 a FR-029 | T046, T047 |
| FR-030 | T020, T021, T022 |
| FR-031 | T042, T043 |
| FR-032 | T026, T027 |
| FR-033 | T041, T042 |

| Criterio | Tareas |
|---|---|
| SC-001 | T030 |
| SC-002 | T030 |
| SC-003 | T030, T032 |
| SC-004 | T034, T035 |
| SC-005 | T021, T026 |
| SC-006 | T026 |
| SC-007 | T037 |
| SC-008 | T042 |
| SC-009 | T042 |
| SC-010 | T040, T042 |
| SC-011 | T046 |
| SC-012 | T020, T021 |
| SC-013 | T021, T030 |
| SC-014 | T041, T042 |
| SC-015 | T026 |
