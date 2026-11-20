# Navegación de VIVART

La web pública se diseña primero para celular. Su barra inferior tiene tres pestañas: **Mapa · Agenda · Pasaporte**.

- **Mapa:** vista isométrica con sedes seleccionables y una lista alternativa. El buscador dice «Buscar sede» y busca sedes registradas en la programación (las funciones por nombre se buscan en Agenda). El filtro temporal es «Funciones del día». Desde una sede seleccionada se consultan sus funciones y, si hay un destino verificado, se puede elegir «Cómo llegar».
- **Agenda:** búsqueda, filtros y fichas de funciones. Aquí está **¿Qué hay ahora?** (RF-07). Desde aquí se accede a **Mi recorrido** y al botón **«Pregúntale a Alforjita»**.
- **Pasaporte:** **Mi pasaporte** (total de sellos obtenidos, por ejemplo «5 sellos», sin meta ni porcentaje global), rutas culturales e insignias. El progreso con denominador («2 de 3») pertenece a cada ruta. Un visitante sin cuenta puede explorar las **rutas públicas** y sus funciones; necesita identificarse para ver su colección, su progreso y sus insignias (RF-27, RF-29).
- **Carrito y Perfil:** accesos separados de la barra inferior. **Mis entradas** está dentro de Perfil. Las funciones gratuitas no muestran «Agregar al carrito».
- **Inicio de sesión:** se pide solo cuando la acción lo requiere (pagar, canjear un sello, ver colección o perfil). Al terminar, la persona **vuelve a la compra o al canje que lo originó** y el sistema comprueba que siga siendo válido (RF-03).

El panel interno se diseña primero para escritorio. Cada rol ve las acciones que le corresponden: el editor prepara borradores, el publicador revisa y publica, y el administrador gestiona la operación y también puede crear y publicar. Una persona con varios roles ve la suma de sus acciones. El personal de acceso tiene una vista móvil para validar entradas.

## Referencias visuales

Los mockups de `../assets/mockups/` son referencias visuales. **Si una pantalla contradice un requisito, prevalece el requisito.** Ningún mockup es fuente de horarios, precios, cupos, direcciones, accesibilidad ni de cifras de progreso: sus textos y datos son de ejemplo.

| Referencia | Ubicación | Qué muestra |
|---|---|---|
| Mapa isométrico | `../assets/mockups/mapa-isometrico.jpeg` | Ilustración isométrica sin etiquetas ni marcadores. El mockup ilustra el estilo isométrico. El mapa de VIVART debe representar el circuito de Loja con sedes verificadas; el mockup no es fuente de coordenadas (RF-15). |
| Agenda | `../assets/mockups/Agenda VIVART_ Vive el Festival.png` | Pantalla de Agenda con «¿Qué hay ahora?», filtros por categoría, tarjetas de funciones con Guardar y Agregar al carrito, acceso a Mi recorrido y a Perfil. |
| Mapa, Pasaporte y Rutas | `../assets/mockups/Pasaporte Vivo por Loja.png` | Tres pantallas en un solo archivo: Mapa (sedes, búsqueda, filtros y tarjeta de sede), Pasaporte (Mis Sellos, Rutas Culturales, Insignias) y detalle de una ruta con progreso. |
| Afiche de Alforjita | `../assets/alforjita-referencia.jpeg` | Está en `assets/`, no en `mockups/`. Usar la ilustración como avatar requiere autorización. |

### Los requisitos prevalecen sobre los mockups

Los mockups no se editan en esta entrega. Cuando un mockup muestre algo distinto, se sigue el requisito:

| Mockup | Lo que muestra | Lo que se implementa |
|---|---|---|
| Agenda | Funciones «Gratis» con **Agregar al carrito**. | Una función gratuita **no** muestra «Agregar al carrito» (RF-19). |
| Agenda | El botón dice «Pregúntale a VIVART». | El botón dice **«Pregúntale a Alforjita»** (RF-31). |
| Agenda | Solo se ve Perfil; no se ve el Carrito. | **Carrito conserva su acceso**, separado de Perfil. |
| Agenda | Duraciones («90 min») y «en curso». | Solo si la duración o la hora de fin se conocen (RF-06, RC-03). |
| Mapa | Búsqueda de «sede, función o punto de interés». | Buscador **«Buscar sede»**; solo sedes registradas en la programación (RF-12). |
| Mapa | Filtro «Funciones ahora». | Filtro **«Funciones del día»**; «¿Qué hay ahora?» está en Agenda (RF-12, RF-07). |
| Mapa | La tarjeta de sede no muestra «Cómo llegar» ni la alternativa en lista. | El mapa mantiene **«Cómo llegar»** cuando hay un destino verificado y una **vista alternativa en lista** (RF-13, RF-14). |
| Mapa | Marcadores con iconos por tipo de obra (teatro, música, artes plásticas). | **Marcador neutro**: las sedes no tienen tipo artístico (M-08). |
| Mapa | Botón para ubicar a la persona en el mapa. | **Sin botón «ubicarme»**: el mapa no pide ubicación (RNF-05, M-08). |
| Mapa | Foto de la sede en la tarjeta. | Foto **opcional**, subida por el administrador, con texto alternativo y fuente o autoría; sin foto la tarjeta no cambia (RF-13, M-09). |
| Pasaporte | «5 de 12 sellos», 42 % y un casillero «Próximo sello». | «Mi pasaporte» muestra el total obtenido («5 sellos»), sin meta, porcentaje ni casillero bloqueado (RF-27). |
| Rutas | «2 de 3 sellos» en una ruta. | Es correcto: el denominador pertenece a cada ruta (RF-29). |
| Todos | Fechas de octubre y nombres de funciones de ejemplo. | La programación sale del PDF y del catálogo publicado. |

## Pantallas sin mockup

No se han recibido mockups de estas pantallas. Se diseñan a partir de los requisitos; no se inventa aquí su aspecto.

- Ficha de una actividad o función.
- **Mi recorrido** (solo existe el botón de acceso en Agenda).
- Carrito, pago de prueba, Perfil y Mis entradas.
- Lista de sedes del Mapa.
- Canje de un QR de Pasaporte y vista de un sello individual.
- Alforjita (ventana de conversación y preguntas rápidas).
- Panel interno: borradores, revisión, publicación, carga desde PDF, sedes, ventas, Pasaporte y rutas, roles.
- Control de acceso del personal (validación por QR y código manual).
