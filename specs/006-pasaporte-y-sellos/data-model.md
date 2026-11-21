# Data Model: Pasaporte Vivo y sellos

Amplía la base del **servicio de participación** (base `participacion`, usuario propio). El modelo del spec 005 está en [`specs/005-compra-y-entradas/data-model.md`](../005-compra-y-entradas/data-model.md). Los cambios se aplican al arrancar con sentencias idempotentes y **no borran datos**. Los ids de función y de persona son de programación y de identidad: no hay claves foráneas hacia otras bases.

## passport_qrs (QR de Pasaporte)

| Campo | Tipo | Reglas |
|---|---|---|
| id | texto | Clave |
| function_id | texto | Función de programación (nunca una franja) |
| ref_hash | texto | Único. `sha256(ref)`; el `ref` se deriva con HMAC y no se guarda en claro |
| status | texto | `inactive`, `active` o `replaced` |
| inactive_cause | texto, opcional | `manual` o `function_changed` (P-03) |
| window_start, window_end | texto, opcional | Hora local de Loja `AAAA-MM-DD HH:MM`; `window_end` > `window_start`. Sin valor por defecto (M-10) |
| confirmed_for | JSON, opcional | `{ date, startTime, venueId }` de la función al confirmar la ventana; se compara con la vigente en cada canje |
| created_at, created_by | texto | |
| updated_at, updated_by | texto | |

**Reglas**

- Índice único parcial `(function_id) WHERE status <> 'replaced'`: como mucho un QR vigente por función (FR-014, SC-014).
- `active` exige ventana y `confirmed_for` (restricción `CHECK`).
- Reemplazar: el vigente pasa a `replaced` y se crea uno nuevo `inactive` con un `ref` nuevo, en la misma transacción. Los sellos no cambian (FR-015).
- Un QR nunca se borra.

**Estados**

```text
(ninguno) --generar--> inactive --activar (con ventana)--> active
active --desactivar--> inactive (manual)
active --la función cambió de fecha, hora o sede--> inactive (function_changed)
inactive|active --reemplazar--> replaced   (y se crea otro inactive)
inactive (function_changed) --confirmar ventana nueva y activar--> active
```

## stamp_images (imágenes del sello)

| Campo | Tipo | Reglas |
|---|---|---|
| id | texto | Clave aleatoria; aparece en la URL pública |
| mime | texto | `image/jpeg`, `image/png` o `image/webp`, por sus bytes |
| bytes | binario | Hasta 1 MB, **sin metadatos** (EXIF, XMP, IPTC, comentarios) |
| alt | texto | Obligatorio, de 3 a 300 caracteres |
| credit | texto | Obligatorio, de 3 a 300 caracteres (propia o con licencia que permita reutilizarla) |
| sha256 | texto | Huella de los bytes guardados |
| created_at, created_by | texto | |

Las imágenes son inmutables y **nunca se borran** (M-11).

## stamp_contents (contenido del sello, versionado)

| Campo | Tipo | Reglas |
|---|---|---|
| id | texto | Clave |
| function_id | texto | |
| version | entero | 1, 2, 3…; único por función |
| text | texto, opcional | Texto plano de hasta 280 caracteres (M-12) |
| image_id | texto, opcional | → `stamp_images(id)` con `ON DELETE RESTRICT` |
| created_at, created_by | texto | |

Guardar el contenido crea una versión nueva; el canje enlaza la última versión de la función. Sin ninguna versión, el sello usa solo la plantilla común (FR-022).

## stamps (sellos)

| Campo | Tipo | Reglas |
|---|---|---|
| id | texto | Clave |
| user_id | texto | Persona (identidad) |
| function_id | texto | |
| qr_id | texto | → `passport_qrs(id)`: con qué QR se obtuvo |
| content_id | texto, opcional | → `stamp_contents(id)` con `ON DELETE RESTRICT`: versión vigente al emitirse |
| obtained_at | texto | Instante ISO UTC |

**Restricción única `(user_id, function_id)`**: un sello por persona y función (RC-05). Los sellos no se borran: ni al reemplazar el QR, ni al reprogramar, ni al cancelar, ni al archivar (FR-015, FR-021).

**Ampliación prevista si P-14 se decide como «recuerdo del momento del canje»:** columnas `function_title`, `function_date`, `function_start` y `venue_name` (texto), rellenadas al emitir con los datos de programación; la vista las usa en lugar de los vigentes. Hoy no existen.

## Datos derivados (se calculan, no se guardan)

| Dato | Cálculo |
|---|---|
| Datos del sello | Título, fecha, hora y sede **vigentes** de programación, más su último aviso (cambio o cancelación) |
| Total de «Mi pasaporte» | Número de sellos de la persona (M-01) |
| Canje desactivado por cambio | `confirmed_for` distinto de `{ date, startTime, venueId }` vigente |
| Ventana abierta | `window_start` ≤ ahora en Loja ≤ `window_end` |
| Enlace del QR | `PUBLIC_BASE_URL` + `/pasaporte/canje/` + `ref` |

## Historial (tabla `history` del spec 005, solo anexar)

| Acción | `details` |
|---|---|
| `passport.qr.generated`, `passport.qr.replaced` | QR anterior y nuevo (ids, nunca el `ref`) |
| `passport.qr.activated`, `passport.qr.deactivated` | Causa (`manual` o `function_changed`) y, si cambió, los datos antes y después |
| `passport.qr.window_set` | Ventana antes y después |
| `passport.content.set` | Versión, texto, id de imagen, `alt` y `credit` (nunca los bytes) |

Todas guardan quién, cuándo, `entity_type = function` y `entity_id` (FR-020, SC-010).

## Validación (resumen)

| Entrada | Error |
|---|---|
| Función que programación no devuelve (no existe, no publicada o es una franja) | 404 |
| Activar sin ventana; fin ≤ inicio; fecha u hora inválidas | 422 con el campo |
| Texto de más de 280 caracteres | 422 `text` |
| Imagen que no es JPEG, PNG o WebP; mayor de 1 MB; estructura dañada; sin `alt` o `credit` | 422 con el campo |
