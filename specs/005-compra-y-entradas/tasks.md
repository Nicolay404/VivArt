# Tasks: Carrito, compra y control de entradas

**Input**: Design documents from `specs/005-compra-y-entradas/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Sí. Los criterios de éxito exigen pruebas, incluidas las de concurrencia (RNF-06); el mapa está en `research.md`.

**Organization**: por historia de usuario. Rutas relativas a la raíz del repositorio; `P/` = `app/services/participacion/`.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [x] T001 Crear `P/package.json` (Fastify 5, `pg`, `qrcode`; scripts `start` y `test` como programación), `P/Dockerfile` (node:24-alpine, usuario sin privilegios, healthcheck) y `P/.dockerignore`
- [x] T002 [P] Añadir las bases `participacion` y `participacion_pruebas` con usuario propio en `app/db/init/01-bases-por-servicio.sh` (idempotente)
- [x] T003 [P] Añadir a `app/preparar-entorno.mjs` `PARTICIPACION_DB_PASSWORD` y `TICKET_KEY` (32 bytes aleatorios), sin cambiar las variables existentes
- [x] T004 Añadir el contenedor `participacion` (puerto 3003, `PAYMENT_SIMULATOR=on`, `IDENTIDAD_URL`, `PROGRAMACION_URL`, claves de servicio) en `app/docker-compose.yml`; en `programacion` añadir `PARTICIPACION_URL=http://participacion:3003` y la clave para llamarlo
- [x] T005 [P] Añadir el prefijo `/api/participacion` y `camera=(self)` en `Permissions-Policy` en `app/edge/server.js`, con su prueba en `app/edge/test/edge.test.js`
- [x] T006 [P] Incluir el servicio en el CI y la cobertura: `.github/workflows/ci.yml`, `.github/scripts/cobertura.sh`, prueba de humo de contenedores y `sonar-project.properties`; añadir `app/services/participacion` a la imagen publicada en `.github/workflows/cd.yml`; y `npm --prefix services/participacion test` en `app/package.json`

## Phase 2: Foundational

- [x] T007 Crear `P/src/config.js` (variables de entorno, `PAYMENT_SIMULATOR` solo fuera de producción, `CLOCK_FIXED` solo fuera de producción, sin secretos por defecto) y `P/src/clock.js` (hora de Loja, UTC−5)
- [x] T008 Crear `P/src/db.js` con el esquema de `data-model.md`: `settings` (hold_minutes 10, sale_close_minutes 30), `sales` (capacity ≥ 0), `orders` (status `pending|confirmed|failed|expired|in_review`), `order_items` (quantity 1..6), `payments` (reference única), `tickets` (seq único por pedido, secret_hash y code_hash únicos, status `valid|invalidated`), `access_controls`, `incidents` (status `open|resolved`), `history` con triggers que impiden UPDATE, DELETE y TRUNCATE; migración idempotente y transacciones
- [x] T009 [P] Crear `P/src/http/errors.js` y `P/src/http/session.js` (cookie de sesión, `Origin` obligatorio en escrituras, igual que programación)
- [x] T010 [P] Crear `P/src/clients/identidad.js` (introspect y authorize con fallo cerrado, 503 `identity_unavailable`)
- [x] T011 [P] Crear `P/src/clients/programacion.js` (`function(id)` y `functions(ids)` con `X-Service-Key`; si no responde, error `not_verifiable`)
- [x] T012 Crear `P/src/app.js`, `P/src/server.js` y `P/src/services.js` (ensambla repositorios, dominios y rutas; `/health` comprueba la base)
- [x] T013 Crear `P/test/helpers.js` (esquema de pruebas por ejecución, identidad y programación simuladas con funciones configurables y reloj fijo)
- [x] T014 [P] Cambio compatible en identidad: acción `schedule.cancel_with_sales` (solo `administrador`) en `app/services/identidad/src/domain/policy.js`, con prueba en su `test/`
- [x] T015 [P] Cambio compatible en programación: `access { mode, priceUsd }` en `funcionInterna` y nueva ruta `GET /internal/functions?ids=` en `app/services/programacion/src/domain/changes.js` y `src/http/routes.js`, con prueba en `test/integration/internal.test.js`; actualizar `specs/002-programacion-y-publicacion/contracts/programacion.openapi.yaml`

**Checkpoint**: el servicio arranca, migra su base y responde `/health`.

## Phase 3: User Story 1 - Armar el carrito (P1) 🎯 MVP

**Goal**: cotizar un carrito sin cuenta con precio vigente, cupo, cruces, cierre de venta y límite de seis; estado de venta público.

**Independent Test**: sin sesión, cotizar dos funciones, ajustar cantidades y comprobar el total; las gratuitas no se venden.

