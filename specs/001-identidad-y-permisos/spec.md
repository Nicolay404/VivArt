# Feature Specification: Identidad, perfil y permisos

**Feature Branch**: `001-identidad-y-permisos`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Spec 01 de 8 de VIVART: Identidad, perfil y permisos. Redactar la especificación sin plan técnico ni implementación. Fuente de verdad: `context/`. Alcance: RF-01, RF-02, RF-03, RF-04 y RF-04b; reglas RC-01 y RC-06; verificaciones RNF-02, RNF-04, RNF-05 y RNF-09 en lo que toca a identidad y permisos."

## Clarifications

### Session 2026-11-19

- Q: ¿Cómo se habilita el primer administrador? → A: Un procedimiento interno y documentado del equipo habilita la primera cuenta administrativa para un correo designado; su titular establece su contraseña al activarla. No hay registro público especial ni credenciales predeterminadas en el repositorio; después, un administrador activo asigna roles. El registro público nunca otorga permisos internos.
- Q: ¿Qué datos y credenciales pide el registro público? → A: Solo un correo electrónico único y una contraseña de al menos 15 caracteres, sin reglas de composición, con espacios permitidos, pegado desde un gestor permitido y una longitud máxima admitida de al menos 64 caracteres. No se piden cédula, teléfono ni dirección.
- Q: ¿Cómo se verifica la cuenta y se recupera el acceso? → A: Un enlace de verificación por correo al registrarse. Comprar o reclamar un sello exige una cuenta con correo verificado; Agenda, Mapa y Alforjita siguen abiertos sin cuenta. Recuperar el acceso usa un enlace de un solo uso y con vencimiento, y la pantalla muestra el mismo mensaje exista o no el correo. En la demo se puede usar un buzón de pruebas. El proveedor de correo y los plazos exactos de los enlaces se deciden en el plan técnico.

## Alcance y límites

Este spec define **quién puede hacer qué** en VIVART: la consulta pública sin cuenta, la identificación de usuarios, los roles y sus permisos, la revocación de roles y el historial de las operaciones sensibles de permisos. Es el primero de un máximo de ocho specs y los demás dependen de él.

**Dentro de este spec:** RF-01, RF-02, RF-03, RF-04, RF-04b, RC-01 y RC-06 (en lo que toca a permisos), y las verificaciones RNF-02, RNF-04, RNF-05 y RNF-09 aplicables a identidad y permisos.

**Fuera de este spec** (solo son dependencias; cada uno define sus propios flujos):

- Programación, borradores, revisión y publicación (spec 02): aquí solo se fija **quién** puede hacerlo; el flujo editorial es del spec 02.
- Mapa (03), Mi recorrido (04), carrito, compra y control de entradas (05), Pasaporte y sellos (06), rutas e insignias (07) y Alforjita (08).
- La elección de arquitectura y de tecnología: queda para la etapa de planes técnicos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar sin cuenta (Priority: P1)

Un visitante abre VIVART desde el celular y consulta la Agenda, las fichas, el Mapa y Alforjita, prepara un carrito y guarda su recorrido en su navegador, sin registrarse ni identificarse.

**Why this priority**: es la puerta de entrada al producto. El propósito del bloque es mantener abierta la consulta pública y pedir identificación solo cuando la acción lo requiera.

**Independent Test**: se puede probar abriendo VIVART sin sesión y comprobando que se consulta, se prepara un carrito y se guarda una función, sin que aparezca ninguna petición de identificación ni de ubicación.

**Acceptance Scenarios**:

1. **Given** un visitante sin sesión, **When** abre Agenda, una ficha, el Mapa o Alforjita, **Then** puede consultarlos sin identificarse.
2. **Given** un visitante sin sesión, **When** agrega funciones a un carrito o guarda funciones en su recorrido, **Then** el sistema lo permite sin pedir cuenta.
3. **Given** un visitante sin sesión, **When** intenta pagar, canjear un sello o abrir Perfil, **Then** el sistema le pide identificarse solo en ese momento (Historia 2).
4. **Given** un visitante sin sesión, **When** consulta Agenda o Mapa, **Then** el sistema no le exige compartir su ubicación.

---

### User Story 2 - Identificarse y retomar la acción (Priority: P1)

Una persona pide pagar o canjear un sello, el sistema le pide identificarse (registrarse o iniciar sesión) y, al terminar, vuelve exactamente a la acción que había iniciado, que el sistema revalida.

**Why this priority**: comprar y canjear exigen identidad. Si la persona pierde lo que estaba haciendo al identificarse, abandona la compra o el sello.

