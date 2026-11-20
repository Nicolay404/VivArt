# Feature Specification: Mapa isométrico de sedes

**Feature Branch**: `003-mapa-de-sedes`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Spec 03 de 8 de VIVART: mapa isométrico de sedes. Cubre RF-12 a RF-15. Sin plan técnico ni implementación."

## Clarifications

### Session 2026-11-20

- Q: ¿Quién entrega la ilustración isométrica de Loja y cómo se ubican los marcadores? → A: El equipo prepara y entrega una ilustración isométrica del circuito de Loja. El mockup define el estilo, no la geografía. El administrador ubica los marcadores sobre la ilustración; una sede fuera del plano o sin marcador sigue disponible en la lista.
- Q: ¿Cuándo es verificado un destino de «Cómo llegar»? → A: Cuando el administrador comprueba que el destino corresponde a la sede y registra la fuente y la fecha de verificación. «Cómo llegar» aparece solo con un destino verificado y abre una aplicación externa. La posición del marcador ilustrado no se usa como coordenada real.
- Q: ¿Qué características de accesibilidad se filtran? → A: Para el MVP, «acceso sin escalones» y «baño accesible». Cada característica se verifica por separado con los estados confirmada, no disponible o por confirmar. El filtro solo devuelve sedes con la característica confirmada; las observaciones de texto son complementarias y no controlan el filtro.
- Q: ¿Las franjas de apertura cuentan para «Funciones del día»? → A: No. Solo cuentan las funciones (RF-12 y constitución). Una sede con solo franjas sigue en el mapa y en la lista, pero no en ese filtro (M-06).
- Q: ¿Qué sedes salen en la lista y en la búsqueda? → A: Todas las registradas, tengan o no funciones y tengan o no marcador. Los recorridos también se listan, sin «Cómo llegar» (M-07).
- Q: ¿Qué funciones muestra la ficha de una sede? → A: Las publicadas desde hoy en adelante, en hora de Loja; con «Funciones del día» activo, solo las de ese día. Las canceladas se muestran marcadas como «Cancelada», como en la ficha del spec 002, y no cuentan para el filtro (M-08).
- Q: ¿Qué son los «días de la edición»? → A: Los días con funciones publicadas de la edición activa. No cambia el modelo del spec 002 (M-06).
- Q: ¿Qué registra el administrador como destino y cómo se abre? → A: Coordenadas (latitud y longitud) con su fuente y fecha de verificación. «Cómo llegar» abre un enlace de Google Maps a esas coordenadas, en celular y escritorio, sin pedir la ubicación de la persona (M-08).
- Q: ¿Quién entrega la ilustración y cuándo? → A: Pendiente del equipo (P-13), preferible en SVG. Mientras tanto, la demo usa una ilustración provisional marcada como tal.
- Q: ¿La tarjeta de sede lleva foto, iconos por tipo y botón «ubicarme»? → A: Foto opcional por sede, subida por el administrador, con texto alternativo y fuente o autoría, solo propia o con licencia que permita reutilizarla; sin foto la tarjeta no cambia (M-09). Marcador neutro, porque las sedes no tienen tipo artístico. Sin botón «ubicarme» (RNF-05, M-08).
- Q: ¿Cómo se combinan los filtros? → A: Con «y»: una sede aparece solo si cumple todos los filtros activos.

## Alcance y límites

Este spec define cómo el visitante reconoce el circuito del festival y decide a qué sede ir: la vista isométrica con sedes seleccionables, la búsqueda y los filtros, la ficha de cada sede con sus funciones, la lista equivalente y el mantenimiento de los datos de las sedes por el administrador.

**Dentro de este spec:** RF-12, RF-13, RF-14 y RF-15; decisiones M-02, M-03, M-05, M-06, M-07, M-08 y M-09 del contexto (el buscador busca sedes y el filtro es «Funciones del día»); verificaciones RNF-01, RNF-03 y RNF-05 en lo que toca al mapa.

