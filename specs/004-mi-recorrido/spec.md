# Feature Specification: Mi recorrido y alternativas

**Feature Branch**: `004-mi-recorrido`

**Created**: 2026-11-19

**Status**: Specified

**Input**: User description: "Spec 04 de 8 de VIVART: Mi recorrido y alternativas. Cubre RF-16 a RF-18, con RC-02, RC-03 y RC-06. Sin plan técnico ni implementación."

## Clarifications

### Session 2026-11-20

- Q: ¿Qué alternativas se sugieren y qué se entiende por sedes cercanas? → A: Solo funciones publicadas, no canceladas y que aún no hayan comenzado en la misma sede. Si no hay alternativas, se ofrece volver a la Agenda. En el MVP no se calculan distancias ni se mantiene una lista de sedes vecinas.
- Q: ¿Qué pasa con una función guardada que se archiva? → A: Permanece en Mi recorrido hasta que el visitante la quite. Se muestra que ya no está en la programación activa y, si fue cancelada, se conserva el aviso de cancelación.

### Session 2026-11-21

- Q: ¿Cómo se detecta si una función está agotada y cómo se maneja si el servicio de venta falla? → A: Se consulta el estado público de venta en `/api/participacion/sale-status?functionIds=...` (spec 005). Si devuelve `state: "sold_out"`, se muestran alternativas de la misma sede; si el servicio de participación no responde o falla, Mi recorrido sigue funcionando con degradación suave sin bloquearse y sin mostrar el estado de agotada.
- Q: ¿Cómo persisten en el navegador las funciones que el equipo archiva posteriormente? → A: Mi recorrido guarda en `localStorage` un registro con los datos mínimos al guardar (ID de función, ID de actividad, título, fecha, horarios, nombre y tipo de sede, `venueId` y avisos previos). Al consultar la programación, si una función guardada ya no aparece en la API o devuelve 404 (actividad archivada), se conserva en el recorrido mostrando «Ya no está en la programación activa» (y su aviso si fue cancelada) hasta que el visitante la quite explícitamente (FR-018).
- Q: ¿Desde dónde se guarda una función o franja y cuál es la ruta y acceso a Mi recorrido? → A: Cada función o franja individual puede guardarse o quitarse desde su ficha (`/actividad/{id}`) y desde la Agenda cuando la función sea unívoca, mostrando siempre el mensaje «Guardar no reserva cupo». El recorrido tiene la ruta pública `/recorrido` y es accesible mediante un botón dedicado en la cabecera de la Agenda y en la navegación principal.
- Q: ¿Cuándo se considera que dos funciones se cruzan en horario (RC-02)? → A: Hay cruce solo si ambas funciones ocurren en la misma fecha y sus intervalos conocidos se solapan (`inicioA < finB` e `inicioB < finA`). Si una termina exactamente cuando la otra inicia (p. ej. 10:00–11:00 y 11:00–12:00), no hay cruce. Si alguna carece de hora de fin o duración conocida, nunca se advierte cruce (RC-02, FR-008). La advertencia nunca bloquea guardar.
- Q: ¿Qué opciones se ofrecen al seleccionar una alternativa para una función afectada (FR-015)? → A: Al abrir alternativas en la misma sede (para funciones canceladas, agotadas, terminadas o con inicio pasado), el visitante puede elegir «Sustituir» (que quita la original y guarda la alternativa atómicamente), «Conservar ambas» (agrega la alternativa sin quitar la original) o volver a la Agenda si no desea cambios o no hay alternativas.

## Alcance y límites

Este spec define cómo el visitante organiza su visita: guardar funciones o franjas sin cuenta, verlas ordenadas por horario, recibir advertencias de cruces y de cambios, y encontrar alternativas cuando una función guardada se cancela, ya empezó o se agota.

