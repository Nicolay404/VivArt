# Feature Specification: Carrito, compra y control de entradas

**Feature Branch**: `005-compra-y-entradas`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Spec 05 de 8 de VIVART: carrito, compra y control de entradas. Cubre RF-19 a RF-24 y RF-36, con RC-04, RC-05 y RC-06. Sin plan técnico ni implementación."

## Clarifications

### Session 2026-11-20

- Q: ¿Cómo se simula el pago de prueba? → A: Solo en demo o pruebas se puede simular un pago confirmado, fallido o confirmado después de vencer la retención. No se procesa dinero ni se piden datos de tarjeta. El pago tardío pasa a revisión sin emitir entradas ni recuperar cupos ya liberados.
- Q: ¿Quién puede invalidar una entrada? → A: Solo el administrador, sobre una entrada confirmada y todavía no usada, y debe registrar el motivo. La entrada permanece visible en el historial y deja de permitir el ingreso. La invalidación manual no reembolsa ni repone cupo automáticamente. La cancelación de una función se rige por su propia regla, cuyo dueño es este spec.
- Q: ¿Cuántas entradas se pueden comprar por pedido? → A: Un máximo de seis por pedido, contando todas las unidades del carrito aunque sean de funciones distintas. También aplica el cupo disponible de cada función. El límite no se configura por función en el MVP.

## Alcance y límites

Este spec define cómo se compran entradas para funciones con venta interna habilitada y cómo se evita que una entrada conceda acceso dos veces: el carrito, el pago de prueba con retención de cupos, la emisión de entradas con QR, la configuración de la venta por el administrador, la validación en la sede, y la cancelación o reprogramación de funciones con entradas vendidas.

**Dentro de este spec:** RF-19, RF-20, RF-21, RF-22, RF-23, RF-24 y RF-36; reglas RC-04 (dos tipos de QR), RC-05 (unicidad) y RC-06 (aviso y historial); decisiones P-02, P-04 y P-07; verificaciones RNF-04, RNF-05, RNF-06 y RNF-07 en lo que toca a la compra.

**Alcance inicial del MVP:** entrada general y **pagos de prueba**. Sin asientos numerados, cobros reales, reservas gratuitas ni reembolsos.

**Fuera de este spec** (solo son dependencias):

- Identidad, correo verificado y permisos del personal de acceso (spec 001).
- La programación, las fichas, la reprogramación y la cancelación editorial (spec 02): este spec es el **dueño** de la regla de cancelación y reprogramación con entradas vendidas; el spec 02 solo remite aquí.
- Mi recorrido (04), Pasaporte y sellos (06): el QR de Pasaporte no es una entrada.
- Mapa (03), rutas (07) y Alforjita (08).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Armar el carrito (Priority: P1)

Un visitante agrega entradas de una o varias funciones con venta interna, ajusta cantidades, elimina ítems y revisa el precio unitario y el total en USD. Advierte los cruces sin bloquear la compra.

**Why this priority**: es el inicio del flujo de compra.

**Independent Test**: sin sesión, se agregan entradas de dos funciones, se ajustan cantidades y se comprueba el total y que las gratuitas no ofrecen carrito.

**Acceptance Scenarios**:

1. **Given** una función de pago con precio, cupo y venta interna habilitada, **When** el visitante la agrega, **Then** entra al carrito.
2. **Given** una función gratuita, **When** se muestra su ficha, **Then** no aparece «Agregar al carrito».
3. **Given** una función de pago sin precio, sin cupo o sin venta interna habilitada, **When** se muestra su ficha, **Then** no puede añadirse al carrito.
4. **Given** una función con venta externa, **When** se muestra su ficha, **Then** puede mostrar un enlace verificado en lugar del carrito.
5. **Given** un carrito, **When** el visitante ajusta cantidades o elimina ítems, **Then** el total se recalcula en USD.
6. **Given** dos funciones del carrito que se cruzan, **When** ambos intervalos se conocen, **Then** se advierte sin bloquear la compra (RC-02).
7. **Given** una función con «Evento Pagado» y sin precio, **When** se consulta, **Then** no entra al carrito.
8. **Given** un carrito con seis unidades en total (aunque sean de funciones distintas), **When** el visitante intenta agregar otra unidad, **Then** el sistema no la agrega e indica el máximo de seis entradas por pedido.
9. **Given** una función con menos cupo disponible que la cantidad pedida, **When** se ajusta la cantidad, **Then** también se aplica el cupo disponible.

