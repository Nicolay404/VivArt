# Research: Alforjita, asistente del festival

Decisiones técnicas del spec 008. Las decisiones de producto están en el spec (Clarifications) y en `context/requirements/funcionales.md` (M-14 a M-17).

## D-01. Dónde vive Alforjita

- **Decisión**: en el servicio de programación, con dos módulos de dominio nuevos (`alforjita-interprete.js` y `alforjita.js`) y una ruta pública.
- **Razón**: la arquitectura (`docs/arquitectura/README.md`) asigna Alforjita a este servicio; ahí están el catálogo publicado, las sedes con accesibilidad y el reloj común.
- **Alternativas**: servicio propio (otra base y otra pieza para leer el mismo catálogo por HTTP; contradice FR-006 y la arquitectura).

## D-02. El mismo catálogo que la Agenda

- **Decisión**: `createAgenda` expone `publicadas()` (la lectura que ya usa la Agenda: actividades activas con `published_content`, funciones, franjas y avisos, solo de la edición activa). Alforjita no hace consultas SQL propias sobre actividades.
- **Razón**: FR-006 y SC-002. Si la Agenda cambia cómo lee el catálogo, Alforjita cambia con ella. Los borradores y las versiones pendientes nunca se leen (SC-006).

## D-03. Una sola ruta: `POST /assistant/answers`

- **Decisión**: el cuerpo lleva **o** `{ "text": "…" }` **o** `{ "quick": "<id>", "venueId"?: "…" }`, más `criteria` opcional para aplicar una sugerencia («quitar un criterio», «otro día») sin volver a escribir. Sin sesión: la ruta no lee la cookie.
- **Razón**: el registro de Fastify (`logger: info`) guarda método y URL, no el cuerpo. Con POST el texto nunca llega al registro (M-17, SC-012). La defensa CSRF existente (JSON y `Origin` permitido) se aplica igual.
- **No se guarda nada**: ni la consulta ni la respuesta. La respuesta **no repite el texto escrito**: devuelve los criterios ya interpretados (ids y valores), que la web describe con palabras.
- **Límites**: `text` de 1 a 200 caracteres tras quitar caracteres de control y espacios repetidos; vacío o más largo → `422` con `fields.text`. El campo de la web tiene `maxlength=200`.

## D-04. Intérprete de reglas simples (sin IA generativa)

Función pura `interpretar(texto, { hoy, categorias, sedes, titulos })`. Normaliza con `normalizar()` (sin tildes ni mayúsculas) y aplica reglas en este orden; la primera intención que coincide gana:

1. **Fuera de alcance** (FR-013, FR-015, FR-016), con la pantalla a la que acudir:
   - comprar, pagar, reservar, carrito → la ficha de la función y el Carrito;
   - canjear, reclamar, escanear un sello → el QR de la función y el Pasaporte;
   - «mis entradas», «mi pedido» → Mis entradas; «mis sellos», «mi pasaporte», «mi progreso», «mis rutas» → Pasaporte;
   - cambiar, modificar, editar, borrar, publicar, cancelar una función o actividad, «borrador», «propuesta» → no puede; la programación la gestiona el equipo del festival en el panel interno.
   - datos de otra persona (correo, «de mi amigo», «de otra persona») → no consulta datos personales.
2. **Pasaporte y rutas** (FR-017): «pasaporte», «sello», «ruta», «insignia» sin posesivo → texto fijo y enlaces a `/pasaporte` y `/rutas`.
3. **Dato de una actividad** (FR-012): «cuánto cuesta», «precio», «cuánto vale» → precio; «a qué hora termina», «cuándo termina», «cuánto dura», «duración» → fin; requieren reconocer un título.
4. **Accesibilidad de una sede** (FR-012): «accesible», «accesibilidad», «sin escalones», «silla de ruedas», «rampa», «baño accesible» → características de la sede reconocida (o de todas las que coincidan si no se nombra ninguna: se pide elegir).
5. **Búsqueda con criterios**: día, horas, categoría, sede, acceso y título. Si no se reconoce **ningún** criterio ni intención → «no entendida» (FR-021): preguntas guiadas y enlace a la Agenda, sin inventar.