**Dentro de este spec:** RF-16, RF-17 y RF-18; reglas RC-02 (cruces), RC-03 (función sin hora de fin), RC-06 (aviso público) y RC-07 (reloj de referencia); decisión P-05 (Mi recorrido se queda en el navegador); verificaciones RNF-01 y RNF-08 en lo que toca al recorrido.

**Fuera de este spec** (solo son dependencias):

- La programación, las fichas y los avisos de cambio que publica el equipo (spec 02).
- Identidad, cuentas y permisos (spec 001): Mi recorrido no usa cuenta.
- Compra de entradas y agotamiento de cupos (spec 05): este spec solo reacciona a que una función esté agotada consultando `/api/participacion/sale-status`.
- Mapa (03), Pasaporte (06), rutas (07) y Alforjita (08).
- Cualquier sincronización entre dispositivos: no existe en el MVP.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Guardar y ordenar mi recorrido (Priority: P1)

Un visitante guarda funciones o franjas desde la Agenda o desde la ficha de actividad, las quita, y las ve ordenadas por horario en Mi recorrido (`/recorrido`), sin crear una cuenta.

**Why this priority**: es el propósito del bloque y la base de las demás historias.

**Independent Test**: sin sesión, se guardan tres funciones, se cierra y se reabre el navegador, y se comprueba que siguen guardadas y ordenadas.

**Acceptance Scenarios**:

1. **Given** una ficha o función en la Agenda, **When** el visitante la guarda, **Then** aparece en Mi recorrido sin pedir cuenta.
2. **Given** funciones guardadas, **When** abre Mi recorrido (`/recorrido`), **Then** las ve ordenadas por horario cronológico.
3. **Given** una función guardada, **When** la quita, **Then** desaparece de Mi recorrido.
4. **Given** el visitante cierra y reabre el mismo navegador, **When** abre Mi recorrido, **Then** conserva sus funciones guardadas en `localStorage`.
5. **Given** la acción de guardar, **When** se muestra, **Then** informa que guardar no reserva cupo.
6. **Given** una franja de apertura, **When** se guarda, **Then** puede guardarse igual que una función.
7. **Given** el visitante inicia sesión, **When** abre Mi recorrido, **Then** su recorrido sigue en el navegador: iniciar sesión no lo sincroniza ni lo asocia a la cuenta.

---

### User Story 2 - Advertencia de cruces (Priority: P1)

Cuando dos funciones guardadas se solapan en la misma fecha y ambos intervalos se conocen, Mi recorrido lo advierte, sin impedir guardarlas.

**Why this priority**: evita que el visitante planee algo imposible.

**Independent Test**: se guardan dos funciones que se solapan y una de hora desconocida y se comprueba que solo el primer caso se advierte.

**Acceptance Scenarios**:

1. **Given** dos funciones en la misma fecha con inicio y fin conocidos que se solapan (`inicioA < finB` y `inicioB < finA`), **When** se ven en Mi recorrido, **Then** se advierte el cruce.
2. **Given** dos funciones consecutivas donde una termina justo cuando la otra inicia (`finA == inicioB`), **When** se evalúan, **Then** no se advierte cruce.
3. **Given** una función cuyo fin se desconoce, **When** se compara con otra, **Then** no se advierte cruce, porque el intervalo no se conoce (RC-02).
4. **Given** una advertencia de cruce, **When** el visitante quiere guardar ambas, **Then** puede hacerlo: la advertencia nunca bloquea.
5. **Given** el cruce entre una franja y una función, **When** ambos intervalos se conocen, **Then** se advierte.

---

### User Story 3 - Cambios y cancelaciones reflejados (Priority: P1)

Si una función guardada cambia de hora o de sede, Mi recorrido muestra los datos nuevos. Si se cancela, sigue visible con su aviso hasta que el visitante la quite.

**Why this priority**: la programación cambia durante el festival; un recorrido desactualizado perjudica al visitante.

**Independent Test**: se guarda una función, se reprograma y se cancela otra, y se abre Mi recorrido.