**Fuera de este spec** (solo son dependencias):

- La programación, las fichas y «¿Qué hay ahora?» (spec 02). El mapa solo muestra funciones ya publicadas y no canceladas.
- Identidad y permisos del administrador (spec 001).
- Mi recorrido (04), compra (05), Pasaporte (06), rutas (07) y Alforjita (08).
- Elegir tecnología de renderizado (el destino externo de «Cómo llegar» sí está decidido: Google Maps, M-08).
- Las fotos de actividades (spec 002): se decidirán aparte.
- Entregar la ilustración definitiva de Loja (P-13).

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

Al seleccionar una sede, el visitante ve su nombre, su dirección o referencia, su foto si la tiene, la información de accesibilidad y las funciones publicadas desde hoy, y puede abrir una ficha o elegir «Cómo llegar».

**Why this priority**: conecta la ubicación con la programación; es la razón de consultar el mapa.

**Independent Test**: se selecciona una sede con funciones y se abre una ficha desde la sede; se prueba «Cómo llegar» en una sede con destino verificado y en una sin él.

**Acceptance Scenarios**:

1. **Given** una sede con funciones publicadas, **When** se selecciona, **Then** se muestran su nombre, su dirección o referencia y sus funciones publicadas desde hoy en adelante (hora de Loja), y una función cancelada aparece marcada como «Cancelada».
2. **Given** una función en la lista de la sede, **When** se selecciona, **Then** se abre su ficha.
3. **Given** una sede con destino verificado, **When** el visitante elige «Cómo llegar», **Then** se abre ese destino en una aplicación externa.
4. **Given** una sede sin destino verificado (por ejemplo, un recorrido), **When** se selecciona, **Then** no se ofrece «Cómo llegar».
5. **Given** una sede con una característica de accesibilidad sin confirmar, **When** se muestra, **Then** esa característica aparece como «por confirmar»; una confirmada aparece como confirmada y una no disponible, como no disponible.
6. **Given** una sede sin funciones publicadas desde hoy, **When** se selecciona, **Then** se indica que no hay funciones próximas, sin error.
7. **Given** el filtro «Funciones del día» activo para un día, **When** se selecciona una sede, **Then** solo se muestran sus funciones de ese día.
8. **Given** una sede con foto, **When** se muestra, **Then** la foto tiene texto alternativo y se indica su fuente o autoría; **Given** una sede sin foto, **Then** la tarjeta se muestra igual, sin hueco ni imagen de relleno.
9. **Given** una función de ayer en esa sede, **When** se abre la sede, **Then** no aparece en su lista.

---

### User Story 3 - Buscar sedes (Priority: P1)

El visitante busca una sede con un campo que dice «Buscar sede». Para buscar una función por nombre usa la Agenda.

**Why this priority**: es la forma más rápida de llegar a una sede concreta.

**Independent Test**: se busca por nombre de sede y se comprueba que aparecen todas las sedes registradas en la programación, y solo ellas.

**Acceptance Scenarios**:

1. **Given** el campo «Buscar sede», **When** se escribe parte del nombre de una sede, **Then** se muestran las sedes que coinciden.
2. **Given** una plaza, museo o teatro registrado como sede de la programación, **When** se busca, **Then** aparece.
3. **Given** un lugar que no es sede de la programación, **When** se busca, **Then** no aparece; el mapa no muestra puntos de interés generales.
4. **Given** una búsqueda de una función por su nombre, **When** se escribe en el mapa, **Then** no devuelve funciones; el visitante debe usar la Agenda.
5. **Given** una búsqueda sin coincidencias, **When** se ejecuta, **Then** se muestra un mensaje de sin resultados.
6. **Given** una sede registrada sin funciones, **When** se busca, **Then** aparece.
7. **Given** una búsqueda escrita sin tildes o con otras mayúsculas («teatro bolivar»), **When** se ejecuta, **Then** encuentra la sede igual.

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
5. **Given** el filtro de accesibilidad con «acceso sin escalones» o «baño accesible», **When** se activa, **Then** solo muestra sedes con esa característica confirmada, y una sede con la característica no disponible o por confirmar no aparece.
6. **Given** una sede con solo franjas de apertura ese día, **When** se aplica «Funciones del día», **Then** no aparece; sigue visible en el mapa y en la lista sin filtros.
7. **Given** «Funciones del día» y «acceso sin escalones» activos a la vez, **When** se aplican, **Then** solo aparecen las sedes que cumplen ambos.
8. **Given** el selector de día, **When** se abre, **Then** ofrece solo los días con funciones publicadas de la edición activa.
9. **Given** que hoy está fuera de la edición o no tiene funciones, **When** se activa el filtro sin elegir día, **Then** no muestra sedes e indica que hoy no hay funciones, con la opción de elegir otro día.