---

### User Story 2 - Pagar con retención de cupos (Priority: P1)

Al iniciar el pago, el sistema exige sesión con correo verificado, verifica precio, vigencia y cupos, y retiene los cupos durante 10 minutos mientras el pedido está pendiente.

**Why this priority**: evita vender dos veces el último cupo y protege el precio acordado.

**Independent Test**: se inicia un pago, se cambia el precio, se deja vencer y se repite, comprobando las reglas de precio y retención.

**Acceptance Scenarios**:

1. **Given** un visitante sin sesión, **When** inicia el pago, **Then** se le pide identificarse y, tras hacerlo, vuelve al carrito (spec 001).
2. **Given** precio, vigencia o cupo que cambiaron, **When** se inicia el pago, **Then** se pide revisar el carrito.
3. **Given** un pedido pendiente, **When** se crea, **Then** los cupos se retienen durante 10 minutos y el pedido conserva el total validado mientras la retención siga vigente.
4. **Given** un cambio de precio, **When** hay un pedido pendiente vigente, **Then** el pedido conserva su total; **when** hay pedidos confirmados, **then** no se modifican.
5. **Given** un pago fallido o una retención vencida, **When** se produce, **Then** los cupos se liberan.
6. **Given** una retención vencida, **When** el usuario vuelve a pagar, **Then** debe revisar y aceptar el precio vigente.
7. **Given** un último cupo, **When** dos usuarios inician el pago a la vez, **Then** solo uno lo retiene (RC-05).
8. **Given** que el administrador cambia el plazo de retención, **When** se crean pedidos nuevos, **Then** se aplica el plazo nuevo y las retenciones ya iniciadas no cambian.

---

### User Story 3 - Recibir las entradas (Priority: P1)

Tras confirmarse el pago de prueba, el usuario recibe una entrada individual con QR único por cada unidad comprada y las ve en Mis entradas, dentro de Perfil.

**Why this priority**: es el resultado de la compra y lo que se presenta en la sede.

**Independent Test**: se confirma un pago de tres entradas y se comprueba que hay tres QR distintos; se repite la confirmación y no se duplican.

**Acceptance Scenarios**:

1. **Given** un pago confirmado de N entradas, **When** se emite, **Then** existen N entradas, cada una con un QR único.
2. **Given** una confirmación de pago repetida, **When** llega de nuevo, **Then** no se emiten más entradas (RC-05).
3. **Given** un pago confirmado fuera de plazo (tardío), **When** llega, **Then** se registra una incidencia y no se emiten entradas automáticamente.
4. **Given** un usuario, **When** abre Mis entradas, **Then** ve solo sus propios pedidos y entradas.
5. **Given** un pago no verificable, **When** se consulta, **Then** se muestra que no está confirmado.
6. **Given** el entorno de demo o pruebas, **When** se inicia un pago de prueba, **Then** se puede elegir simular pago confirmado, fallido o confirmado después de vencer la retención.
7. **Given** el simulador, **When** se usa, **Then** no se procesa dinero ni se piden datos de tarjeta.
8. **Given** un pago simulado como confirmado después de vencer la retención, **When** llega, **Then** pasa a revisión sin emitir entradas ni recuperar cupos ya liberados.
9. **Given** un entorno que no es de demo ni de pruebas, **When** se inicia un pago, **Then** no se ofrece la opción de elegir el resultado.

---

### User Story 4 - El administrador configura la venta (Priority: P2)

El administrador configura precio, cupo y habilitación de venta por función, consulta pedidos, cupos retenidos y vendidos, entradas usadas e incidencias, y resuelve las incidencias de pago tardío en el entorno de prueba.

**Why this priority**: sin esta configuración no hay funciones vendibles; pero depende de que las funciones existan (spec 02).

**Independent Test**: se configura una función, se compra, y se intenta reducir el cupo por debajo de lo vendido más lo retenido.

**Acceptance Scenarios**:

1. **Given** una función, **When** el administrador configura precio, cupo y venta, **Then** queda disponible para el carrito.
2. **Given** una función con cupo vendido y retenido, **When** el administrador intenta reducir el cupo por debajo de la suma, **Then** el sistema lo rechaza.
3. **Given** un editor o un publicador sin rol de administrador, **When** intenta activar ventas, **Then** el sistema lo rechaza (publicar no activa ventas).
4. **Given** una incidencia de pago tardío, **When** el administrador la revisa, **Then** registra su resolución en el entorno de prueba, sin emitir entradas, sin recuperar cupos ya liberados y sin reembolsos.
5. **Given** el administrador, **When** consulta una función, **Then** ve pedidos, cupos retenidos y vendidos y entradas usadas.
6. **Given** el administrador, **When** cambia el plazo de retención, **Then** solo el administrador puede hacerlo.
7. **Given** una entrada confirmada y no usada, **When** el administrador la invalida e indica el motivo, **Then** deja de permitir el ingreso, permanece visible en el historial y no se reembolsa ni se repone cupo automáticamente.
8. **Given** una entrada ya usada, **When** el administrador intenta invalidarla, **Then** el sistema lo rechaza.
9. **Given** un usuario sin rol de administrador, **When** intenta invalidar una entrada, **Then** el sistema lo rechaza.

---

### User Story 5 - Validar entradas en la sede (Priority: P1)

El personal de acceso abre el control de acceso de su función, escanea el QR o introduce el código alternativo, y el sistema admite o rechaza la entrada con su motivo.

**Why this priority**: es el objetivo final de la compra y de la integridad del acceso.

**Independent Test**: se valida una entrada, se vuelve a validar, y se prueba con una entrada de otra función, una cancelada y un QR de Pasaporte.

**Acceptance Scenarios**:

1. **Given** el personal asignado, **When** abre el control de acceso de su función, **Then** puede validar; **when** lo cierra, **then** deja de aceptar entradas.
2. **Given** una entrada confirmada, no usada ni invalidada, de la función asignada y no cancelada, **When** se escanea, **Then** se admite y se marca como usada.
3. **Given** una entrada ya usada, **When** se escanea de nuevo, **Then** se rechaza con el motivo «entrada ya usada».
4. **Given** una entrada de otra función, **When** se escanea, **Then** se rechaza con «función incorrecta».
5. **Given** un QR de Pasaporte, **When** se escanea en el control de acceso, **Then** se rechaza con «tipo de código incorrecto» y no se marca nada como usado (RC-04).
6. **Given** una cámara no disponible, **When** el personal introduce el código alternativo, **Then** la validación funciona igual.
7. **Given** dos solicitudes simultáneas con la misma entrada, **When** se validan, **Then** solo una se admite (RC-05).
8. **Given** una función cancelada, **When** se escanea una de sus entradas, **Then** se rechaza con «función cancelada».
9. **Given** una entrada invalidada por el administrador, **When** se escanea, **Then** se rechaza con «entrada no confirmada o invalidada».

---

### User Story 6 - Cancelar una función con entradas vendidas (Priority: P2)

Solo el administrador puede cancelar una función con entradas vendidas; sin ventas también puede hacerlo el publicador. La cancelación bloquea compras y validaciones, libera retenciones y deja un aviso en la ficha y en Mis entradas.

**Why this priority**: cubre el peor caso del festival, pero no el flujo normal de compra.

**Independent Test**: se cancela una función con entradas vendidas y un pedido pendiente, y se comprueban los bloqueos y los avisos.

**Acceptance Scenarios**:

1. **Given** una función con entradas vendidas, **When** un publicador intenta cancelarla, **Then** el sistema lo rechaza; **when** lo hace el administrador, **then** se cancela.
2. **Given** una función sin ventas, **When** la cancela el publicador, **Then** se cancela.
3. **Given** una función cancelada, **When** alguien intenta comprar, **Then** se bloquea.
4. **Given** pedidos pendientes con cupo retenido, **When** se cancela la función, **Then** las retenciones se liberan y los pedidos dejan de ser pagables.
5. **Given** una entrada ya emitida, **When** se cancela la función, **Then** Mis entradas la muestra como «función cancelada» con el aviso público y el acceso la rechaza.
6. **Given** el administrador, **When** consulta la función cancelada, **Then** identifica los pedidos afectados.
7. **Given** una cancelación con entradas vendidas, **When** se completa, **Then** no se inicia ningún reembolso automático ni manual dentro de VIVART.

---

### User Story 7 - Reprogramar una función con entradas vendidas (Priority: P2)

Si una función con entradas vendidas cambia de fecha, hora o sede y sigue siendo la misma función, las entradas no usadas conservan su QR y su validez para la nueva fecha, hora o sede.

