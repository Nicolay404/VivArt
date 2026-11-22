# Tasks: Alforjita, asistente del festival

**Input**: Design documents from `specs/008-alforjita/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Sí. Cada criterio de éxito tiene su prueba; el mapa está en `research.md` (D-09).

**Organization**: por historia de usuario. Rutas relativas a la raíz del repositorio; `S/` = `app/services/programacion/` y `W/` = `app/web/`.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [x] T001 Exponer `publicadas()` en `S/src/domain/agenda.js` (la misma lectura que ya usa la Agenda, solo edición activa) sin cambiar el comportamiento de `/agenda`, `/now` ni de la ficha

## Phase 2: Foundational

- [x] T002 [P] Intérprete puro `S/src/domain/alforjita-interprete.js` (D-04): limpieza y límite de 200 caracteres, descarte de correos y números largos, intenciones (fuera de alcance, Pasaporte y rutas, precio, fin, accesibilidad), días (hoy, mañana, pasado mañana, nombres de día, «21», «21 de noviembre», ISO; fecha imposible ignorada), horas (M-14: 1–11 → tarde; «de la mañana», «am»; desde, antes de, a las; mañana, tarde, noche), acceso, y categorías, sedes y títulos por nombre normalizado (el más largo gana; plural sencillo)
- [x] T003 [P] Pruebas unitarias `S/test/unit/alforjita-interprete.test.js`: el ejemplo de la danza, «las seis» = 18:00 y «6 de la mañana» = 06:00, «mañana» frente a «en la mañana», tildes y mayúsculas, cada intención fuera de alcance con su pantalla, «mis sellos» frente a «¿cómo funciona el pasaporte?», texto sin sentido sin criterios, correo descartado (SC-003, SC-011)
- [x] T004 Dominio `S/src/domain/alforjita.js`: `createAlforjita({ agenda, catalogs, repos, clock, clockFixed })` con `responder(consulta)`; selección de funciones y franjas (D-05), límite de 10, `agendaUrl`, orden y estado temporal (RC-03), etiqueta común de acceso; nunca repite el texto escrito
- [x] T005 Registrar `alforjita` en `S/src/services.js` y la ruta `POST /assistant/answers` en `S/src/http/routes.js`: sin sesión; valida que llegue exactamente uno de `text`, `quick` o `criteria` (422 con `fields`); error de base → 503 `catalog_unavailable`

**Checkpoint**: la ruta responde y `npm test` sigue en verde.

## Phase 3: User Story 1 - Abrir Alforjita y usar preguntas rápidas (P1) 🎯 MVP

**Goal**: abrir el panel sin cuenta desde la Agenda y usar las preguntas rápidas.

**Independent Test**: sin sesión, abrir Alforjita, elegir cada pregunta rápida y ver fichas enlazadas.

- [x] T006 [P] [US1] Pruebas de integración `S/test/integration/alforjita.test.js` (primera parte): cada pregunta rápida con reloj fijado (`today`, `free_today`, `tonight`, `venue` sin y con `venueId`, `changes` con cancelada y reprogramada, `passport_routes`); sin cookie; pregunta rápida desconocida → 422 (SC-001, SC-009)
- [x] T007 [US1] Preguntas rápidas en `S/src/domain/alforjita.js` (D-07), incluidas «¿Hubo cambios?» con avisos públicos (nunca `internal_reason`) y `choose` de sedes
- [x] T008 [P] [US1] Icono neutro `alforja` en la tabla de trazos de `W/js/dom.js`
- [x] T009 [US1] Botón «Pregúntale a Alforjita» en la cabecera de la Agenda (`W/js/publico.js`), que importa `W/js/alforjita.js` al pulsarlo; si la importación falla, aviso de falla y la Agenda sigue igual
- [x] T010 [US1] Panel `W/js/alforjita.js` (D-08): `<dialog>` con `showModal()`, encabezado con avatar neutro y «Cerrar», preguntas rápidas como botones, lista `aria-live="polite"`, tarjetas de resultado con enlace a `/actividad/{id}` (al seguirlo se cierra el panel), foco de vuelta al botón al cerrar, conversación en memoria del módulo y «Nueva conversación»
- [x] T011 [P] [US1] Estilos del panel en `W/styles.css` con los tokens existentes: lateral de 420 px en escritorio, pantalla completa por debajo de 640 px, foco visible, sin desplazamiento horizontal

**Checkpoint**: Alforjita se abre y responde las preguntas rápidas.

## Phase 4: User Story 2 - Consultar por fecha, horario, categoría, sede y modalidad (P1)

**Goal**: texto libre acotado con los mismos resultados que la Agenda.

**Independent Test**: con reloj fijado, consulta combinada comparada con la Agenda filtrada.

- [x] T012 [P] [US2] Pruebas `S/test/integration/alforjita.test.js` (segunda parte): «¿Qué funciones gratuitas de danza hay después de las seis?» con `assumedDay` y solo las de hoy aún no empezadas; sin coincidencias hoy → sugerencia de otros días; «gratis» sin `paid` ni `unconfirmed`; mismos ids de actividad que `GET /agenda` para un día futuro con los mismos filtros, y para hoy menos las ya empezadas; `reference` igual a la de la Agenda; más de 10 → `total` y `agendaUrl`; 201 caracteres → 422 (SC-002, SC-003, SC-004, SC-010, SC-011)
- [x] T013 [US2] Búsqueda con criterios en `S/src/domain/alforjita.js`: aplicar `criteria` de sugerencias sin volver a interpretar, `past_day`, `criteriaLabels` legibles
- [x] T014 [US2] Campo de texto en `W/js/alforjita.js`: formulario con etiqueta, `maxlength=200`, burbuja del visitante con `textContent`, aviso «Asumí hoy, …», sugerencias como botones y «Ver todas en la Agenda»

## Phase 5: User Story 3 - Distinguir qué pasa cuando falta algo (P1)

**Goal**: las cuatro respuestas sin inventar datos.

**Independent Test**: provocar cada caso y comprobar texto y salida.

- [x] T015 [P] [US3] Pruebas `S/test/integration/alforjita.test.js` (tercera parte): sin coincidencias con criterios y sugerencias; precio sin confirmar (nunca «gratuita»); acceso por confirmar; sin hora de fin ni duración; fin calculado con duración conocida; «Hora de inicio pasada» de una función de hoy ya empezada (RC-03); accesibilidad confirmada, no disponible y por confirmar; título que coincide con varias → `choose`; base caída → 503 (SC-005)
- [x] T016 [US3] Respuestas `answer` y `unconfirmed` (precio, acceso, fin, duración, `step_free`, `accessible_toilet` con fuente y fecha) en `S/src/domain/alforjita.js`, leyendo la accesibilidad del repositorio de sedes del spec 003
- [x] T017 [US3] Falla del servicio en `W/js/alforjita.js`: sin respuesta, `5xx` o más de 8 s → «No pude consultar la programación» con «Ir a la Agenda» (FR-014)

## Phase 6: User Story 4 - Límites del asistente (P1)

**Goal**: rechazar lo que no le toca, con la pantalla adecuada, y sin tocar datos privados.

**Independent Test**: intentar cada acción prohibida y comprobar el rechazo.

- [x] T018 [P] [US4] Pruebas `S/test/integration/alforjita.test.js` (cuarta parte): comprar, canjear, «mis entradas», «mis sellos», «mi progreso», cambiar la programación y datos de otra persona → `out_of_scope` con enlaces; Pasaporte y rutas → `info` con `/pasaporte` y `/rutas`; un borrador, una versión pendiente y una archivada con títulos únicos nunca aparecen; la respuesta no contiene el texto escrito (SC-006)
- [x] T019 [P] [US4] Prueba de registro en `S/test/integration/alforjita.test.js`: app construida con un registro capturado; una frase única no aparece en el registro ni en ninguna tabla tras preguntarla (SC-012)
- [x] T020 [US4] Ruta `/rutas` en `W/app.js` con `pantallaProximamente` («Llega con el spec 007»)

## Phase 7: User Story 5 - Preguntas rápidas fijas (P3)

**Goal**: preguntas fijas cuyo resultado cambia con la programación publicada.

**Independent Test**: cambiar la programación publicada y repetir la pregunta.

- [x] T021 [US5] Prueba `S/test/integration/alforjita.test.js`: publicar un cambio (cancelar o reprogramar una función) cambia la respuesta de `today` y de `changes` sin tocar Alforjita (SC-009)

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T022 [P] Prueba de punta a punta `app/edge/test/e2e-alforjita.test.js`: pregunta por la entrada común sin sesión, compara con `/api/programacion/agenda` y comprueba que la Agenda responde aunque Alforjita reciba una consulta inválida (SC-002, SC-008)
- [x] T023 [P] Comprobación de humo en `.github/scripts/humo-contenedores.sh`: `POST /api/programacion/assistant/answers` con `{"quick":"today"}` responde 200
- [x] T024 [P] Documentación: `docs/arquitectura/02-servicios.md` (ruta de Alforjita) y `README.md` (Alforjita en la lista de funciones)
- [x] T025 Verificación en Chrome sin ventana a 360 px y 1440 px: abrir, usar y cerrar solo con teclado; sin desplazamiento horizontal; sin peticiones de ubicación; resultados en `quickstart.md` (SC-007)
- [ ] T026 `npm test` completo en verde y revisión de SonarCloud tras subir el PR
- [ ] T027 PR de `008-alforjita` hacia `main` (sin fusionar; lo fusiona el equipo)

## Dependencies & Execution Order

- Setup (T001) → Foundational (T002–T005) → historias.
- US1 es el MVP. US2, US3 y US4 dependen de T004 y pueden ir en cualquier orden; las tres comparten `S/src/domain/alforjita.js` y `S/test/integration/alforjita.test.js`, así que se hacen en serie.
- La web (T008–T011, T014, T017, T020) puede avanzar en paralelo al dominio una vez fijado el contrato.
- Polish al final.
