# Feature Specification: Mapa isométrico de sedes

**Feature Branch**: `003-mapa-de-sedes`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Spec 03 de 8 de VIVART: mapa isométrico de sedes. Cubre RF-12 a RF-15. Sin plan técnico ni implementación."

## Alcance y límites

Este spec define cómo el visitante reconoce el circuito del festival y decide a qué sede ir: la vista isométrica con sedes seleccionables, la búsqueda y los filtros, la ficha de cada sede con sus funciones, la lista equivalente y el mantenimiento de los datos de las sedes por el administrador.

**Dentro de este spec:** RF-12, RF-13, RF-14 y RF-15; decisiones M-02 y M-03 del contexto (el buscador busca sedes y el filtro es «Funciones del día»); verificaciones RNF-01, RNF-03 y RNF-05 en lo que toca al mapa.

**Fuera de este spec** (solo son dependencias):

- La programación, las fichas y «¿Qué hay ahora?» (spec 02). El mapa solo muestra funciones ya publicadas y no canceladas.
- Identidad y permisos del administrador (spec 001).
- Mi recorrido (04), compra (05), Pasaporte (06), rutas (07) y Alforjita (08).
- Elegir tecnología de mapas o de renderizado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Explorar las sedes en el mapa (Priority: P1)

Un visitante abre el Mapa, ve una vista isométrica del circuito con sedes seleccionables, se desplaza, hace zoom y selecciona una sede.

**Why this priority**: es la tercera pestaña principal de la web y la forma visual de ubicarse.

**Independent Test**: se abre el Mapa desde el celular, se desplaza, se hace zoom y se selecciona una sede.

**Acceptance Scenarios**:

1. **Given** el Mapa abierto, **When** el visitante se desplaza y hace zoom, **Then** la vista isométrica responde y los marcadores siguen siendo seleccionables.
2. **Given** un marcador, **When** el visitante lo selecciona, **Then** se abre la ficha de la sede.
3. **Given** el Mapa, **When** se carga, **Then** no se pide ubicación ni identificación.
4. **Given** una pantalla de celular, **When** se usa el Mapa, **Then** la página no desborda horizontalmente.

---

### User Story 2 - Ver la sede y sus funciones (Priority: P1)

Al seleccionar una sede, el visitante ve su nombre, su dirección o referencia, la información de accesibilidad y las funciones publicadas, y puede abrir una ficha o elegir «Cómo llegar».

**Why this priority**: conecta la ubicación con la programación; es la razón de consultar el mapa.

**Independent Test**: se selecciona una sede con funciones y se abre una ficha desde la sede; se prueba «Cómo llegar» en una sede con destino verificado y en una sin él.

**Acceptance Scenarios**:

1. **Given** una sede con funciones publicadas, **When** se selecciona, **Then** se muestran su nombre, su dirección o referencia y sus funciones publicadas no canceladas.
2. **Given** una función en la lista de la sede, **When** se selecciona, **Then** se abre su ficha.
3. **Given** una sede con destino verificado, **When** el visitante elige «Cómo llegar», **Then** se abre ese destino en una aplicación externa.
4. **Given** una sede sin destino verificado (por ejemplo, un recorrido), **When** se selecciona, **Then** no se ofrece «Cómo llegar».
5. **Given** una sede sin accesibilidad confirmada, **When** se muestra, **Then** aparece «Accesibilidad por confirmar».
6. **Given** una sede sin funciones publicadas, **When** se selecciona, **Then** se indica que no hay funciones, sin error.

---

### User Story 3 - Buscar sedes (Priority: P1)

El visitante busca una sede con un campo que dice «Buscar sede». Para buscar una función por nombre usa la Agenda.

**Why this priority**: es la forma más rápida de llegar a una sede concreta.

**Independent Test**: se busca por nombre de sede y se comprueba que solo aparecen sedes registradas en la programación.

**Acceptance Scenarios**:

1. **Given** el campo «Buscar sede», **When** se escribe parte del nombre de una sede, **Then** se muestran las sedes que coinciden.
2. **Given** una plaza, museo o teatro registrado como sede de la programación, **When** se busca, **Then** aparece.
3. **Given** un lugar que no es sede de la programación, **When** se busca, **Then** no aparece; el mapa no muestra puntos de interés generales.
4. **Given** una búsqueda de una función por su nombre, **When** se escribe en el mapa, **Then** no devuelve funciones; el visitante debe usar la Agenda.
5. **Given** una búsqueda sin coincidencias, **When** se ejecuta, **Then** se muestra un mensaje de sin resultados.

---

### User Story 4 - Filtrar por «Funciones del día» y por accesibilidad (Priority: P2)

El visitante filtra el mapa por «Funciones del día», que muestra las sedes con funciones publicadas y no canceladas para el día consultado (hoy por defecto, en hora de Loja, con la opción de elegir otro día de la edición), o por características de accesibilidad verificadas.

**Why this priority**: ayuda a decidir a qué sede ir, pero depende de que el mapa y las sedes ya existan.

**Independent Test**: con una hora de referencia fijada, se activa el filtro y se verifica qué sedes aparecen; se cambia de día y se repite.

**Acceptance Scenarios**:

1. **Given** el filtro «Funciones del día», **When** se activa sin elegir día, **Then** muestra las sedes con funciones publicadas y no canceladas de hoy en hora de Loja, aunque todavía no hayan empezado.
2. **Given** el filtro, **When** el visitante elige otro día de la edición, **Then** muestra las sedes de ese día.
3. **Given** una función cancelada, **When** se aplica el filtro, **Then** no hace aparecer a su sede.
4. **Given** el mapa, **When** se busca qué hay ahora, **Then** no hay otro filtro temporal: «¿Qué hay ahora?» está en la Agenda.
5. **Given** el filtro de accesibilidad, **When** se activa, **Then** solo muestra sedes con esa característica verificada, y una sede sin verificación no aparece.

---

### User Story 5 - Consultar las sedes en una lista (Priority: P1)

El visitante alterna a una lista equivalente para consultar las sedes, incluidas las que no tienen marcador en la ilustración, sin compartir ubicación y sin usar el mapa gráfico.

**Why this priority**: garantiza accesibilidad y cubre las sedes que no caben en la ilustración.

**Independent Test**: se consulta una sede solo con teclado y sin abrir el mapa gráfico, incluida una sede sin marcador.

**Acceptance Scenarios**:

1. **Given** el Mapa, **When** el visitante abre la lista, **Then** ve todas las sedes con funciones, incluidas las que no tienen marcador.
2. **Given** la lista, **When** se usa solo con teclado, **Then** se puede seleccionar una sede y ver sus funciones.
3. **Given** la lista, **When** se usa, **Then** no se pide ubicación.
4. **Given** una sede, **When** se muestra su estado, **Then** no se comunica solo con color.

---

### User Story 6 - El administrador mantiene los datos de las sedes (Priority: P2)

El administrador actualiza los datos, marcadores y destinos de las sedes, registra la accesibilidad con su fuente y fecha de verificación, y los cambios se registran en el historial sin revisión editorial.

**Why this priority**: los datos de las sedes cambian, y el mapa solo es útil si están al día.

**Independent Test**: se corrige una dirección y un marcador, se registra accesibilidad con fuente y fecha, y se verifica el efecto público y el historial.

**Acceptance Scenarios**:

1. **Given** un administrador, **When** corrige una dirección o un marcador, **Then** se actualizan los datos de la sede sin aviso público y queda en el historial.
2. **Given** un administrador, **When** registra la accesibilidad de una sede, **Then** guarda la fuente y la fecha de verificación.
3. **Given** una sede sin confirmación de accesibilidad, **When** se muestra, **Then** aparece «Accesibilidad por confirmar» y no entra en el filtro.
4. **Given** una función que cambia de sede, **When** se confirma, **Then** es una reprogramación con aviso público (spec 02), no una corrección de la sede.
5. **Given** un usuario sin rol de administrador, **When** intenta modificar una sede, **Then** el sistema lo rechaza.
6. **Given** una sede nueva sin marcador, **When** el administrador la registra, **Then** aparece en la lista y en la búsqueda aunque no tenga marcador.