---

### User Story 5 - Consultar las sedes en una lista (Priority: P1)

El visitante alterna a una lista equivalente para consultar las sedes, incluidas las que no tienen marcador en la ilustración, sin compartir ubicación y sin usar el mapa gráfico.

**Why this priority**: garantiza accesibilidad y cubre las sedes que no caben en la ilustración.

**Independent Test**: se consulta una sede solo con teclado y sin abrir el mapa gráfico, incluida una sede sin marcador.

**Acceptance Scenarios**:

1. **Given** el Mapa, **When** el visitante abre la lista, **Then** ve todas las sedes registradas, tengan o no funciones y tengan o no marcador, incluidos los recorridos.
2. **Given** la lista, **When** se usa solo con teclado, **Then** se puede seleccionar una sede y ver sus funciones.
3. **Given** la lista, **When** se usa, **Then** no se pide ubicación.
4. **Given** una sede, **When** se muestra su estado, **Then** no se comunica solo con color.
5. **Given** un recorrido en la lista, **When** se selecciona, **Then** muestra su descripción y sus funciones, sin «Cómo llegar».

---

### User Story 6 - El administrador mantiene los datos de las sedes (Priority: P2)

El administrador actualiza los datos, marcadores, destinos y fotos de las sedes, registra la accesibilidad con su fuente y fecha de verificación, y los cambios se registran en el historial sin revisión editorial.

**Why this priority**: los datos de las sedes cambian, y el mapa solo es útil si están al día.

**Independent Test**: se corrige una dirección y un marcador, se registra accesibilidad con fuente y fecha, y se verifica el efecto público y el historial.

**Acceptance Scenarios**:

1. **Given** un administrador, **When** corrige una dirección o un marcador, **Then** se actualizan los datos de la sede sin aviso público y queda en el historial.
2. **Given** un administrador, **When** registra «acceso sin escalones» o «baño accesible» de una sede, **Then** verifica cada característica por separado con el estado confirmada, no disponible o por confirmar, y guarda la fuente y la fecha de verificación.
3. **Given** un administrador con una ilustración entregada por el equipo, **When** ubica el marcador de una sede, **Then** el marcador queda sobre la ilustración y no se usa como coordenada real.
4. **Given** un administrador, **When** registra el destino de una sede, **Then** introduce sus coordenadas (latitud y longitud), comprueba que corresponden a la sede y guarda la fuente y la fecha de verificación; mientras no lo haga, «Cómo llegar» no aparece.
5. **Given** una sede con una característica por confirmar, **When** se muestra, **Then** aparece «por confirmar» y la sede no entra en el filtro de esa característica; una observación de texto no cambia el filtro.
6. **Given** una función que cambia de sede, **When** se confirma, **Then** es una reprogramación con aviso público (spec 02), no una corrección de la sede.
7. **Given** un usuario sin rol de administrador, **When** intenta modificar una sede, **Then** el sistema lo rechaza.
8. **Given** una sede nueva sin marcador, **When** el administrador la registra, **Then** aparece en la lista y en la búsqueda aunque no tenga marcador.
9. **Given** un administrador, **When** sube una foto de una sede, **Then** debe indicar su texto alternativo y su fuente o autoría; sin esos datos la foto no se guarda, y el cambio queda en el historial.
10. **Given** un administrador, **When** quita la foto de una sede, **Then** la tarjeta pública vuelve a mostrarse sin foto.
11. **Given** coordenadas fuera de rango (latitud fuera de −90 a 90 o longitud fuera de −180 a 180), **When** se guardan, **Then** el sistema las rechaza.

