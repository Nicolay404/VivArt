# VIVART: requisitos funcionales

Los ocho bloques organizan el comportamiento del producto y sirven de insumo para Spec Kit. **No son los specs finales ni determinan la arquitectura.**

Los identificadores **RF-xx** (requisitos) y **RC-xx** (reglas comunes) son estables: no se renumeran. `no-funcionales.md` indica en su columna «Verifica» qué RF o RC comprueba cada RNF.

## Conceptos y reglas comunes

### Conceptos

- **Actividad:** obra, exposición, feria, taller u otra propuesta cultural. Una actividad puede tener varias funciones.
- **Organización:** equipo responsable de la actividad. Es un dato de la ficha. En el MVP no tiene cuentas ni permisos propios.
- **Función:** presentación concreta, con fecha, hora y sede. Dos presentaciones de la misma obra a distintas horas son funciones distintas. Precio, cupos, entradas y QR del pasaporte se gestionan por función. Una **función puntual** de una actividad permanente (una visita guiada, una inauguración) es una función como cualquier otra, siempre que tenga fecha y hora registradas.
- **Franja de apertura:** intervalo en que se puede visitar una actividad permanente. Puede repetirse en varios días y haber más de una franja por día. **Una franja no entrega sellos, no cuenta para rutas ni habilita ventas por sí sola.** No hay sellos por día, franja o exposición en el MVP.
- **Modalidad de acceso:** gratuita confirmada, de pago confirmada o por confirmar. La ausencia de precio no significa gratuidad. «Entrada Libre» y «Evento Gratuito» del PDF equivalen a gratuita confirmada solo si la etiqueta se asocia claramente a la ficha y el registro fue revisado. «Evento Pagado» identifica una actividad de pago, pero no habilita el carrito sin precio, cupo y venta interna habilitada. Si la venta es externa, la ficha puede mostrar un enlace verificado.
- **Guardar, comprar y canjear son acciones distintas.** Guardar no reserva. Una compra confirmada emite entradas. Canjear el QR del Pasaporte Vivo otorga un sello. Se puede reclamar un sello sin comprar ni validar una entrada.

### Reglas comunes

| ID | Regla |
|---|---|
| RC-01 | **Roles.** Una persona puede tener varios roles; sus permisos son la suma de los roles activos y cada acción se rechaza si ningún rol activo la concede. Los roles son visitante, usuario registrado, editor, publicador, administrador y personal de acceso. Un **publicador autorizado** es un usuario con el rol de publicador activo. Solo el personal de acceso tiene alcance limitado: las funciones que se le asignan. |
| RC-02 | **Cruces de horario.** Se advierte cuando ambos intervalos se conocen. La advertencia nunca bloquea guardar ni comprar. |
| RC-03 | **Función sin hora de fin.** Si solo se conoce el inicio y ya pasó, se muestra «Hora de inicio pasada» y la función sale de las próximas. No se afirma que está en curso ni que terminó. «Terminada» solo se muestra si hay hora de fin, una duración conocida que permita calcularla o una confirmación operativa explícita. |
| RC-04 | **Dos tipos de QR, no intercambiables.** Un QR de entrada no reclama un sello y un QR de pasaporte no valida un ingreso. Cada tipo se identifica sin ambigüedad y, si se usa en el flujo equivocado, se rechaza con el motivo «tipo de código incorrecto». |
| RC-05 | **Unicidad.** Una entrada se consume una vez, un sello se otorga una vez por usuario y función, el último cupo se vende una vez y una confirmación de pago repetida no emite más entradas. Las pruebas están en RNF-06. |
| RC-06 | **Historial y aviso público.** Toda operación sensible (publicación, reprogramación, cancelación, archivo, cambios en sedes o categorías, cambios de permisos, edición y reasignación de borradores) conserva quién la hizo, cuándo y sobre qué registro. El **aviso público** se exige solo para reprogramaciones, cancelaciones y cambios que afecten la asistencia o el acceso a una función; no para cada corrección de texto, categoría o marcador. Cuando corresponde, el aviso es visible en Agenda, Mi recorrido y, si hay entradas, Mis entradas. |
| RC-07 | **Reloj de referencia.** Agenda, ¿Qué hay ahora?, Mi recorrido, Alforjita y el control de acceso usan una misma referencia de fecha y hora en hora de Loja. En pruebas y en la demo puede fijarse una fecha y hora distintas (véase RNF-10). |