**Independent Test**: se puede probar iniciando una compra o un canje sin sesión, identificándose y verificando que se retoma la acción y que, si ya no es válida, se explica el motivo.

**Acceptance Scenarios**:

1. **Given** un visitante con ítems en el carrito, **When** inicia el pago y se identifica, **Then** vuelve al carrito con su contenido y el sistema verifica que siga siendo válido antes de continuar.
2. **Given** un visitante que abre el enlace de un QR de Pasaporte, **When** se identifica, **Then** vuelve al canje y el sistema verifica que siga siendo válido.
3. **Given** una acción retomada que ya no es válida (cupo agotado, QR vencido o función cancelada), **When** el sistema la revalida, **Then** indica el motivo y ofrece volver a la ficha o al carrito, sin completar la acción.
4. **Given** una persona sin cuenta, **When** se registra durante una compra o un canje, **Then** debe verificar su correo e iniciar sesión, y entonces retoma la misma acción y el sistema comprueba si sigue vigente.
5. **Given** una cuenta registrada cuyo correo no está verificado, **When** intenta completar una compra o reclamar un sello, **Then** el sistema no lo permite, le indica que falta verificar el correo y le ofrece reenviar el enlace.

---

### User Story 3 - Cada rol solo hace lo que le corresponde (Priority: P1)

El sistema aplica en todo momento los permisos de los roles: el editor solo prepara y edita sus propios borradores y los envía a revisión, pero no publica; el publicador y el administrador revisan, editan propuestas ajenas y publican; el personal de acceso solo valida las funciones que se le asignan; y publicar no activa ventas.

**Why this priority**: es el núcleo de seguridad del producto. Un permiso mal aplicado permite publicar sin revisión o validar entradas de funciones ajenas.

**Independent Test**: se puede probar con una cuenta por rol y una matriz de acciones, incluyendo solicitudes directas al sistema que no pasan por la interfaz, y verificando que cada acción no concedida se rechaza.

**Acceptance Scenarios**:

1. **Given** un usuario solo con rol de editor, **When** intenta publicar una ficha, **Then** el sistema lo rechaza, **incluso si la solicitud se hace de forma directa al sistema sin pasar por la interfaz**.
2. **Given** un editor, **When** intenta editar un borrador ajeno, **Then** el sistema lo rechaza.
3. **Given** un publicador o un administrador, **When** edita o aprueba una propuesta ajena, **Then** el sistema lo permite y registra quién lo hizo.
4. **Given** un publicador, **When** publica una ficha que él mismo editó, **Then** el sistema lo permite sin exigir una segunda persona.
5. **Given** un usuario con rol de publicador pero sin permiso para activar ventas, **When** publica una función, **Then** la venta de esa función no se activa.
6. **Given** un integrante del personal de acceso, **When** intenta validar una entrada de una función que no se le asignó, **Then** el sistema lo rechaza.
7. **Given** un usuario registrado sin rol interno, **When** intenta consultar pedidos o entradas de otra cuenta o abrir el panel interno, **Then** el sistema lo rechaza.

---

### User Story 4 - El administrador asigna y revoca roles (Priority: P2)

Un administrador asigna y revoca roles a las personas, incluyendo varios roles a la misma persona, y asigna al personal de acceso las funciones que puede validar.

**Why this priority**: sin esta gestión nadie puede ocupar los roles internos. Se prioriza después de que los permisos existan (Historia 3).

**Independent Test**: se puede probar asignando uno y varios roles a una cuenta y verificando que sus permisos son la suma de los roles activos; revocando uno y verificando que pierde solo lo que ese rol concedía.

**Acceptance Scenarios**:

1. **Given** un administrador, **When** asigna el rol de editor a un usuario, **Then** el usuario puede preparar borradores y nada más.
2. **Given** un usuario con roles de editor y publicador, **When** actúa, **Then** puede realizar las acciones de ambos roles y se rechaza cualquier otra.
3. **Given** un integrante del personal de acceso, **When** el administrador le asigna dos funciones, **Then** solo puede validar entradas de esas dos funciones.
4. **Given** un usuario sin rol de administrador, **When** intenta asignar o revocar roles, **Then** el sistema lo rechaza.
5. **Given** que el contexto no define permisos por organización, **When** se asigna un rol, **Then** el rol no se limita por organización.

---

### User Story 5 - Revocar un rol sin perder trabajo (Priority: P2)

