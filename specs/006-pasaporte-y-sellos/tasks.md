# Tasks: Pasaporte Vivo y sellos

**Input**: Design documents from `specs/006-pasaporte-y-sellos/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Sí. Cada criterio de éxito tiene su prueba, incluida la concurrencia del sello único (RNF-06); el mapa está en `research.md`.

**Organization**: por historia de usuario. Rutas relativas a la raíz del repositorio; `P/` = `app/services/participacion/` y `W/` = `app/web/`.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [x] T001 [P] Acción `passport.manage` (solo `administrador`) en `app/services/identidad/src/domain/policy.js`, con su prueba en `app/services/identidad/test/unit/policy.test.js`
- [x] T002 [P] `PUBLIC_BASE_URL` en `P/src/config.js` (por defecto `http://localhost:8080`), en `P/.env.example` y en el servicio `participacion` de `app/docker-compose.yml`
- [x] T003 [P] Copiar sin cambios `app/services/programacion/src/domain/imagenes.js` a `P/src/domain/imagenes.js` y `app/services/programacion/test/imagenes-prueba.js` a `P/test/imagenes-prueba.js` (ya están en `sonar.cpd.exclusions`)

## Phase 2: Foundational

- [x] T004 Esquema idempotente en `P/src/db.js`: `passport_qrs` (`ref_hash` único; `status` ∈ `inactive|active|replaced`; `inactive_cause` ∈ `manual|function_changed`; ventana `AAAA-MM-DD HH:MM` con `window_end > window_start`; `CHECK` «`active` exige ventana y `confirmed_for`»; índice único parcial `(function_id) WHERE status <> 'replaced'`), `stamp_images` (`mime` ∈ JPEG, PNG, WebP; `bytes` «hasta 1 MB»; `alt` y `credit` «de 3 a 300 caracteres»), `stamp_contents` (`UNIQUE (function_id, version)`; `text` «hasta 280 caracteres»; `image_id` → `stamp_images` con `ON DELETE RESTRICT`) y `stamps` (`UNIQUE (user_id, function_id)`; `content_id` → `stamp_contents` con `ON DELETE RESTRICT`)
- [x] T005 [P] Repositorio `P/src/repositories/pasaporte.js`: QR por función y por `ref_hash`, sellos por persona, inserción del sello con `ON CONFLICT DO NOTHING RETURNING`, versiones de contenido e imágenes
- [x] T006 [P] Utilidades puras en `P/src/domain/pasaporte.js`: `ref` con HMAC-SHA256(`TICKET_KEY`, `pasaporte:{qrId}`) recortado a 128 bits en base64url, su huella, ventana válida y abierta en hora de Loja, comparación de `confirmed_for` con la función vigente, clasificación del `ref` (`VIVART-E1:` = entrada) y texto breve en texto plano
- [x] T007 [P] Pruebas unitarias en `P/test/unit/pasaporte.test.js`: `ref` estable e impredecible, ventana (inicio, fin, límites), cambio de la función, `wrong_code_type`, texto de 281 caracteres (SC-003, SC-014, SC-015)
- [x] T008 Registrar dominio y repositorio en `P/src/services.js` y añadir a `P/test/helpers.js` funciones simuladas configurables (fecha, hora, sede, cancelada, aviso) y cuentas con y sin correo verificado

**Checkpoint**: el servicio arranca con las tablas nuevas sin perder datos y `npm test` sigue en verde.

## Phase 3: User Story 4 - El administrador gestiona los QR del Pasaporte (P2, base de las demás)

**Goal**: generar, activar, desactivar y reemplazar el QR; fijar la ventana; ver el QR en SVG con su enlace.

**Independent Test**: generar un QR, intentar activarlo sin ventana, fijarla, activarlo, reemplazarlo y comprobar el historial y los permisos.

> Va antes que las historias P1 porque sin QR no hay canje.

- [x] T009 [P] [US4] Pruebas del panel en `P/test/integration/pasaporte-admin.test.js`: generar (y 409 si ya hay uno vigente), activar sin ventana (422), fijar ventana (fin ≤ inicio: 422), activar, desactivar, reemplazar (un solo vigente; `ref` nuevo), id que no es función (404), SVG y enlace con `PUBLIC_BASE_URL`; editor, publicador, acceso y usuario: 403; sin sesión: 401; identidad caída: 503; historial de cada operación sin el `ref` (SC-008, SC-009, SC-010, SC-014)
- [x] T010 [US4] Dominio `P/src/domain/pasaporte-admin.js`: estado por función, generar, reemplazar (en una transacción), fijar ventana guardando `confirmed_for` con la función vigente, activar y desactivar; QR en SVG con `qrcode` (corrección M); exige `passport.manage`
- [x] T011 [US4] Rutas del panel en `P/src/http/routes.js`: `GET /panel/passport`, `GET /panel/functions/:id/passport`, `POST …/passport/qr`, `POST …/passport/qr/replace`, `PUT …/passport/window`, `POST …/passport/activate`, `POST …/passport/deactivate`
- [x] T012 [US4] Pantalla `W/js/panel-pasaporte.js` y ruta `/panel/pasaporte` en `W/app.js` (y enlace en la barra del panel): lista de funciones publicadas con su estado; por función, QR grande, enlace, descarga en SVG, ventana en hora de Loja, activar, desactivar y reemplazar

