# Feature Specification: Pasaporte Vivo y sellos

**Feature Branch**: `006-pasaporte-y-sellos`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Spec 06 de 8 de VIVART: Pasaporte Vivo y sellos. Cubre RF-25 a RF-27, con RC-04, RC-05 y RC-06. Sin plan técnico ni implementación."

## Clarifications

### Session 2026-11-20

- Q: ¿Qué pasa con un sello cuando la función se cancela después? → A: Al cancelar una función se bloquean nuevos canjes. Los sellos obtenidos antes de la cancelación siguen en la colección, muestran el aviso en su detalle y siguen contando para las rutas que ya los reconocían.
- Q: ¿Qué contenido tiene cada sello? → A: El sello siempre muestra los datos de la función en una plantilla común de VIVART. El administrador puede añadir una imagen autorizada, un texto breve o ambos; ninguno es obligatorio para emitir el sello.
- Q: ¿La ventana de canje tiene un valor por defecto? → A: No. Para activar el QR, el administrador fija el inicio y el fin a mano; no se inventa un horario (M-10).
- Q: Si el administrador cambia la imagen o el texto del sello, ¿qué pasa con los sellos emitidos? → A: Conservan el contenido que tenían. El contenido se versiona y cada sello apunta a la versión vigente al emitirse; una imagen no se borra mientras algún sello la use (M-11).
- Q: ¿Qué reglas sigue la imagen del sello y qué largo tiene el texto breve? → A: Las de la foto de sede (M-09): texto alternativo y autoría obligatorios, propia o con licencia que permita reutilizarla, JPEG, PNG o WebP de hasta 1 MB validada por su contenido, sin SVG y sin metadatos EXIF. Texto breve de hasta 280 caracteres, solo texto plano (M-12).
- Q: ¿Cómo lleva el administrador el QR a la sede? → A: El panel muestra el QR grande, con descarga en SVG para imprimir, y su enlace `/pasaporte/canje/{ref}`, con un `ref` aleatorio e impredecible. Hay un solo QR vigente por función: al reemplazarlo se crea un `ref` nuevo y el anterior se rechaza como «QR desactivado o reemplazado». El QR lleva la dirección pública del sitio: los QR definitivos se imprimen cuando esté cerrada P-12 (despliegue y dominio) (M-13).
- Q: ¿Qué ve un visitante en la sección de rutas del Pasaporte? → A: «Próximamente», hasta que exista el spec 007 (M-13).
- Q: ¿Qué datos muestra un sello si su función se reprograma después del canje? → A: **Pendiente (P-14)**: datos vigentes de la función más el aviso de cambio, o datos del momento del canje como recuerdo. Lo deciden Rafa y el equipo; este spec no lo resuelve.

## Alcance y límites

Este spec define cómo el usuario conserva un recuerdo de cada función habilitada, sea gratuita o de pago: el QR del Pasaporte por función, el canje de un sello al abrir su enlace, la colección de sellos y el control del administrador sobre los QR y las ventanas de canje.

**Dentro de este spec:** RF-25, RF-26 y RF-27; reglas RC-04 (dos tipos de QR, no intercambiables) y RC-05 (un sello por usuario y función); decisiones P-03 (reprogramación desactiva el canje), M-01 (Mi pasaporte muestra el total de sellos, sin meta global) y M-10 a M-13; pendiente P-14; verificaciones RNF-01, RNF-04, RNF-06 y RNF-07 en lo que toca al Pasaporte.

**Fuera de este spec** (solo son dependencias):

- Cuenta, correo verificado y retorno al canje tras identificarse (spec 001).
- Funciones, fechas y avisos de cambio (spec 02) y entradas de pago (spec 05): el QR del Pasaporte **no** es una entrada.
- Rutas culturales, su progreso y las insignias (spec 07): las rutas solo cuentan sellos distintos de funciones elegibles.
- Mapa (03), Mi recorrido (04) y Alforjita (08).
- Imprimir los QR definitivos: depende de P-12 (despliegue y dominio).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reclamar un sello con el QR (Priority: P1)