**Acceptance Scenarios**:

1. **Given** una función guardada que cambia de hora, **When** se abre Mi recorrido, **Then** muestra la hora nueva y el aviso del cambio.
2. **Given** una función guardada que cambia de sede, **When** se abre Mi recorrido, **Then** muestra la sede nueva y el aviso.
3. **Given** una función guardada que se cancela, **When** se abre Mi recorrido, **Then** sigue visible con su aviso de cancelación.
4. **Given** una función cancelada en Mi recorrido, **When** el visitante la quita, **Then** desaparece.
5. **Given** un cambio de hora que genera o elimina un cruce, **When** se abre Mi recorrido, **Then** la advertencia de cruce se actualiza.
6. **Given** una función guardada que el equipo archiva, **When** se abre Mi recorrido, **Then** permanece visible con la indicación de que ya no está en la programación activa, hasta que el visitante la quite.
7. **Given** una función archivada que había sido cancelada, **When** se abre Mi recorrido, **Then** conserva además su aviso de cancelación.

---

### User Story 4 - Alternativas cuando algo falla (Priority: P2)

Ante una función cancelada, con «Hora de inicio pasada», terminada o agotada, Mi recorrido sugiere funciones de la misma sede que aún no comiencen. En el MVP no se sugieren sedes cercanas.

**Why this priority**: ayuda a recomponer el plan, pero depende de que los cambios y avisos ya funcionen.

**Independent Test**: con una función cancelada y otra agotada, se comprueba que las sugerencias son funciones futuras de la misma sede primero.

**Acceptance Scenarios**:

1. **Given** una función cancelada, **When** el visitante abre sus alternativas, **Then** se sugieren funciones que aún no comienzan.
2. **Given** alternativas disponibles, **When** se sugieren, **Then** todas son funciones publicadas, no canceladas y que aún no han comenzado, de la misma sede que la función afectada.
3. **Given** que no hay alternativas en la misma sede, **When** se sugieren, **Then** no se ofrecen funciones de otras sedes y se ofrece volver a la Agenda.
4. **Given** una función cuya hora de inicio ya pasó y no tiene hora de fin, **When** se sugieren alternativas, **Then** se indica «Hora de inicio pasada» y no se afirma que la original terminó (RC-03).
5. **Given** una función con venta agotada según `/api/participacion/sale-status`, **When** se abren sus alternativas, **Then** se sugieren funciones futuras de la misma sede que no estén canceladas.
6. **Given** que no hay ninguna alternativa, **When** se abren, **Then** se muestra un mensaje de sin resultados y se ofrece volver a la Agenda.
7. **Given** una sugerencia, **When** el visitante la elige, **Then** puede optar por «Sustituir» (quitando la original y guardando la alternativa atómicamente) o «Conservar ambas».

### Edge Cases

- Un recorrido vacío: muestra mensaje claro y botón para explorar la Agenda.
- Datos del navegador borrados: el recorrido se pierde, porque vive solo en el navegador; el visitante puede volver a guardar.
- Almacenamiento local bloqueado o lleno: se informa al usuario que no se pudo guardar el recorrido localmente.
- Una función guardada que el equipo archiva: permanece en Mi recorrido con los datos almacenados y la indicación de que ya no está en la programación activa.
- Una función guardada sin hora de fin (por ejemplo, «Lo que Somos»): no se advierte cruce y se muestra «Hora de inicio pasada» cuando corresponde.
- Intentar guardar la misma función dos veces: es idempotente, no se duplica en el recorrido.
- Muchas funciones guardadas: se ordenan cronológicamente y se pueden quitar individualmente o vaciar el recorrido.
- Una función reprogramada que queda cruzada con otra: recalcula y muestra la advertencia de cruce.
- Falla del servicio de participación al consultar estado de venta: degradación suave, la función se muestra normalmente sin bloquear ni mostrar estado de agotada.
- Una hora de referencia fijada en pruebas o demo (RC-07): Mi recorrido toma la misma referencia para evaluar si una función ya empezó o está por comenzar.