**Why this priority**: evita que una reprogramación invalide lo que el público ya pagó.

**Independent Test**: se vende una entrada, se reprograma la función y se valida la misma entrada en la nueva fecha.

**Acceptance Scenarios**:

1. **Given** una entrada no usada, **When** la función se reprograma, **Then** la entrada conserva su QR y su validez para la nueva fecha, hora o sede.
2. **Given** una entrada ya usada, **When** la función se reprograma, **Then** no se reactiva.
3. **Given** la reprogramación, **When** se publica, **Then** se refleja en Agenda, Mi recorrido y Mis entradas con aviso.
4. **Given** una entrada tras una reprogramación, **When** se valida, **Then** se valida contra los datos vigentes de la función.
5. **Given** una reprogramación, **When** el usuario busca devolver la entrada desde la web, **Then** no existe esa opción en el MVP.

### Edge Cases

- El último cupo de una función y dos compras simultáneas.
- Una confirmación de pago repetida (dos notificaciones del mismo pago).
- Un pago confirmado después de que la retención venció (pago tardío).
- Un cambio de precio mientras el usuario tiene un pedido pendiente.
- Una función cancelada con pedidos pendientes y con entradas ya usadas.
- Una entrada duplicada o fotografiada: el QR de una entrada usada se rechaza.
- Un QR de Pasaporte escaneado en el control de acceso, y un QR de entrada abierto como canje.
- Personal de acceso sin funciones asignadas.
- Funciones con venta externa (enlace verificado).
- Un carrito con funciones de venta habilitada y otras agotadas.
- Un carrito de más de seis unidades en total, repartidas en funciones distintas.
- Una entrada invalidada que el usuario sigue viendo en Mis entradas.
- Una función que ya empezó: el contexto no define si se sigue vendiendo.

## Requirements *(mandatory)*

### Functional Requirements

**Carrito**

- **FR-001**: El sistema DEBE permitir agregar entradas de una o varias funciones con venta interna, ajustar cantidades, eliminar ítems y mostrar el precio unitario y el total en USD, con un máximo de seis entradas por pedido (FR-038).
- **FR-002**: Una función de pago DEBE entrar al carrito solo si tiene precio, cupo y venta interna habilitados.
- **FR-003**: Las funciones gratuitas NO DEBEN mostrar «Agregar al carrito».
- **FR-004**: Si la venta es externa, la ficha PUEDE mostrar un enlace verificado.
- **FR-005**: El carrito DEBE advertir cruces de horario sin bloquear la compra (RC-02).
- **FR-006**: El carrito DEBE poder prepararse sin cuenta.

**Pago y retención**

- **FR-007**: Al iniciar el pago, el sistema DEBE exigir sesión con correo verificado y verificar precio, vigencia y cupos; si cambian, DEBE pedir que se revise el carrito.
- **FR-008**: El carrito NO DEBE congelar el precio. El pedido pendiente DEBE conservar el total validado al crearse mientras siga vigente su retención.
- **FR-009**: Los cupos DEBEN retenerse durante 10 minutos desde que se inicia el pago, y liberarse si el pago falla o vence.
- **FR-010**: Si una retención vence y el usuario vuelve a pagar, DEBE revisar y aceptar el precio vigente.
- **FR-011**: Un cambio de precio NO DEBE modificar pedidos confirmados.
- **FR-012**: Solo el administrador DEBE poder cambiar el plazo de retención, y el nuevo valor DEBE aplicarse a pedidos nuevos sin alterar retenciones iniciadas.
- **FR-013**: El pago DEBE ser de prueba; el sistema NO DEBE procesar datos de tarjetas reales ni hacer cobros reales (RNF-05).

**Emisión**

- **FR-014**: El sistema DEBE emitir una entrada individual con QR único por cada unidad comprada, solo después de confirmar el pago.
- **FR-015**: Una confirmación repetida NO DEBE duplicar entradas (RC-05).
- **FR-016**: Una confirmación tardía DEBE registrarse como incidencia y NO DEBE emitir entradas automáticamente.
- **FR-017**: El usuario DEBE ver sus pedidos y entradas en Perfil, y solo los propios.
- **FR-018**: Si no se puede verificar un pago, ingreso o canje, el sistema DEBE mostrar que no está confirmado (RNF-07).

**Configuración de la venta**

