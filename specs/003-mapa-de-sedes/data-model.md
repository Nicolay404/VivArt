# Data Model: Mapa isométrico de sedes

Amplía la base del **servicio de programación** (base `programacion`, usuario propio). El modelo del spec 002 está en [`specs/002-programacion-y-publicacion/data-model.md`](../002-programacion-y-publicacion/data-model.md); aquí solo se describe lo nuevo. Los cambios se aplican al arrancar con sentencias idempotentes (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`) y **no borran datos**.

## venues (sedes): columnas existentes y nuevas

| Campo | Tipo | Reglas |
|---|---|---|
| id, name, name_key, kind, address, route_description | (spec 002) | Sin cambios. `name_key` (sin mayúsculas ni tildes) es la base de la búsqueda |
| marker | JSON, opcional | **Formato fijo desde este spec:** `{ "illustrationId": texto, "x": número, "y": número }`, con `x` e `y` entre 0 y 1 (fracción del ancho y del alto de la ilustración). Si el `illustrationId` no es el de la ilustración vigente o el formato no es este, se presenta como **sin marcador** |
| dest_lat | número, opcional | **Nuevo.** Latitud del destino, entre −90 y 90 |
| dest_lng | número, opcional | **Nuevo.** Longitud del destino, entre −180 y 180 |
| dest_source | texto, opcional | **Nuevo.** Fuente de la verificación (por ejemplo «Revisión en sitio» o «Responsable de la sede»). Hasta 500 caracteres |
| dest_verified_on | fecha (AAAA-MM-DD), opcional | **Nuevo.** Fecha de la verificación, en hora de Loja; no posterior a hoy |

**Reglas del destino**

- Los cuatro campos `dest_*` se guardan **todos o ninguno** (restricción `CHECK` en la base). Destino verificado = los cuatro presentes (FR-023).
- Un recorrido (`kind = route`) **no** admite destino: guardarlo da 422, y cambiar a recorrido una sede con destino exige quitarlo antes (409).
- El marcador **nunca** se usa para calcular el destino (FR-012, FR-020).

## venue_accessibility (nueva)

Una fila por sede y característica. Si no hay fila, la característica está **por confirmar**.

| Campo | Tipo | Reglas |
|---|---|---|
| venue_id | texto | → `venues(id)`; borrado en cascada |
| feature | texto | `step_free` (acceso sin escalones) o `accessible_toilet` (baño accesible) |
| status | texto | `confirmed`, `unavailable` o `unconfirmed` |
| source | texto, opcional | Obligatoria si `status` es `confirmed` o `unavailable`. Hasta 500 caracteres |
| verified_on | fecha, opcional | Obligatoria si `status` es `confirmed` o `unavailable`; no posterior a hoy |
| note | texto, opcional | Observación complementaria, hasta 1000 caracteres. **No controla el filtro** (FR-018) |
| updated_at | instante ISO (UTC) | |

Clave primaria `(venue_id, feature)`. La restricción `CHECK` impide guardar `confirmed` o `unavailable` sin fuente y fecha.

**Filtro (FR-010, FR-024):** una sede pasa el filtro de una característica **solo** si su fila tiene `status = confirmed`.

## venue_photos (nueva)

Como máximo una foto por sede.

| Campo | Tipo | Reglas |
|---|---|---|
| venue_id | texto | Clave; → `venues(id)`; borrado en cascada |
| mime | texto | `image/jpeg`, `image/png` o `image/webp`, comprobado por los bytes iniciales, no por lo que diga el cliente |
| (limpieza) | — | El servidor quita EXIF, XMP, IPTC y comentarios antes de guardar (`src/domain/imagenes.js`), aunque se suba directamente por la API |
| bytes | binario (`bytea`) | Hasta 1 MB |
| alt | texto | Obligatorio, de 3 a 300 caracteres: texto alternativo (FR-025) |
| credit | texto | Obligatorio, de 3 a 300 caracteres: fuente o autoría, y licencia si aplica (M-09) |
| sha256 | texto | Huella de los bytes; versiona la URL pública para que la caché no muestre una foto antigua |
| updated_at | instante ISO (UTC) | |

Se presenta como `photo: { url, alt, credit }` o `photo: null`. Sin foto, la tarjeta no cambia (FR-025).

## Ilustración vigente (no es una tabla)

Constante del servicio en `src/domain/mapa.js`, devuelta por `GET /map`:

| Campo | Ejemplo | Reglas |
|---|---|---|
| id | `provisional-2026-11` | Se compara con `marker.illustrationId` |
| src | `/img/mapa-provisional.svg` | Archivo servido por la web |
| width, height | `1600`, `1000` | Proporción de la ilustración |
| provisional | `true` | Si es `true`, la web muestra «Ilustración provisional» (FR-028) |

Al llegar la ilustración definitiva (P-13): se añade el archivo, se cambia la constante con un `id` nuevo y el administrador vuelve a colocar los marcadores. Hasta entonces, las sedes siguen en la lista.

## Datos derivados (se calculan, no se guardan)

| Dato | Cálculo |
|---|---|
| Funciones visibles | Filas de `functions` cuya actividad está publicada (`published_at` no nulo), no archivada y es de una edición activa o sin edición. Las franjas no cuentan (M-06) |
| Días elegibles | Fechas distintas de funciones visibles con `status = scheduled`, ordenadas |
| Sede en «Funciones del día» | Tiene al menos una función visible `scheduled` en el día consultado, haya empezado o no |
| Funciones de la ficha | Funciones visibles de la sede con `date >= hoy`, o solo las del día consultado; incluye las `cancelled`, marcadas |
| `timeStatus` | El mismo cálculo del spec 002 (`estadoTemporal`): nunca «en curso» ni «terminada» sin hora de fin o duración |
| `directionsUrl` | `https://www.google.com/maps/search/?api=1&query={lat},{lng}` si el destino está verificado y la sede no es un recorrido; si no, `null` |

## Historial (tabla `history` del spec 002, solo anexar)

| Acción | Cuándo | `details` |
|---|---|---|
| `catalog.venue.created` y `catalog.venue.updated` | Crear o corregir nombre, tipo, dirección, descripción o marcador | Campos cambiados, antes y después |
| `venue.destination.set` y `venue.destination.removed` | Registrar, corregir o quitar el destino | Coordenadas, fuente y fecha, antes y después |
| `venue.accessibility.set` | Registrar o cambiar una característica | `feature` y estado, fuente, fecha y nota, antes y después |
| `venue.photo.set` y `venue.photo.removed` | Subir, reemplazar o quitar la foto | `alt`, `credit`, `mime`, tamaño y huella (nunca los bytes) |

Todas guardan `actor_id`, `at`, `entity_type = venue` y `entity_id` (FR-017, SC-009). Ninguna crea un aviso público (RC-06).

## Validación (resumen)

| Entrada | Error |
|---|---|
| `marker` con un `illustrationId` distinto del vigente, o `x` o `y` fuera de [0, 1] | 422 `marker` |
| Latitud o longitud fuera de rango o no numéricas; falta la fuente o la fecha; fecha futura | 422 con el campo |
| Destino en un recorrido | 422 `kind` |
| `feature` desconocida | 404 |
| `status` desconocido; `confirmed` o `unavailable` sin fuente o fecha | 422 con el campo |
| Foto que no es JPEG, PNG o WebP por sus bytes; mayor de 1 MB; base64 inválido | 422 `photo` |
| Foto sin `alt` o sin `credit` | 422 con el campo |
| Sede inexistente | 404 |
