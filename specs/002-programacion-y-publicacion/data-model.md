# Data Model: Programación, agenda y publicación

Base de datos propia del servicio de programación (PostgreSQL: base `programacion` con su propio usuario). Ningún otro servicio escribe en ella; la consultan a través de la API. Las fechas y horas de funciones y franjas se guardan como **hora local de Loja** (`date` y `time`); los registros de auditoría como instantes ISO 8601 en UTC.

## Catálogos (solo el administrador; sin revisión editorial)

### editions

| Campo | Tipo | Reglas |
|---|---|---|
| id | texto | Clave |
| name | texto | Único, obligatorio |
| year | entero | Opcional |
| active | booleano | La Agenda muestra por defecto las ediciones activas |

### categories

| Campo | Tipo | Reglas |
|---|---|---|
| id | texto | Clave |
| name | texto | Único sin distinguir mayúsculas ni tildes |

### venues (sedes)

| Campo | Tipo | Reglas |
|---|---|---|
| id | texto | Clave |
| name | texto | Único sin distinguir mayúsculas ni tildes |
| kind | texto | `place` (lugar) o `route` (recorrido o tramo de calle) |
| address | texto, opcional | Corregirla no exige aviso público (FR-025) |
| route_description | texto, opcional | Para recorridos (caso del desfile inaugural) |
| marker | JSON, opcional | Posición en el mapa; la usa el spec 03 |

## Actividades y flujo editorial

### activities

| Campo | Tipo | Reglas |
|---|---|---|
| id | texto | Clave; aparece en el enlace compartible |
| owner_id | texto | Autor responsable (cuenta del servicio de identidad) |
| created_by | texto | Quién la creó |
| edition_id | texto, opcional | Referencia a `editions` |
| status | texto | `active` o `archived` |
| published_at | fecha, opcional | Vacío = nunca publicada (solo así se puede borrar) |
| published_content | JSON, opcional | Lo que ve el público (ver «Contenido») |
| working_content | JSON, opcional | Borrador o versión pendiente |
| editorial_state | texto | `none`, `draft`, `in_review`, `returned` |
| review_notes | texto, opcional | Observaciones de la última devolución (FR-032) |
| version | entero | Sube en cada cambio; control de edición simultánea |
| import_key | texto, opcional | Único; clave del registro importado |
| source | JSON, opcional | Lote y página de origen (FR-023) |
| search_text | texto | Título, artistas y organización normalizados (búsqueda) |
| created_at, updated_at | fecha | |

**Estados.**

```text
creación → draft ──enviar──> in_review ──devolver──> returned ──enviar──> in_review
                                   └──publicar──> none (publicada)
publicada (none) ──editar──> draft (versión pendiente; la publicada sigue visible)
in_review ──descartar revisión (solo si ya estaba publicada)──> none
cualquier estado ──archivar (administrador)──> status = archived (fuera de la Agenda)
nunca publicada ──borrar──> eliminada
```

Reglas:

- El editor solo crea y edita **sus** actividades en `draft` o `returned` (FR-008, FR-009).
- El publicador y el administrador editan cualquiera, devuelven y publican, también lo propio (FR-012).
- Para **enviar** (FR-030): título, categoría y al menos una función (fecha, hora de inicio y sede) o franja (fechas o rango de días, horario y sede) válidas. Guardar no exige nada.
- Publicar **no** activa ventas (FR-014): este servicio no tiene datos de venta.

### Contenido (`working_content` y `published_content`)

```json
{
  "title": "texto",
  "artists": ["texto"],
  "organization": "texto o null",
  "description": "texto o null",
  "categoryId": "id o null",
  "access": { "mode": "free | paid | unconfirmed", "priceUsd": 5.0 },
  "durationMinutes": 60,
  "functions": [
    { "id": "estable", "date": "2026-11-21", "startTime": "19:00", "endTime": null, "durationMinutes": null, "venueId": "id" }
  ],
  "slots": [
    { "id": "estable", "venueId": "id", "dates": ["2026-11-21"], "from": null, "to": null, "weekdays": null, "opens": "10:00", "closes": "14:00" }
  ]
}
```

- `access.priceUsd` es `null` si no se conoce; `paid` con `null` significa «precio por confirmar». Nunca se deduce gratuidad.
- Una franja usa `dates` (lista de fechas) **o** `from`/`to` con `weekdays` opcional (1 = lunes … 7 = domingo).
- Una actividad permanente tiene franjas y puede tener funciones puntuales a la vez.

### functions (funciones publicadas)

| Campo | Tipo | Reglas |
|---|---|---|
| id | texto | El mismo identificador estable del contenido |
| activity_id | texto | |
| date, start_time | fecha y hora local | Obligatorias |
| end_time | hora, opcional | |
| duration_minutes | entero, opcional | |
| venue_id | texto | |
| status | texto | `scheduled` o `cancelled` |

Cambiar fecha, hora o sede de una fila existente exige **aviso público** (FR-015, FR-016). Una función publicada nunca se borra: se cancela (FR-027).

### opening_slots (franjas publicadas)

Las mismas columnas que una franja del contenido, más `activity_id`.

### notices (avisos públicos)

| Campo | Tipo | Reglas |
|---|---|---|
| id | entero | |
| activity_id | texto | |
| function_id | texto, opcional | |
| kind | texto | `rescheduled`, `cancelled` o `changed` |
| public_text | texto | Visible en la ficha |
| internal_reason | texto | Solo en el panel |
| actor_id, at | texto, fecha | |

## Carga desde el archivo estructurado

### import_batches

| Campo | Tipo | Reglas |
|---|---|---|
| id | texto | |
| uploaded_by, uploaded_at | texto, fecha | |
| filename | texto, opcional | |
| status | texto | `preview` o `accepted` |

### import_records

| Campo | Tipo | Reglas |
|---|---|---|
| batch_id, position | texto, entero | |
| import_key | texto | |
| source_ref | JSON | Página de origen (FR-023) |
| data | JSON | Contenido ya convertido |
| errors | JSON | Lista de errores; con errores no se carga (FR-033) |
| duplicate_of | texto, opcional | Otra posición del lote o una actividad existente |
| outcome | texto | `pending`, `loaded`, `skipped_existing`, `skipped_error` |
| activity_id | texto, opcional | Borrador creado |

## Historial

### history (solo anexar)

| Campo | Tipo | Reglas |
|---|---|---|
| id | entero | |
| at | fecha | |
| actor_id | texto | |
| action | texto | `activity.created`, `draft.saved`, `draft.submitted`, `draft.returned`, `activity.published`, `revision.discarded`, `activity.reassigned`, `function.rescheduled`, `function.cancelled`, `activity.archived`, `activity.deleted`, `catalog.*`, `import.*` |
| entity_type, entity_id | texto | |
| details | JSON | Sin datos personales ni credenciales |

Triggers impiden `UPDATE`, `DELETE` y `TRUNCATE`.

## Relaciones

- `activities` 1 — N `functions`, `opening_slots`, `notices`.
- `functions.venue_id` y `opening_slots.venue_id` → `venues`; `activities.edition_id` → `editions`; el contenido referencia `categories`.
- `owner_id`, `created_by` y `actor_id` son identificadores del servicio de identidad: valores opacos aquí.
- Los identificadores de función son la referencia que usarán participación (entradas, QR y sellos).