Un usuario escanea el QR del Pasaporte en la sede, se identifica si hace falta y reclama el sello de la función, sin necesidad de haber comprado ni validado una entrada.

**Why this priority**: es el corazón del Pasaporte Vivo y el distintivo del producto.

**Independent Test**: con una función habilitada y una cuenta verificada, se abre el enlace del QR y se obtiene el sello; se repite y se obtiene el mismo.

**Acceptance Scenarios**:

1. **Given** un usuario con sesión y correo verificado, **When** abre el enlace de un QR vigente de una función habilitada y no cancelada dentro de la ventana de canje, **Then** recibe un sello de esa función.
2. **Given** una función gratuita o de pago, **When** el usuario reclama el sello, **Then** no se le exige haber comprado ni validado una entrada.
3. **Given** un usuario sin sesión, **When** abre el enlace del QR, **Then** se le pide identificarse y, al terminar, vuelve al canje, que se revalida (spec 001).
4. **Given** un usuario que ya reclamó el sello de esa función, **When** abre otra vez el enlace, **Then** se le muestra el mismo sello, sin tratarlo como error.
5. **Given** dos solicitudes simultáneas del mismo usuario para la misma función, **When** se procesan, **Then** existe un solo sello (RC-05).
6. **Given** el enlace del QR abierto en un navegador, **When** no hay cámara, **Then** el canje funciona igual: no hay código manual de canje en el MVP.
7. **Given** comprar una entrada, **When** se completa, **Then** el sello no se entrega automáticamente.

---

### User Story 2 - Rechazos claros del canje (Priority: P1)

Cuando el canje no procede, el sistema indica el motivo: tipo de código incorrecto, QR desactivado o reemplazado, fuera de la ventana de canje (vencido o aún no abierto) o función cancelada.

**Why this priority**: evita frustración en la sede y protege la integridad del canje.

**Independent Test**: se prueban los cuatro rechazos y se verifica el mensaje de cada uno.

**Acceptance Scenarios**:

1. **Given** un QR de entrada abierto como canje, **When** se procesa, **Then** se rechaza con «tipo de código incorrecto» y no se otorga sello (RC-04).
2. **Given** un QR desactivado o reemplazado, **When** se abre, **Then** se indica que ese QR ya no está vigente.
3. **Given** un canje fuera de la ventana, **When** se abre, **Then** se indica si está vencido o aún no abierto.
4. **Given** una función cancelada, **When** se abre el enlace, **Then** se rechaza con ese motivo y no se emite ningún sello nuevo.
5. **Given** una cuenta con el correo sin verificar, **When** intenta reclamar, **Then** se le pide verificar el correo y no se otorga el sello.
6. **Given** un canje que no puede verificarse, **When** ocurre, **Then** se muestra que no está confirmado.

---

### User Story 3 - Ver mi colección de sellos (Priority: P1)

El usuario consulta su colección en «Mi pasaporte», que muestra el total de sellos obtenidos, y abre cada sello para ver el espectáculo, la fecha, la sede y el recuerdo visual o textual.

**Why this priority**: es la recompensa visible del canje.

**Independent Test**: con tres sellos, se consulta la colección y se abre uno.

**Acceptance Scenarios**:

1. **Given** un usuario con sellos, **When** abre «Mi pasaporte», **Then** ve el total de sellos obtenidos (por ejemplo, «5 sellos»).
2. **Given** «Mi pasaporte», **When** se muestra, **Then** no hay meta global, porcentaje global ni casillero bloqueado de un «próximo sello».
3. **Given** un sello, **When** el usuario lo abre, **Then** ve espectáculo, fecha, sede y el recuerdo visual o textual, si existe.
4. **Given** un sello sin imagen ni texto añadidos por el administrador, **When** se abre, **Then** se muestra con la plantilla común y los datos de la función, sin inventar contenido.
5. **Given** un sello de una función cancelada después de obtenerlo, **When** el usuario lo abre, **Then** sigue en la colección y su detalle muestra el aviso de cancelación.
6. **Given** un sello de una función cancelada, **When** se calcula el progreso de una ruta que ya lo reconocía, **Then** el sello sigue contando (spec 07).
7. **Given** un usuario, **When** consulta su colección, **Then** ve solo sus propios sellos.
8. **Given** un visitante sin cuenta, **When** abre la pestaña Pasaporte, **Then** se le pide identificarse para ver su colección, y la sección de rutas muestra «Próximamente» hasta que exista el spec 07, que la reemplaza con las rutas públicas.

---

### User Story 4 - El administrador gestiona los QR del Pasaporte (Priority: P2)

El administrador genera, activa, desactiva o reemplaza el QR del Pasaporte por función, configura la ventana de canje y el contenido del sello. Reemplazar el QR no elimina sellos obtenidos.

**Why this priority**: sin QR gestionados no hay canje; depende de que las funciones existan (spec 02).

**Independent Test**: se genera un QR, se reemplaza y se comprueba que el anterior queda inválido y que los sellos obtenidos permanecen.

**Acceptance Scenarios**:

1. **Given** una función, **When** el administrador genera y activa su QR, **Then** el canje queda habilitado dentro de la ventana configurada.
2. **Given** un QR reemplazado, **When** se usa el anterior, **Then** se rechaza y los sellos ya obtenidos se conservan.
3. **Given** un QR desactivado, **When** se abre, **Then** el canje se rechaza.
4. **Given** el administrador, **When** configura el contenido del sello, **Then** puede añadir una imagen autorizada, un texto breve o ambos, o ninguno, y se usa en los sellos futuros; los sellos ya emitidos conservan el contenido que tenían.
7. **Given** una función con QR vigente, **When** el administrador la consulta, **Then** ve el QR grande, puede descargarlo en SVG para imprimirlo y ve su enlace.
8. **Given** una función, **When** se intenta activar su QR sin ventana de canje, **Then** el sistema lo rechaza y pide fijar inicio y fin.
9. **Given** una imagen de sello sin texto alternativo o sin autoría, en un formato distinto de JPEG, PNG o WebP, o de más de 1 MB, **When** se sube, **Then** se rechaza; si se acepta, se guarda sin metadatos EXIF.
10. **Given** un texto breve de más de 280 caracteres o con marcado HTML, **When** se guarda, **Then** se rechaza o se guarda como texto plano, nunca como HTML.
5. **Given** un usuario sin rol de administrador, **When** intenta gestionar un QR, **Then** el sistema lo rechaza.
6. **Given** una actividad permanente, **When** solo tiene franjas, **Then** no puede tener QR de Pasaporte; sí puede tenerlo una función puntual de esa actividad.

---

### User Story 5 - Un cambio de fecha, hora o sede desactiva el canje (Priority: P2)

Al publicarse un cambio de fecha, hora o sede de una función con canje habilitado, el canje anterior se desactiva; el administrador puede confirmar una nueva ventana y reactivarlo. Los sellos ya obtenidos se conservan.

**Why this priority**: evita canjes con una ventana que ya no corresponde a la función.

**Independent Test**: se reprograma una función con canje habilitado y se comprueba que el canje queda desactivado y que se reactiva con una nueva ventana.

**Acceptance Scenarios**:

1. **Given** una función con canje habilitado, **When** se publica un cambio de fecha, hora o sede, **Then** el canje se desactiva y la ventana no se mueve sola.
2. **Given** el canje desactivado por el cambio, **When** el administrador confirma una nueva ventana, **Then** puede reactivarlo.
3. **Given** sellos ya obtenidos antes del cambio, **When** se publica el cambio, **Then** se conservan.
4. **Given** una función sin canje habilitado, **When** se publica un cambio, **Then** no se activa nada.
5. **Given** una función cancelada, **When** se abre su QR, **Then** el canje se rechaza.

