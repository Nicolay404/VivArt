# Data Model: Alforjita, asistente del festival

**No hay tablas ni columnas nuevas.** Alforjita solo lee lo que ya existe en el servicio de programación y no guarda consultas, respuestas ni conversaciones (M-17, FR-028).

## Lo que se lee (sin cambios)

| Fuente | Para qué |
|---|---|
| Actividades publicadas (`activities.published_content`, solo `status = 'active'` y edición activa), vía `agenda.publicadas()` | título, categoría, acceso y precio, duración |
| `functions` | día, hora de inicio, hora de fin o duración, sede, estado (`scheduled` o `cancelled`) |
| `opening_slots` | franjas de apertura de actividades permanentes |
| `notices` | «¿Hubo cambios?» (`cancelled`, `rescheduled`) y su texto público; nunca `internal_reason` |
| `categories`, `venues` | reconocer nombres en el texto y mostrar resultados |
| `venue_accessibility` | `step_free` y `accessible_toilet` con estado, fuente y fecha (spec 003) |

Nunca se leen versiones de borrador, propuestas, el historial ni datos de otros servicios.

## Objetos en memoria (por solicitud)

### Consulta

| Campo | Tipo | Regla |
|---|---|---|
| `text` | texto, 1–200 | solo si no hay `quick`; se limpia de caracteres de control; no se guarda ni se registra |
| `quick` | `today` \| `free_today` \| `tonight` \| `venue` \| `changes` \| `passport_routes` | solo si no hay `text` |
| `venueId` | texto | solo con `quick = venue` |
| `criteria` | Criterios | opcional: aplica una sugerencia (quitar un criterio, otro día) sin volver a interpretar |

### Criterios

| Campo | Tipo | Regla |
|---|---|---|
| `date` | AAAA-MM-DD | si falta, hoy en Loja y `assumedDay = true` |
| `from` | HH:MM o null | incluida |
| `until` | HH:MM o null | excluida |
| `categoryId`, `venueId` | id o null | reconocidos por nombre en el catálogo |
| `access` | `free` \| `paid` \| null | `free` solo con gratuidad confirmada |
| `activityId` | id o null | título reconocido |

### Respuesta

| Campo | Siempre | Contenido |
|---|---|---|
| `kind` | sí | `matches`, `no_matches`, `answer`, `unconfirmed`, `out_of_scope`, `info`, `not_understood`, `choose`, `past_day` |
| `reference` | sí | el mismo objeto de reloj que la Agenda (`now`, `date`, `time`, `timeZone`, `fixed`) |
| `message` | sí | frase en español generada a partir de plantillas fijas y datos del catálogo |
| `criteria`, `assumedDay` | en búsquedas | criterios aplicados, con los nombres de categoría y sede |
| `items`, `total`, `agendaUrl` | en `matches` | hasta 10 resultados (función o franja) |
| `missing` | en `unconfirmed` | qué dato falta |
| `suggestions` | en `no_matches`, `past_day` | criterios alternativos con su etiqueta |
| `options` | en `choose` | sedes o actividades para elegir |
| `links` | en `out_of_scope`, `info`, `not_understood` | `{ label, href }` a pantallas de la web |

### Resultado (item)

| Campo | Contenido |
|---|---|
| `type` | `function` \| `slot` |
| `activityId`, `title`, `href` | `href = /actividad/{activityId}` |
| `date`, `startTime`, `endTime` | de la función, o `opens`/`closes` de la franja; `endTime` solo si está confirmado |
| `timeStatus` | `upcoming`, `start_passed`, `in_progress`, `cancelled` (RC-03) |
| `venue` | `{ id, name, kind }` |
| `access` | `{ mode, priceUsd, label }` con la etiqueta común de la Agenda |
| `notice` | solo en «¿Hubo cambios?»: `{ kind, text, at }` |