## Phase 4: User Story 1 - Reclamar un sello con el QR (P1) 🎯 MVP

**Goal**: abrir el enlace y obtener el sello, sin entrada, con retorno tras iniciar sesión y un solo sello por persona y función.

**Independent Test**: con un QR activo y una cuenta verificada, abrir el enlace y obtener el sello; repetirlo y obtener el mismo.

- [x] T013 [P] [US1] Pruebas de canje en `P/test/integration/pasaporte-canje.test.js`: canje válido en función gratuita y de pago sin pedidos (201); repetir (200, mismo id); sin sesión (401); comprar una entrada no da el sello (SC-001)
- [x] T014 [P] [US1] Prueba de concurrencia en `P/test/integration/pasaporte-concurrencia.test.js`: 20 solicitudes simultáneas del mismo usuario con el mismo `ref` dan un solo sello y el mismo id en todas las respuestas; dos usuarios distintos, dos sellos (SC-002)
- [x] T015 [US1] Canje en `P/src/domain/pasaporte.js` con el orden de la decisión 10 de `research.md`: formato, QR, sesión, correo verificado, sello existente, programación, cancelada, activo y sin cambios (si cambió, desactiva con `function_changed` y lo registra), ventana, emitir con la última versión de contenido
- [x] T016 [US1] Ruta `POST /passport/claims` en `P/src/http/routes.js`
- [x] T017 [US1] Página `W/js/pasaporte.js` y ruta `/pasaporte/canje/{ref}` en `W/app.js`: reclama al cargar; con 401 guarda la acción pendiente `canje` en identidad y lleva a iniciar sesión; muestra el sello obtenido o el existente

**Checkpoint**: el canje funciona de punta a punta.

## Phase 5: User Story 2 - Rechazos claros del canje (P1)

**Goal**: cada rechazo con su motivo.

**Independent Test**: provocar cada motivo y comprobar su mensaje.

- [x] T018 [P] [US2] Pruebas en `P/test/integration/pasaporte-canje.test.js`: `wrong_code_type`, `qr_not_found`, `qr_replaced`, `qr_inactive` (`manual` y `function_changed`), `window_not_open`, `window_expired`, `function_cancelled`, `email_not_verified`, `not_verifiable` (programación caída: 503 y 0 sellos) (SC-003, SC-004, SC-005, SC-011)
- [x] T019 [US2] Mensajes de rechazo en `P/src/domain/pasaporte.js` y su presentación en `W/js/pasaporte.js` (texto claro, sin depender del color; «no confirmado» si no se pudo verificar)

## Phase 6: User Story 3 - Ver mi colección de sellos (P1)

**Goal**: «Mi pasaporte» con el total y el detalle de cada sello, con datos vigentes y aviso.

**Independent Test**: con tres sellos, consultar la colección y abrir uno.

- [x] T020 [P] [US3] Pruebas de colección en `P/test/integration/pasaporte-canje.test.js`: `total` sin meta ni porcentaje; solo sellos propios; sello ajeno 404; sello sin contenido con `content: null`; función cancelada después con su aviso; programación caída con `verified: false` (SC-006, SC-007, SC-011, SC-012)
- [x] T021 [US3] `GET /passport`, `GET /passport/stamps/:id` y `GET /passport/images/:id` en `P/src/domain/pasaporte.js` y `P/src/http/routes.js`, con los datos vigentes de programación (`GET /internal/functions?ids=`)
- [x] T022 [US3] Pestaña `/pasaporte` en `W/js/pasaporte.js` (reemplaza el «Próximamente» actual de `W/app.js`): sin sesión, invitación a identificarse; con sesión, «Mi pasaporte: N sellos» y la rejilla; rutas «Próximamente» (FR-028); detalle `/pasaporte/sello/{id}` con plantilla común, imagen con `alt` y autoría, texto como `textContent` y aviso de cambio o cancelación
- [x] T023 [P] [US3] Estilos del Pasaporte en `W/styles.css` con los tokens existentes, sin meta ni casillero bloqueado

## Phase 7: User Story 4 (continuación) - Contenido del sello versionado (P2)

