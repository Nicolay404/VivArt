# Feature Specification: Programación, agenda y publicación

**Feature Branch**: `002-programacion-y-publicacion`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Spec 02 de 8 de VIVART: programación, agenda y publicación. Cubre RF-05 a RF-11 y RF-35, con RC-03, RC-06 y RC-07. Sin plan técnico ni implementación."

## Clarifications

### Session 2026-11-20

- Q: ¿Qué campos son obligatorios para enviar a revisión? → A: Título, categoría y al menos una función o franja con sede y programación válida. Una función necesita fecha y hora de inicio; una franja necesita días o fechas y horario de apertura. El borrador puede guardarse incompleto. La duración, la descripción y el precio pueden quedar pendientes si no se conocen o no aplican; la falta de precio no habilita la venta ni convierte la función en gratuita.
- Q: ¿Quién prepara la carga desde el PDF y en qué formato llega? → A: El equipo prepara y revisa los datos del PDF fuera de VIVART y el administrador sube un archivo estructurado. El sistema muestra una vista previa con referencias de origen, posibles duplicados y errores; los registros aceptados se cargan como borradores sin publicación automática. Se mantiene la creación manual. El formato concreto del archivo se define en el plan técnico de este spec.
- Q: ¿Cómo se avisa al editor de una devolución? → A: La propuesta queda como «Devuelta» y el editor lee las observaciones dentro del panel, la corrige y la reenvía. No hay correos de avisos editoriales en el MVP.

## Alcance y límites

Este spec define cómo el equipo mantiene una **programación vigente** y cómo el público la encuentra desde el celular: la Agenda, las fichas, «¿Qué hay ahora?», el flujo editorial (borrador, revisión, publicación), los cambios con aviso público, la carga inicial desde el PDF y el archivo de actividades.

**Dentro de este spec:** RF-05, RF-06, RF-07, RF-08, RF-09, RF-10, RF-11 y RF-35; reglas RC-03 (función sin hora de fin), RC-06 (historial y aviso público) y RC-07 (reloj de referencia); verificaciones RNF-08, RNF-09 y RNF-10 en lo que toca a la programación.

**Fuera de este spec** (solo son dependencias):

- Quién tiene cada rol y los rechazos por permisos (spec 001, FR-009 a FR-023).
- Mapa y filtro por sedes (spec 03), Mi recorrido (04), carrito, venta, entradas y cancelación con entradas vendidas (05), Pasaporte (06), rutas (07) y Alforjita (08).
- La elección de arquitectura y de tecnología.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar la Agenda y las fichas (Priority: P1)

Un visitante abre la Agenda desde el celular, busca por título o artista, filtra por fecha, categoría, sede y modalidad de acceso, abre una ficha y la comparte con un enlace.

**Why this priority**: es el uso principal del público y la razón de ser del producto.

**Independent Test**: con actividades publicadas, se busca y se filtra, se abre una ficha y se abre su enlace en otra sesión.

**Acceptance Scenarios**:

1. **Given** actividades publicadas, **When** el visitante busca por un título o un artista, **Then** la Agenda muestra solo las que coinciden.
2. **Given** la Agenda, **When** combina filtros de fecha, categoría, sede y modalidad de acceso, **Then** solo se muestran las actividades que cumplen todos.
3. **Given** una ficha, **When** se abre, **Then** muestra la descripción, la organización, la fecha, la hora, la sede, la duración si se conoce, la modalidad de acceso, el precio confirmado y los avisos de cambio.
4. **Given** una ficha con datos sin confirmar (por ejemplo, sin precio o sin duración), **When** se abre, **Then** esos datos se muestran como pendientes y no se completan ni se deducen.
5. **Given** una ficha, **When** se copia su enlace y se abre en otro dispositivo, **Then** se ve la misma ficha publicada, sin pedir cuenta.
6. **Given** una actividad en borrador, en revisión o archivada, **When** el visitante usa la Agenda, **Then** no aparece.

---

### User Story 2 - «¿Qué hay ahora?» (Priority: P1)

Un visitante abre «¿Qué hay ahora?» en la Agenda y ve las franjas abiertas y las próximas funciones, sin las canceladas.

**Why this priority**: resuelve la pregunta más común durante el festival: qué puedo ver ahora o en un rato.

**Independent Test**: con una hora de referencia fijada, se comprueba qué franjas y funciones aparecen y que las canceladas no.

**Acceptance Scenarios**:

