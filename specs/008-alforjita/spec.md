# Feature Specification: Alforjita, asistente del festival

**Feature Branch**: `008-alforjita`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Spec 08 de 8 de VIVART: Alforjita, asistente del festival. Cubre RF-31 a RF-34, con RC-07. Sin plan técnico ni implementación."

## Clarifications

### Session 2026-11-20

- Q: ¿Cómo se formulan las consultas? → A: Con preguntas rápidas y con texto libre acotado, interpretado con reglas simples y sin exigir IA generativa. Debe poder resolver casos como «¿Qué funciones gratuitas de danza hay después de las seis?», indicar qué día asumió cuando corresponda y, si no entiende, ofrecer preguntas guiadas o volver a la Agenda. Las respuestas consultan el catálogo público vigente.
- Q: ¿Se pueden editar las preguntas rápidas? → A: No. En el MVP no hay un panel para editarlas: las preguntas rápidas son fijas, pero sus resultados cambian con la programación publicada.

### Session 2026-11-21

- Q: ¿Cómo se lee «después de las seis» y otras horas? → A: Una hora de 1 a 11 sin «de la mañana» o «am» se lee de tarde o noche («las seis» = 18:00), y la hora indicada cuenta («a las 18:00 o después»). «Mañana» sola es el día siguiente; «en la mañana» es antes de las 12:00, «en la tarde» de 12:00 a 17:59 y «en la noche» desde las 18:00. Para hoy solo salen funciones que aún no empiezan; un día ya pasado se indica como pasado y se ofrece consultar hoy u otro día (M-14).
- Q: ¿Cuáles son las preguntas rápidas? → A: «¿Qué hay hoy?», «¿Qué hay gratis hoy?», «¿Qué hay esta noche?», «¿Qué hay en una sede?» (se elige la sede), «¿Hubo cambios?» y «¿Cómo funcionan el Pasaporte y las rutas?» (M-15).
- Q: ¿Qué cuenta como «cambios»? → A: Las funciones de hoy en adelante con un aviso publicado de cancelación o reprogramación, la más reciente primero, sin ventana de horas (M-15).
- Q: ¿Cómo se muestran los resultados y cómo se comparan con la Agenda? → A: Cada resultado es una función (título, día, hora, sede y acceso) que enlaza a su ficha; como máximo 10, con «Ver todas en la Agenda» que abre la Agenda con los mismos filtros. La Agenda no gana un filtro por hora: la comparación se hace con los criterios que comparten (día, categoría, sede y acceso) (M-16).
- Q: ¿Qué entiende el texto libre? → A: Hasta 200 caracteres, sin distinguir tildes ni mayúsculas. Días («hoy», «mañana», «pasado mañana», nombres de día, «sábado 21»), horas («después de», «antes de», «en la mañana/tarde/noche»), categorías y sedes por su nombre en el catálogo, acceso («gratis», «gratuita», «de pago») y una obra por su título, como la búsqueda de la Agenda, para responder precio, hora de fin o duración (M-16).
- Q: ¿Qué páginas enlaza sobre Pasaporte y rutas? → A: Un texto breve y fijo que explica cómo funcionan (no repite datos de la programación) y un enlace a `/pasaporte`, donde el spec 007 muestra las rutas públicas también sin cuenta (M-16).
- Q: ¿Cómo es la ventana, sin mockup? → A: El botón «Pregúntale a Alforjita» está solo en la Agenda y abre un panel lateral en escritorio y a pantalla completa en celular. Esc cierra y el foco vuelve al botón. El avatar es un icono neutro, no la mascota, hasta que haya autorización (M-17).
- Q: ¿Se guarda la conversación? → A: No. Vive solo en la página abierta y se borra al cerrar o recargar; el servidor no guarda ni registra el texto escrito, porque podría contener datos personales (M-17).

## Alcance y límites

Este spec define cómo Alforjita ayuda al visitante a encontrar un plan o aclarar dudas sin revisar toda la programación: cómo se abre, qué preguntas rápidas ofrece, qué consultas resuelve, qué respuestas distingue cuando falta un dato y qué no hace nunca.

**Dentro de este spec:** RF-31, RF-32, RF-33 y RF-34; regla RC-07 (reloj de referencia); decisiones de fecha implícita («hoy» en hora de Loja), de las cuatro respuestas, del filtro de gratuitas confirmadas y del alcance sobre Pasaporte y rutas; verificaciones RNF-03, RNF-05, RNF-07 y RNF-10 en lo que toca al asistente.