- [x] T016 [P] [US1] Pruebas de cotización y estado de venta en `P/test/integration/cart.test.js`: gratuita, sin precio, sin venta, cancelada, venta cerrada a 30 minutos, límite de seis, ajuste al cupo, cruces solo con fin conocido, estado sin número de cupos (SC-001, SC-015, SC-017)
- [x] T017 [US1] Repositorio de venta y disponibilidad (vendidas, retenidas vigentes, disponible) en `P/src/repositories/sales.js`
- [x] T018 [US1] Dominio de carrito y estado de venta en `P/src/domain/cart.js`: precio = `access.priceUsd` solo si `mode = paid`, en centavos; cierre `ahora ≥ inicio − sale_close_minutes`; cruces solo si ambos tienen hora de fin o duración
- [x] T019 [US1] Rutas públicas `POST /cart/quote` y `GET /sale-status` en `P/src/http/routes-public.js`
- [x] T020 [US1] Web: módulo `app/web/js/carrito.js` (carrito en `localStorage`, página `/carrito` con cantidades, total en USD, cruces y límite) y botón «Agregar al carrito» con el estado de venta en `app/web/js/ficha-componente.js` y en las tarjetas de `app/web/js/publico.js`; ruta y enlace del carrito en `app/web/app.js`

## Phase 4: User Story 2 - Pagar con retención de cupos (P1)

**Goal**: pedido pendiente con retención de 10 minutos, sin vender dos veces el último cupo.

**Independent Test**: iniciar un pago, cambiar el precio, dejar vencer y repetir.

- [x] T021 [P] [US2] Pruebas en `P/test/integration/orders.test.js`: sin sesión 401, correo sin verificar 403, `cart_changed`, retención con plazo vigente, vencimiento con reloj fijo, cambio de precio que no altera el pedido, cambio de plazo que solo afecta pedidos nuevos (SC-003)
- [x] T022 [P] [US2] Prueba de concurrencia del último cupo en `P/test/integration/concurrency.test.js`: 20 pedidos simultáneos, exactamente uno pendiente (SC-002)
- [x] T023 [US2] Repositorio de pedidos en `P/src/repositories/orders.js` y dominio en `P/src/domain/orders.js`: transacción con `SELECT … FOR UPDATE` de las filas de `sales` en orden de id, total validado, `expires_at = created_at + hold_minutes`, máximo seis unidades
- [x] T024 [US2] Rutas `POST /orders`, `GET /orders`, `GET /orders/{id}` (solo propios, 404 si es ajeno) en `P/src/http/routes-person.js`
- [x] T025 [US2] Web: en `app/web/js/carrito.js`, «Ir a pagar» que registra la acción pendiente `compra` si no hay sesión, vuelve al carrito, recotiza, pide aceptar el total y muestra el pedido con la cuenta regresiva de la retención

## Phase 5: User Story 3 - Recibir las entradas (P1)

**Goal**: pago de prueba que emite N entradas con QR único, sin duplicar; pago tardío como incidencia; Mis entradas, también sin conexión.

**Independent Test**: confirmar un pago de tres entradas y repetir la confirmación.

- [x] T026 [P] [US3] Pruebas en `P/test/integration/payments.test.js`: confirmado emite N con secretos distintos, repetido no emite más (también simultáneo), fallido libera, `confirmed_late` crea incidencia sin entradas, función cancelada impide confirmar, simulador ausente con `NODE_ENV=production`, Mis entradas solo propias (SC-004, SC-005, SC-012, SC-013)
- [x] T027 [US3] Dominio de pago y emisión en `P/src/domain/payments.js` y repositorio `P/src/repositories/tickets.js`: referencia única, secreto y código derivados con HMAC (`TICKET_KEY`) y guardados como SHA-256, contenido del QR `VIVART-E1:<secreto>`, código de 10 caracteres sin 0/O/1/I/L
- [x] T028 [US3] Rutas `POST /orders/{id}/simulate-payment` (solo con simulador) y `GET /tickets` (estado vigente desde programación, aviso público, QR en SVG; `unverified` si programación no responde) en `P/src/http/routes-person.js`
- [x] T029 [US3] Web: `app/web/js/entradas.js` con el simulador de pago (tres resultados, sin datos de tarjeta), Mis pedidos y Mis entradas en Perfil, QR y código, copia en `localStorage` y aviso «Estado sin confirmar» sin conexión; rutas en `app/web/app.js`

## Phase 6: User Story 5 - Validar entradas en la sede (P1)

**Goal**: abrir y cerrar el control, escanear o escribir el código, admitir una sola vez.

**Independent Test**: validar, revalidar, otra función, cancelada y QR de Pasaporte.

- [x] T030 [P] [US5] Pruebas en `P/test/integration/access.test.js`: cada motivo de rechazo, control cerrado, función no asignada 403, personal sin funciones (lista vacía), reprogramada sigue válida (SC-007, SC-009)
- [x] T031 [P] [US5] Prueba de concurrencia de validación en `P/test/integration/concurrency.test.js`: 20 validaciones simultáneas, una admitida (SC-006)
- [x] T032 [US5] Dominio de acceso en `P/src/domain/access.js`: tipo de código, búsqueda por hash, `UPDATE … WHERE used_at IS NULL AND status = 'valid' RETURNING`, motivo al releer, `not_verifiable` si programación no responde
- [x] T033 [US5] Rutas `GET /access/functions`, `POST /access/functions/{id}/open|close|validate` en `P/src/http/routes-panel.js` con `access.validate` y la función como contexto
- [x] T034 [US5] Web: `app/web/js/acceso.js` (celular primero): funciones asignadas, abrir y cerrar, lector con `BarcodeDetector` si existe y campo para el código, resultado grande con el motivo; ruta `/acceso` en `app/web/app.js`

