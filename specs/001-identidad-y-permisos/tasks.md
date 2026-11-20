# Tasks: Identidad, perfil y permisos

**Input**: Design documents from `/specs/001-identidad-y-permisos/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Incluidas. El spec exige criterios verificables (SC-001 a SC-018) y el plan los mapea a pruebas (`research.md`).

**Organization**: por historias de usuario del spec. **Orden por dependencia:** Historia 7 (registro, sesión y recuperación) es P2 pero es la base de las demás y se implementa antes que las historias P1 que necesitan cuentas; las historias P1 se marcan como tales.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencia pendiente)
- **[Story]**: historia del spec (US1 a US9)
- Rutas relativas a la raíz del repositorio. **Todo el código vive bajo `app/`** (servicios, web y entrada común); la documentación y las herramientas de agentes quedan fuera de esa carpeta

## Alcance

Solo el spec 001. **No se incluyen** carrito, pago, canje, Pasaporte ni nada de los specs 002 a 008.

---

## Phase 1: Setup

- [x] T001 Crear `app/package.json` con el script `test` que ejecuta `npm --prefix services/identidad test` y `node --test "edge/test/**/*.test.js"`
- [x] T002 Crear `app/services/identidad/package.json` (`"type": "module"`, `engines.node >= 24`, dependencias `fastify` ^5 y `@fastify/cookie`, scripts `test` con `node --test test/` y `start`)
- [x] T003 [P] Actualizar `.gitignore` con `node_modules/`, `app/services/identidad/data/` y `*.sqlite`
- [x] T004 [P] Crear `app/services/identidad/.env.example` con los nombres de las variables (sin valores secretos) descritas en `research.md`
- [x] T005 Ejecutar `npm install` en `app/services/identidad` y confirmar `package-lock.json`

---

## Phase 2: Foundational (bloquea todas las historias)

- [x] T006 Crear `app/services/identidad/src/config.js`: lee variables de entorno con valores por defecto técnicos (sesión 168 h, verificación 24 h, recuperación 1 h, activación 72 h, acción pendiente 24 h, parámetros de scrypt, `ALLOWED_ORIGINS`, `SERVICE_KEYS`, `MAIL_TRANSPORT`, `PUBLIC_BASE_URL`, `DB_FILE`); sin ningún secreto por defecto
- [x] T007 Crear `app/services/identidad/src/db.js` con el esquema de `data-model.md`: `users` (`email` **único**, guardado en minúsculas y sin espacios; `password_hash` vacío mientras la cuenta está pendiente de activación; `status` en `pending_activation` o `active`; `email_verified_at` opcional), `role_assignments` (único por `user_id` y `role`; `role` en editor, publicador, administrador o personal_acceso), `function_assignments` (único por `user_id` y `function_id`), `sessions` (`id` = hash SHA-256 del token), `email_tokens` (`token_hash` clave; `purpose` en verify, reset o activate; `used_at` opcional), `pending_actions` (`type` en compra o canje; `ref` con patrón `^[A-Za-z0-9_-]{1,64}$`) y `audit_log` (solo anexar)
- [x] T008 [P] Crear `app/services/identidad/src/repositories/users.js`
- [x] T009 [P] Crear `app/services/identidad/src/repositories/roles.js` (asignaciones de rol y de función)
- [x] T010 [P] Crear `app/services/identidad/src/repositories/sessions.js`
- [x] T011 [P] Crear `app/services/identidad/src/repositories/tokens.js`
- [x] T012 [P] Crear `app/services/identidad/src/repositories/pending.js`
- [x] T013 [P] Crear `app/services/identidad/src/repositories/audit.js` (nunca guarda contraseñas ni tokens)
- [x] T014 [P] Crear `app/services/identidad/src/domain/passwords.js`: validación de 15 a 128 caracteres con normalización NFKC, espacios permitidos y sin reglas de composición; hash y comprobación con scrypt (`scrypt$N$r$p$sal$hash`)
- [x] T015 [P] Crear `app/services/identidad/src/domain/tokens.js`: tokens de 32 bytes aleatorios, hash SHA-256 y vencimiento
- [x] T016 Crear `app/services/identidad/src/mail/index.js` (puerto de correo y selección del transporte por `MAIL_TRANSPORT`)
- [x] T017 [P] Crear `app/services/identidad/src/mail/test-transport.js` (buzón de pruebas en memoria; no envía correos reales)
- [x] T018 [P] Crear `app/services/identidad/src/mail/console-transport.js` (imprime el enlace; uso del procedimiento interno)
- [x] T019 [P] Crear `app/services/identidad/src/http/errors.js`: errores con forma uniforme; el 403 indica `missingRole` y `acceptedRoles` y nunca contenido protegido
- [x] T020 [P] Crear `app/services/identidad/src/http/security.js`: comprobación de `Origin` y de `Content-Type: application/json` en métodos que cambian estado, y limitador de intentos en memoria (inicio de sesión 10 por 15 min; registro y recuperación 5 por hora)
- [x] T021 Crear `app/services/identidad/src/domain/policy.js`: tabla de acciones y roles de `data-model.md` (permisos como suma de roles activos; `draft.edit_own` exige `ownerId` propio; `access.validate` exige función asignada)
- [x] T022 Crear `app/services/identidad/src/app.js`: fábrica de Fastify con cookies, seguridad, manejo de errores, registro de rutas, `GET /health` y registro de logs que no incluye contraseñas ni tokens
- [x] T023 Crear `app/services/identidad/src/server.js` (arranque en el puerto 3001)
- [x] T024 [P] Crear `app/services/identidad/test/helpers.js` (construye la app con base en memoria, scrypt rápido y buzón de pruebas)
- [x] T025 [P] Crear `app/services/identidad/test/unit/passwords.test.js`: 14 caracteres se rechazan; 15, 64 y 128 con espacios y sin mayúsculas, números ni símbolos se aceptan; 129 se rechaza; el hash no contiene la contraseña (SC-011)
- [x] T026 [P] Crear `app/services/identidad/test/unit/tokens.test.js`: aleatoriedad, hash y vencimiento (SC-014)
- [x] T027 [P] Crear `app/services/identidad/test/unit/policy.test.js`: matriz rol por acción, suma de varios roles, `draft.edit_own` con dueño ajeno, `access.validate` con y sin función, `publish` no concede `sales.configure` (SC-001, SC-004, SC-006, SC-009)
- [x] T028 [P] Crear `app/services/identidad/test/unit/security.test.js`: límite de intentos y rechazo de `Origin` no permitido y de contenido no JSON

**Checkpoint**: la base está lista; las historias pueden empezar.

---

## Phase 3: User Story 1 - Consultar sin cuenta (Priority: P1)

**Goal**: la consulta pública no exige cuenta, identificación ni ubicación; la entrada común sirve la web y enruta el servicio.

**Independent Test**: sin sesión, la entrada sirve la web y el servicio responde a rutas públicas; las rutas protegidas devuelven 401; la web no usa geolocalización.

- [x] T029 [P] [US1] Crear `app/edge/server.js`: sirve `app/web/` y enruta `/api/identidad/*` al servicio quitando el prefijo; sin dependencias
- [x] T030 [P] [US1] Crear `app/web/index.html` con estructura accesible (etiquetas, regiones, foco visible)
- [x] T031 [P] [US1] Crear `app/web/styles.css` (contraste legible, foco visible, estados no solo por color, sin desbordamiento horizontal en celular)
- [x] T032 [US1] Crear `app/web/app.js` con el enrutamiento básico y el ayudante de formularios con errores junto al campo; sin `geolocation`
- [x] T033 [US1] Crear `app/edge/test/edge.test.js`: sirve la web, enruta el prefijo, no solicita ubicación y no exige sesión para lo público (SC-002)
- [x] T034 [P] [US1] Crear `app/services/identidad/test/integration/public-access.test.js`: `GET /health` sin sesión; `GET /me` sin sesión da 401; las rutas protegidas piden identificarse solo cuando corresponde (FR-001, FR-003)

---

## Phase 4: User Story 7 - Registro, sesión y recuperación (Priority: P2, base de las demás)

**Goal**: registrarse con correo y contraseña, verificar el correo, iniciar y cerrar sesión, y recuperar el acceso.

**Independent Test**: registrar, verificar con el buzón de pruebas, iniciar y cerrar sesión, recuperar con un enlace de un solo uso.

- [x] T035 [P] [US7] Crear `app/services/identidad/test/integration/register-verify.test.js`: registro con solo correo y contraseña (rechaza datos extra como cédula); respuesta neutra para correo nuevo y repetido; enlace de verificación de un solo uso y con vencimiento; el registro nunca otorga roles (FR-004, FR-028, FR-029, FR-030; SC-010, SC-013, SC-014, SC-016)
- [x] T036 [P] [US7] Crear `app/services/identidad/test/integration/session.test.js`: inicio de sesión con cookie `HttpOnly`, `GET /me`, cierre de sesión, error genérico para credenciales inválidas y límite de intentos (FR-004, FR-006; SC-008)
- [x] T037 [P] [US7] Crear `app/services/identidad/test/integration/password-reset.test.js`: mismo mensaje exista o no el correo, enlace de un solo uso y con vencimiento, cierre de las demás sesiones al restablecer (FR-005, FR-029; SC-013, SC-014, SC-016)
- [x] T038 [US7] Crear `app/services/identidad/src/domain/accounts.js`: registro, verificación, reenvío, inicio y cierre de sesión (hash ficticio si el correo no existe), recuperación y restablecimiento
- [x] T039 [US7] Crear `app/services/identidad/src/http/routes-auth.js` con `/auth/register`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/login`, `/auth/logout`, `/auth/password-reset/request`, `/auth/password-reset/confirm` y `/me` según `contracts/identidad.openapi.yaml`
- [x] T040 [US7] Añadir en `app/web/app.js` las pantallas de registro, inicio de sesión, verificación y recuperación

---

## Phase 5: User Story 9 - Primer administrador (Priority: P1)

**Goal**: habilitar la primera cuenta administrativa por un procedimiento interno, sin credenciales predeterminadas.

**Independent Test**: ejecutar el script, activar con el enlace, establecer la contraseña y asignar un rol a otra cuenta.

- [x] T041 [P] [US9] Crear `app/services/identidad/test/integration/first-admin.test.js`: activación con el enlace establece la contraseña y el rol de administrador; registrarse públicamente con el mismo correo no otorga rol; el enlace es de un solo uso (FR-027, FR-028; SC-015)
- [x] T042 [US9] Añadir `activate` a `app/services/identidad/src/domain/accounts.js` y `/auth/activate` a `app/services/identidad/src/http/routes-auth.js`
- [x] T043 [US9] Crear `app/services/identidad/bin/crear-primer-administrador.js --email`: crea la cuenta pendiente de activación con rol administrador y emite el enlace por el transporte configurado; no define contraseña ni credenciales predeterminadas
- [x] T044 [US9] Añadir en `app/web/app.js` la pantalla de activación

---

## Phase 6: User Story 2 - Identificarse y retomar la acción (Priority: P1)

**Goal**: conservar la acción pendiente (compra o canje), devolver a la persona al punto de origen y exigir revalidación; **nunca ejecutar un pago ni un canje**.

**Independent Test**: guardar una acción `canje` sin sesión, iniciar sesión, llamar a `resume` y obtener el destino con `executed=false`.

- [x] T045 [P] [US2] Crear `app/services/identidad/test/integration/pending-resume.test.js`: conservar tipo y referencia (FR-031); destino fijado por el servicio, nunca por la persona, con referencias inválidas rechazadas (FR-032); `executed=false` siempre (FR-033); cuenta sin correo verificado queda bloqueada con `blockedReason=email_not_verified` (FR-035); acción vencida y descartada (FR-034); retomar tras verificar e iniciar sesión (SC-003, SC-012, SC-017, SC-018)
- [x] T046 [P] [US2] Crear `app/services/identidad/test/integration/no-payment-routes.test.js`: recorre las rutas registradas y comprueba que **no existe** ninguna ruta de pago, carrito, canje, sello o Pasaporte (SC-017)
- [x] T047 [US2] Crear `app/services/identidad/src/domain/pending.js`: conservar, retomar y descartar; destino `compra → /carrito` y `canje → /pasaporte/canje/{ref}`
- [x] T048 [US2] Crear `app/services/identidad/src/http/routes-pending.js` con `POST /auth/pending-actions`, `GET /auth/resume` y `DELETE /auth/pending-actions/current` según el contrato
- [x] T049 [US2] Añadir en `app/web/app.js` el flujo de retorno: conserva la acción antes de pedir identificación y vuelve al destino mostrando el resultado, sin ejecutar nada

---

## Phase 7: User Story 3 - Cada rol solo hace lo que le corresponde (Priority: P1)

**Goal**: aplicar los permisos en el servidor y ofrecer a los otros servicios la introspección y `authorize` con credencial de servicio.

**Independent Test**: una cuenta por rol y una matriz de acciones, incluidas solicitudes directas sin pasar por la web.

- [x] T050 [P] [US3] Crear `app/services/identidad/test/integration/internal-authz.test.js`: `introspect` y `authorize` rechazan credencial de servicio inválida; la matriz por rol; editor no publica ni edita borradores ajenos aunque la solicitud sea directa; publicador y administrador editan propuestas ajenas y publican las propias; publicar no concede `sales.configure`; personal de acceso solo valida funciones asignadas (FR-009 a FR-017; SC-001, SC-009)
- [x] T051 [US3] Crear `app/services/identidad/src/http/guards.js`: exige sesión y acción en las rutas públicas protegidas
- [x] T052 [US3] Crear `app/services/identidad/src/http/routes-internal.js` con `/internal/introspect` y `/internal/authorize` según `contracts/introspeccion.openapi.yaml`, con credencial de servicio por consumidor y fallo cerrado ante sesión inactiva

---

## Phase 8: User Story 4 - El administrador asigna y revoca roles (Priority: P2)

**Goal**: gestión de roles y de funciones del personal de acceso por el administrador, sin permisos por organización.

**Independent Test**: asignar uno y varios roles y comprobar que los permisos son la suma.

- [x] T053 [P] [US4] Crear `app/services/identidad/test/integration/roles-admin.test.js`: solo el administrador asigna y revoca; varios roles suman permisos; el personal de acceso recibe funciones solo con ese rol; no hay alcance por organización; la asignación queda en el historial (FR-009 a FR-011, FR-016; SC-004)
- [x] T054 [US4] Crear `app/services/identidad/src/domain/roles.js` (asignar y revocar roles y funciones, con historial en cada cambio)
- [x] T055 [US4] Crear `app/services/identidad/src/http/routes-roles.js` con `GET /users`, `GET /users/{id}`, `PUT` y `DELETE /users/{id}/roles/{role}` y `PUT` y `DELETE /users/{id}/functions/{functionId}`
- [x] T056 [US4] Añadir en `app/web/app.js` el panel de roles con etiquetas y errores junto al campo, y confirmación al revocar

---

## Phase 9: User Story 5 - Revocar un rol sin perder trabajo (Priority: P2)

**Goal**: la revocación quita solo las acciones del rol, surte efecto en la siguiente consulta de permisos y no toca contenido de otros servicios.

**Independent Test**: asignar editor y publicador, revocar uno y comprobar la siguiente introspección.

- [x] T057 [P] [US5] Crear `app/services/identidad/test/integration/revocation.test.js`: revocar un rol conserva los demás, la siguiente `introspect` ya no lo incluye, revocar `personal_acceso` quita sus funciones, la sesión no se cierra y el servicio no modifica nada fuera de sus propias tablas (FR-018 a FR-021; SC-004, SC-005)
- [x] T058 [P] [US5] Documentar en `specs/001-identidad-y-permisos/contracts/introspeccion.openapi.yaml` que los consumidores no deben guardar en caché los permisos

---

## Phase 10: User Story 6 - Entender por qué se rechaza una acción (Priority: P2)

**Goal**: los rechazos por permisos indican el rol faltante y no revelan contenido.

**Independent Test**: acciones no concedidas con cada rol y revisión del mensaje.

- [x] T059 [P] [US6] Crear `app/services/identidad/test/integration/rejections.test.js`: el 403 trae `missingRole` y `acceptedRoles`, y no incluye título, texto ni autor; un borrador ajeno responde sin datos del borrador (FR-022, FR-023; SC-006)
- [x] T060 [US6] Añadir en `app/web/app.js` el mensaje de rechazo junto a la acción que lo originó

---

## Phase 11: User Story 8 - Historial de operaciones sensibles (Priority: P3)

**Goal**: el administrador consulta quién, cuándo y sobre qué registro.

**Independent Test**: asignar, revocar y consultar el historial.

- [x] T061 [P] [US8] Crear `app/services/identidad/test/integration/audit.test.js`: cada asignación, revocación y activación queda registrada con quién, cuándo y sobre qué; solo el administrador la consulta; no contiene contraseñas ni tokens (FR-024, FR-025, FR-026; SC-007)
- [x] T062 [US8] Crear `app/services/identidad/src/http/routes-audit.js` con `GET /audit`
- [x] T063 [US8] Añadir en `app/web/app.js` la consulta del historial

---

## Phase 12: Polish y verificaciones transversales

- [x] T064 [P] Crear `app/services/identidad/test/unit/no-secrets.test.js`: recorre los archivos versionables y falla si encuentra credenciales, contraseñas o claves de servicio fijas (FR-026, FR-027; SC-015)
- [x] T065 Ejecutar `npm test` desde la raíz y comprobar que pasan todas las pruebas del servicio y de la entrada común
- [x] T066 Recorrer el `quickstart.md` de principio a fin con el buzón de pruebas y anotar el resultado (hecho con contenedores reales: construcción, salud, usuario no root y recorrido completo; ver resultado en el informe)
- [ ] T067 Comprobar la web con teclado y a ancho de celular (RNF-01, RNF-03) y anotar el resultado
- [x] T068 Revisar que el repositorio no contenga secretos, que `.specify/integration.json` no esté en los commits y que no existan rutas ni código de carrito, pago, canje o Pasaporte
- [x] T069 Marcar las tareas completadas en este archivo y registrar los pendientes (P-10, P-11)
- [x] T070 [P] Crear `app/services/identidad/Dockerfile` y `.dockerignore` (imagen mínima, sin root, con comprobación de salud y sin secretos)
- [x] T071 [P] Crear `app/edge/Dockerfile` y `app/docker-compose.yml` para la demo (el servicio no publica puertos; solo la entrada común)
- [x] T072 Crear `app/edge/test/e2e.test.js`: recorrido real por la entrada común y el buzón de pruebas hasta el retorno a la acción, sin ejecutarla (SC-003, SC-016, SC-017)

---

## Dependencies & Execution Order

- Fase 1 → Fase 2 → historias. Dentro de las pruebas de cada historia, escribirlas primero y comprobar que fallan antes de implementar.
- **US1** (web y entrada) no depende de cuentas. **US7** depende de la Fase 2 y es base de **US9**, **US2**, **US3**, **US4**, **US5**, **US6** y **US8**.
- **US9** depende de US7 (cuentas y tokens). **US2** depende de US7 (sesión). **US3** depende de US7 y de la política. **US4** depende de US3 (guardas) y de US9 (un administrador). **US5** depende de US4. **US6** depende de US3. **US8** depende de US4 (cambios que registrar).
- `app/web/app.js` se edita en varias historias: esas tareas son secuenciales entre sí.

### Parallel Opportunities

- Fase 2: T008 a T013 y T014 a T015, T017 y T018, T019 y T020, y las pruebas unitarias T025 a T028 se pueden hacer en paralelo.
- Las pruebas de cada historia (T035 a T037, T041, T045 y T046, etc.) son archivos distintos y se pueden escribir en paralelo.

## Implementation Strategy

1. Completar Fase 1 y 2.
2. **MVP:** US1 + US7 (se puede registrar, verificar, iniciar sesión y recuperar).
3. Añadir US9 (primer administrador), US2 (retorno), US3 (permisos e introspección), US4, US5, US6 y US8, comprobando cada historia por separado.
4. Fase 12: pruebas completas y revisión.

## Cobertura contra requisitos y criterios

| Requisito | Tareas |
|---|---|
| FR-001 | T029, T033, T034 |
| FR-002 | T032, T033 |
| FR-003 | T034, T051 |
| FR-004 | T035, T036, T038, T039 |
| FR-005 | T037, T038, T039 |
| FR-006 | T036, T039 |
| FR-007 | T045, T047, T048 |
| FR-008 | T045, T047 |
| FR-009 | T021, T027, T053, T054 |
| FR-010 | T021, T027, T050 |
| FR-011 | T053, T054, T055 |
| FR-012 | T027, T050, T052 |
| FR-013 | T027, T050 |
| FR-014 | T027, T050 |
| FR-015 | T027, T050, T052 |
| FR-016 | T053, T055 |
| FR-017 | T050, T052, T057 |
| FR-018 | T054, T057 |
| FR-019 | T057, T058 |
| FR-020 | T054, T057 |
| FR-021 | T057, T058 |
| FR-022 | T019, T059, T060 |
| FR-023 | T019, T059 |
| FR-024 | T013, T054, T061 |
| FR-025 | T061, T062, T063 |
| FR-026 | T013, T022, T061, T064 |
| FR-027 | T041, T042, T043, T064 |
| FR-028 | T014, T025, T035 |
| FR-029 | T035, T037, T038 |
| FR-030 | T017, T018, T035, T037 |
| FR-031 | T045, T047, T048 |
| FR-032 | T045, T047, T049 |
| FR-033 | T045, T046, T047 |
| FR-034 | T045, T048, T049 |
| FR-035 | T045, T048 |

| Criterio | Tareas |
|---|---|
| SC-001 | T027, T050 |
| SC-002 | T033, T034 |
| SC-003 | T045 |
| SC-004 | T027, T053, T057 |
| SC-005 | T057 |
| SC-006 | T027, T059 |
| SC-007 | T061 |
| SC-008 | T036 |
| SC-009 | T027, T050 |
| SC-010 | T035 |
| SC-011 | T025 |
| SC-012 | T045 |
| SC-013 | T035, T037 |
| SC-014 | T026, T035, T037 |
| SC-015 | T041, T064 |
| SC-016 | T035, T037 |
| SC-017 | T045, T046 |
| SC-018 | T045 |