**Alcance inicial:** preguntas rápidas fijas y consultas de texto libre acotado, interpretadas con reglas simples y filtros; no exige IA generativa. El nombre del asistente es **Alforjita**.

**Fuera de este spec** (solo son dependencias):

- La programación publicada y sus fichas (spec 02): Alforjita **no mantiene un catálogo propio**; usa el mismo catálogo público vigente que la Agenda.
- Los datos de las sedes y su accesibilidad (spec 03).
- Entradas, sellos y progreso personal (specs 05, 06 y 07): Alforjita no los consulta.
- La cuenta (spec 001): Alforjita funciona sin cuenta.
- La autorización para usar la ilustración de la mascota como avatar: es un trámite externo y no bloquea este spec.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Abrir Alforjita y usar preguntas rápidas (Priority: P1)

Un visitante, sin cuenta, abre «Pregúntale a Alforjita» desde la Agenda y elige una pregunta rápida sobre funciones próximas, gratuitas, sedes y cambios.

**Why this priority**: es la puerta de entrada al asistente y funciona sin conocimiento previo.

**Independent Test**: sin sesión, se abre Alforjita desde la Agenda, se elige cada pregunta rápida y se verifica que responde con fichas.

**Acceptance Scenarios**:

1. **Given** la Agenda, **When** el visitante toca «Pregúntale a Alforjita», **Then** se abre el asistente sin pedir cuenta.
2. **Given** el asistente abierto, **When** se muestra, **Then** ofrece preguntas rápidas sobre funciones próximas, gratuitas, sedes y cambios.
3. **Given** una pregunta rápida, **When** el visitante la elige, **Then** Alforjita responde con las fichas que coinciden, enlazadas.
4. **Given** el asistente, **When** se usa solo con teclado, **Then** se puede abrir, usar y cerrar (RNF-03).
5. **Given** el asistente, **When** se abre, **Then** no pide datos personales ni ubicación.

---

### User Story 2 - Consultar por fecha, horario, categoría, sede y modalidad (Priority: P1)

El visitante pide funciones por fecha, horario, categoría, sede o modalidad de acceso, eligiendo una pregunta rápida o escribiendo texto libre. Alforjita lo interpreta con reglas simples, consulta el catálogo vigente y muestra fichas que coinciden, con enlaces a cada una.

**Why this priority**: es el valor principal del asistente frente a navegar toda la Agenda.

**Independent Test**: con una hora de referencia fijada, se hace una consulta combinada y se comparan las fichas devueltas con la Agenda filtrada.

**Acceptance Scenarios**:

1. **Given** «¿Qué funciones gratuitas de danza empiezan después de las seis?», **When** se consulta, **Then** Alforjita asume hoy en hora de Loja, lo indica, y muestra las funciones de hoy gratuitas confirmadas de danza que aún no empiezan.
2. **Given** una consulta sin día, **When** no hay funciones de hoy que coincidan, **Then** ofrece consultar otro día.
3. **Given** el filtro de gratuitas, **When** se aplica, **Then** incluye solo funciones con gratuidad confirmada.
4. **Given** una ficha en una respuesta, **When** el visitante la abre, **Then** llega a la ficha de la Agenda; **when** vuelve, **then** regresa a Agenda.
5. **Given** la Agenda y Alforjita con la misma consulta, **When** se comparan, **Then** muestran los mismos resultados.
6. **Given** una hora de referencia fijada en pruebas o demo, **When** se consulta, **Then** usa esa misma referencia que la Agenda (RC-07).
7. **Given** el texto libre «¿Qué funciones gratuitas de danza hay después de las seis?», **When** se envía, **Then** Alforjita lo interpreta, indica que asumió hoy y muestra las funciones que coinciden.
8. **Given** un texto libre que Alforjita no entiende, **When** se envía, **Then** ofrece preguntas guiadas o volver a la Agenda, sin inventar una respuesta.
9. **Given** una consulta de texto libre, **When** se interpreta, **Then** no se exige IA generativa ni se piden datos personales.

---

### User Story 3 - Distinguir qué pasa cuando falta algo (Priority: P1)

Alforjita responde de forma distinta cuando no hay coincidencias, cuando el dato no está confirmado, cuando la consulta está fuera de alcance y cuando el servicio falla.

**Why this priority**: es lo que evita que el asistente invente datos y que el visitante se confunda.

**Independent Test**: se provoca cada uno de los cuatro casos y se verifica el texto y la salida de cada uno.

**Acceptance Scenarios**:

1. **Given** una consulta sin resultados, **When** se responde, **Then** indica los criterios aplicados y ofrece relajar uno o abrir la Agenda.
2. **Given** una función sin precio confirmado, **When** se pregunta por su precio, **Then** dice que el precio aún no está confirmado, sin decir que es gratuita ni inventar uno.
3. **Given** una función sin hora de fin o sin duración, **When** se pregunta cuándo termina, **Then** dice que ese dato no está confirmado.
4. **Given** una sede con «acceso sin escalones» o «baño accesible» sin confirmar, **When** se pregunta por su accesibilidad, **Then** dice que esa característica está por confirmar y no la da por disponible.
5. **Given** una consulta fuera de alcance (comprar, canjear, modificar), **When** se pide, **Then** explica que no puede hacerlo y a qué pantalla acudir.
6. **Given** que el catálogo no responde, **When** se consulta, **Then** dice que no pudo consultar la programación y remite a la Agenda.
7. **Given** una pregunta con un dato no confirmado, **When** se responde, **Then** nunca lo completa ni lo deduce.

---

### User Story 4 - Límites del asistente (Priority: P1)

Alforjita no consulta borradores ni información privada, no compra, no canjea sellos, no modifica la programación y no consulta entradas, sellos ni progreso personal. Sí puede explicar cómo funcionan el Pasaporte y las rutas y enlazar a sus páginas públicas.

**Why this priority**: protege la privacidad y la integridad del catálogo.

**Independent Test**: se intenta cada acción prohibida y se verifica que se rechaza con una explicación.

**Acceptance Scenarios**:

1. **Given** una pregunta sobre un borrador o propuesta, **When** se hace, **Then** no devuelve nada del borrador.
2. **Given** una pregunta sobre «mis entradas», «mis sellos» o «mi progreso», **When** se hace, **Then** explica que no puede consultar datos personales y remite a Perfil o Pasaporte.
3. **Given** una petición de comprar una entrada o reclamar un sello, **When** se hace, **Then** explica que no puede y remite a la ficha o al QR.
4. **Given** una petición de cambiar la programación, **When** se hace, **Then** no la ejecuta.
5. **Given** una pregunta sobre cómo funciona el Pasaporte o las rutas, **When** se hace, **Then** explica y enlaza a sus páginas públicas.
6. **Given** el asistente, **When** se usa, **Then** no pide datos personales para responder sobre programación.

---

### User Story 5 - Preguntas rápidas fijas (Priority: P3)

Las preguntas rápidas son fijas en el MVP: no hay un panel para editarlas, pero sus resultados cambian con la programación publicada. Los horarios, precios y sedes se consultan en el catálogo y nunca se mantienen en respuestas manuales duplicadas.

**Why this priority**: simplifica el MVP y evita datos duplicados; el asistente funciona sin edición manual.

**Independent Test**: se cambia la programación publicada y se verifica que el resultado de la misma pregunta rápida cambia sin editar la pregunta.

**Acceptance Scenarios**:

1. **Given** una pregunta rápida, **When** la programación publicada cambia, **Then** su resultado cambia sin editar la pregunta.
2. **Given** el sistema, **When** se busca un panel para editar preguntas rápidas, **Then** no existe en el MVP.
3. **Given** una pregunta rápida, **When** responde sobre horarios, precios o sedes, **Then** los toma del catálogo y no de un texto manual.

### Edge Cases

- Una consulta ambigua (por ejemplo, «después de las seis» sin día): asume hoy en hora de Loja y lo indica.
- Una consulta de un día futuro de la edición o ya pasado.
- Una función con solo hora de inicio que ya pasó: «Hora de inicio pasada», no se presenta como en curso ni como terminada (RC-03).
- Una función de pago sin precio: no se presenta como gratuita.
- Una consulta con varios criterios sin coincidencias.
- Una consulta fuera del festival o sin relación con la programación.
- Texto vacío, muy largo o con caracteres extraños.
- Un texto libre ambiguo o que Alforjita no entiende: ofrece preguntas guiadas o volver a la Agenda.
- Un texto libre con datos personales: no se piden ni se usan para responder sobre programación.
- Una consulta que pide datos personales de otra persona.
- El asistente falla pero la Agenda sigue disponible (RNF-07).
- Una cancelación o reprogramación reciente: las respuestas reflejan el catálogo vigente.

## Requirements *(mandatory)*

### Functional Requirements

**Apertura y preguntas rápidas**