1. **Given** una franja de apertura vigente, **When** se consulta «¿Qué hay ahora?», **Then** aparece como abierta.
2. **Given** una función que empieza más tarde hoy, **When** se consulta, **Then** aparece como próxima.
3. **Given** una función cancelada, **When** se consulta, **Then** no aparece.
4. **Given** una función con solo hora de inicio y esa hora ya pasó, **When** se consulta, **Then** se muestra «Hora de inicio pasada», sale de las próximas y no se presenta como «en curso» ni como terminada (RC-03).
5. **Given** una hora de referencia fijada en pruebas o demo, **When** se consulta, **Then** el resultado corresponde a esa hora en hora de Loja (RC-07).

---

### User Story 3 - El editor prepara y envía a revisión (Priority: P1)

Un editor crea un borrador de una actividad, añade funciones o franjas, previsualiza la ficha y la envía a revisión. No puede publicarla.

**Why this priority**: es el origen de toda la programación y la primera mitad del flujo editorial.

**Independent Test**: un editor crea un borrador, lo previsualiza y lo envía; se comprueba que no puede publicar y que no puede editarlo mientras esté en revisión.

**Acceptance Scenarios**:

1. **Given** un editor, **When** crea un borrador con funciones o franjas, **Then** puede previsualizar cómo se vería la ficha antes de enviarla.
2. **Given** un borrador completo, **When** el editor lo envía a revisión, **Then** queda en revisión y el editor no puede modificarlo hasta que se lo devuelvan con observaciones.
3. **Given** un editor, **When** intenta publicar, **Then** el sistema lo rechaza con el motivo (spec 001).
4. **Given** una ficha ya publicada, **When** el editor la edita, **Then** se crea una versión pendiente de revisión y la última versión publicada sigue visible.
5. **Given** una actividad permanente, **When** el editor añade franjas de apertura (con varios días y más de una franja por día), **Then** se registran como franjas, no como funciones.
6. **Given** una actividad permanente con una visita guiada o inauguración de fecha y hora conocidas, **When** el editor la registra, **Then** queda como función puntual de esa actividad.
7. **Given** un borrador incompleto, **When** el editor lo guarda, **Then** el sistema lo guarda sin exigir los campos obligatorios de envío.
8. **Given** un borrador sin título, sin categoría o sin ninguna función o franja con sede y programación válida, **When** el editor intenta enviarlo, **Then** el sistema no lo envía y señala junto a cada campo qué falta.
9. **Given** una función sin fecha u hora de inicio, o una franja sin días o fechas o sin horario de apertura, **When** el editor intenta enviar, **Then** el sistema la considera inválida y no envía la propuesta.
10. **Given** un borrador con duración, descripción o precio pendientes, **When** el editor lo envía, **Then** el sistema lo acepta y la ficha muestra esos datos como pendientes.
11. **Given** una función sin precio, **When** se envía, **Then** no se habilita la venta ni se convierte en gratuita.

---

### User Story 4 - Revisar, devolver y publicar (Priority: P1)

Un publicador o un administrador consulta las propuestas, edita las ajenas si hace falta, las devuelve con observaciones o las aprueba y publica, incluidas las que él mismo preparó.

**Why this priority**: es la segunda mitad del flujo y la que hace visible la programación.

**Independent Test**: con propuestas de distintos autores, se devuelven, se aprueban y se publican, y se comprueba la visibilidad antes y después.

**Acceptance Scenarios**:

1. **Given** propuestas pendientes, **When** un publicador las consulta, **Then** ve las de todos los editores.
2. **Given** una propuesta, **When** el publicador la devuelve con observaciones, **Then** queda en estado «Devuelta» y el editor lee las observaciones dentro del panel, la corrige y la reenvía.
3. **Given** una propuesta devuelta, **When** se produce la devolución, **Then** el sistema no envía correos de avisos editoriales.
4. **Given** una propuesta aprobada, **When** se publica, **Then** la ficha aparece en la Agenda.
5. **Given** una ficha que el propio publicador editó, **When** la aprueba y publica, **Then** el sistema lo permite sin exigir una segunda persona.
6. **Given** una revisión pendiente de una ficha publicada, **When** el público consulta la Agenda, **Then** sigue viendo la última versión publicada.
7. **Given** publicar una ficha, **When** la función tiene venta, **Then** publicar no activa ventas (spec 05).

---

### User Story 5 - Reprogramar o cancelar con aviso (Priority: P2)

Un publicador autorizado reprograma o cancela una función con un motivo interno y un aviso público; el sistema conserva quién hizo el cambio y cuándo.