## Requirements *(mandatory)*

### Functional Requirements

**Guardar y ordenar**

- **FR-001**: El sistema DEBE permitir guardar y quitar funciones o franjas sin cuenta.
- **FR-002**: El sistema DEBE conservar el recorrido en el mismo navegador y ordenarlo por horario cronológico.
- **FR-003**: El sistema DEBE informar visiblemente que guardar no reserva cupo.
- **FR-004**: Mi recorrido DEBE quedarse en el navegador: iniciar sesión NO DEBE sincronizarlo ni asociarlo a la cuenta, y el MVP NO DEBE sincronizarlo entre dispositivos.
- **FR-005**: Mi recorrido DEBE ser accesible desde la Agenda y contar con la ruta `/recorrido`.

**Cruces**

- **FR-006**: El sistema DEBE advertir un cruce cuando dos funciones o franjas en la misma fecha tienen intervalos conocidos que se solapan (`inicioA < finB` e `inicioB < finA`).
- **FR-007**: La advertencia de cruce NO DEBE bloquear guardar.
- **FR-008**: El sistema NO DEBE advertir un cruce cuando alguno de los dos intervalos no se conoce o cuando una finaliza exactamente al iniciar la otra (`finA == inicioB`).

**Cambios y cancelaciones**

- **FR-009**: Mi recorrido DEBE reflejar los cambios de hora y de sede de las funciones guardadas, con el aviso del cambio.
- **FR-010**: Una función cancelada DEBE permanecer visible en Mi recorrido con su aviso hasta que el visitante la quite.
- **FR-011**: Los cruces DEBEN recalcularse cuando cambie la hora de una función guardada.

**Alternativas**

- **FR-012**: Ante una función cancelada, con «Hora de inicio pasada», terminada o agotada, el sistema DEBE sugerir funciones que aún no comiencen y no estén canceladas.
- **FR-013**: Las alternativas DEBEN ser solo funciones publicadas, no canceladas y que aún no hayan comenzado en la misma sede que la función afectada. Si no hay, el sistema DEBE ofrecer volver a la Agenda. El sistema NO DEBE calcular distancias ni mantener una lista de sedes vecinas en el MVP.
- **FR-014**: El sistema NO DEBE afirmar que una función terminó si no se sabe: «Terminada» solo se muestra con hora de fin, una duración conocida que permita calcularla o una confirmación operativa explícita (RC-03).
- **FR-015**: El sistema DEBE permitir conservar, quitar o sustituir la función original al elegir una alternativa.
- **FR-016**: Mi recorrido DEBE usar la misma referencia de fecha y hora, en hora de Loja, que la Agenda, y que pueda fijarse en pruebas y demo (RC-07).

**Alternativas, funciones archivadas e integración** (clarificaciones del 2026-11-20 y 2026-11-21)

- **FR-017**: El sistema NO DEBE considerar sedes cercanas en el MVP; las alternativas se limitan a la misma sede (FR-013).
- **FR-018**: Una función guardada que el equipo archiva DEBE permanecer en Mi recorrido hasta que el visitante la quite, DEBE indicar que ya no está en la programación activa y, si fue cancelada, DEBE conservar el aviso de cancelación.
- **FR-019**: El sistema DEBE consultar `/api/participacion/sale-status` para conocer si una función con venta está agotada (`sold_out`) y desplegar alternativas; ante indisponibilidad del servicio de participación, DEBE aplicar degradación suave sin interrumpir la consulta del recorrido.
- **FR-020**: El almacenamiento local de Mi recorrido DEBE guardar los datos esenciales de la función o franja (IDs, título, fecha, horas, sede y avisos) para garantizar su visualización si la actividad es archivada posteriormente.
- **FR-021**: Al seleccionar una alternativa, el sistema DEBE ofrecer la acción «Sustituir» (que atómicamente quita la función afectada y guarda la alternativa elegida) y «Conservar ambas».