- **FR-019**: El administrador DEBE configurar precio, cupo y habilitación de venta por función; publicar NO DEBE activar ventas.
- **FR-020**: El administrador DEBE poder consultar pedidos, cupos retenidos y vendidos, entradas usadas e incidencias.
- **FR-021**: El sistema NO DEBE permitir reducir el cupo por debajo de lo vendido más lo retenido.
- **FR-022**: El administrador DEBE revisar las incidencias de pago tardío y registrar su resolución en el entorno de prueba; la resolución NO DEBE emitir entradas automáticamente, recuperar cupos ya liberados ni ejecutar reembolsos dentro de VIVART.

**Control de acceso**

- **FR-023**: El personal asignado DEBE poder abrir y cerrar el control de acceso de su función; el cierre NO DEBE deducirse de una duración desconocida.
- **FR-024**: El personal DEBE poder escanear un QR o introducir un código alternativo.
- **FR-025**: El sistema DEBE admitir una entrada solo si está confirmada, no usada ni invalidada, corresponde a la función asignada al operador y la función no está cancelada; entonces DEBE marcarla como usada.
- **FR-026**: El sistema DEBE rechazar con su motivo: tipo de código incorrecto, código no encontrado, entrada ya usada, función incorrecta, función cancelada, entrada no confirmada o invalidada, o control de acceso cerrado.
- **FR-027**: Un QR de Pasaporte NO DEBE validar un ingreso, y un QR de entrada NO DEBE reclamar un sello (RC-04).
- **FR-028**: Una entrada NO DEBE consumirse dos veces, ni siquiera con dos solicitudes simultáneas (RC-05).
- **FR-029**: El último cupo NO DEBE venderse dos veces (RC-05).

**Cancelación y reprogramación con ventas**

- **FR-030**: Solo el administrador DEBE poder cancelar una función con entradas vendidas; sin ventas también PUEDE hacerlo el publicador. Esta es la fuente única de la regla; el spec 02 remite aquí.
- **FR-031**: La cancelación DEBE bloquear nuevas compras y validaciones, liberar las retenciones pendientes y dejar un aviso en la ficha y en Mis entradas.
- **FR-032**: Las entradas ya emitidas de una función cancelada DEBEN mostrarse como «función cancelada» y rechazarse en el acceso con ese motivo.
- **FR-033**: El administrador DEBE poder identificar los pedidos afectados por una cancelación.
- **FR-034**: Los reembolsos, automáticos o manuales dentro de VIVART, NO DEBEN existir en el MVP.
- **FR-035**: Si una función con entradas vendidas sigue siendo la misma y cambia de fecha, hora o sede, las entradas no usadas DEBEN conservar su QR y su validez; las usadas NO DEBEN reactivarse. El cambio DEBE reflejarse en Agenda, Mi recorrido y Mis entradas. NO DEBE existir devolución desde la web.

**Pago de prueba, invalidación y límite por pedido** (decisiones cerradas el 2026-11-20; véase Clarifications)

- **FR-036**: Solo en demo o pruebas, el sistema DEBE permitir simular un pago confirmado, fallido o confirmado después de vencer la retención. NO DEBE procesar dinero ni pedir datos de tarjeta. Un pago confirmado tardío DEBE pasar a revisión sin emitir entradas ni recuperar cupos ya liberados.
- **FR-037**: Solo el administrador DEBE poder invalidar una entrada confirmada y todavía no usada, y DEBE registrar el motivo. La entrada invalidada DEBE permanecer visible en el historial y dejar de permitir el ingreso. La invalidación manual NO DEBE reembolsar ni reponer cupo automáticamente. La cancelación de una función se rige por FR-030, no por esta invalidación.
- **FR-038**: El sistema DEBE permitir un máximo de seis entradas por pedido, contando todas las unidades del carrito aunque sean de funciones distintas, y DEBE aplicar además el cupo disponible de cada función. El límite NO DEBE configurarse por función en el MVP.

### Key Entities