**Why this priority**: la programación cambia durante el festival y el público debe enterarse.

**Independent Test**: se reprograma y se cancela una función y se comprueba el aviso en la ficha y el historial.

**Acceptance Scenarios**:

1. **Given** una función, **When** el publicador cambia fecha, hora o sede, **Then** se publica un aviso y la ficha muestra los datos nuevos.
2. **Given** el traslado de una función a otra sede, **When** se confirma, **Then** se trata como reprogramación y exige aviso público.
3. **Given** una función con entradas vendidas o pedidos pendientes, **When** el publicador va a confirmar un cambio, **Then** el sistema muestra cuántos hay antes de confirmar y aplica las reglas del spec 05 (RF-24, RF-36) y, si corresponde, del spec 06 (RF-25).
4. **Given** una función sin ventas, **When** el publicador la cancela con motivo y aviso, **Then** la función se muestra cancelada con el aviso y deja de aparecer en «¿Qué hay ahora?».
5. **Given** una corrección de texto, categoría o marcador, **When** se guarda, **Then** no se exige aviso público (RC-06).
6. **Given** cualquier cambio sensible, **When** se completa, **Then** el historial conserva quién, cuándo y sobre qué registro.

---

### User Story 6 - Cargar la programación desde el PDF (Priority: P2)

El equipo prepara y revisa los datos del PDF fuera de VIVART y el administrador sube un archivo estructurado. El sistema muestra una vista previa con referencias de origen, posibles duplicados y errores; el administrador acepta registros, que se cargan como borradores, y después confirma explícitamente cuáles se publican. La creación manual se mantiene.

**Why this priority**: sin carga inicial no hay programación; el PDF trae decenas de actividades.

**Independent Test**: con una carga de prueba, se revisan duplicados y pendientes, se aceptan registros y se verifica que quedan como borradores y que solo se publican los confirmados.

**Acceptance Scenarios**:

1. **Given** un archivo estructurado subido por el administrador, **When** el sistema lo procesa, **Then** muestra una vista previa con la referencia de origen de cada registro, los posibles duplicados y los errores.
2. **Given** registros aceptados, **When** se cargan, **Then** quedan como borradores sin publicar.
3. **Given** un lote cargado, **When** el administrador no confirma, **Then** ningún registro se publica.
4. **Given** registros con correcciones ya revisadas, **When** se vuelve a cargar el mismo lote, **Then** las correcciones no se sobrescriben.
5. **Given** una etiqueta «Evento Pagado» sin precio, **When** se carga, **Then** el registro queda como de pago sin precio confirmado y no habilita el carrito.
6. **Given** una etiqueta «Entrada Libre» o «Evento Gratuito», **When** la etiqueta se asocia claramente a la ficha y el registro fue revisado, **Then** se registra como gratuita confirmada; si no, queda por confirmar.
7. **Given** un registro con errores en la vista previa, **When** el administrador acepta el lote, **Then** el registro con errores no se carga como borrador hasta corregirse.
8. **Given** el administrador, **When** prefiere crear una actividad sin archivo, **Then** puede hacerlo manualmente.

---

### User Story 7 - Gestionar categorías y sedes (Priority: P2)

El administrador gestiona las ediciones, las categorías y las sedes sin pasar por la revisión editorial; los cambios quedan en el historial.

**Why this priority**: las fichas, los filtros y el mapa dependen de estos catálogos.

**Independent Test**: se crea una categoría y se corrige la dirección de una sede, y se verifica el efecto en las fichas y en el historial.

**Acceptance Scenarios**:

1. **Given** el administrador, **When** crea o corrige una categoría o una sede, **Then** el cambio se aplica sin revisión editorial y queda en el historial.
2. **Given** una dirección corregida, **When** se guarda, **Then** se actualizan los datos de la sede en las fichas que la usan, sin aviso público.
3. **Given** un usuario sin rol de administrador, **When** intenta gestionar estos catálogos, **Then** el sistema lo rechaza.
4. **Given** una función, **When** cambia de sede, **Then** se trata como reprogramación (Historia 5).

---

### User Story 8 - Archivar una actividad (Priority: P3)

El administrador archiva una actividad que ya no forma parte de la programación activa, conservando pedidos, entradas, sellos e historial.

**Why this priority**: mantiene limpia la programación sin perder datos con valor para usuarios y para el equipo.

**Independent Test**: se archiva una actividad con ventas y sellos y se comprueba que desaparece de la Agenda y que los datos asociados permanecen.

**Acceptance Scenarios**:

1. **Given** una función vigente que no se va a realizar, **When** el administrador va a retirarla, **Then** primero debe cancelarla con aviso.
2. **Given** una actividad con ventas o sellos, **When** el administrador la archiva, **Then** sale de la programación activa y se conservan pedidos, entradas, sellos e historial.
3. **Given** una actividad con ventas o sellos, **When** alguien intenta eliminarla definitivamente, **Then** el sistema no lo permite.
4. **Given** un usuario sin rol de administrador, **When** intenta archivar, **Then** el sistema lo rechaza.

### Edge Cases

- Una actividad permanente con horario partido: dos franjas el mismo día (por ejemplo, 10h00–14h00 y 15h00–19h30).
- Una actividad permanente con franjas distintas según el rango de días (caso «Frontera en Movimiento», PDF pág. 4).
- Una actividad permanente sin horario en su ficha y con una función puntual aparte (caso «Círculo de Memorias Recicladas», págs. 4 y 13).
- Dos funciones de la misma obra el mismo día y en la misma sede (caso «Zombi Manifiesto», pág. 8).
- Una función con solo hora de inicio (caso «Lo que Somos», pág. 4).
- Varias fichas de pago sin precio indicado (siete marcas «Evento Pagado» en las págs. 13, 18, 38, 43 y 47).
- Una sede descrita como recorrido o tramo de calle (el desfile inaugural, pág. 8).
- La Agenda sin ninguna actividad publicada, o una búsqueda sin coincidencias.
- Un editor que intenta modificar una propuesta ya enviada.
- Un borrador guardado incompleto que nunca se envía.
- Un archivo estructurado con errores, vacío o con registros duplicados.
- Dos personas editando el mismo borrador a la vez: el contexto no lo define.
- Una revisión pendiente de una ficha publicada que el publicador descarta.
- La nota «Programación sujeta a cambios» del PDF (pág. 3): cualquier ficha puede cambiar y debe mostrarlo con aviso.

## Requirements *(mandatory)*

### Functional Requirements

**Agenda y fichas**

- **FR-001**: La Agenda DEBE mostrar solo actividades publicadas y permitir buscar por título o artista.
- **FR-002**: La Agenda DEBE permitir filtrar por fecha, categoría, sede y modalidad de acceso, y combinar los filtros.
- **FR-003**: Cada ficha DEBE tener un enlace compartible y mostrar la descripción, la organización, la fecha, la hora, la sede, la duración si se conoce, la modalidad de acceso, el precio confirmado y los avisos de cambio.
- **FR-004**: La ficha DEBE mostrar como pendiente todo dato no confirmado y NO DEBE completar ni deducir duración, cupos, precios ni accesibilidad.
- **FR-005**: «¿Qué hay ahora?» DEBE estar en la Agenda y mostrar franjas abiertas y próximas funciones, excluyendo las canceladas.
- **FR-006**: Una función con solo hora de inicio que ya pasó DEBE mostrarse como «Hora de inicio pasada», salir de las próximas y NO DEBE presentarse como en curso ni como terminada. «Terminada» solo se muestra con hora de fin, una duración conocida que permita calcularla o una confirmación operativa explícita (RC-03).
- **FR-007**: La Agenda, las fichas y «¿Qué hay ahora?» DEBEN usar una referencia común de fecha y hora en hora de Loja, que pueda fijarse solo en pruebas y demo (RC-07, RNF-10).

**Flujo editorial**

- **FR-008**: El editor DEBE poder crear y editar sus propios borradores, añadir funciones o franjas, previsualizar la ficha y enviarla a revisión; NO DEBE poder publicarla.
- **FR-009**: Una vez enviada una propuesta, el editor NO DEBE poder modificarla hasta que se la devuelvan con observaciones.
- **FR-010**: El administrador DEBE poder reasignar un borrador a otra persona, y el cambio DEBE quedar en el historial.
- **FR-011**: Editar una ficha ya publicada DEBE crear una versión pendiente de revisión, y la última versión publicada DEBE seguir visible hasta que se apruebe o se descarte.
- **FR-012**: El publicador y el administrador DEBEN poder consultar todas las propuestas, editarlas, devolverlas con observaciones, o aprobarlas y publicarlas, incluidas las que ellos mismos prepararon.
- **FR-013**: El sistema DEBE conservar el historial de cada cambio de un borrador (RC-06).
- **FR-014**: Publicar NO DEBE activar ventas por sí solo (spec 05).

**Cambios con aviso**