### Edge Cases

- El QR del Pasaporte puede compartirse: no es prueba estricta de asistencia y esto es una decisión aceptada del producto.
- Un usuario sin conexión o con un enlace que no se puede verificar: se muestra que no está confirmado.
- Un QR de entrada abierto como enlace de canje y un QR de Pasaporte escaneado en el control de acceso (spec 05).
- Dos usuarios distintos con el mismo enlace: cada uno recibe su propio sello.
- Un sello de una función que después se reprograma o se cancela.
- Un usuario que reclama el sello fuera de la sede: el contexto no exige estar en la sede.
- La ventana de canje abierta pero la función aún no empezó, o ya terminó.
- Una función archivada con sellos: se conservan (spec 02).
- Sellos con la plantilla común sola, con imagen, con texto breve o con ambos.
- Un sello de una función cancelada después de obtenerlo.
- Un sello de una función reprogramada después del canje: qué datos muestra está pendiente (P-14).
- El contenido del sello cambia después de emitir algunos sellos: los emitidos conservan su versión y su imagen no se borra.
- El dominio público cambia después de imprimir los QR: hay que reimprimirlos (P-12).
- El enlace de un QR reemplazado: se rechaza como «QR desactivado o reemplazado».

## Requirements *(mandatory)*

### Functional Requirements

**Canje**

- **FR-001**: Al abrir el enlace del QR, el sistema DEBE verificar sesión iniciada con correo verificado, QR vigente, función habilitada y no cancelada, y ventana de canje vigente.
- **FR-002**: El sistema NO DEBE exigir haber comprado ni validado una entrada para reclamar un sello, sea la función gratuita o de pago.
- **FR-003**: El sistema DEBE entregar un solo sello por usuario y función, y si ya existe DEBE mostrar el mismo sello sin tratarlo como error (RC-05).
- **FR-004**: Comprar una entrada NO DEBE entregar el sello automáticamente. Al cancelar una función, el sistema DEBE bloquear nuevos canjes.
- **FR-005**: El sistema NO DEBE ofrecer código manual de canje en el MVP; DEBE bastar abrir el enlace del QR en el navegador.
- **FR-006**: Si el usuario no tiene sesión, el sistema DEBE pedir identificarse y devolverlo al canje, que se revalida (spec 001).

**Rechazos**

- **FR-007**: El sistema DEBE rechazar con su motivo: tipo de código incorrecto (RC-04), QR desactivado o reemplazado, fuera de la ventana de canje (vencido o aún no abierto) y función cancelada.
- **FR-008**: Un QR de entrada NO DEBE reclamar un sello (RC-04).
- **FR-009**: Si el canje no puede verificarse, el sistema DEBE mostrar que no está confirmado.

**Colección**

- **FR-010**: El usuario DEBE poder consultar su colección y abrir cada sello para ver espectáculo, fecha, sede y, cuando el administrador los haya añadido, la imagen y el texto breve.
- **FR-011**: «Mi pasaporte» DEBE mostrar el total de sellos obtenidos y NO DEBE mostrar meta global, porcentaje global ni casilleros bloqueados.
- **FR-012**: Cada usuario DEBE ver solo sus propios sellos.
- **FR-013**: Un visitante sin cuenta DEBE poder ver las rutas públicas y DEBE identificarse para ver su colección.

**Administración de QR**