### Edge Cases

- Una sede definida como tramo de calle o recorrido, como el desfile inaugural (PDF pág. 8): no tiene destino único para «Cómo llegar».
- Una sede con varias funciones el mismo día, algunas canceladas.
- Un día sin funciones publicadas: el filtro no muestra sedes y se indica.
- Una sede registrada sin dirección: se muestra su referencia o «Dirección por confirmar», sin inventarla.
- El mapa no carga o tarda: la Agenda y las fichas siguen disponibles, y la lista de sedes puede consultarse.
- Una sede con funciones publicadas pero sin marcador.
- Dos sedes con nombres parecidos en la búsqueda.
- Un dispositivo sin soporte para zoom táctil.

## Requirements *(mandatory)*

### Functional Requirements

**Vista y exploración**

- **FR-001**: El sistema DEBE mostrar una vista isométrica interactiva del circuito con marcadores seleccionables, desplazamiento y zoom.
- **FR-002**: El Mapa DEBE funcionar sin cuenta y sin pedir ubicación.
- **FR-003**: El Mapa DEBE ser utilizable en un navegador móvil sin desbordamiento horizontal.
- **FR-004**: La Agenda y las fichas NO DEBEN esperar a que cargue el Mapa.

**Búsqueda y filtros**

- **FR-005**: El Mapa DEBE ofrecer un buscador con el texto «Buscar sede» que busque únicamente sedes registradas en la programación.
- **FR-006**: El Mapa NO DEBE mostrar puntos de interés generales ni buscar funciones por nombre; para eso se usa la Agenda.
- **FR-007**: El Mapa DEBE ofrecer el filtro «Funciones del día», que muestra las sedes con funciones publicadas y no canceladas para el día consultado, aunque todavía no hayan empezado.
- **FR-008**: El filtro «Funciones del día» DEBE consultar hoy por defecto, en hora de Loja, y permitir elegir otro día de la edición.
- **FR-009**: El Mapa NO DEBE ofrecer otro filtro temporal; «¿Qué hay ahora?» pertenece a la Agenda.
- **FR-010**: El Mapa DEBE permitir filtrar por características de accesibilidad verificadas, y una sede sin verificación NO DEBE aparecer en ese filtro.

**Sede**

- **FR-011**: Al seleccionar una sede, el sistema DEBE mostrar su nombre, su dirección o referencia y sus funciones publicadas no canceladas.
- **FR-012**: «Cómo llegar» DEBE abrir un destino verificado en una aplicación externa, y NO DEBE ofrecerse si la sede no tiene destino verificado.
- **FR-013**: Si falta confirmación de accesibilidad, la sede DEBE mostrar «Accesibilidad por confirmar».
- **FR-014**: Una plaza, museo o teatro DEBE aparecer como sede solo si está registrado como sede de la programación.

**Lista alternativa**

- **FR-015**: El sistema DEBE ofrecer una lista equivalente para consultar sedes sin compartir ubicación, incluidas las sedes sin marcador en la ilustración.
- **FR-016**: La lista DEBE ser utilizable con teclado, y el estado de una sede NO DEBE comunicarse solo con color.

**Administración de sedes**

- **FR-017**: El administrador DEBE poder actualizar los datos, marcadores y destinos de las sedes, sin revisión editorial y con registro en el historial.
- **FR-018**: El administrador DEBE poder registrar la accesibilidad de una sede con su fuente y la fecha de verificación, y verificarla con su responsable o por revisión directa.
- **FR-019**: Trasladar una función a otra sede DEBE tratarse como una reprogramación con aviso público (spec 02), no como una actualización de la sede.
- **FR-020**: El plano del circuito del PDF DEBE tratarse como referencia visual, no como fuente de coordenadas exactas.
- **FR-021**: Solo el administrador DEBE poder modificar los datos de una sede.