Cuando el administrador revoca un rol, el usuario pierde únicamente las acciones que ese rol concedía; sus borradores y propuestas pendientes se conservan con su autor e historial, el administrador puede reasignarlos, otro publicador puede continuar una revisión y el contenido publicado sigue visible.

**Why this priority**: evita perder trabajo editorial y garantiza que un cambio de permisos no altere la programación pública.

**Independent Test**: se puede probar con un editor que tiene un borrador y una propuesta pendiente, revocándole el rol y verificando que el trabajo se conserva, se reasigna y no se despublica nada.

**Acceptance Scenarios**:

1. **Given** un editor con un borrador y una propuesta pendiente, **When** el administrador le revoca el rol, **Then** el borrador y la propuesta se conservan con su autor e historial.
2. **Given** un borrador conservado, **When** el administrador lo reasigna a otra persona, **Then** la nueva persona puede continuarlo y el historial refleja la reasignación.
3. **Given** una revisión pendiente de un publicador cuyo rol se revocó, **When** otro publicador la continúa, **Then** el sistema lo permite.
4. **Given** contenido ya publicado por un usuario al que se le revoca el rol, **When** se completa la revocación, **Then** el contenido sigue visible y no se despublica.
5. **Given** un usuario con varios roles, **When** se revoca uno, **Then** conserva las acciones de los roles restantes.

---

### User Story 6 - Entender por qué se rechaza una acción (Priority: P2)

Cuando una acción se rechaza por permisos, la persona recibe un mensaje que indica qué rol falta, sin que el mensaje revele contenido que no puede ver.

**Why this priority**: los roles internos deben entender qué pueden hacer y por qué se rechaza una acción; un mensaje confuso o demasiado revelador es un problema operativo y de seguridad.

**Independent Test**: se puede probar intentando acciones no concedidas con cada rol y revisando que el mensaje nombra el rol faltante y no incluye datos del contenido protegido.

**Acceptance Scenarios**:

1. **Given** un editor que intenta publicar, **When** el sistema lo rechaza, **Then** el mensaje indica que falta el rol de publicador.
2. **Given** un usuario que intenta abrir un borrador ajeno al que no tiene acceso, **When** el sistema lo rechaza, **Then** el mensaje no muestra título, texto ni autor del borrador.
3. **Given** el mismo rechazo, **When** se consulta el campo o la pantalla afectada, **Then** el mensaje aparece junto a la acción que lo originó.

---

### User Story 7 - Registro de acceso y recuperación de cuenta (Priority: P2)

Una persona se registra, inicia y cierra sesión, recupera el acceso si lo pierde y consulta solo sus propios pedidos, entradas, sellos e insignias desde los espacios correspondientes.

**Why this priority**: es la base de identidad de cada usuario, pero depende de decisiones pendientes (credenciales y verificación) que se resuelven antes de planificar.

**Independent Test**: se puede probar registrando una cuenta, cerrando e iniciando sesión, recuperando el acceso y verificando que solo se ven los datos propios.

**Acceptance Scenarios**:

1. **Given** una persona sin cuenta, **When** se registra con un correo único y una contraseña válida, **Then** recibe un enlace de verificación por correo y, al verificarlo e iniciar sesión, queda identificada y puede retomar la acción que originó el registro.
2. **Given** un usuario con sesión, **When** la cierra, **Then** vuelve a ser un visitante y deja de acceder a sus datos.
3. **Given** un usuario que perdió su acceso, **When** pide recuperarlo con su correo, **Then** el sistema envía un enlace de un solo uso y con vencimiento, y la pantalla muestra el mismo mensaje tanto si el correo está registrado como si no.
4. **Given** un usuario con sesión, **When** consulta Perfil o Pasaporte, **Then** ve solo sus propios pedidos, entradas, sellos e insignias.
5. **Given** un enlace de recuperación ya usado o vencido, **When** se abre, **Then** el sistema no permite cambiar la contraseña y ofrece pedir uno nuevo.
6. **Given** una contraseña de menos de 15 caracteres, **When** se intenta registrar o recuperar, **Then** el sistema la rechaza y explica el requisito junto al campo; **given** una contraseña de 15 o más caracteres con espacios y sin mayúsculas, números ni símbolos, **then** el sistema la acepta.

---

### User Story 9 - Habilitar la primera cuenta de administrador (Priority: P1)

El equipo habilita la primera cuenta administrativa para un correo designado mediante un procedimiento interno y documentado. Su titular establece su contraseña al activarla y, desde ahí, asigna roles a otras cuentas.