**Días** (M-14): «hoy», «esta noche» (hoy y noche), «mañana» sola (día siguiente; no si va tras «en la», «por la», «de la»), «pasado mañana», nombres de día (la próxima vez que ocurra, hoy incluido), «21», «el 21», «sábado 21», «21 de noviembre», `2026-11-21`. Sin día → hoy en hora de Loja, y la respuesta lo indica (`assumedDay: true`). Un día ya pasado → `kind: "past_day"` con oferta de hoy y de los próximos días con funciones. Una fecha imposible («31 de febrero») se ignora y se dice que no se reconoció.

**Horas** (M-14): números (`6`, `18`, `6:30`, `18h00`, `18:00`) y palabras (`una` … `doce`, `mediodía`). De 1 a 11 sin «de la mañana», «am» o «a.m.» → +12 h; «12» o «mediodía» → 12:00. Expresiones: «después de», «desde», «a partir de» → desde (incluida); «antes de» → hasta (excluida); «a las X» → comienza entre X:00 y X:59; «en la mañana» → antes de 12:00; «en la tarde» → 12:00 a 17:59; «en la noche», «esta noche» → desde 18:00.

**Acceso**: «gratis», «gratuita(s)», «gratuito(s)», «libre», «sin costo» → `free` (solo gratuidad confirmada, FR-008); «de pago», «pagadas», «con entrada» → `paid`.

**Categorías, sedes y títulos**: se comparan sus nombres normalizados con el texto. Gana el nombre más largo que aparece completo (como palabras). Además se admite el plural sencillo de una categoría («conciertos» → «Concierto», «obras de teatro» → «Teatro» si existe). Un título se reconoce si su nombre normalizado aparece o si todas sus palabras de 4 o más letras aparecen; si coinciden varios, se listan para elegir.

**Datos personales en el texto**: correos y números de 7 o más cifras se descartan antes de interpretar; no se usan ni se devuelven.

## D-05. Qué se devuelve como resultado

- **Funciones**: publicadas, no canceladas, de la edición activa, que cumplen los criterios. Para hoy, solo las que aún no empiezan (`estadoTemporal = upcoming`, FR-007). Orden: fecha, hora de inicio, título.
- **Franjas de apertura** (exposiciones permanentes): se incluyen si abren ese día y, con horas, si su horario se cruza con el rango pedido; para hoy, solo si aún no cierran. Se muestran como «Abierto de 10:00 a 14:00». Así «¿Qué hay hoy?» coincide con lo que muestra la Agenda para el día.
- **Máximo 10** (M-16) y `total`; si hay más, `agendaUrl` abre la Agenda con los mismos filtros (`/agenda?date=…&categoryId=…&venueId=…&access=…&q=…`). La hora no viaja a la Agenda (no tiene ese filtro).
- Cada resultado lleva título, día, hora, sede, acceso con su etiqueta común (`etiquetaAcceso`) y `href` `/actividad/{id}`.
- **Estado temporal** (RC-03): al preguntar por una actividad concreta, una función de hoy ya empezada sin fin conocido dice «Hora de inicio pasada»; nunca «en curso» ni «terminada» sin fin conocido.

## D-06. Las respuestas distintas

| `kind` | Cuándo | Qué incluye |
|---|---|---|
| `matches` | Hay resultados | `items`, `total`, `agendaUrl`, `criteria`, `assumedDay` |
| `no_matches` | Ningún resultado | `criteria` descritos, `suggestions`: quitar cada criterio por separado («Sin “danza”»), hasta 3 próximos días de la edición con coincidencias (FR-007), y «Abrir la Agenda» |
| `unconfirmed` | Se preguntó un dato que no está confirmado | qué dato falta (`price`, `access`, `end`, `duration`, `step_free`, `accessible_toilet`) y la ficha; la ausencia de precio nunca dice «gratuita» |
| `answer` | Se preguntó un dato que sí está confirmado | el dato (precio en USD, hora de fin, característica confirmada o no disponible) con fuente y fecha si es accesibilidad |
| `out_of_scope` | Comprar, canjear, modificar, datos personales | explicación y `links` a la pantalla adecuada |
| `info` | Pasaporte y rutas | texto fijo y `links` a `/pasaporte` y `/rutas` |
| `not_understood` | Ningún criterio ni intención | preguntas guiadas (las rápidas) y «Abrir la Agenda» |
| `choose` | Falta elegir sede o actividad (varias coinciden, o «¿Qué hay en una sede?») | `options` con id y nombre |
| `past_day` | El día pedido ya pasó | oferta de hoy y próximos días |