### Edge Cases

- Una sede definida como tramo de calle o recorrido, como el desfile inaugural (PDF pág. 8): no tiene destino único para «Cómo llegar».
- Una sede con varias funciones el mismo día, algunas canceladas.
- Un día sin funciones publicadas: el filtro no muestra sedes y se indica.
- Una sede registrada sin dirección: se muestra su referencia o «Dirección por confirmar», sin inventarla.
- El mapa no carga o tarda: la Agenda y las fichas siguen disponibles, y la lista de sedes puede consultarse.
- Una sede con funciones publicadas pero sin marcador, o fuera del plano de la ilustración: sigue en la lista.
- Una sede con una característica de accesibilidad confirmada y otra por confirmar.
- Una observación de texto sobre accesibilidad que contradice el estado verificado: prevalece el estado.
- Dos sedes con nombres parecidos en la búsqueda.
- Un dispositivo sin soporte para zoom táctil.
- Hoy está fuera de la edición o no tiene funciones: «Funciones del día» sale vacío y lo indica (historia 4, escenario 9).
- La búsqueda no distingue mayúsculas ni tildes.
- Una sede con solo franjas de apertura: aparece en el mapa y en la lista, pero no en «Funciones del día».
- La ilustración definitiva no ha llegado (P-13): la demo usa una ilustración provisional marcada como tal, y la lista sigue completa.
- Una función cancelada hoy en una sede sin otras funciones ese día: la sede no aparece en el filtro, y en su ficha la función se ve como «Cancelada».

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
- **FR-007**: El Mapa DEBE ofrecer el filtro «Funciones del día», que muestra las sedes con funciones publicadas y no canceladas para el día consultado, aunque todavía no hayan empezado. Una franja de apertura NO DEBE contar para este filtro.
- **FR-008**: El filtro «Funciones del día» DEBE consultar hoy por defecto, en hora de Loja, y permitir elegir otro día de la edición, entendido como un día con funciones publicadas de la edición activa.
- **FR-009**: El Mapa NO DEBE ofrecer otro filtro temporal; «¿Qué hay ahora?» pertenece a la Agenda.
- **FR-010**: El Mapa DEBE permitir filtrar por «acceso sin escalones» y «baño accesible», y una sede cuya característica no está confirmada NO DEBE aparecer en ese filtro. Los filtros activos DEBEN combinarse con «y».

**Sede**

- **FR-011**: Al seleccionar una sede, el sistema DEBE mostrar su nombre, su dirección o referencia y sus funciones publicadas desde hoy en adelante (hora de Loja), o solo las del día consultado si «Funciones del día» está activo. Una función cancelada DEBE mostrarse marcada como «Cancelada».
- **FR-012**: «Cómo llegar» DEBE abrir un destino verificado en una aplicación externa, mediante un enlace de Google Maps a sus coordenadas y sin pedir la ubicación de la persona, y NO DEBE ofrecerse si la sede no tiene destino verificado. La posición del marcador ilustrado NO DEBE usarse como coordenada real.
- **FR-013**: Cada característica de accesibilidad DEBE mostrarse como confirmada, no disponible o por confirmar; si falta confirmación, DEBE mostrarse «por confirmar».
- **FR-014**: Una plaza, museo o teatro DEBE aparecer como sede solo si está registrado como sede de la programación.

**Lista alternativa**