**Why this priority**: sin una primera cuenta administrativa nadie puede asignar roles internos y el panel no se puede poner en marcha. (Se numera 9 para conservar las referencias a las historias 1 a 8.)

**Independent Test**: se puede probar siguiendo el procedimiento documentado con un correo designado, activando la cuenta, estableciendo la contraseña y asignando un rol a otra cuenta.

**Acceptance Scenarios**:

1. **Given** un correo designado por el equipo, **When** se aplica el procedimiento interno documentado, **Then** se habilita una cuenta administrativa cuyo titular establece su propia contraseña al activarla.
2. **Given** el repositorio y la configuración del proyecto, **When** se revisan, **Then** no contienen credenciales predeterminadas de ningún administrador.
3. **Given** una persona que se registra públicamente con cualquier correo, incluido el designado, **When** completa el registro, **Then** obtiene solo el rol de usuario registrado y ningún permiso interno.
4. **Given** un administrador activo, **When** asigna roles a otras cuentas, **Then** el sistema lo permite (Historia 4).

---

### User Story 8 - Historial de operaciones sensibles de permisos (Priority: P3)

Un administrador autorizado consulta quién asignó, revocó o reasignó permisos o trabajo, cuándo y sobre qué registro.

**Why this priority**: da trazabilidad a los cambios de permisos. Importa, pero el producto funciona sin la consulta si el registro existe.

**Independent Test**: se puede probar asignando, revocando y reasignando, y consultando el historial para identificar a quien lo hizo, la fecha y el registro afectado.

**Acceptance Scenarios**:

1. **Given** una asignación, una revocación o una reasignación, **When** se completa, **Then** el historial conserva quién la hizo, cuándo y sobre qué registro.
2. **Given** un administrador autorizado, **When** consulta el historial, **Then** identifica quién hizo el cambio, cuándo y qué registro afectó.
3. **Given** un usuario sin rol de administrador, **When** intenta consultar el historial, **Then** el sistema lo rechaza.

### Edge Cases

- ¿Qué pasa si un usuario tiene un rol revocado mientras tiene una acción en curso? La acción se revalida en el momento de ejecutarse con los roles activos, no con los del inicio.
- ¿Qué pasa si una persona intenta una acción de un rol que no tiene mediante una solicitud directa al sistema? Se rechaza igual que desde la interfaz.
- ¿Qué pasa si un usuario tiene varios roles y uno se revoca? Conserva las acciones de los demás.
- ¿Qué pasa si el personal de acceso tiene asignadas cero funciones? No puede validar ninguna entrada.
- ¿Qué pasa si una persona se identifica y la acción original ya no es válida (cupo agotado, QR vencido, función cancelada)? Se muestra el motivo y se ofrece volver a la ficha o al carrito.
- ¿Qué pasa si el visitante cierra el navegador antes de identificarse? Conserva lo que tenía guardado localmente (carrito y recorrido), sin cuenta.
- ¿Qué pasa si la identificación falla o no se puede verificar? La acción no se completa y se muestra que no está confirmada.
- ¿Qué pasa si una persona se registra con un correo ya registrado? El sistema no crea una segunda cuenta; el correo es único.
- ¿Qué pasa si el enlace de verificación o el de recuperación se abre dos veces o después de vencer? El segundo uso o el uso vencido se rechaza y se ofrece pedir uno nuevo.
- ¿Qué pasa si alguien pide recuperar el acceso de un correo no registrado? La pantalla muestra el mismo mensaje que si estuviera registrado y no revela si la cuenta existe.
- ¿Qué pasa si una persona pega una contraseña desde un gestor? El sistema la acepta, incluidos los espacios, hasta la longitud máxima admitida (al menos 64 caracteres).
- ¿Qué pasa si se revoca el último rol de administrador? El contexto no lo define: queda como pendiente registrado en Assumptions.
- ¿Qué pasa si un usuario se asigna o se revoca roles a sí mismo? El contexto no lo define: queda como pendiente registrado en Assumptions.

## Requirements *(mandatory)*

### Functional Requirements

**Consulta pública e identificación**

