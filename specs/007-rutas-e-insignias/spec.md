# Feature Specification: Rutas culturales e insignias

**Feature Branch**: `007-rutas-e-insignias`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Spec 07 de 8 de VIVART: rutas culturales e insignias. Cubre RF-28 a RF-30. Sin plan técnico ni implementación."

## Alcance y límites

Este spec define cómo se anima al público a explorar distintas propuestas a partir de los sellos que ya colecciona: la creación y publicación de rutas por el administrador, la consulta pública de las rutas, el progreso de cada usuario en cada ruta y el desbloqueo de insignias.

**Dentro de este spec:** RF-28, RF-29 y RF-30; decisiones M-01 (el progreso con denominador pertenece a cada ruta, no al pasaporte) y la regla de que una franja no cuenta para rutas; verificaciones RNF-04 y RNF-06 en lo que toca a rutas e insignias.

**Fuera de este spec** (solo son dependencias):

- Los sellos, su canje y la colección (spec 06): este spec solo **cuenta** sellos ya obtenidos.
- Las funciones y sus cambios (spec 02) y la cuenta (spec 001).
- Mapa (03), Mi recorrido (04), compra (05) y Alforjita (08).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar las rutas (Priority: P1)

Un visitante, con o sin cuenta, abre la pestaña Pasaporte, ve las rutas públicas y sus funciones, y sabe cuántos sellos pide cada ruta.

**Why this priority**: es el gancho público de la ruta; invita a coleccionar sellos.

**Independent Test**: sin sesión, se abre una ruta publicada y se ven sus funciones y su meta.

**Acceptance Scenarios**:

1. **Given** rutas publicadas, **When** un visitante sin cuenta abre Pasaporte, **Then** ve las rutas públicas y sus funciones.
2. **Given** una ruta, **When** se abre, **Then** muestra su descripción, sus funciones elegibles, su meta y su insignia.
3. **Given** una ruta no publicada, **When** un visitante busca rutas, **Then** no aparece.
4. **Given** un visitante sin cuenta, **When** intenta ver su progreso, **Then** se le pide identificarse; las rutas siguen visibles.
5. **Given** una función elegible cancelada, **When** se muestra la ruta, **Then** se indica su estado cancelado.

---

### User Story 2 - Ver mi progreso en una ruta (Priority: P1)

Un usuario registrado ve cuántos sellos distintos de funciones elegibles ha reunido en una ruta, con el denominador de esa ruta (por ejemplo, «2 de 3»), y qué funciones le faltan.

**Why this priority**: es lo que motiva a continuar.

**Independent Test**: con dos de tres sellos de una ruta, se consulta el progreso y se verifica que se muestra «2 de 3».

**Acceptance Scenarios**:

1. **Given** un usuario con sellos de funciones elegibles, **When** abre la ruta, **Then** ve su progreso con el denominador de la ruta (por ejemplo, «2 de 3»).
2. **Given** dos sellos de la misma función, **When** se calcula, **Then** cuenta uno solo: se cuentan sellos distintos.
3. **Given** un sello de una función no elegible, **When** se calcula, **Then** no suma.
4. **Given** una ruta, **When** se muestra el progreso, **Then** marca qué funciones ya tienen sello y cuáles faltan.
5. **Given** el pasaporte del usuario, **When** se consulta, **Then** el denominador «de N» pertenece solo a cada ruta, no al total de sellos (spec 06).
6. **Given** un sello obtenido de una función que luego deja de ser elegible, **When** se consulta la ruta, **Then** el comportamiento queda sujeto a clarificación (FR-020).

---

### User Story 3 - Desbloquear la insignia (Priority: P1)

Al alcanzar la meta de una ruta, el usuario obtiene su insignia una sola vez, y la ve en el apartado Insignias de Pasaporte.

**Why this priority**: es la recompensa final y el cierre del ciclo.

**Independent Test**: se reúnen los sellos requeridos y se verifica que se otorga la insignia una vez, aun con dos solicitudes simultáneas.

**Acceptance Scenarios**:

