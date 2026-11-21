# Data Model: Mi recorrido y alternativas

Este spec gestiona los datos de **Mi recorrido** exclusivamente en el navegador del visitante (`localStorage`). No crea tablas en la base de datos de PostgreSQL ni expone rutas que almacenen datos en el servidor, cumpliendo la decisión **P-05** y la arquitectura compartida del proyecto.

## Almacenamiento local (`localStorage`)

Clave de almacenamiento: `vivart_recorrido_v1`.

### Estructura del objeto guardado

```json
{
  "version": 1,
  "updatedAt": "2026-11-21T18:30:00.000Z",
  "items": [
    {
      "id": "fn_f1a2b3c4d5e6f7a8",
      "kind": "function",
      "activityId": "act_1020304050607080",
      "functionId": "f1a2b3c4d5e6f7a8",
      "slotId": null,
      "title": "Zombi Manifiesto",
      "artists": ["Compañía Ficticia D"],
      "date": "2026-11-21",
      "startTime": "18:00",
      "endTime": "19:30",
      "durationMinutes": 90,
      "venue": {
        "id": "ven_5d0cc9353d224405",
        "name": "Teatro Bolívar",
        "kind": "place"
      },
      "status": "scheduled",
      "notice": null,
      "savedAt": "2026-11-21T15:00:00.000Z"
    }
  ]
}
```

---

## Definición de campos de `ItemRecorrido`

| Campo | Tipo | Obligatorio | Descripción y reglas |
|---|---|---|---|
| `id` | string | Sí | Identificador único en el recorrido: `fn_${functionId}` para funciones o `slot_${slotId}_${date}` para franjas |
| `kind` | string | Sí | `'function'` o `'slot'` |
| `activityId` | string | Sí | Identificador de la actividad en el servicio de programación |
| `functionId` | string \| null | Condicional | Obligatorio si `kind === 'function'` |
| `slotId` | string \| null | Condicional | Obligatorio si `kind === 'slot'` |
| `title` | string | Sí | Título de la actividad |
| `artists` | array de strings | Sí | Lista de artistas o colectivos |
| `date` | string (AAAA-MM-DD) | Sí | Fecha en la que se realiza la función o aplica la franja |
| `startTime` | string (HH:MM) | Sí | Hora de inicio en hora local de Loja |
| `endTime` | string \| null | No | Hora de fin en formato HH:MM si se conoce; `null` si no está confirmada (RC-03) |
| `durationMinutes`| number \| null | No | Duración en minutos si se conoce; `null` si no está confirmada |
| `venue` | objeto Venue | Sí | `{ id, name, kind }` donde `kind` es `'place'` o `'route'` |
| `status` | string | Sí | `'scheduled'`, `'cancelled'` o `'archived'` |
| `notice` | objeto \| null | No | Aviso público vigente `{ kind, text, at }` si la función fue reprogramada o cancelada |
| `savedAt` | string (ISO) | Sí | Instante en el que el visitante guardó el elemento |

---

## Modelo de Cruces (`CruceHorario`)

Representa la advertencia de solapamiento entre dos ítems guardados:

| Campo | Tipo | Descripción |
|---|---|---|
| `itemA` | string | `id` del primer ítem involucrado |
| `itemB` | string | `id` del segundo ítem involucrado |
| `date` | string | Fecha común donde ocurre el cruce |
| `overlapMinutes`| number | Cantidad de minutos de solapamiento |

### Reglas de cálculo del solapamiento (RC-02, FR-006 a FR-008)

1. **Misma fecha obligatoria**: Si `dateA !== dateB`, no hay cruce.
2. **Intervalos conocidos**:
   - `finA` se obtiene de `endTime` o de `startTime + durationMinutes`.
   - Si `finA` o `finB` no se conocen (ambos `null`), **no se advierte cruce**.
3. **Fórmula de solapamiento estricto**:
   - Hay cruce si y solo si:
     $$\text{inicioA} < \text{finB} \quad \land \quad \text{inicioB} < \text{finA}$$
4. **Tangentes**:
   - Si $\text{finA} = \text{inicioB}$ o $\text{finB} = \text{inicioA}$, **no hay cruce**.
5. **No bloqueante**: La presencia de un cruce solo produce un aviso visual en la interfaz; nunca impide guardar o mantener las funciones.

---

## Estados Temporales y de Venta

Para cada elemento del recorrido, en tiempo de renderizado se calculan dos estados:

### 1. Estado Temporal (`timeStatus`)
Se calcula con la referencia oficial de hora de Loja (`reference.now`):
- `upcoming`: La hora actual es anterior a `startTime`.
- `in_progress`: La hora actual está entre `startTime` y `endTime` (solo si `endTime` es conocido).
- `start_passed`: La hora actual superó `startTime`, pero `endTime` es desconocido (RC-03: nunca se afirma «en curso» ni «terminada»).
- `finished`: La hora actual superó `endTime` (o duración conocida).
- `cancelled`: La función tiene `status === 'cancelled'`.
- `archived`: La actividad fue archivada en el backend (no devuelta por la API).

### 2. Estado de Venta (`saleState`)
Obtenido de `GET /api/participacion/sale-status?functionIds=...`:
- `available`: Entradas disponibles o sin agotamiento reportado.
- `sold_out`: Cupos agotados.
- `closed`: Venta cerrada.
- `null`: No aplica (función gratuita, sin venta o servicio no disponible).

---

## Modelo de Alternativa (`AlternativaItem`)

| Campo | Tipo | Descripción |
|---|---|---|
| `functionId` | string | ID de la función alternativa |
| `activityId` | string | ID de la actividad correspondiente |
| `title` | string | Título de la actividad |
| `artists` | array de strings | Artistas |
| `date` | string | Fecha de la función |
| `startTime` | string | Hora de inicio |
| `endTime` | string \| null | Hora de fin |
| `venue` | objeto Venue | Misma sede que la función original (`venue.id` idéntico) |
| `access` | objeto Access | Modalidad de acceso |

### Reglas de Alternativas (FR-012, FR-013, FR-017)
- **Misma sede**: `venue.id` debe coincidir exactamente con el de la función afectada.
- **No cancelada**: `status !== 'cancelled'`.
- **Futura**: `startTime` posterior al instante de referencia (`upcoming`).
- **Publicada y activa**: Actividad disponible en el catálogo vigente.