La **falla del servicio** (FR-014) no es un `kind`: si la API no responde, responde `5xx` o tarda más de 8 s, la web muestra «No pude consultar la programación» y el botón «Ir a la Agenda». Si la base falla dentro del servicio, la API responde `503 catalog_unavailable` y la web muestra lo mismo.

## D-07. Preguntas rápidas (M-15)

| `quick` | Criterios |
|---|---|
| `today` | hoy, aún no empezadas |
| `free_today` | hoy, `access = free` |
| `tonight` | hoy, desde 18:00 |
| `venue` | requiere `venueId`; sin él responde `choose` con las sedes registradas. Hoy en adelante (FR-002 «sedes») |
| `changes` | funciones de hoy en adelante con aviso publicado `cancelled` o `rescheduled`; la más reciente primero, con el texto público del aviso; las canceladas aparecen aquí marcadas «Cancelada» |
| `passport_routes` | `info` |

Las preguntas son fijas en el código y sus resultados salen del catálogo (FR-018, FR-019). No hay panel para editarlas (FR-022).

## D-08. Interfaz web

- **Botón** «Pregúntale a Alforjita» en la fila de acciones de la cabecera de la Agenda, junto a «Mi recorrido». Al pulsarlo se importa `js/alforjita.js` (importación dinámica); si la importación falla, se muestra el aviso de falla y la Agenda sigue igual.
- **Panel**: `<dialog>` con `showModal()` (atrapa el foco y cierra con Esc, de forma nativa); al cerrar, el foco vuelve al botón. Lateral de 420 px en escritorio; a pantalla completa por debajo de 640 px. Encabezado con el avatar neutro (icono de alforja a línea, `aria-hidden`), el nombre y el botón «Cerrar».
- **Conversación**: lista con `aria-live="polite"`. Las burbujas del visitante muestran su texto con `textContent` (nunca HTML). Las respuestas son tarjetas con enlaces a las fichas; al seguir un enlace se cierra el panel y la ficha conserva «Volver a la Agenda».
- **Memoria**: la conversación vive en una variable del módulo mientras la pestaña está abierta (sobrevive a ir a una ficha y volver), y se borra al recargar o cerrar la pestaña, o con «Nueva conversación». No usa `localStorage` ni `sessionStorage` ni cookies.
- **Sin ubicación ni datos personales**: el panel no tiene campos de datos personales ni pide permisos del navegador.
- **`/rutas`**: `pantallaProximamente('Rutas culturales', …, 'Llega con el spec 007.')`.

## D-09. Pruebas (mapa de criterios de éxito)

| Criterio | Prueba |
|---|---|
| SC-001 | integración: la ruta responde sin cookie; e2e: abrir sin sesión; revisión de la web: sin campos personales ni permisos del navegador |
| SC-002 | integración y e2e: para un día futuro de la edición, los ids de actividad de Alforjita con día, categoría, sede y acceso = los de `GET /agenda` con los mismos filtros; para hoy, Alforjita = Agenda menos las ya empezadas |
| SC-003 | unitaria e integración: toda consulta sin día lleva `assumedDay: true` y la fecha de hoy en Loja |
| SC-004 | integración: «gratis» nunca devuelve `paid` ni `unconfirmed` |
| SC-005 | integración: un caso por cada `kind` de D-06 y la falla (`503` con la base caída); ningún precio, fin ni accesibilidad deducido |
| SC-006 | integración: un borrador, una versión pendiente y una actividad archivada con títulos únicos nunca aparecen, ni al buscarlos por título |
| SC-007 | navegador: abrir, usar y cerrar solo con teclado (Tab, Enter, Esc), foco de vuelta al botón |
| SC-008 | e2e: con Alforjita respondiendo error, `GET /agenda` sigue respondiendo; web: la Agenda carga sin importar `alforjita.js` |
| SC-009 | revisión: no hay ruta de panel de Alforjita; integración: cambiar la programación publicada cambia la respuesta de la misma pregunta rápida |
| SC-010 | integración: `reference` de la respuesta = `reference` de `GET /agenda` con el reloj fijado |
| SC-011 | unitaria e integración: «¿Qué funciones gratuitas de danza hay después de las seis?» con reloj fijado devuelve exactamente las esperadas; frases sin sentido → `not_understood` |
| SC-012 | integración: se construye la app con un registro capturado; tras preguntar una frase única, la frase no aparece en el registro ni en ninguna tabla |