1. **Given** un usuario que alcanza la meta con su último sello, **When** se calcula el progreso, **Then** obtiene la insignia de esa ruta.
2. **Given** una insignia ya obtenida, **When** se vuelve a alcanzar o recalcular la meta, **Then** no se otorga otra vez.
3. **Given** dos solicitudes simultáneas que completan la meta, **When** se procesan, **Then** se otorga una sola insignia.
4. **Given** el apartado Insignias, **When** el usuario lo abre, **Then** ve solo sus propias insignias.
5. **Given** una ruta cuya meta ya no es alcanzable, **When** se consulta, **Then** el comportamiento queda sujeto a clarificación (FR-020).

---

### User Story 4 - El administrador crea y publica rutas (Priority: P2)

El administrador crea una ruta, selecciona las funciones elegibles, establece una meta alcanzable, asigna la insignia y la publica.

**Why this priority**: sin rutas no hay progreso ni insignias; depende de que existan sellos y funciones habilitadas.

**Independent Test**: se crea una ruta con tres funciones elegibles y meta 3, se publica y se verifica que aparece en el Pasaporte.

**Acceptance Scenarios**:

1. **Given** funciones con Pasaporte habilitado, **When** el administrador crea una ruta, **Then** puede seleccionarlas como elegibles.
2. **Given** una función sin Pasaporte habilitado o una franja de apertura, **When** se intenta seleccionar, **Then** no es elegible.
3. **Given** una meta mayor al número de funciones elegibles, **When** se intenta guardar, **Then** el sistema la rechaza por no ser alcanzable.
4. **Given** una ruta completa, **When** el administrador la publica, **Then** aparece en Pasaporte.
5. **Given** una ruta publicada, **When** el administrador la edita, **Then** las insignias ya ganadas no se retiran automáticamente.
6. **Given** un usuario sin rol de administrador, **When** intenta gestionar rutas, **Then** el sistema lo rechaza.

### Edge Cases

- Una ruta con una sola función elegible y meta 1.
- Una ruta cuya función elegible se cancela o pierde su canje por una reprogramación.
- Una ruta editada después de que un usuario ganó su insignia.
- Un usuario con sellos de una ruta que aún no se publicó.
- Dos rutas que comparten funciones: un sello puede contar en ambas.
- Un usuario que alcanza la meta de dos rutas con el mismo sello.
- La actividad permanente con franjas: no cuenta; solo cuenta una función puntual con sello.
- Un usuario sin sellos: progreso de 0 en cada ruta.
- Una ruta sin insignia asignada: no puede publicarse.

## Requirements *(mandatory)*

### Functional Requirements

**Administración**

- **FR-001**: El administrador DEBE poder crear y publicar rutas, seleccionar funciones elegibles, establecer una meta alcanzable y asignar la insignia.
- **FR-002**: Solo las funciones con Pasaporte habilitado DEBEN poder ser elegibles; una franja de apertura NO DEBE ser elegible ni contar para rutas.
- **FR-003**: El sistema DEBE rechazar una meta mayor al número de funciones elegibles de la ruta.
- **FR-004**: El sistema NO DEBE permitir publicar una ruta sin insignia asignada ni sin funciones elegibles.
- **FR-005**: Solo el administrador DEBE poder crear, editar y publicar rutas, incluso con solicitudes directas.
- **FR-006**: Editar una ruta NO DEBE retirar automáticamente insignias ya ganadas.
- **FR-007**: Los cambios sobre rutas e insignias DEBEN quedar en el historial (RC-06).

**Consulta pública**

- **FR-008**: El visitante DEBE poder consultar las rutas públicas y sus funciones sin cuenta.
- **FR-009**: La ruta DEBE mostrar descripción, funciones elegibles, meta e insignia.
- **FR-010**: Una ruta no publicada NO DEBE ser visible para el público.
- **FR-011**: Una función elegible cancelada DEBE mostrarse como cancelada en la ruta.

**Progreso**