- **FR-001**: El sistema DEBE permitir a un visitante sin cuenta consultar Agenda, fichas, Mapa y Alforjita, preparar un carrito y guardar su recorrido local.
- **FR-002**: El sistema NO DEBE exigir ubicación ni identificación para consultar Agenda o Mapa.
- **FR-003**: El sistema DEBE pedir identificación únicamente cuando la acción lo requiera (pagar, canjear un sello, consultar datos de cuenta o usar el panel interno). Pagar y canjear un sello exigen además una cuenta con correo verificado (FR-029).
- **FR-004**: El sistema DEBE permitir a una persona registrarse, iniciar sesión y cerrar sesión.
- **FR-005**: El sistema DEBE permitir a un usuario recuperar el acceso a su cuenta mediante un enlace enviado por correo (FR-029).
- **FR-006**: El sistema DEBE permitir a cada usuario consultar solo sus propios pedidos, entradas, sellos e insignias, y NO DEBE permitirle consultar los de otra cuenta.

**Retorno a la acción original**

- **FR-007**: Cuando una compra o un canje requiere identificación, el sistema DEBE devolver a la persona a esa misma acción al terminar de identificarse. Si la cuenta es nueva, la acción se retoma después de verificar el correo e iniciar sesión.
- **FR-008**: Al retomar la acción, el sistema DEBE comprobar que todavía sea válida; si ya no lo es, DEBE indicar el motivo y ofrecer volver a la ficha o al carrito sin completar la acción.

**Roles y permisos**

- **FR-009**: El sistema DEBE reconocer los roles visitante, usuario registrado, editor, publicador, administrador y personal de acceso, y permitir que una persona tenga varios roles.
- **FR-010**: Los permisos de una persona DEBEN ser la suma de sus roles activos, y toda acción DEBE rechazarse si ningún rol activo la concede.
- **FR-011**: El administrador DEBE poder asignar y revocar roles, y asignar al personal de acceso las funciones que puede validar. Solo el administrador PUEDE hacerlo.
- **FR-012**: El editor DEBE poder crear y editar **sus propios** borradores y enviarlos a revisión, y NO DEBE poder publicar ni editar borradores ajenos. Esta regla DEBE cumplirse también en solicitudes directas al sistema que no pasan por la interfaz.
- **FR-013**: El publicador y el administrador DEBEN poder revisar y editar propuestas ajenas, y aprobar y publicar, incluidas las fichas que ellos mismos editaron; no se exige una segunda persona. El administrador DEBE poder además crear y publicar eventos, cargar el catálogo o la programación planificada y reasignar borradores. El detalle del flujo editorial es del spec 02.
- **FR-014**: Publicar contenido NO DEBE activar ventas por sí solo. La activación de ventas se rige por el spec 05.
- **FR-015**: El personal de acceso DEBE poder validar entradas solo de las funciones que se le asignan, y NO DEBE poder validar las de otras funciones.
- **FR-016**: No DEBEN existir permisos por organización; la organización es solo un dato de la ficha.
- **FR-017**: Los permisos DEBEN verificarse en el momento de ejecutar cada acción con los roles activos en ese momento, y no depender de lo que muestre la interfaz.

**Revocación**

- **FR-018**: Al revocar un rol, el usuario DEBE perder solo las acciones que ese rol concedía y conservar las de sus demás roles.
- **FR-019**: Al revocar un rol, los borradores y propuestas pendientes del usuario DEBEN conservarse con su autor e historial.
- **FR-020**: El administrador DEBE poder reasignar el trabajo conservado, y otro publicador DEBE poder continuar una revisión pendiente.
- **FR-021**: Revocar un rol NO DEBE despublicar contenido ya publicado.

**Rechazos**

- **FR-022**: Toda acción rechazada por permisos DEBE indicar qué rol falta y mostrarse junto a la acción que la originó.
- **FR-023**: El mensaje de rechazo NO DEBE revelar contenido que el usuario no puede ver (por ejemplo, título, texto o autor de un borrador ajeno).

**Historial y privacidad**

- **FR-024**: Toda asignación o revocación de roles, asignación de funciones al personal de acceso y reasignación de borradores DEBE conservar quién la hizo, cuándo y sobre qué registro.
- **FR-025**: Un administrador autorizado DEBE poder consultar ese historial, y ningún otro rol PUEDE hacerlo.
- **FR-026**: El sistema NO DEBE exponer credenciales ni códigos privados en registros operativos.

**Primer administrador, credenciales, verificación y recuperación** (decisiones cerradas el 2026-11-19; véase Clarifications)