- **FR-015**: El sistema DEBE ofrecer una lista equivalente para consultar sedes sin compartir ubicación, con todas las sedes registradas, tengan o no funciones y tengan o no marcador en la ilustración. Los recorridos DEBEN listarse sin «Cómo llegar».
- **FR-016**: La lista DEBE ser utilizable con teclado, y el estado de una sede NO DEBE comunicarse solo con color.

**Administración de sedes**

- **FR-017**: El administrador DEBE poder actualizar los datos, marcadores, destinos y la foto de las sedes, sin revisión editorial y con registro en el historial.
- **FR-018**: El administrador DEBE poder registrar cada característica de accesibilidad de una sede por separado, con su estado, su fuente y la fecha de verificación, y verificarla con su responsable o por revisión directa. Las observaciones de texto DEBEN ser complementarias y NO DEBEN controlar el filtro.
- **FR-019**: Trasladar una función a otra sede DEBE tratarse como una reprogramación con aviso público (spec 02), no como una actualización de la sede.
- **FR-020**: El plano del circuito del PDF DEBE tratarse como referencia visual, no como fuente de coordenadas exactas.
- **FR-021**: Solo el administrador DEBE poder modificar los datos de una sede.

**Ilustración, destino verificado y accesibilidad** (decisiones cerradas el 2026-11-20; véase Clarifications)

- **FR-022**: El equipo DEBE entregar la ilustración isométrica del circuito de Loja; el mockup define el estilo y NO la geografía. El administrador DEBE poder ubicar los marcadores sobre ella, y una sede fuera del plano o sin marcador DEBE seguir disponible en la lista.
- **FR-023**: Un destino de «Cómo llegar» DEBE registrarse como coordenadas (latitud y longitud) válidas y considerarse verificado solo cuando el administrador comprobó que corresponde a la sede y registró la fuente y la fecha de verificación.
- **FR-024**: Para el MVP, las características de accesibilidad DEBEN ser «acceso sin escalones» y «baño accesible», verificadas por separado con los estados confirmada, no disponible y por confirmar. El filtro DEBE devolver solo sedes con la característica confirmada.

**Foto, marcador y búsqueda** (decisiones cerradas el 2026-11-20; véase Clarifications)

- **FR-025**: Una sede PUEDE tener una foto opcional subida por el administrador. La foto DEBE tener texto alternativo y fuente o autoría, y solo DEBEN usarse fotos propias o con licencia que permita reutilizarlas. Sin foto, la tarjeta NO DEBE cambiar ni mostrar una imagen de relleno.
- **FR-026**: Los marcadores DEBEN ser neutros (sin icono por tipo artístico), y el Mapa NO DEBE ofrecer un botón para ubicar a la persona.
- **FR-027**: La búsqueda de sedes NO DEBE distinguir mayúsculas ni tildes.
- **FR-028**: Mientras no exista la ilustración definitiva (P-13), el Mapa DEBE usar una ilustración provisional marcada visiblemente como tal.

### Key Entities