- **FR-012**: El usuario registrado DEBE poder ver su progreso en cada ruta con el denominador de esa ruta (por ejemplo, «2 de 3»).
- **FR-013**: El progreso DEBE calcularse solo con sellos distintos de funciones elegibles de esa ruta; dos sellos de la misma función cuentan una vez y un sello de una función no elegible no suma.
- **FR-014**: El progreso DEBE marcar qué funciones elegibles ya tienen sello y cuáles faltan.
- **FR-015**: El denominador «de N» DEBE pertenecer a cada ruta, y NO DEBE mostrarse en «Mi pasaporte» como meta global.
- **FR-016**: Un visitante sin cuenta DEBE identificarse para ver su progreso, y NO DEBE perder el acceso a las rutas públicas.

**Insignias**

- **FR-017**: Al alcanzar la meta, el usuario DEBE obtener la insignia de la ruta una sola vez.
- **FR-018**: Dos solicitudes simultáneas que completan la meta NO DEBEN otorgar la insignia dos veces (RC-05).
- **FR-019**: El usuario DEBE ver solo sus propias insignias en el apartado Insignias.

**Decisiones pendientes**

- **FR-020**: Cuando una función elegible se cancela o deja de tener canje habilitado y la meta deja de ser alcanzable, la ruta DEBE comportarse así: [NEEDS CLARIFICATION: el contexto exige una meta alcanzable al crear la ruta, pero no define qué ocurre si después una función elegible se cancela o pierde su canje, ni qué ocurre con el progreso ya acumulado].
- **FR-021**: Las imágenes y textos de rutas e insignias son [NEEDS CLARIFICATION: el contexto no define quién produce los recursos visuales de las rutas y las insignias ni qué formatos admite].

### Key Entities

- **Ruta cultural**: conjunto publicado de funciones elegibles con meta e insignia.
- **Función elegible**: función con Pasaporte habilitado incluida en una ruta.
- **Meta**: cantidad de sellos distintos requerida; alcanzable respecto a las funciones elegibles.
- **Progreso**: sellos distintos de funciones elegibles reunidos por un usuario en una ruta.
- **Insignia**: reconocimiento obtenido una sola vez al alcanzar la meta.
- **Colección de insignias**: insignias de un usuario.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un visitante sin cuenta consulta rutas públicas, funciones, meta e insignia en el 100 % de las pruebas, y 0 rutas no publicadas son visibles.
- **SC-002**: El progreso de una ruta cuenta exactamente los sellos distintos de funciones elegibles: 0 sellos duplicados, 0 de funciones no elegibles.
- **SC-003**: «Mi pasaporte» muestra 0 denominadores globales, y el 100 % de las rutas muestra el suyo.
- **SC-004**: Al alcanzar la meta, el 100 % de los usuarios obtiene la insignia exactamente 1 vez, también con solicitudes simultáneas.
- **SC-005**: Editar una ruta retira 0 insignias ya ganadas.
- **SC-006**: 0 franjas de apertura son elegibles ni suman al progreso.
- **SC-007**: El 100 % de las metas rechazadas es mayor al número de funciones elegibles.
- **SC-008**: 0 usuarios sin rol de administrador consiguen crear o publicar rutas, ni con solicitudes directas.
- **SC-009**: 0 usuarios ven el progreso o las insignias de otra cuenta.
- **SC-010**: El 100 % de los cambios de rutas queda en el historial.

## Trazabilidad con el contexto

| Contexto | Cubierto por |
|---|---|
| RF-28 | FR-001 a FR-007; Historia 4 |
| RF-29, M-01 | FR-008 a FR-016; Historias 1 y 2 |
| RF-30 | FR-017 a FR-019; Historia 3 |
| RC-05, RNF-06 | FR-013, FR-018; SC-002, SC-004 |
| RNF-04 | FR-005, FR-009, FR-019; SC-008, SC-009 |

## Assumptions

- Los sellos y su canje vienen del spec 06; las funciones y sus cambios, del spec 02; la cuenta, del spec 001.
- La pantalla de Rutas tiene mockup solo como referencia visual; el requisito prevalece sobre cualquier cifra del mockup.
- Una función puede pertenecer a más de una ruta; el contexto no lo prohíbe.
- Una ruta es de consulta pública; su progreso, por cuenta.