- **FR-015**: El publicador DEBE poder reprogramar o cancelar una función con un motivo interno y un aviso público, y el sistema DEBE conservar quién lo hizo y cuándo.
- **FR-016**: Trasladar una función a otra sede DEBE tratarse como una reprogramación con aviso público.
- **FR-017**: Antes de confirmar una reprogramación o cancelación, el sistema DEBE mostrar cuántas entradas vendidas y pedidos pendientes tiene la función.
- **FR-018**: Si la función tiene entradas vendidas, la cancelación y la reprogramación se rigen por RF-24 y RF-36 del spec 05, y este spec NO DEBE duplicar esas reglas. Si tiene Pasaporte habilitado, se rige además por RF-25 (spec 06).
- **FR-019**: El aviso público DEBE exigirse solo para reprogramaciones, cancelaciones y cambios que afecten la asistencia o el acceso, y NO DEBE exigirse para correcciones de texto, categoría o marcador (RC-06).

**Carga y catálogos**

- **FR-020**: El administrador DEBE poder subir un archivo estructurado y revisar una vista previa con las referencias de origen, los posibles duplicados y los errores de cada registro.
- **FR-021**: Los registros aceptados DEBEN cargarse como borradores, y el sistema NO DEBE publicar un lote automáticamente: el administrador DEBE confirmar explícitamente qué registros se publican.
- **FR-022**: La carga NO DEBE sobrescribir correcciones ya revisadas.
- **FR-023**: El sistema DEBE conservar la página de origen de cada dato importado (RNF-09).
- **FR-024**: Las etiquetas del PDF DEBEN interpretarse así: «Entrada Libre» y «Evento Gratuito» como gratuita confirmada solo si se asocian claramente a la ficha y el registro fue revisado; «Evento Pagado» como actividad de pago sin habilitar el carrito si falta precio, cupo o venta interna; la ausencia de precio nunca como gratuidad.
- **FR-025**: El administrador DEBE poder gestionar ediciones, categorías y sedes sin revisión editorial, con registro de cada cambio en el historial. Corregir una dirección o un marcador actualiza los datos de la sede.
- **FR-026**: El administrador DEBE poder crear y publicar eventos y cargar el catálogo o la programación planificada.

**Archivo**

- **FR-027**: Una función vigente que no se va a realizar DEBE cancelarse con aviso antes de retirarse; NO DEBE ocultarse sin cancelar.
- **FR-028**: Solo el administrador DEBE poder archivar una actividad; archivar la retira de la programación activa y NO DEBE borrar pedidos, entradas, sellos ni historial.
- **FR-029**: El sistema NO DEBE eliminar definitivamente una actividad con ventas o sellos.

**Campos obligatorios, carga estructurada y devolución** (decisiones cerradas el 2026-11-20; véase Clarifications)

- **FR-030**: El sistema DEBE permitir guardar un borrador incompleto, y DEBE exigir para enviarlo a revisión título, categoría y al menos una función o franja con sede y programación válida. Una función DEBE tener fecha y hora de inicio; una franja DEBE tener días o fechas y horario de apertura. La duración, la descripción y el precio PUEDEN quedar pendientes. La falta de precio NO DEBE habilitar la venta ni convertir la función en gratuita.
- **FR-031**: El equipo prepara y revisa los datos del PDF fuera de VIVART. El sistema DEBE permitir que el administrador suba un archivo estructurado y mostrar una vista previa antes de cargarlo; los registros aceptados DEBEN cargarse como borradores sin publicación automática, y el sistema DEBE mantener la creación manual. El formato concreto del archivo corresponde al plan técnico de este spec.
- **FR-032**: Una propuesta devuelta DEBE quedar en estado «Devuelta», y el editor DEBE poder leer las observaciones dentro del panel, corregirla y reenviarla. El sistema NO DEBE enviar correos de avisos editoriales en el MVP.
- **FR-033**: Un registro con errores en la vista previa NO DEBE cargarse como borrador hasta que se corrija.

### Key Entities