- **FR-027**: El sistema DEBE permitir que el equipo habilite la primera cuenta administrativa para un correo designado mediante un procedimiento interno y documentado, y su titular DEBE establecer su propia contraseña al activarla. NO DEBE existir un registro público especial para el primer administrador ni credenciales predeterminadas en el repositorio. A partir de esa cuenta, un administrador activo DEBE poder asignar roles a otras cuentas.
- **FR-028**: El registro público DEBE pedir únicamente un correo electrónico único y una contraseña, y NUNCA DEBE otorgar permisos internos. La contraseña DEBE tener al menos 15 caracteres, DEBE permitir espacios y pegarse desde un gestor de contraseñas, DEBE admitir una longitud máxima de al menos 64 caracteres y NO DEBE exigir combinaciones de mayúsculas, números o símbolos. El sistema NO DEBE pedir cédula, teléfono ni dirección para crear una cuenta.
- **FR-029**: Al registrarse, el sistema DEBE enviar un enlace de verificación al correo. Pagar y canjear un sello DEBEN exigir una cuenta con correo verificado, mientras que Agenda, Mapa y Alforjita permanecen abiertos sin cuenta. Tras verificar el correo e iniciar sesión, el sistema DEBE permitir retomar la acción original y comprobar si sigue vigente. Para recuperar el acceso, el sistema DEBE enviar un enlace de un solo uso y con vencimiento, y DEBE mostrar el mismo mensaje tanto si el correo está registrado como si no.
- **FR-030**: Para la demo DEBE poder comprobarse la verificación y la recuperación sin enviar correos reales, mediante un buzón de pruebas. La elección del proveedor de correo y los plazos exactos de los enlaces corresponden al plan técnico.

**Retorno a la acción original** (contrato con los specs 05 y 06: este spec garantiza el regreso y la revalidación; cada spec dueño define sus comprobaciones y no se duplican aquí)

- **FR-031**: Antes de pedir identificación por una compra o un canje, el sistema DEBE conservar la acción pendiente (su tipo y su referencia) para poder retomarla.
- **FR-032**: Tras identificarse (iniciar sesión, o registrarse, verificar el correo e iniciar sesión), el sistema DEBE devolver a la persona al punto donde estaba: el carrito con su contenido en una compra, o el enlace del QR de la función en un canje.
- **FR-033**: Al retomar la acción, el sistema DEBE volver a comprobar su vigencia con las reglas del spec dueño. Retomar la acción NO DEBE ejecutar automáticamente un pago ni un canje desde este spec: qué ocurre después de revalidar (por ejemplo, si se pide una confirmación) lo define el spec dueño de cada flujo (spec 05 para la compra y spec 06 para el canje).
- **FR-034**: Si la comprobación falla, el sistema DEBE indicar el motivo y ofrecer volver a la ficha o al carrito, sin completar la acción.
- **FR-035**: Si la cuenta no tiene el correo verificado, el sistema DEBE impedir completar la compra o el canje, indicarlo y ofrecer reenviar el enlace; la acción pendiente se retoma tras verificar el correo e iniciar sesión (FR-029).

| Acción pendiente | Qué se conserva | Dónde se retoma | Qué se vuelve a comprobar y quién lo define |
|---|---|---|---|
| Compra (pagar) | El carrito y su contenido | El carrito, antes de pagar | Precio, vigencia y cupos (spec 05, FR-007) |
| Canje de sello | La referencia al QR de la función | El enlace del QR, antes de reclamar | QR vigente, función habilitada y no cancelada y ventana de canje vigente (spec 06, FR-001) |

Este spec **no** construye el carrito, el pago ni el canje de sellos: solo garantiza que la persona vuelva a esas acciones identificada y que se revaliden.

### Key Entities

