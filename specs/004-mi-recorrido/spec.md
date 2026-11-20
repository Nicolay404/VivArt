# Feature Specification: Mi recorrido y alternativas

**Feature Branch**: `004-mi-recorrido`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Spec 04 de 8 de VIVART: Mi recorrido y alternativas. Cubre RF-16 a RF-18, con RC-02, RC-03 y RC-06. Sin plan técnico ni implementación."

## Alcance y límites

Este spec define cómo el visitante organiza su visita: guardar funciones o franjas sin cuenta, verlas ordenadas por horario, recibir advertencias de cruces y de cambios, y encontrar alternativas cuando una función guardada se cancela, ya empezó o se agota.

**Dentro de este spec:** RF-16, RF-17 y RF-18; reglas RC-02 (cruces), RC-03 (función sin hora de fin), RC-06 (aviso público) y RC-07 (reloj de referencia); decisión P-05 (Mi recorrido se queda en el navegador); verificaciones RNF-01 y RNF-08 en lo que toca al recorrido.

**Fuera de este spec** (solo son dependencias):

- La programación, las fichas y los avisos de cambio que publica el equipo (spec 02).
- Identidad, cuentas y permisos (spec 001): Mi recorrido no usa cuenta.
- Compra de entradas y agotamiento de cupos (spec 05): este spec solo reacciona a que una función esté agotada.
- Mapa (03), Pasaporte (06), rutas (07) y Alforjita (08).
- Cualquier sincronización entre dispositivos: no existe en el MVP.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Guardar y ordenar mi recorrido (Priority: P1)

Un visitante guarda funciones o franjas desde la Agenda, las quita, y las ve ordenadas por horario en Mi recorrido, sin crear una cuenta.

**Why this priority**: es el propósito del bloque y la base de las demás historias.

**Independent Test**: sin sesión, se guardan tres funciones, se cierra y se reabre el navegador, y se comprueba que siguen guardadas y ordenadas.

**Acceptance Scenarios**:

1. **Given** una ficha, **When** el visitante la guarda, **Then** aparece en Mi recorrido sin pedir cuenta.
2. **Given** funciones guardadas, **When** abre Mi recorrido, **Then** las ve ordenadas por horario.
3. **Given** una función guardada, **When** la quita, **Then** desaparece de Mi recorrido.
4. **Given** el visitante cierra y reabre el mismo navegador, **When** abre Mi recorrido, **Then** conserva sus funciones guardadas.
5. **Given** la acción de guardar, **When** se muestra, **Then** informa que guardar no reserva cupo.
6. **Given** una franja de apertura, **When** se guarda, **Then** puede guardarse igual que una función.
7. **Given** el visitante inicia sesión, **When** abre Mi recorrido, **Then** su recorrido sigue en el navegador: iniciar sesión no lo sincroniza ni lo asocia a la cuenta.

---

### User Story 2 - Advertencia de cruces (Priority: P1)

Cuando dos funciones guardadas se solapan y ambos intervalos se conocen, Mi recorrido lo advierte, sin impedir guardarlas.

**Why this priority**: evita que el visitante planee algo imposible.

**Independent Test**: se guardan dos funciones que se solapan y una de hora desconocida y se comprueba que solo el primer caso se advierte.

**Acceptance Scenarios**:

1. **Given** dos funciones con inicio y fin conocidos que se solapan, **When** se ven en Mi recorrido, **Then** se advierte el cruce.
2. **Given** una función cuyo fin se desconoce, **When** se compara con otra, **Then** no se advierte cruce, porque el intervalo no se conoce (RC-02).
3. **Given** una advertencia de cruce, **When** el visitante quiere guardar ambas, **Then** puede hacerlo: la advertencia nunca bloquea.
4. **Given** el cruce entre una franja y una función, **When** ambos intervalos se conocen, **Then** se advierte.

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

---

### User Story 4 - Alternativas cuando algo falla (Priority: P2)

Ante una función cancelada, con «Hora de inicio pasada», terminada o agotada, Mi recorrido sugiere funciones que aún no comiencen, priorizando la misma sede y luego sedes cercanas si hay datos suficientes.

**Why this priority**: ayuda a recomponer el plan, pero depende de que los cambios y avisos ya funcionen.

**Independent Test**: con una función cancelada y otra agotada, se comprueba que las sugerencias son funciones futuras de la misma sede primero.

**Acceptance Scenarios**:

1. **Given** una función cancelada, **When** el visitante abre sus alternativas, **Then** se sugieren funciones que aún no comienzan.
2. **Given** alternativas disponibles en la misma sede, **When** se sugieren, **Then** esas aparecen primero.
3. **Given** que no hay alternativas en la misma sede y hay datos suficientes, **When** se sugieren, **Then** se ofrecen funciones de sedes cercanas.
4. **Given** una función cuya hora de inicio ya pasó y no tiene hora de fin, **When** se sugieren alternativas, **Then** se indica «Hora de inicio pasada» y no se afirma que la original terminó (RC-03).
5. **Given** una función agotada, **When** se abren sus alternativas, **Then** se sugieren funciones futuras que no estén canceladas.
6. **Given** que no hay ninguna alternativa, **When** se abren, **Then** se muestra un mensaje de sin resultados y se ofrece volver a la Agenda.
7. **Given** una sugerencia, **When** el visitante la elige, **Then** puede conservar la original, quitarla o sustituirla.

### Edge Cases