## 01. Identidad, perfil y permisos

**Objetivo:** mantener abierta la consulta pública y pedir identificación solo cuando la acción lo requiera.

| ID | Requisito |
|---|---|
| RF-01 | El visitante puede consultar Agenda, fichas, Mapa y Alforjita, preparar un carrito y guardar su recorrido local sin cuenta. |
| RF-02 | El usuario puede registrarse, iniciar y cerrar sesión, recuperar el acceso y consultar sus propios pedidos, entradas, sellos e insignias desde los espacios correspondientes (pedidos y entradas en Perfil; sellos e insignias en Pasaporte). |
| RF-03 | Si se solicita iniciar sesión durante una compra o un canje, el usuario vuelve a la acción original y el sistema comprueba que todavía sea válida. Si ya no lo es (cupo agotado, QR vencido, función cancelada), se lo indica con el motivo y le ofrece volver a la ficha o al carrito. |
| RF-04 | El administrador asigna y revoca roles (RC-01). **El editor** prepara y edita sus propios borradores y los envía a revisión (RF-08), pero no puede publicar, ni siquiera mediante una llamada directa a la API. **El publicador** revisa, edita propuestas ajenas, aprueba y publica, incluidas las fichas que él mismo editó; no se exige una segunda persona. **El administrador** gestiona la operación, revisa y edita propuestas ajenas, reasigna borradores, y también puede crear y publicar eventos y cargar el catálogo o la programación planificada. No hay permisos por organización. **El personal de acceso** valida solo las funciones que se le asignan. Publicar no concede permiso para activar ventas. Toda acción rechazada por permisos indica qué rol falta, sin revelar contenido que el usuario no puede ver. |
| RF-04b | Al revocar un rol, los borradores y propuestas pendientes se conservan con su autor e historial, y el usuario pierde solo las acciones que concedía ese rol. El administrador puede reasignar el trabajo y otro publicador puede continuar una revisión. Revocar un rol no despublica contenido. |

**Flujo:** el visitante inicia una compra o abre un QR de pasaporte → se identifica → retoma la acción → el sistema verifica su vigencia.

## 02. Programación, agenda y publicación

**Objetivo:** permitir que el equipo mantenga una programación vigente y que el público la encuentre desde el celular.