- **Cuenta de usuario**: persona identificada en VIVART. Atributos clave: correo electrónico único, contraseña, estado de verificación del correo y roles activos. No se guarda cédula, teléfono ni dirección.
- **Enlace de verificación**: enlace enviado al correo al registrarse; confirma que el correo pertenece a la persona.
- **Enlace de recuperación**: enlace de un solo uso y con vencimiento para restablecer la contraseña.
- **Rol**: conjunto de acciones permitidas (visitante, usuario registrado, editor, publicador, administrador, personal de acceso).
- **Asignación de rol**: vínculo entre una cuenta y un rol, con quién lo asignó y cuándo. Para el personal de acceso incluye las funciones que puede validar.
- **Acción pendiente de identificación**: la compra (carrito) o el canje (referencia al QR de la función) que una persona había iniciado sin sesión; se conserva, se retoma tras identificarse y se revalida con las reglas del spec dueño.
- **Borrador o propuesta**: contenido editorial con autor e historial; su ciclo de vida es del spec 02, pero su conservación al revocar roles se define aquí.
- **Registro de historial**: constancia de una operación sensible (quién, cuándo, sobre qué registro).
- **Mensaje de rechazo**: respuesta que indica el rol faltante sin revelar contenido protegido.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En una matriz de pruebas con una cuenta por rol, el 100 % de las acciones no concedidas por los roles activos se rechaza, incluidas las solicitudes directas al sistema que no pasan por la interfaz.
- **SC-002**: Un visitante sin cuenta completa la consulta de Agenda, fichas, Mapa y Alforjita, el armado de un carrito y el guardado de su recorrido sin ninguna petición de identificación ni de ubicación (0 peticiones).
- **SC-003**: En el 100 % de los intentos de compra o canje que exigen identificación, la persona vuelve a la acción original tras identificarse, y las acciones que ya no son válidas muestran su motivo en lugar de completarse.
- **SC-004**: Un usuario con varios roles puede hacer en el 100 % de los casos las acciones de todos sus roles activos, y tras revocar uno pierde solo las de ese rol.
- **SC-005**: Tras revocar un rol, 0 borradores o propuestas pendientes se pierden y 0 contenidos publicados dejan de ser visibles.
- **SC-006**: En el 100 % de los rechazos por permisos, el mensaje indica el rol faltante y no incluye título, texto ni autor de contenido que el usuario no puede ver.
- **SC-007**: El 100 % de las asignaciones, revocaciones y reasignaciones queda en el historial, y un administrador autorizado puede identificar quién, cuándo y sobre qué registro en cada caso.
- **SC-008**: 0 usuarios pueden consultar pedidos, entradas, sellos o insignias de otra cuenta en las pruebas de acceso.
- **SC-009**: El personal de acceso con N funciones asignadas puede validar entradas de exactamente esas N funciones y de ninguna otra.
- **SC-010**: El registro público pide exactamente 2 datos (correo y contraseña) y 0 datos adicionales como cédula, teléfono o dirección.
- **SC-011**: En las pruebas de contraseña, el 100 % de las contraseñas de menos de 15 caracteres se rechaza, y el 100 % de las de 15 a 64 caracteres con espacios y sin reglas de composición se acepta.
- **SC-012**: En el 100 % de los intentos de compra o canje con una cuenta sin correo verificado, la acción no se completa y se explica que falta verificar; tras verificar e iniciar sesión, la acción se retoma y se revalida.
- **SC-013**: Para un correo registrado y uno no registrado, la pantalla de recuperación muestra el mismo mensaje en el 100 % de los casos.
- **SC-014**: Un enlace de recuperación o de verificación usado una vez o vencido se rechaza en el 100 % de los intentos posteriores.
- **SC-015**: 0 cuentas obtienen permisos internos a través del registro público, y 0 credenciales predeterminadas de administrador existen en el repositorio.
- **SC-016**: La verificación y la recuperación pueden comprobarse de principio a fin en la demo sin enviar ningún correo real.
- **SC-017**: En el 100 % de los retornos tras identificarse, la vigencia de la compra o del canje se vuelve a comprobar, y 0 pagos o canjes se ejecutan automáticamente por el solo hecho de retomar la acción desde este spec.
- **SC-018**: El 100 % de las acciones retomadas con una comprobación fallida muestra el motivo y ofrece volver a la ficha o al carrito.

## Anexo técnico y de arquitectura

Este anexo fija las **restricciones** que este spec y los otros siete heredan. **No elige el estilo arquitectónico ni la tecnología**: esa elección se toma aparte y debe quedar acordada antes de los planes técnicos (constitución, principios III y IV). No es un spec nuevo.

**Restricciones de arquitectura (obligatorias, de la constitución y del contexto)**

- **AN-001**: VIVART tiene **una sola arquitectura compartida** por los ocho specs.
- **AN-002**: Esa arquitectura se documenta en **cuatro vistas**, con Mermaid o DeepWiki.
- **AN-003**: **No se permite el monolito modular.** El estilo elegido debe poder justificarse frente a esta restricción.
- **AN-004**: La elección del estilo se acuerda por el equipo **antes de los planes técnicos**, y no antes de redactar los requisitos. Ningún spec la presupone.

**Capacidades transversales que la arquitectura debe permitir** (cada una se verifica en `context/requirements/no-funcionales.md`; aquí solo se enumeran para que los planes las contemplen)