- Un recorrido vacío.
- Datos del navegador borrados: el recorrido se pierde, porque vive solo en el navegador; el visitante puede volver a guardar.
- Una función guardada que el equipo archiva o retira de la programación activa.
- Una función guardada sin hora de fin (por ejemplo, «Lo que Somos»): no se advierte cruce y se muestra «Hora de inicio pasada» cuando corresponde.
- La misma función guardada dos veces.
- Muchas funciones guardadas.
- Un dispositivo con almacenamiento local bloqueado: el recorrido no puede guardarse y se informa.
- Una función reprogramada que queda cruzada con otra.
- Una hora de referencia fijada en pruebas o demo (RC-07).

## Requirements *(mandatory)*

### Functional Requirements

**Guardar y ordenar**

- **FR-001**: El sistema DEBE permitir guardar y quitar funciones o franjas sin cuenta.
- **FR-002**: El sistema DEBE conservar el recorrido en el mismo navegador y ordenarlo por horario.
- **FR-003**: El sistema DEBE informar que guardar no reserva cupo.
- **FR-004**: Mi recorrido DEBE quedarse en el navegador: iniciar sesión NO DEBE sincronizarlo ni asociarlo a la cuenta, y el MVP NO DEBE sincronizarlo entre dispositivos.
- **FR-005**: Mi recorrido DEBE ser accesible desde la Agenda.

**Cruces**

- **FR-006**: El sistema DEBE advertir un cruce cuando ambos intervalos se conocen.
- **FR-007**: La advertencia de cruce NO DEBE bloquear guardar.
- **FR-008**: El sistema NO DEBE advertir un cruce cuando alguno de los dos intervalos no se conoce.

**Cambios y cancelaciones**

- **FR-009**: Mi recorrido DEBE reflejar los cambios de hora y de sede de las funciones guardadas, con el aviso del cambio.
- **FR-010**: Una función cancelada DEBE permanecer visible en Mi recorrido con su aviso hasta que el visitante la quite.
- **FR-011**: Los cruces DEBEN recalcularse cuando cambie la hora de una función guardada.

**Alternativas**

- **FR-012**: Ante una función cancelada, con «Hora de inicio pasada», terminada o agotada, el sistema DEBE sugerir funciones que aún no comiencen y no estén canceladas.
- **FR-013**: El sistema DEBE priorizar las funciones de la misma sede y, después, las de sedes cercanas si hay datos suficientes.
- **FR-014**: El sistema NO DEBE afirmar que una función terminó si no se sabe: «Terminada» solo se muestra con hora de fin, una duración conocida que permita calcularla o una confirmación operativa explícita (RC-03).
- **FR-015**: El sistema DEBE permitir conservar, quitar o sustituir la función original al elegir una alternativa.
- **FR-016**: Mi recorrido DEBE usar la misma referencia de fecha y hora, en hora de Loja, que la Agenda, y que pueda fijarse en pruebas y demo (RC-07).

**Decisiones pendientes**

- **FR-017**: Una sede se considera «cercana» a otra cuando [NEEDS CLARIFICATION: el contexto no define cómo se determina la cercanía ni qué datos son «suficientes»; el mapa no es fuente de coordenadas exactas].
- **FR-018**: Una función guardada que el equipo archiva o retira de la programación activa DEBE tratarse así en Mi recorrido: [NEEDS CLARIFICATION: el contexto no define si desaparece, queda con un aviso o se oculta].

### Key Entities

- **Recorrido**: conjunto de funciones y franjas guardadas por un visitante en su navegador, ordenado por horario.
- **Elemento guardado**: una función o una franja con su estado (vigente, cambiada, cancelada).
- **Cruce**: solapamiento entre dos intervalos conocidos.
- **Alternativa**: función futura no cancelada sugerida para sustituir una afectada.
- **Aviso de cambio**: mensaje público de reprogramación o cancelación (spec 02).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un visitante sin cuenta guarda, quita y consulta funciones, y el 100 % de las funciones guardadas sigue en Mi recorrido tras cerrar y reabrir el mismo navegador.
- **SC-002**: En el 100 % de las pruebas, el recorrido aparece ordenado por horario.
- **SC-003**: En el 100 % de los casos con intervalos conocidos que se solapan, se advierte el cruce; en el 100 % de los casos con algún intervalo desconocido, no.
- **SC-004**: 0 advertencias de cruce impiden guardar una función.
- **SC-005**: El 100 % de los cambios de hora o de sede se refleja en Mi recorrido con su aviso, y el 100 % de las canceladas permanece visible hasta que el visitante la quita.
- **SC-006**: En el 100 % de las pruebas, las alternativas son funciones que aún no comienzan y no están canceladas, con la misma sede primero.
- **SC-007**: 0 funciones con solo hora de inicio se muestran como «terminada» sin una hora de fin, una duración conocida o una confirmación operativa.
- **SC-008**: Tras iniciar sesión, el 100 % del recorrido sigue solo en el navegador y no aparece asociado a la cuenta.

## Trazabilidad con el contexto

| Contexto | Cubierto por |
|---|---|
| RF-16, P-05 | FR-001 a FR-005; Historia 1 |
| RF-17, RC-02 | FR-006 a FR-011; Historias 2 y 3 |
| RF-18, RC-03 | FR-012 a FR-015; Historia 4 |
| RC-07 | FR-016 |
| RNF-01 | FR-005; SC-001 |
| RNF-08 | FR-014; SC-007 |

## Assumptions

- Mi recorrido se guarda solo en el navegador del visitante; no hay cuenta ni sincronización.
- Las funciones, franjas, avisos y estados vienen del spec 02; el estado «agotada» viene del spec 05.
- Hoy existe solo el acceso a Mi recorrido desde la Agenda en el mockup; la pantalla de Mi recorrido no tiene mockup.
- Un recorrido se pierde si se borran los datos del navegador; esto no se considera un defecto.