| ID | Requisito |
|---|---|
| RF-05 | La Agenda muestra actividades publicadas. Permite buscar por título o artista y filtrar por fecha, categoría, sede y modalidad de acceso. |
| RF-06 | Cada ficha tiene un enlace compartible y muestra la información disponible: descripción, organización, fecha, hora, sede, duración si se conoce, modalidad, precio confirmado y avisos de cambio. Los datos no confirmados se muestran como pendientes, no se completan. |
| RF-07 | **¿Qué hay ahora?** está en la Agenda. Muestra franjas abiertas y próximas funciones, excluyendo las canceladas. Aplica RC-03 y RC-07. |
| RF-08 | El editor crea y edita **sus propios** borradores, añade funciones o franjas, previsualiza la ficha y la envía a revisión. No puede publicarla. Una vez enviada una propuesta, el editor no puede modificarla hasta que se la devuelvan con observaciones. El administrador puede reasignar un borrador a otra persona. Editar una ficha ya publicada crea una versión pendiente de revisión. Cada cambio de un borrador conserva su historial (RC-06). |
| RF-09 | El publicador y el administrador consultan las propuestas, también las ajenas; pueden editarlas, devolverlas con observaciones o aprobarlas y publicarlas, incluso las que ellos mismos prepararon. Mientras una revisión esté pendiente, la última versión publicada sigue visible. |
| RF-10 | El publicador puede reprogramar o cancelar con un motivo interno y un aviso público, y el sistema conserva quién hizo el cambio y cuándo. **Trasladar una función a otra sede es una reprogramación** y requiere aviso público. Antes de confirmar, el sistema muestra cuántas entradas vendidas y pedidos pendientes tiene la función. **Si hay entradas vendidas, se aplican RF-24 (cancelación) y RF-36 (reprogramación), que son la fuente de esas reglas.** Si la función tiene Pasaporte habilitado, se aplica además RF-25. Se aplica RC-06. |
| RF-11 | El administrador gestiona ediciones, categorías y sedes. Los cambios en sedes y categorías **no pasan por revisión editorial** pero quedan en el historial; corregir una dirección o un marcador actualiza los datos de la sede. También crea y publica eventos. Puede cargar el catálogo o la programación planificada y revisar una carga preparada a partir del PDF con páginas de origen, posibles duplicados y datos pendientes. Los registros aceptados se cargan como borradores: **importar un lote no lo publica**. El administrador confirma explícitamente qué registros se publican. Nunca se sobrescriben correcciones ya revisadas. |
| RF-35 | **Archivo con historial.** No se elimina una actividad con ventas o sellos. Si una función vigente no se va a realizar, primero se cancela con aviso (no se oculta). **Solo el administrador puede archivar.** Archivar retira la actividad de la programación activa sin borrar pedidos, entradas, sellos ni historial. |

**Flujo:** carga inicial o creación manual → borrador → previsualización → revisión → devolución o publicación → ficha visible en Agenda. Si hay un cambio posterior, se publica un aviso y se conserva el historial.

**Casos de referencia del PDF** (verificados sobre la capa de texto de `PROGRAMACION 2026 digital.pdf`; no se revisaron las ilustraciones). El PDF no viene con el clon del repositorio: véase `context/assets/README.md`.

- **Horario partido** (págs. 3–4): varias actividades de la Plaza de la Cultura abren de 10h00 a 14h00 y de 15h00 a 19h30.
- **«Frontera en Movimiento»** (pág. 4): franjas distintas según el rango de días. 09h00–13h00 de viernes 13 a sábado 14 y de lunes 16 a sábado 21; 15h00–18h00 el viernes 13 y de lunes 16 a viernes 20.
- **«Círculo de Memorias Recicladas»** (págs. 4 y 13): en la pág. 4 es una actividad **permanente** sin horario en la ficha; en la pág. 13 aparece como **«Performance Inaugural»** a las 20h00 en el mismo lugar (Rocafuerte y Bernardo Valdivieso, esquina). Es una actividad permanente con una función puntual.
- **«Zombi Manifiesto»** (pág. 8): dos funciones el 12 de noviembre en el Teatro Bolívar, a las 11h00 y a las 20h00.
- **Solo hora de inicio:** «Lo que Somos» (pág. 4) indica únicamente 09h00 (RC-03).
- **Pagadas sin precio:** el texto del PDF contiene siete marcas «Evento Pagado» (págs. 13, 18, 38, 43 y 47), por ejemplo «Viernes de otra Cosa» (pág. 13), «Noche Sinvergüenza» (pág. 18) y «Noche Lojana» (pág. 38). Ninguna indica precio y el texto no contiene ninguna cifra de precio.
- **Gratuitas:** «Entrada Libre» y «Evento Gratuito» aparecen, por ejemplo, en las págs. 11 y 26.
- **Sede como recorrido:** el desfile inaugural (pág. 8) se describe como un tramo de la calle Bolívar, no como un edificio.
- La pág. 3 indica «Programación sujeta a cambios».