- **AN-005**: Verificación de identidad, rol, ámbito y propiedad de los datos en el servidor, en cada acción (RNF-04; FR-012, FR-017).
- **AN-006**: Historial de operaciones sensibles con quién, cuándo y sobre qué registro (RNF-09; FR-024).
- **AN-007**: Integridad ante solicitudes simultáneas: último cupo, entrada y sello únicos (RNF-06; reglas del spec 05 y 06).
- **AN-008**: Una referencia de fecha y hora común, en hora de Loja, que pueda fijarse solo en pruebas y demo (RC-07, RNF-10).
- **AN-009**: Agenda y fichas disponibles aunque el Mapa, Alforjita o el pago fallen (RNF-07).
- **AN-010**: Web pública utilizable en navegador móvil sin instalar una aplicación y panel interno de escritorio (RNF-01, RNF-02).

**Dependencias de los demás specs respecto a este**

| Spec | Qué hereda de este |
|---|---|
| 02 Programación y publicación | Roles de editor, publicador y administrador; reglas de edición y rechazo (FR-012, FR-013, FR-022) |
| 03 Mapa | Consulta pública sin cuenta y sin ubicación (FR-001, FR-002) |
| 04 Mi recorrido | Recorrido local sin cuenta (FR-001) |
| 05 Compra y control de entradas | Identificación con retorno a la acción (FR-007, FR-008); personal de acceso por función (FR-015); permiso de ventas (FR-014) |
| 06 Pasaporte y sellos | Retorno al canje tras identificarse (FR-007, FR-008) |
| 07 Rutas e insignias | Colección y progreso propios de cada cuenta (FR-006) |
| 08 Alforjita | Uso sin cuenta (FR-001); sin acceso a datos personales (FR-026) |

## Trazabilidad con el contexto

| Contexto | Cubierto por |
|---|---|
| RF-01 | FR-001, FR-002, FR-003; Historia 1 |
| RF-02 | FR-004, FR-005, FR-006; Historia 7 |
| RF-03 | FR-007, FR-008; Historia 2 |
| RF-04 | FR-009 a FR-017, FR-022, FR-023; Historias 3, 4 y 6 |
| RF-04b | FR-018 a FR-021; Historia 5 |
| RC-01 | FR-009, FR-010, FR-016 |
| RC-06 (permisos y reasignación) | FR-024, FR-025; Historia 8 |
| Decisión Q1 (primer administrador) | FR-027; Historia 9; SC-015 |
| Decisión Q2 (correo y contraseña) | FR-028; Historia 7; SC-010, SC-011 |
| RF-03 (retorno y revalidación), contrato con specs 05 y 06 | FR-031 a FR-035; Historia 2; SC-017, SC-018 |
| Decisión Q3 (verificación y recuperación) | FR-003, FR-007, FR-029, FR-030; Historias 2 y 7; SC-012 a SC-014, SC-016 |
| RNF-02 (mensaje de rechazo) | FR-022, SC-006 |
| RNF-04 (verificación en servidor) | FR-012, FR-017, SC-001 |
| RNF-05 (privacidad) | FR-002, FR-026 |
| RNF-09 (trazabilidad) | FR-024, FR-025, SC-007 |

## Assumptions

- La web pública se usa primero desde celular; el panel interno, primero desde escritorio (`context/design/navegacion.md`).
- Las pantallas de registro, inicio de sesión, Perfil y del panel interno no tienen mockup; se diseñarán a partir de estos requisitos.
- El administrador es quien asigna las funciones al personal de acceso, por ser quien asigna y revoca roles (RF-04). El contexto no lo dice con otras palabras.
- Las acciones de ventas (activar venta, cancelar con entradas vendidas), el flujo editorial y la validación de entradas se definen en los specs 05 y 02; este spec solo fija quién tiene el permiso para ejecutarlas.
- Este spec no elige arquitectura ni tecnología; la elección del estilo arquitectónico se acuerda antes de los planes técnicos.

- La demo usa un buzón de pruebas; el proveedor de correo y los plazos exactos de los enlaces los define el plan técnico.

**Pendientes registrados sin marcador** (no estaban en el contexto y se llevan a clarificación):

- Qué ocurre si se revoca el último rol de administrador o si un administrador se revoca roles a sí mismo.
- Si una persona puede auto-asignarse roles o solo los asigna el administrador (se asume lo segundo por RF-04).
- Vigencia y cierre automático de una sesión inactiva.
- Cuánto tiempo se conserva la acción original (compra o canje) mientras la persona verifica su correo, y si la activación por correo del primer administrador cuenta como verificación (P-11 del contexto).
- Qué ocurre tras revalidar la acción (por ejemplo, si se pide una confirmación antes de pagar o de reclamar) lo definen los specs 05 y 06; este spec solo garantiza el regreso y la revalidación.