## Phase 7: User Story 4 - El administrador configura la venta (P2)

**Goal**: cupo y habilitación por función, plazos, consultas, invalidación e incidencias.

**Independent Test**: configurar, comprar e intentar bajar el cupo por debajo de lo comprometido.

- [x] T035 [P] [US4] Pruebas en `P/test/integration/admin.test.js`: solo administrador (editor y publicador 403), `not_sellable`, `capacity_below_committed`, plazos solo para pedidos nuevos, invalidación con motivo sin reponer cupo, ya usada rechazada, resolución de incidencia sin entradas (SC-010, SC-014)
- [x] T036 [US4] Dominio de administración en `P/src/domain/admin.js` (ajustes, venta, resumen por función, invalidación, incidencias) con historial de cada acción
- [x] T037 [US4] Rutas `/panel/settings`, `/panel/functions/{id}/sale`, `/panel/tickets/{id}/invalidate`, `/panel/incidents` en `P/src/http/routes-panel.js` con `sales.configure`
- [x] T038 [US4] Web: `app/web/js/panel-ventas.js` (ajustes de plazos, venta de la función desde el editor de la actividad, resumen con pedidos y entradas, invalidar con motivo, incidencias) y enlace «Ventas» del panel para el administrador en `app/web/js/panel-bandeja.js`

## Phase 8: User Story 6 - Cancelar una función con entradas vendidas (P2)

**Goal**: solo el administrador cancela con ventas; bloqueos y avisos.

**Independent Test**: cancelar con entradas vendidas y un pedido pendiente.

- [x] T039 [P] [US6] Ruta interna `GET /internal/functions/{id}/impact` en `P/src/http/routes-internal.js` (entradas válidas no usadas y pedidos con retención vigente), con prueba en `P/test/integration/impact.test.js` (SC-018)
- [x] T040 [US6] En programación, `cancelar` exige `schedule.cancel_with_sales` si `soldTickets > 0` o si el impacto no está disponible, en `app/services/programacion/src/domain/changes.js`, con prueba en `test/integration/changes.test.js`
- [x] T041 [US6] Prueba de cancelación en participación en `P/test/integration/cancel.test.js`: compra bloqueada, pedido pendiente no pagable y retención ignorada, Mis entradas «Función cancelada» con aviso, validación rechazada, 0 reembolsos (SC-008)
- [x] T042 [US6] Web: en el diálogo de cancelar de `app/web/js/panel-editor.js`, mostrar que hace falta el administrador cuando hay entradas vendidas o el dato no está disponible

## Phase 9: User Story 7 - Reprogramar una función con entradas vendidas (P2)

**Goal**: las entradas no usadas siguen válidas con los datos nuevos.

**Independent Test**: vender, reprogramar y validar la misma entrada.

- [x] T043 [US7] Prueba en `P/test/integration/reschedule.test.js`: entrada válida con nueva fecha y sede, usada no se reactiva, Mis entradas con el aviso de reprogramación (SC-009)

## Phase 10: Polish

- [x] T044 [P] Prueba de punta a punta con los tres servicios detrás de la entrada común en `app/edge/test/e2e-participacion.test.js`: configurar, comprar, confirmar, validar, cancelar con ventas
- [x] T045 [P] Actualizar la arquitectura: servicio de participación implementado en `docs/arquitectura/02-servicios.md`, despliegue en `03-despliegue.md` y flujos 3 en `04-comportamiento.md`
- [x] T046 [P] Revisar registros sin datos de tarjeta, secretos ni códigos (SC-011) en `P/src/app.js`
- [x] T047 Ejecutar `npm test` y los escenarios de `quickstart.md` en la demo, y registrar los resultados en `specs/005-compra-y-entradas/quickstart.md`

## Dependencies & Execution Order

- Setup (T001–T006) → Foundational (T007–T015) → historias.
- US1 → US2 → US3 (cada una usa lo anterior). US5 necesita entradas (US3). US4 puede ir en paralelo a US5 tras US3. US6 necesita US3 y T014–T015. US7 necesita US5.
- Polish al final.

## Parallel Example

```text
Tras T013: T014, T015 y T016 en paralelo (servicios distintos).
En US5: T030 y T031 (pruebas) en paralelo antes de T032.
```

## Implementation Strategy

1. MVP: Setup, Foundational, US1 a US3 (comprar y recibir entradas).
2. Después US5 (validar en la sede), US4 (administración), US6 y US7 (cambios con ventas).
3. Cerrar con la prueba de punta a punta, la arquitectura y la demo.