No inventar los datos ausentes ni usar los mockups como fuente de programación.

## 03. Mapa isométrico de sedes

**Objetivo:** ayudar al visitante a reconocer el circuito y decidir a qué sede ir.

| ID | Requisito |
|---|---|
| RF-12 | Mostrar una vista isométrica interactiva del circuito con marcadores seleccionables, desplazamiento y zoom. Permitir **buscar sedes** (el campo dice «Buscar sede»; para buscar una función por nombre se usa la Agenda) y filtrar por **«Funciones del día»** o por características de accesibilidad verificadas. «Funciones del día» muestra las sedes con funciones publicadas y no canceladas para el día consultado, aunque todavía no hayan empezado. **Por defecto consulta hoy, en hora de Loja (RC-07), y permite elegir otro día de la edición.** No hay otro filtro temporal en el mapa: **¿Qué hay ahora?** está en la Agenda (RF-07). Una plaza, museo o teatro aparece solo si está registrado como sede de la programación; el mapa no muestra puntos de interés generales. Una sede sin accesibilidad verificada no aparece en el filtro de accesibilidad. |
| RF-13 | Al seleccionar una sede, mostrar su nombre, dirección o referencia y funciones publicadas. **Cómo llegar** abre un destino verificado en una aplicación externa; si la sede no tiene un destino verificado (por ejemplo, un recorrido), no se ofrece. Si falta confirmación de accesibilidad, muestra «Accesibilidad por confirmar». |
| RF-14 | Ofrecer una lista equivalente para consultar sedes sin compartir ubicación, incluidas las que no tengan un marcador en la ilustración. |
| RF-15 | El administrador puede actualizar los datos, marcadores y destinos de las sedes sin revisión editorial, con registro en el historial. También registra la accesibilidad en la ficha de la sede y la verifica con su responsable o por revisión directa, conservando la **fuente y la fecha de verificación**. El plano del circuito del PDF es una referencia visual, no una fuente de coordenadas exactas. |

**Flujo:** abrir Mapa → buscar o seleccionar una sede → consultar sus funciones → abrir una ficha o elegir **Cómo llegar**.

## 04. Mi recorrido y alternativas

**Objetivo:** ayudar a organizar la visita y ajustar el plan si cambia la programación.

| ID | Requisito |
|---|---|
| RF-16 | Guardar y quitar funciones o franjas sin cuenta, conservarlas en el mismo navegador y ordenarlas por horario. Informar que guardar no reserva cupo. Mi recorrido **se queda en el navegador**: iniciar sesión no lo sincroniza ni lo asocia a la cuenta, y el MVP no sincroniza entre dispositivos. |
| RF-17 | Advertir cruces según RC-02. Reflejar cambios de hora y sede (RC-06) y mantener las funciones canceladas con su aviso hasta que el visitante las quite. |
| RF-18 | Ante una función cancelada, con «Hora de inicio pasada», terminada (RC-03) o agotada, sugerir funciones que aún no comiencen. Priorizar la misma sede y luego sedes cercanas si hay datos suficientes. No afirmar que la original terminó si no se sabe. |

**Flujo:** guardar una función → consultar **Mi recorrido** → detectar un cruce o cambio → conservar, quitar o sustituir la función.

## 05. Carrito, compra y control de entradas

**Objetivo:** permitir la compra de funciones habilitadas y evitar que una entrada conceda acceso dos veces.