- **Carrito**: conjunto de ítems (función y cantidad) de un visitante.
- **Pedido**: carrito en pago, con total validado, estado (pendiente, confirmado, fallido, vencido, en incidencia) y retención.
- **Retención de cupo**: cupos apartados por un pedido durante 10 minutos.
- **Entrada**: unidad comprada, con QR único y estado (confirmada, usada, invalidada, función cancelada). Una entrada invalidada conserva el motivo y quién la invalidó.
- **Simulador de pago de prueba**: opción disponible solo en demo o pruebas para elegir el resultado del pago.
- **Configuración de venta**: precio, cupo y habilitación por función.
- **Incidencia de pago**: confirmación tardía pendiente de resolución del administrador.
- **Control de acceso**: apertura y cierre de la validación de una función por el personal asignado.
- **Motivo de rechazo**: razón por la que una validación no se admite.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las funciones gratuitas no muestra «Agregar al carrito» y el 100 % de las de pago sin precio, cupo o venta habilitada no entra al carrito.
- **SC-002**: Ante dos solicitudes simultáneas por el último cupo, exactamente 1 lo obtiene, en el 100 % de las pruebas.
- **SC-003**: El 100 % de los pedidos pendientes libera sus cupos al fallar o vencer, y conserva su total mientras la retención siga vigente.
- **SC-004**: El 100 % de los pagos confirmados de N entradas emite exactamente N entradas con N QR distintos, y 0 confirmaciones repetidas emiten entradas adicionales.
- **SC-005**: El 100 % de las confirmaciones tardías genera una incidencia y 0 emiten entradas automáticamente.
- **SC-006**: Ante dos validaciones simultáneas de la misma entrada, exactamente 1 se admite, en el 100 % de las pruebas.
- **SC-007**: El 100 % de las validaciones con un QR de Pasaporte, una entrada de otra función, una usada o una de función cancelada se rechaza con su motivo.
- **SC-008**: Al cancelar una función, el 100 % de las nuevas compras y validaciones se bloquea, las retenciones se liberan y el aviso aparece en la ficha y en Mis entradas; 0 reembolsos se ejecutan.
- **SC-009**: Tras reprogramar una función, el 100 % de las entradas no usadas sigue siendo válido para la nueva fecha, y 0 entradas usadas se reactivan.
- **SC-010**: 0 usuarios sin rol de administrador consiguen activar ventas, cambiar el plazo de retención o cancelar una función con entradas vendidas, incluso con solicitudes directas.
- **SC-011**: 0 datos de tarjetas reales se procesan o aparecen en registros.
- **SC-012**: 0 usuarios consultan pedidos o entradas de otra cuenta.
- **SC-013**: El simulador ofrece los tres resultados solo en demo o pruebas; en el 100 % de los casos un pago confirmado tardío pasa a revisión sin entradas ni cupos recuperados, y 0 datos de tarjeta se piden.
- **SC-014**: 0 usuarios sin rol de administrador consiguen invalidar una entrada; el 100 % de las invalidaciones registra el motivo, deja de permitir el ingreso y 0 reembolsos o reposiciones de cupo ocurren automáticamente.
- **SC-015**: 0 pedidos superan las seis entradas en total, y el cupo disponible de cada función se respeta en el 100 % de los casos.

## Trazabilidad con el contexto

| Contexto | Cubierto por |
|---|---|
| RF-19, RC-02, Q11 | FR-001 a FR-006, FR-038; Historia 1 |
| RF-20, P-04, P-07 | FR-007 a FR-013; Historia 2 |
| RF-21, Q9 | FR-014 a FR-018, FR-036; Historia 3 |
| RF-22, P-02, Q10 | FR-019 a FR-022, FR-037; Historia 4 |
| RF-23, RC-04 | FR-023 a FR-029; Historia 5 |
| RF-24 | FR-030 a FR-034; Historia 6 |
| RF-36 | FR-035; Historia 7 |
| RC-05, RNF-06 | FR-015, FR-028, FR-029; SC-002, SC-004, SC-006 |
| RNF-04 | FR-017, FR-019, FR-030; SC-010, SC-012 |
| RNF-05 | FR-013; SC-011 |
| RNF-07 | FR-018 |

## Assumptions

- El spec 001 aporta la sesión, el correo verificado y los permisos; el spec 02, las funciones y los avisos públicos; el spec 06, el QR de Pasaporte.
- La demo usa pagos de prueba; los cobros reales y los reembolsos están fuera del MVP.
- Una función cuya venta externa se muestra con enlace verificado no pasa por el carrito.
- Qué ocurre con la venta cuando una función ya empezó, y cuánto tiempo se conserva una entrada, no están definidos en el contexto y se llevan a clarificación.
- Las pantallas de carrito, pago, Mis entradas y control de acceso no tienen mockup; la Agenda solo ilustra el botón de carrito.
