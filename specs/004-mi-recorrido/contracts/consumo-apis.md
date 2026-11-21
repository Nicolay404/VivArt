# Contratos de APIs consumidas por Mi Recorrido

Mi recorrido es una funcionalidad orientada al cliente (navegador web) que no implementa un servicio backend propio. Consume dos APIs públicas ya existentes a través de la entrada HTTP común.

---

## 1. Servicio de Programación y Consulta Pública (spec 002)

### A. Consulta de la Agenda
- **Ruta**: `GET /api/programacion/agenda`
- **Uso en Mi recorrido**:
  - Obtener el catálogo vigente de actividades publicadas.
  - Obtener el objeto `reference` con la fecha y hora oficial de Loja (`reference.now`, `reference.date`, `reference.time`, `reference.fixed`).
  - Buscar alternativas en la misma sede filtrando por `venueId` y fecha/hora.
- **Formato de respuesta**:
  ```json
  {
    "reference": {
      "now": "2026-11-21T18:00:00.000Z",
      "date": "2026-11-21",
      "time": "13:00",
      "timeZone": "America/Guayaquil",
      "fixed": false
    },
    "items": [
      {
        "id": "act_102030",
        "title": "Zombi Manifiesto",
        "artists": ["Compañía Ficticia D"],
        "category": { "id": "cat_teatro", "name": "Teatro" },
        "access": { "mode": "paid", "priceUsd": 5.0, "label": "De pago: USD 5,00" },
        "nextDate": "2026-11-21",
        "venues": [{ "id": "ven_5d0cc935", "name": "Teatro Bolívar", "kind": "place" }],
        "isPermanent": false,
        "hasNotices": false
      }
    ]
  }
  ```

### B. Detalle de Actividad y Funciones
- **Ruta**: `GET /api/programacion/activities/{id}`
- **Uso en Mi recorrido**:
  - Sincronizar y actualizar las funciones guardadas (detectar cambios de hora, sede o avisos de cancelación/reprogramación).
  - Si responde `404 Not Found`, el ítem guardado se marca como archivado (`archived`) con la indicación «Ya no está en la programación activa» (FR-018).
- **Formato de respuesta**:
  ```json
  {
    "id": "act_102030",
    "title": "Zombi Manifiesto",
    "functions": [
      {
        "id": "fn_11h00",
        "date": "2026-11-21",
        "startTime": "11:00",
        "endTime": "12:30",
        "durationMinutes": 90,
        "venue": { "id": "ven_5d0cc935", "name": "Teatro Bolívar", "kind": "place" },
        "status": "scheduled",
        "timeStatus": "finished"
      }
    ],
    "notices": []
  }
  ```

---

## 2. Servicio de Participación y Entradas (spec 005 - Diego)

### Estado de venta de funciones
- **Ruta**: `GET /api/participacion/sale-status?functionIds={id1},{id2},...`
- **Uso en Mi recorrido**:
  - Comprobar si alguna función de pago guardada en el recorrido ha agotado sus entradas (`sold_out`).
  - Si el estado es `sold_out`, Mi recorrido activa el ofrecimiento de alternativas en la misma sede (FR-012).
- **Contrato establecido en `specs/005-compra-y-entradas/contracts/participacion.openapi.yaml`**:
  - **Parámetros**: `functionIds` (IDs separados por comas, máximo 100).
  - **Respuesta 200 OK**:
    ```json
    {
      "items": [
        {
          "functionId": "fn_11h00",
          "state": "sold_out"
        },
        {
          "functionId": "fn_20h00",
          "state": "available"
        }
      ]
    }
    ```
  - **Valores posibles de `state`**:
    - `available`: Entradas disponibles.
    - `sold_out`: Entradas agotadas.
    - `closed`: Venta cerrada.
- **Tolerancia a fallos**:
  - Si el servicio de participación responde `503`, `500` o no está disponible, el cliente no bloquea la vista de Mi recorrido; simplemente omite la marca de agotada (degradación suave).