- **Sede**: lugar o recorrido registrado en la programación, con nombre, dirección o referencia, destino verificado opcional, marcador opcional, foto opcional y accesibilidad con fuente y fecha de verificación.
- **Marcador**: posición de una sede en la ilustración isométrica.
- **Destino verificado**: coordenadas (latitud y longitud) que «Cómo llegar» abre en Google Maps, con la fuente y la fecha en que se comprobó que corresponde a la sede.
- **Característica de accesibilidad**: «acceso sin escalones» o «baño accesible», con estado (confirmada, no disponible o por confirmar), fuente y fecha de verificación, y una observación de texto complementaria opcional.
- **Ilustración isométrica**: imagen del circuito de Loja preparada por el equipo, sobre la que el administrador ubica los marcadores.
- **Foto de sede**: imagen opcional con texto alternativo y fuente o autoría; propia o con licencia que permita reutilizarla.
- **Día consultado**: el día usado por el filtro «Funciones del día»; hoy por defecto, en hora de Loja, o un día con funciones publicadas de la edición activa.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un visitante abre el Mapa, se desplaza, hace zoom y selecciona una sede sin ninguna petición de ubicación ni de identificación (0 peticiones).
- **SC-002**: El 100 % de las sedes registradas aparece en la lista, tengan o no funciones y tengan o no marcador.
- **SC-003**: Con una hora de referencia fijada, el filtro «Funciones del día» muestra exactamente las sedes con al menos una función publicada y no cancelada ese día, aunque no haya empezado, en el 100 % de las pruebas; 0 sedes aparecen solo por tener franjas.
- **SC-004**: En el 100 % de las pruebas, una función cancelada no hace aparecer a su sede en el filtro.
- **SC-005**: 0 lugares que no son sedes de la programación aparecen en la búsqueda, y la búsqueda de una función por nombre devuelve 0 funciones.
- **SC-006**: El 100 % de las sedes sin destino verificado no ofrece «Cómo llegar», y el 100 % de las que lo tienen lo abre.
- **SC-007**: El 100 % de las características sin confirmar se muestra «por confirmar» y 0 sedes con la característica no confirmada aparecen en su filtro; las observaciones de texto no alteran el filtro en el 100 % de las pruebas.
- **SC-008**: Una sede se consulta con teclado y sin usar el mapa gráfico en el 100 % de las pruebas de accesibilidad.
- **SC-009**: El 100 % de los cambios del administrador sobre sedes queda en el historial con quién, cuándo y qué registro.
- **SC-010**: Agenda y fichas se abren aunque el Mapa falle, en el 100 % de las pruebas de fallo.
- **SC-011**: El 100 % de los destinos sin fuente y fecha de verificación no ofrece «Cómo llegar», y 0 marcadores se usan como coordenadas reales.
- **SC-012**: El 100 % de las sedes fuera del plano o sin marcador aparece en la lista.
- **SC-013**: El 100 % de las fotos de sede publicadas tiene texto alternativo y fuente o autoría.
- **SC-014**: La búsqueda encuentra la sede en el 100 % de las pruebas escritas sin tildes o con otras mayúsculas.

## Trazabilidad con el contexto

| Contexto | Cubierto por |
|---|---|
| RF-12 (vista, búsqueda, filtros) | FR-001 a FR-010; Historias 1, 3, 4 |
| RF-13 (sede y Cómo llegar), Q5 | FR-011 a FR-014, FR-023; Historia 2 |
| RF-14 (lista equivalente) | FR-015, FR-016; Historia 5 |
| RF-15 (administración de sedes), Q4 | FR-017 a FR-022; Historia 6 |
| M-02, M-03, M-05, M-06 | FR-005 a FR-010 |
| M-07 | FR-015; SC-002 |
| M-08 | FR-011, FR-012, FR-026 |
| M-09 (foto de sede) | FR-017, FR-025; SC-013 |
| P-13 (ilustración pendiente) | FR-028 |
| RF-12 (accesibilidad), Q6 | FR-010, FR-013, FR-018, FR-024 |
| RNF-01, RNF-03, RNF-05 | FR-002, FR-003, FR-016; SC-001, SC-008 |
| RNF-07 | FR-004; SC-010 |
| RNF-09 | FR-017; SC-009 |

## Assumptions

- Los permisos del administrador vienen del spec 001, y las funciones publicadas vienen del spec 02.
- El mockup de Mapa (`context/assets/mockups/`) solo ilustra el estilo; el mapa de VIVART debe representar el circuito de Loja con sedes verificadas. El equipo entrega la ilustración (P-13), preferible en SVG; hasta entonces se usa una provisional marcada como tal.
- El mockup muestra la tarjeta de sede sin «Cómo llegar» ni lista, con marcadores por tipo y un botón de ubicación; prevalece el requisito (marcador neutro, sin «ubicarme»).
- Las pantallas de lista de sedes y ficha de sede no tienen mockup.
- Una sede puede no tener marcador y seguir siendo consultable en la lista.