| ID | Requisito |
|---|---|
| RF-19 | Agregar entradas de una o varias funciones con venta interna, ajustar cantidades, eliminar ítems y revisar el precio unitario y el total en USD. Advertir cruces según RC-02. Las funciones gratuitas no muestran «Agregar al carrito». |
| RF-20 | Al iniciar el pago, exigir sesión y verificar precio, vigencia y cupos. Si cambian, pedir que se revise el carrito. El carrito no congela el precio. Al crear el pedido se valida el total, y **el pedido pendiente conserva ese total mientras siga vigente su retención**. Los cupos se retienen durante **10 minutos** desde que se inicia el pago (valor inicial); **solo el administrador puede cambiar ese plazo y el nuevo valor se aplica a pedidos nuevos**, sin alterar retenciones ya iniciadas. Si el pago falla o vence, se liberan los cupos; si el usuario vuelve a pagar, debe revisar y aceptar el precio vigente. Un cambio de precio no modifica pedidos confirmados. |
| RF-21 | Emitir una entrada individual con QR único por cada unidad comprada, solo después de confirmar el pago. Una confirmación repetida no duplica entradas (RC-05). Una confirmación tardía se registra como **incidencia** y **no emite entradas automáticamente**. Pedidos y entradas se consultan según RF-02. |
| RF-22 | El administrador configura precio, cupo y habilitación de venta por función (el plazo de retención se rige por RF-20). Puede consultar pedidos, cupos retenidos y vendidos y entradas usadas. **Revisa las incidencias por confirmación tardía y registra su resolución en el entorno de prueba**; la resolución no emite entradas automáticamente, no recupera cupos ya liberados y no ejecuta reembolsos dentro de VIVART. No puede reducir el cupo por debajo de lo vendido más lo retenido. |
| RF-23 | El personal asignado abre y cierra el control de acceso de su función; el cierre no se deduce de una duración desconocida. Escanea un QR o introduce un código alternativo. Una entrada se **admite** solo si está confirmada, no usada ni invalidada, corresponde a la función asignada al operador y la función no está cancelada; entonces se marca como usada. Si se rechaza, se indica el motivo: **tipo de código incorrecto** (RC-04), código no encontrado, entrada ya usada, función incorrecta, función cancelada, entrada no confirmada o invalidada, o control de acceso cerrado. |
| RF-24 | **Fuente única de la regla de cancelación con ventas** (RF-10 remite aquí). **Cancelar una función con entradas vendidas corresponde solo al administrador**; sin ventas también puede hacerlo el publicador. La cancelación bloquea nuevas compras y validaciones, libera las retenciones pendientes y deja un aviso en la ficha y en Mis entradas. Las entradas ya emitidas se muestran como «función cancelada» y se rechazan en el acceso con ese motivo. El administrador puede identificar los pedidos afectados. Los reembolsos, automáticos o manuales dentro de VIVART, quedan fuera del MVP. |
| RF-36 | **Reprogramación con entradas vendidas.** Si sigue siendo la misma función, las entradas no usadas conservan su QR y su validez para la nueva fecha, hora o sede. Las entradas usadas no se reactivan. El cambio se refleja en Agenda, Mi recorrido y Mis entradas (RC-06). En el MVP no hay devolución desde la web. |

**Flujo:** ficha con venta habilitada → carrito → inicio de sesión → verificación y retención → pago de prueba confirmado → **Mis entradas** → validación en la sede.

**Alcance inicial:** entrada general y pagos de prueba, sin asientos numerados, cobros reales, reservas gratuitas ni reembolsos.

## 06. Pasaporte Vivo y sellos

**Objetivo:** que el usuario conserve un recuerdo de cada función habilitada, sea gratuita o de pago.