- **FR-014**: El administrador DEBE poder generar, activar, desactivar o reemplazar el QR del Pasaporte por función, configurar la ventana de canje y el contenido del sello. Cada función DEBE tener como máximo un QR vigente.
- **FR-015**: Reemplazar el QR NO DEBE eliminar sellos obtenidos.
- **FR-016**: Solo las funciones con fecha y hora (incluidas las funciones puntuales de actividades permanentes) DEBEN poder tener QR de Pasaporte; una franja de apertura NO DEBE entregar sellos.
- **FR-017**: Solo el administrador DEBE poder gestionar los QR del Pasaporte.
- **FR-018**: Al publicarse un cambio de fecha, hora o sede de una función con canje habilitado, el sistema DEBE desactivar el canje anterior; la ventana NO DEBE moverse automáticamente.
- **FR-019**: El administrador DEBE poder confirmar una nueva ventana y reactivar el canje, y los sellos ya obtenidos DEBEN conservarse.
- **FR-020**: Los cambios de QR, ventana y contenido del sello DEBEN quedar en el historial (RC-06).

**Sello de una función cancelada y contenido del sello** (decisiones cerradas el 2026-11-20; véase Clarifications)

- **FR-021**: Los sellos obtenidos antes de la cancelación de una función DEBEN seguir en la colección, DEBEN mostrar el aviso de cancelación en su detalle y DEBEN seguir contando para las rutas que ya los reconocían. La cancelación NO DEBE retirar sellos.
- **FR-022**: El sello DEBE mostrar siempre los datos de la función en una plantilla común de VIVART. El administrador PUEDE añadir una imagen autorizada, un texto breve o ambos; ninguno DEBE ser obligatorio para emitir el sello.

**Ventana, contenido, imagen y QR impreso** (decisiones cerradas el 2026-11-20; véase Clarifications)

- **FR-023**: La ventana de canje NO DEBE tener valor por defecto: activar el QR DEBE exigir un inicio y un fin fijados por el administrador (M-10).
- **FR-024**: El contenido del sello DEBE versionarse: cada sello DEBE conservar la versión vigente al emitirse, y una imagen NO DEBE borrarse mientras algún sello la use (M-11).
- **FR-025**: La imagen del sello DEBE tener texto alternativo y autoría, ser propia o con licencia que permita reutilizarla, y ser JPEG, PNG o WebP de hasta 1 MB, validada por su contenido; NO DEBE aceptarse SVG y NO DEBEN conservarse metadatos EXIF. El texto breve DEBE tener hasta 280 caracteres y tratarse siempre como texto plano (M-12).
- **FR-026**: El enlace del QR DEBE ser `/pasaporte/canje/{ref}`, con un `ref` aleatorio e impredecible que no sea el identificador de la función. Al reemplazar el QR DEBE crearse un `ref` nuevo y el anterior DEBE rechazarse como «QR desactivado o reemplazado» (M-13).
- **FR-027**: El panel DEBE mostrar el QR vigente de cada función con descarga en SVG para imprimirlo y su enlace (M-13).
- **FR-028**: Mientras no exista el spec 07, la sección de rutas del Pasaporte DEBE mostrar «Próximamente» (M-13).

### Key Entities