- **FR-001**: El sistema DEBE abrir Alforjita sin cuenta desde «Pregúntale a Alforjita» en la Agenda.
- **FR-002**: Alforjita DEBE ofrecer preguntas rápidas sobre funciones próximas, gratuitas, sedes y cambios.
- **FR-003**: Alforjita DEBE poder abrirse, usarse y cerrarse con teclado (RNF-03).
- **FR-004**: Alforjita NO DEBE pedir datos personales ni ubicación para responder sobre programación (RNF-05).

**Consultas**

- **FR-005**: Alforjita DEBE resolver consultas admitidas por fecha, horario, categoría, sede y modalidad de acceso, formuladas como preguntas rápidas o como texto libre acotado interpretado con reglas simples.
- **FR-006**: Alforjita DEBE usar el mismo catálogo público vigente que la Agenda y enlazar a las fichas; NO DEBE mantener un catálogo propio.
- **FR-007**: Si la consulta no indica día, Alforjita DEBE asumir hoy en hora de Loja e indicar esa suposición; para «después de las seis» DEBE sugerir solo funciones de hoy que aún no empiezan y, si no hay, ofrecer consultar otro día.
- **FR-008**: El filtro de gratuitas DEBE incluir solo funciones con gratuidad confirmada.
- **FR-009**: Alforjita DEBE usar la misma referencia de fecha y hora que la Agenda, y que pueda fijarse solo en pruebas y demo (RC-07, RNF-10).
- **FR-010**: Una función con solo hora de inicio que ya pasó DEBE presentarse como «Hora de inicio pasada», sin afirmar que está en curso ni que terminó (RC-03).

**Cuatro respuestas**

- **FR-011**: Ante falta de coincidencias, Alforjita DEBE indicar los criterios aplicados y ofrecer relajar uno o abrir la Agenda.
- **FR-012**: Ante un dato no confirmado, Alforjita DEBE decir qué dato falta (precio, hora de fin, duración, accesibilidad) sin completarlo ni deducirlo; la ausencia de precio NO DEBE presentarse como gratuidad.
- **FR-013**: Ante una consulta fuera de alcance, Alforjita DEBE explicar que no puede hacerlo y a qué pantalla acudir.
- **FR-014**: Ante una falla del servicio, Alforjita DEBE indicar que no pudo consultar la programación y remitir a la Agenda; la consulta manual DEBE seguir disponible (RNF-07).

**Límites**

- **FR-015**: Alforjita NO DEBE inventar datos, consultar borradores o información privada, comprar entradas, canjear sellos ni modificar la programación.
- **FR-016**: Alforjita NO DEBE consultar entradas, sellos ni progreso personal.
- **FR-017**: Alforjita DEBE poder explicar cómo funcionan el Pasaporte y las rutas y enlazar a sus páginas públicas.

**Mantenimiento**

- **FR-018**: Las preguntas rápidas DEBEN ser fijas en el MVP, NO DEBE existir un panel para editarlas, y sus resultados DEBEN cambiar con la programación publicada.
- **FR-019**: Los horarios, precios y sedes DEBEN consultarse en el catálogo y NO DEBEN mantenerse en respuestas manuales duplicadas.
- **FR-020**: La ilustración de la mascota NO DEBE usarse como avatar sin autorización.

**Texto libre acotado y preguntas rápidas fijas** (decisiones cerradas el 2026-11-20; véase Clarifications)

- **FR-021**: Alforjita DEBE permitir preguntas rápidas y consultas de texto libre interpretadas con reglas simples, sin exigir IA generativa. DEBE poder resolver casos como «¿Qué funciones gratuitas de danza hay después de las seis?», indicar qué día asumió cuando corresponda y, si no entiende, ofrecer preguntas guiadas o volver a la Agenda. Las respuestas DEBEN consultar el catálogo público vigente.
- **FR-022**: El sistema NO DEBE incluir en el MVP un panel para editar las preguntas rápidas.

**Interpretación, resultados e interfaz** (decisiones cerradas el 2026-11-21; véase Clarifications)