| ID | Requisito |
|---|---|
| RF-25 | El administrador genera, activa, desactiva o reemplaza el QR del pasaporte por función (una función puntual si la actividad es permanente; véase Conceptos). Configura la ventana de canje y el contenido del sello. Reemplazar el QR no elimina sellos obtenidos. **Al publicarse un cambio de fecha, hora o sede, el canje anterior se desactiva si estaba habilitado**; la ventana no se mueve sola. El administrador puede confirmar una nueva ventana y reactivar el canje. Los sellos ya obtenidos se conservan. |
| RF-26 | Al abrir el enlace del QR, el sistema verifica sesión iniciada, QR vigente, función habilitada y no cancelada y ventana de canje. **No exige haber comprado ni validado una entrada.** Entrega un solo sello por usuario y función. Si ya existe, muestra el mismo sello, sin tratarlo como error. Los rechazos distinguen: tipo de código incorrecto (RC-04), QR desactivado o reemplazado, fuera de la ventana de canje (vencido o aún no abierto) y función cancelada. No hay código manual de canje en el MVP: se usa el enlace del QR abierto en el navegador. |
| RF-27 | El usuario puede consultar su colección y abrir cada sello para ver espectáculo, fecha, sede y recuerdo visual o textual, cuando exista. **Mi pasaporte** muestra el total de sellos obtenidos (por ejemplo, «5 sellos»). No hay meta global, porcentaje global ni casillero bloqueado de un «próximo sello»: el progreso con denominador pertenece a cada ruta (RF-29). |

**Flujo:** escanear el QR del pasaporte en la sede → identificarse si hace falta → reclamar el sello → verlo en la colección. Comprar una entrada no entrega el sello automáticamente. El QR del pasaporte puede compartirse, por lo que no se presenta como prueba estricta de asistencia.

## 07. Rutas culturales e insignias

**Objetivo:** animar al público a explorar distintas propuestas a partir de los sellos que ya colecciona.

| ID | Requisito |
|---|---|
| RF-28 | El administrador crea y publica rutas, selecciona funciones elegibles (funciones con Pasaporte habilitado, incluidas las puntuales de actividades permanentes; no franjas), establece una meta alcanzable y asigna la insignia. |
| RF-29 | El visitante puede consultar las rutas públicas y sus funciones sin cuenta. El usuario registrado puede ver su colección (RF-27) y su **progreso en cada ruta** con denominador (por ejemplo, «2 de 3»), calculado solo con sellos distintos de funciones elegibles de esa ruta. El denominador es de la ruta, no del pasaporte. |
| RF-30 | Al alcanzar la meta, el usuario obtiene la insignia una sola vez. Editar una ruta no retira automáticamente insignias ya ganadas. |

**Flujo:** abrir una ruta en Pasaporte → ver qué funciones faltan → reclamar sus sellos → consultar el progreso → desbloquear la insignia.

## 08. Alforjita, asistente del festival

**Objetivo:** ayudar al visitante a encontrar un plan o aclarar dudas sin revisar toda la programación.

| ID | Requisito |
|---|---|
| RF-31 | Abrir el asistente sin cuenta desde **«Pregúntale a Alforjita»** en Agenda y ofrecer preguntas rápidas sobre funciones próximas, gratuitas, sedes y cambios. |
| RF-32 | Resolver consultas admitidas por fecha, horario, categoría, sede y modalidad de acceso. Usar el mismo catálogo público vigente y la misma referencia de tiempo (RC-07) que Agenda y enlazar a las fichas. **Si la consulta no indica día, asume hoy en hora de Loja e indica esa suposición**; para «después de las seis» sugiere solo funciones de hoy que aún no empiezan y, si no hay, ofrece consultar otro día. El filtro de gratuitas incluye solo funciones con gratuidad confirmada. |
| RF-33 | Distinguir cuatro respuestas. **Sin coincidencias:** indica los criterios aplicados y ofrece relajar uno o abrir la Agenda. **Dato no confirmado:** dice qué dato falta (precio, hora de fin, accesibilidad) sin completarlo ni deducirlo; la ausencia de precio no se presenta como gratuidad. **Fuera de alcance:** explica que no puede hacerlo y a qué pantalla acudir. **Falla del servicio:** indica que no pudo consultar la programación y remite a la Agenda. No inventa datos; no consulta borradores, entradas, sellos ni progreso personal; no compra, no canjea y no modifica la programación. Sí puede explicar cómo funcionan el Pasaporte y las rutas y enlazar a sus páginas públicas. |
| RF-34 | Si se habilita la edición de preguntas rápidas, limitarla a personal autorizado. Los horarios, precios y sedes se consultan en el catálogo, no se mantienen en respuestas manuales duplicadas. |