### Key Entities

- **Recorrido**: conjunto de funciones y franjas guardadas por un visitante en su navegador, ordenado por horario cronológico.
- **Elemento guardado**: registro en almacenamiento local con ID de función/franja, ID de actividad, título, fecha, hora inicio, hora fin, sede y estado (vigente, cambiada, cancelada, archivada).
- **Cruce**: solapamiento horario estricto entre dos intervalos conocidos en la misma fecha (`inicioA < finB && inicioB < finA`).
- **Alternativa**: función de la misma sede, publicada, no cancelada y que aún no ha comenzado, sugerida para sustituir una afectada.
- **Aviso de cambio**: mensaje público de reprogramación o cancelación publicado por el equipo (spec 02).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un visitante sin cuenta guarda, quita y consulta funciones, y el 100 % de las funciones guardadas sigue en Mi recorrido tras cerrar y reabrir el mismo navegador.
- **SC-002**: En el 100 % de las pruebas, el recorrido aparece ordenado por horario cronológico.
- **SC-003**: En el 100 % de los casos con intervalos conocidos que se solapan en la misma fecha, se advierte el cruce; en el 100 % de los casos con algún intervalo desconocido o tangentes (`finA == inicioB`), no se advierte cruce.
- **SC-004**: 0 advertencias de cruce impiden guardar una función.
- **SC-005**: El 100 % de los cambios de hora o de sede se refleja en Mi recorrido con su aviso, y el 100 % de las canceladas permanece visible hasta que el visitante la quita.
- **SC-006**: En el 100 % de las pruebas, las alternativas son funciones publicadas que aún no comienzan, no están canceladas y son de la misma sede; 0 alternativas son de otra sede y, si no hay, se ofrece volver a la Agenda.
- **SC-007**: 0 funciones con solo hora de inicio se muestran como «terminada» sin una hora de fin, una duración conocida o una confirmación operativa.
- **SC-008**: Tras iniciar sesión, el 100 % del recorrido sigue solo en el navegador y no aparece asociado a la cuenta.
- **SC-009**: El 100 % de las funciones archivadas permanece en Mi recorrido con la indicación correspondiente hasta que el visitante la quite, y las canceladas conservan su aviso.
- **SC-010**: En el 100 % de los casos donde una función guardada esté agotada (`sold_out`), se despliega la opción de ver alternativas en la misma sede; y si el servicio de venta no responde, en el 100 % de los casos el recorrido se muestra sin error bloqueante.
- **SC-011**: Al pulsar «Sustituir» en una alternativa, en el 100 % de las pruebas la función original es removida y la alternativa queda guardada en un solo paso.

## Trazabilidad con el contexto

| Contexto | Cubierto por |
|---|---|
| RF-16, P-05 | FR-001 a FR-005, FR-020; Historia 1 |
| RF-17, RC-02, Q8 | FR-006 a FR-011, FR-018; Historias 2 y 3 |
| RF-18, RC-03, Q7 | FR-012 a FR-015, FR-017, FR-019, FR-021; Historia 4 |
| RC-07 | FR-016 |
| RNF-01 | FR-005; SC-001 |
| RNF-08 | FR-014; SC-007 |

## Assumptions

- Mi recorrido se guarda solo en el navegador del visitante (`localStorage`); no hay cuenta ni sincronización entre dispositivos.
- No se calculan distancias entre sedes en el MVP.
- Las funciones, franjas, avisos y estados vienen del spec 02; el estado «agotada» se consulta de `/api/participacion/sale-status` (spec 05).
- La pantalla de Mi recorrido sigue el sistema de diseño de `app/web/styles.css` (modo claro, violeta y atardecer, Bricolage Grotesque + Figtree).
- Un recorrido se pierde si se borran los datos del navegador; esto no se considera un defecto.