**Decisiones pendientes**

- **FR-022**: La ilustración isométrica del circuito de Loja que usa el Mapa DEBE provenir de [NEEDS CLARIFICATION: el contexto no define quién entrega la ilustración isométrica de Loja ni cómo se ubican los marcadores sobre ella; el mockup disponible es solo un ejemplo de estilo].
- **FR-023**: Un destino de «Cómo llegar» se considera verificado cuando [NEEDS CLARIFICATION: el contexto no define quién verifica el destino ni con qué criterio].
- **FR-024**: Las características de accesibilidad que se registran y filtran son [NEEDS CLARIFICATION: el contexto no define la lista de características de accesibilidad (por ejemplo, acceso sin escalones o baño accesible)].

### Key Entities

- **Sede**: lugar registrado en la programación, con nombre, dirección o referencia, destino verificado opcional, marcador opcional y accesibilidad con fuente y fecha de verificación.
- **Marcador**: posición de una sede en la ilustración isométrica.
- **Destino verificado**: punto que «Cómo llegar» abre en una aplicación externa.
- **Característica de accesibilidad**: atributo verificado de una sede, con su fuente y fecha.
- **Día consultado**: el día usado por el filtro «Funciones del día»; hoy por defecto, en hora de Loja.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un visitante abre el Mapa, se desplaza, hace zoom y selecciona una sede sin ninguna petición de ubicación ni de identificación (0 peticiones).
- **SC-002**: El 100 % de las sedes con funciones publicadas aparece en la lista, incluidas las que no tienen marcador.
- **SC-003**: Con una hora de referencia fijada, el filtro «Funciones del día» muestra exactamente las sedes con al menos una función publicada y no cancelada ese día, aunque no haya empezado, en el 100 % de las pruebas.
- **SC-004**: En el 100 % de las pruebas, una función cancelada no hace aparecer a su sede en el filtro.
- **SC-005**: 0 lugares que no son sedes de la programación aparecen en la búsqueda, y la búsqueda de una función por nombre devuelve 0 funciones.
- **SC-006**: El 100 % de las sedes sin destino verificado no ofrece «Cómo llegar», y el 100 % de las que lo tienen lo abre.
- **SC-007**: El 100 % de las sedes sin accesibilidad verificada muestra «Accesibilidad por confirmar» y 0 aparecen en el filtro de accesibilidad.
- **SC-008**: Una sede se consulta con teclado y sin usar el mapa gráfico en el 100 % de las pruebas de accesibilidad.
- **SC-009**: El 100 % de los cambios del administrador sobre sedes queda en el historial con quién, cuándo y qué registro.
- **SC-010**: Agenda y fichas se abren aunque el Mapa falle, en el 100 % de las pruebas de fallo.

## Trazabilidad con el contexto

| Contexto | Cubierto por |
|---|---|
| RF-12 (vista, búsqueda, filtros) | FR-001 a FR-010; Historias 1, 3, 4 |
| RF-13 (sede y Cómo llegar) | FR-011 a FR-014; Historia 2 |
| RF-14 (lista equivalente) | FR-015, FR-016; Historia 5 |
| RF-15 (administración de sedes) | FR-017 a FR-021; Historia 6 |
| M-02, M-03 | FR-005 a FR-009 |
| RNF-01, RNF-03, RNF-05 | FR-002, FR-003, FR-016; SC-001, SC-008 |
| RNF-07 | FR-004; SC-010 |
| RNF-09 | FR-017; SC-009 |

## Assumptions

- Los permisos del administrador vienen del spec 001, y las funciones publicadas vienen del spec 02.
- El mockup de Mapa (`context/assets/mockups/`) solo ilustra el estilo; el mapa de VIVART debe representar el circuito de Loja con sedes verificadas.
- El mockup muestra la tarjeta de sede sin «Cómo llegar» ni lista; prevalece el requisito.
- Las pantallas de lista de sedes y ficha de sede no tienen mockup.
- Una sede puede no tener marcador y seguir siendo consultable en la lista.