**Flujo:** el visitante pregunta «¿Qué funciones gratuitas de danza empiezan después de las seis?» → Alforjita asume hoy (Loja) y lo indica → consulta la programación publicada → muestra fichas que coinciden o explica que no encontró resultados → el visitante abre una ficha o vuelve a Agenda.

**Alcance inicial:** puede funcionar con preguntas guiadas y filtros; no exige IA generativa. El nombre del asistente es **Alforjita**. Usar la ilustración de la mascota como avatar requiere autorización.

## Recorrido integrado de referencia

Un editor prepara una función y un publicador (o el administrador) la publica. El visitante la encuentra en Agenda, Mapa o Alforjita y puede guardarla en Mi recorrido. Si la venta está habilitada, compra una entrada de prueba y presenta su QR al personal de acceso. Si la función tiene Pasaporte Vivo habilitado, escanea **el otro QR** para reclamar un sello. El sello cuenta para una ruta si la función es elegible.

Al preparar los specs, cubrir también los casos de función gratuita, precio no confirmado, horario partido, franjas por rango de días, actividad permanente con función puntual, reprogramación con entradas vendidas, cancelación con y sin ventas, último cupo, entrada usada, QR equivocado y sello ya reclamado.

## Decisiones pendientes

Estas preguntas siguen abiertas. Cuando surja una nueva, se añade aquí con un ID P-xx y no se resuelve en los specs sin respuesta del equipo.

| ID | Pendiente | Afecta |
|---|---|---|
| P-09 | El PDF de programación aún no tiene una carpeta compartida con enlace para el equipo. No bloquea el spec de identidad y permisos. | `context/assets/README.md` |

### Decisiones cerradas para el MVP

| ID | Decisión | Dónde está la regla |
|---|---|---|
| P-01 | El editor edita sus propios borradores y, tras enviarlos, espera la devolución. Publicador y administrador editan propuestas ajenas; el administrador reasigna. Sin permisos por organización. | RF-04, RF-08, RF-09 |
| P-02 | El administrador revisa la incidencia de pago tardío y registra su resolución en el entorno de prueba, sin emitir entradas, recuperar cupos ni reembolsar. | RF-21, RF-22 |
| P-03 | Un cambio publicado de fecha, hora o sede desactiva el canje anterior; el administrador puede confirmar una nueva ventana. Los sellos se conservan. | RF-25 |
| P-04 | El carrito no congela el precio; el pedido pendiente conserva su total mientras dure la retención; los pedidos confirmados no cambian. | RF-20 |
| P-05 | Mi recorrido se queda en el navegador y no se sincroniza con la cuenta. | RF-16 |
| P-06 | Solo el administrador archiva, y antes se cancela con aviso. | RF-35 |
| P-07 | Retención inicial de 10 minutos; solo el administrador la cambia y aplica a pedidos nuevos. | RF-20 |
| M-01 | Pasaporte sin meta global: «Mi pasaporte» muestra el total de sellos obtenidos; el progreso con denominador es de cada ruta. | RF-27, RF-29 |
| M-02 | El buscador del mapa busca **sedes** («Buscar sede»); las funciones por nombre se buscan en Agenda. Solo aparecen sedes registradas en la programación. | RF-12, RF-13 |
| M-03 | Filtro del mapa «Funciones del día»; sin otro filtro temporal. «¿Qué hay ahora?» se queda en Agenda. | RF-12, RF-07 |
| M-04 | El PDF de programación se conserva fuera de Git, en una carpeta compartida. | `context/assets/README.md` |
| M-05 | «Funciones del día» consulta hoy por defecto, en hora de Loja, y permite elegir otro día de la edición. | RF-12, RC-07 |