- **FR-023**: Alforjita DEBE interpretar las horas según M-14: de 1 a 11 sin «de la mañana» o «am» son de tarde o noche; «después de» incluye la hora indicada; «mañana» sola es el día siguiente; «en la mañana», «en la tarde» y «en la noche» son antes de las 12:00, de 12:00 a 17:59 y desde las 18:00. Un día ya pasado DEBE indicarse como pasado y ofrecer consultar hoy u otro día.
- **FR-024**: Las preguntas rápidas DEBEN ser las de M-15. «¿Hubo cambios?» DEBE mostrar las funciones de hoy en adelante con aviso publicado de cancelación o reprogramación, la más reciente primero.
- **FR-025**: Cada resultado DEBE ser una función con título, día, hora, sede y acceso, enlazada a su ficha. Se DEBEN mostrar como máximo 10 y, si hay más, «Ver todas en la Agenda» con los mismos filtros.
- **FR-026**: El texto libre DEBE admitir hasta 200 caracteres, sin distinguir tildes ni mayúsculas, y reconocer categorías, sedes y títulos por su nombre en el catálogo, sin listas manuales.
- **FR-027**: El botón DEBE estar solo en la Agenda y abrir un panel (lateral en escritorio, a pantalla completa en celular); Esc DEBE cerrarlo y devolver el foco al botón. El avatar DEBE ser un icono neutro mientras no haya autorización para la mascota.
- **FR-028**: La conversación NO DEBE guardarse: vive solo en la página abierta. El servidor NO DEBE guardar ni registrar el texto escrito.

### Key Entities

- **Consulta**: pregunta del visitante con criterios de fecha, horario, categoría, sede y modalidad.
- **Respuesta**: coincidencias o uno de los cuatro casos: sin coincidencias, dato no confirmado, fuera de alcance o falla del servicio.
- **Pregunta rápida**: consulta predefinida y fija ofrecida al abrir el asistente; su resultado cambia con la programación publicada.
- **Texto libre acotado**: consulta escrita por el visitante, interpretada con reglas simples.
- **Suposición de día**: «hoy» en hora de Loja cuando la consulta no indica día.
- **Catálogo público vigente**: programación publicada compartida con la Agenda.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las aperturas de Alforjita ocurre sin cuenta, sin datos personales y sin ubicación (0 peticiones).
- **SC-002**: Para la misma consulta, el 100 % de las fichas que muestra Alforjita coincide con las de la Agenda con los mismos filtros.
- **SC-003**: En las consultas sin día, el 100 % de las respuestas indica la suposición «hoy en hora de Loja».
- **SC-004**: 0 funciones sin gratuidad confirmada aparecen en una consulta de gratuitas.
- **SC-005**: En el 100 % de las pruebas de los cuatro casos (sin coincidencias, dato no confirmado, fuera de alcance, falla del servicio), la respuesta es la prevista y 0 respuestas inventan o completan datos.
- **SC-006**: 0 respuestas incluyen contenido de borradores, entradas, sellos o progreso personal.
- **SC-007**: Alforjita se abre, usa y cierra con teclado en el 100 % de las pruebas de accesibilidad.
- **SC-008**: Con Alforjita fallando, la Agenda se abre y consulta en el 100 % de las pruebas.
- **SC-009**: 0 pantallas del MVP permiten editar preguntas rápidas, y el 100 % de las preguntas rápidas refleja la programación publicada vigente.
- **SC-010**: El 100 % de las respuestas con una hora de referencia fijada usa esa misma referencia que la Agenda.
- **SC-011**: En el 100 % de las pruebas, las consultas de texto libre del tipo «¿Qué funciones gratuitas de danza hay después de las seis?» devuelven las funciones correctas e indican el día asumido, y las que no se entienden ofrecen preguntas guiadas o volver a la Agenda, sin inventar datos.
- **SC-012**: El 0 % de los textos escritos en Alforjita queda guardado o registrado en el servidor.

## Trazabilidad con el contexto

| Contexto | Cubierto por |
|---|---|
| RF-31 | FR-001 a FR-004; Historia 1 |
| RF-32, RC-07 | FR-005 a FR-010; Historia 2 |
| RF-33, RC-03 | FR-011 a FR-017; Historias 3 y 4 |
| RF-34, Q17 | FR-018, FR-019, FR-022; Historia 5 |
| RF-32, Q16 | FR-005, FR-021; Historia 2 |
| RNF-03, RNF-05 | FR-003, FR-004; SC-001, SC-007 |
| RNF-07 | FR-014; SC-008 |
| RNF-10 | FR-009; SC-010 |
| M-14 a M-17 | FR-023 a FR-028; SC-012 |

## Assumptions

- La Agenda aporta el catálogo, los filtros y los enlaces a las fichas; Alforjita los reutiliza.
- El mockup de Agenda muestra «Pregúntale a VIVART»; prevalece el requisito: el botón y el asistente se llaman **Alforjita**.
- No existe mockup de la ventana de conversación ni de las preguntas rápidas; se diseña según M-17 con la Agenda como referencia visual.
- La autorización para usar la ilustración de la mascota es un trámite externo pendiente; hasta que exista, el asistente no usa esa ilustración.