- **Actividad**: obra, exposición, feria, taller u otra propuesta cultural; tiene organización, categoría y una o varias funciones o franjas.
- **Función**: presentación con fecha, hora y sede; puede tener hora de fin o duración, o no.
- **Franja de apertura**: intervalo de visita de una actividad permanente, repetible por días.
- **Ficha**: vista pública de una actividad, con enlace compartible y avisos.
- **Borrador, propuesta y versión pendiente**: estados editoriales con autor, historial y observaciones.
- **Aviso público**: mensaje visible sobre un cambio de asistencia o acceso.
- **Lote de carga**: archivo estructurado subido por el administrador con registros preparados desde el PDF, con su referencia de origen, duplicados y errores en una vista previa.
- **Observaciones de devolución**: texto del publicador o administrador asociado a una propuesta en estado «Devuelta».
- **Categoría, sede y edición**: catálogos gestionados por el administrador.
- **Registro de historial**: quién, cuándo y sobre qué registro.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las actividades publicadas aparece en la Agenda y el 0 % de borradores, propuestas y archivadas aparece.
- **SC-002**: Una búsqueda por título o artista y la combinación de los cuatro filtros devuelven solo actividades que cumplen todos los criterios, en el 100 % de las pruebas.
- **SC-003**: El 100 % de las fichas muestra como pendiente cada dato no confirmado, y 0 fichas muestran duraciones, precios, cupos o accesibilidad que no estén registrados.
- **SC-004**: En «¿Qué hay ahora?», 0 funciones canceladas aparecen y 0 funciones con solo hora de inicio se presentan como «en curso» o «terminada».
- **SC-005**: 0 usuarios sin rol de publicador o administrador consiguen publicar, incluso con solicitudes directas al sistema.
- **SC-006**: Mientras una revisión está pendiente, el 100 % de las consultas públicas ve la última versión publicada.
- **SC-007**: El 100 % de las reprogramaciones y cancelaciones publica un aviso y registra quién y cuándo, y el 0 % de las correcciones de texto, categoría o marcador exige aviso.
- **SC-008**: 0 registros de un lote se publican sin confirmación explícita del administrador, y 0 correcciones revisadas se sobrescriben al recargar.
- **SC-009**: El 100 % de los registros importados conserva su página de origen.
- **SC-010**: Los siete casos de referencia del PDF (horario partido, franjas por rango de días, permanente con función puntual, dos funciones de la misma obra, solo hora de inicio, pagadas sin precio y sede como recorrido) se representan sin inventar datos ausentes.
- **SC-012**: El 100 % de los intentos de enviar una propuesta sin título, sin categoría o sin una función o franja válida es rechazado y señala el campo que falta; el 100 % de los borradores incompletos puede guardarse.
- **SC-013**: El 100 % de las funciones sin precio queda sin venta habilitada y sin marca de gratuita.
- **SC-014**: El 100 % de las cargas muestra una vista previa con referencia de origen, duplicados y errores antes de crear borradores, y 0 registros con errores se cargan.
- **SC-015**: El 100 % de las propuestas devueltas queda en «Devuelta» con sus observaciones visibles en el panel y 0 correos editoriales se envían.
- **SC-011**: 0 actividades con ventas o sellos pueden eliminarse definitivamente; el 100 % de las archivadas conserva pedidos, entradas, sellos e historial.

## Trazabilidad con el contexto

| Contexto | Cubierto por |
|---|---|
| RF-05 | FR-001, FR-002; Historia 1 |
| RF-06 | FR-003, FR-004; Historia 1 |
| RF-07, RC-03, RC-07 | FR-005, FR-006, FR-007; Historia 2 |
| RF-08, Q1 | FR-008 a FR-011, FR-013, FR-030; Historia 3 |
| RF-09, Q3 | FR-011, FR-012, FR-014, FR-032; Historia 4 |
| RF-10, RC-06 | FR-015 a FR-019; Historia 5 |
| RF-11, Q2 | FR-020 a FR-026, FR-031, FR-033; Historias 6 y 7 |
| RF-35 | FR-027 a FR-029; Historia 8 |
| RNF-08 | FR-004, FR-006, SC-003, SC-004, SC-010 |
| RNF-09 | FR-013, FR-023, SC-009 |
| RNF-10 | FR-007 |

## Assumptions

- El spec 001 define quién tiene los permisos; este spec los usa.
- Las pantallas del panel interno y la ficha de actividad no tienen mockup; la Agenda sí (`context/assets/mockups/`), solo como referencia visual.
- La programación vigente del sistema es la que consultan la Agenda, el Mapa y Alforjita, una vez publicada.
- Las funciones y franjas se publican en hora de Loja.
- Dos personas editando un mismo borrador a la vez y la vigencia de una propuesta sin revisar no están definidas en el contexto y se llevan a clarificación posterior.
- El PDF de programación no viene con el clon (`context/assets/README.md`); el equipo lo prepara y revisa fuera de VIVART antes de subir el archivo estructurado.
- El formato concreto del archivo estructurado se define en el plan técnico de este spec.