- **QR de Pasaporte**: código por función que se abre como enlace `/pasaporte/canje/{ref}` para reclamar un sello; puede estar activo, desactivado o reemplazado, y solo uno está vigente por función.
- **Ventana de canje**: intervalo en que el canje de una función es válido.
- **Sello**: recuerdo de una función en una plantilla común de VIVART, con espectáculo, fecha y sede, y una imagen autorizada y un texto breve opcionales; único por usuario y función. Si la función se cancela, conserva su aviso.
- **Contenido del sello (versión)**: imagen autorizada y texto breve opcionales de una función, en una versión; los sellos apuntan a la versión vigente al emitirse.
- **Colección**: sellos de un usuario, con su total.
- **Motivo de rechazo del canje**: razón por la que un canje no procede.
- **Función habilitada para Pasaporte**: función con fecha y hora con canje activado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de los canjes válidos (sesión verificada, QR vigente, función habilitada y no cancelada, ventana vigente) entrega un sello, sin exigir entrada.
- **SC-002**: Ante cualquier cantidad de aperturas del mismo enlace por el mismo usuario, existe exactamente 1 sello por función, y el 100 % de las repeticiones muestra el mismo sello, incluso con solicitudes simultáneas.
- **SC-003**: El 100 % de los QR de entrada abiertos como canje se rechaza con «tipo de código incorrecto» y 0 sellos se otorgan.
- **SC-004**: El 100 % de los rechazos (QR desactivado o reemplazado, fuera de la ventana, función cancelada, correo sin verificar) muestra su motivo.
- **SC-005**: Tras reemplazar un QR o publicar un cambio de fecha, hora o sede, 0 sellos obtenidos se eliminan y el canje anterior queda desactivado en el 100 % de los casos.
- **SC-006**: «Mi pasaporte» muestra el total de sellos y 0 metas globales, porcentajes globales o casilleros bloqueados.
- **SC-007**: 0 usuarios ven sellos de otra cuenta.
- **SC-008**: 0 franjas de apertura tienen QR de Pasaporte; solo las funciones con fecha y hora.
- **SC-009**: 0 usuarios sin rol de administrador consiguen gestionar un QR, incluso con solicitudes directas.
- **SC-010**: El 100 % de los cambios de QR, ventana y contenido queda en el historial.
- **SC-011**: El 100 % de los sellos obtenidos antes de una cancelación sigue en la colección con el aviso en su detalle, y 0 canjes nuevos se aceptan después de la cancelación.
- **SC-012**: El 100 % de los sellos se emite con la plantilla común aunque no tenga imagen ni texto, y 0 sellos exigen contenido adicional para emitirse.
- **SC-013**: Tras cambiar el contenido del sello, el 100 % de los sellos ya emitidos conserva su contenido anterior y 0 imágenes en uso se borran.
- **SC-014**: 0 QR se activan sin ventana de canje, y 0 funciones tienen más de un QR vigente.
- **SC-015**: El 100 % de las imágenes de sello aceptadas tiene texto alternativo y autoría y se guarda sin metadatos EXIF; 0 textos breves se muestran como HTML.

## Trazabilidad con el contexto

| Contexto | Cubierto por |
|---|---|
| RF-25, P-03 | FR-014 a FR-020; Historias 4 y 5 |
| RF-26, RC-04, RC-05 | FR-001 a FR-009; Historias 1 y 2 |
| R-06 (sello de función cancelada y contenido del sello) | FR-004, FR-010, FR-021, FR-022; Historias 3, 4 y 5 |
| M-10 (ventana sin valor por defecto) | FR-023; SC-014 |
| M-11 (contenido versionado) | FR-024; SC-013 |
| M-12 (imagen y texto del sello) | FR-025; SC-015 |
| M-13 (QR único, enlace e impresión; rutas «Próximamente») | FR-014, FR-026, FR-027, FR-028; SC-014 |
| P-14 (datos de un sello reprogramado, pendiente) | Sin requisito hasta que el equipo decida |
| P-12 (dominio para imprimir los QR, pendiente) | FR-026 |
| RF-27, M-01 | FR-010 a FR-013; Historia 3 |
| RNF-04 | FR-012, FR-017; SC-007, SC-009 |
| RNF-06 | FR-003; SC-002 |
| RNF-07 | FR-009 |
| RNF-01 | FR-005, FR-006 |

## Assumptions

- La cuenta, el correo verificado y el retorno al canje vienen del spec 001; las funciones, de los specs 02 y 05; las rutas y la insignia, del spec 07.
- El QR del Pasaporte se comparte como enlace, y el producto lo acepta como no prueba estricta de asistencia.
- La pantalla de Pasaporte tiene mockup solo como referencia visual; el requisito prevalece sobre su meta global («5 de 12») y su casillero bloqueado.
- No existe un mockup del canje ni de la vista de un sello individual.
- El contexto no exige estar físicamente en la sede para reclamar; la ventana de canje es el único control temporal.