**Goal**: texto e imagen opcionales; los sellos emitidos conservan su versión.

**Independent Test**: emitir un sello, cambiar el contenido, emitir otro y comparar.

- [x] T024 [P] [US4] Pruebas en `P/test/integration/pasaporte-admin.test.js`: texto de 281 caracteres (422); imagen sin `alt` o `credit`, GIF o SVG (422); imagen con EXIF servida sin él; cambiar el contenido después de emitir conserva el anterior y su imagen; `<b>` se devuelve literal (SC-012, SC-013, SC-015)
- [x] T025 [US4] `PUT /panel/functions/:id/passport/content` en `P/src/domain/pasaporte-admin.js` y `P/src/http/routes.js`: nueva versión con texto e imagen (nueva, quitada o conservada), validada con `imagenes.js`
- [x] T026 [US4] Editor de contenido en `W/js/panel-pasaporte.js` (texto con contador de 280; imagen reducida en el navegador como en el 003, con texto alternativo y autoría) y vista previa con la plantilla común

## Phase 8: User Story 5 - Un cambio de fecha, hora o sede desactiva el canje (P2)

**Goal**: al reprogramar, el canje queda desactivado hasta confirmar una ventana nueva; los sellos se conservan.

**Independent Test**: reprogramar una función con canje activo y comprobar que se desactiva y que se reactiva con una ventana nueva.

- [x] T027 [P] [US5] Pruebas en `P/test/integration/pasaporte-admin.test.js` y `pasaporte-canje.test.js`: con la función simulada reprogramada, el canje da `qr_inactive` (`function_changed`), el panel muestra la causa, los sellos siguen, activar sin confirmar ventana da 422, confirmar ventana y activar lo reactiva; una función sin QR no cambia nada (SC-005)
- [x] T028 [US5] Detección en el panel (`GET /panel/functions/:id/passport` compara y desactiva) y aviso en `W/js/panel-pasaporte.js` «La función cambió: confirma una ventana nueva»

## Phase 9: Polish & Cross-Cutting Concerns

- [x] T029 [P] Prueba de punta a punta en `app/edge/test/e2e-pasaporte.test.js` con los tres servicios reales: el administrador activa un QR, una persona verificada reclama por la entrada común, repite y obtiene el mismo sello; un publicador recibe 403
- [x] T030 [P] Prueba de humo en `.github/scripts/humo-contenedores.sh`: `GET /api/participacion/passport` sin sesión da 401 y el panel del Pasaporte también
- [x] T031 [P] Actualizar `docs/arquitectura/02-servicios.md` (estado del spec 006), `docs/arquitectura/04-comportamiento.md` (el flujo 4, sello único, pasa a implementado) y `README.md`
- [x] T032 Comprobar en Chrome a 360 px (canje, colección, detalle) y a 1440 px (panel): sin desbordamiento horizontal, teclado y sin peticiones de ubicación
- [x] T033 Ejecutar `npm test` en `app/` y la demo con contenedores; registrar los resultados en `specs/006-pasaporte-y-sellos/quickstart.md`
- [ ] T034 Abrir el PR desde `006-pasaporte-y-sellos` (borrador), revisar la CI y SonarCloud y corregir lo que falle; no fusionar

## Dependencies & Execution Order

- **Setup (T001 a T003)**: sin dependencias; en paralelo.
- **Foundational (T004 a T008)**: T004 bloquea todo lo demás.
- **US4 núcleo (T009 a T012)**: sin QR no hay canje; va primero.
- **US1 (T013 a T017)** depende de US4. **US2 (T018 a T019)** y **US3 (T020 a T023)** dependen de US1.
- **US4 contenido (T024 a T026)** y **US5 (T027 a T028)** dependen de US4 núcleo y del canje; pueden ir en paralelo con US3.
- **Polish** al final.

## Parallel Example: después de la fase 2

```text
T009 pruebas del panel        T013 pruebas de canje        T014 concurrencia
T010 dominio del panel   →    T015 canje                →  T018 rechazos
T011 rutas del panel          T016 ruta de canje           T020 colección
```

## Implementation Strategy

1. **MVP**: fases 1 a 6 (panel de QR, canje, rechazos y colección). Con eso el Pasaporte funciona de punta a punta.
2. **Incremento 2**: fase 7 (contenido versionado del sello).
3. **Incremento 3**: fase 8 (desactivación por cambio de la función).
4. **Cierre**: fase 9 y PR listo para revisión.
5. **Si P-14 se decide como «recuerdo del momento del canje»**: añadir las columnas descritas en `data-model.md` a `stamps`, rellenarlas en T015 y usarlas en T021 (una tarea extra, sin cambiar las demás).
