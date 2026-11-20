# Formato del archivo de carga: `vivart-programacion/1`

El equipo prepara y revisa los datos del PDF **fuera de VIVART** y el administrador sube este archivo JSON desde el panel (`POST /panel/imports`). Las claves están en español porque el archivo lo prepara el equipo a mano.

## Estructura

```json
{
  "formato": "vivart-programacion/1",
  "edicion": "Nombre de una edición existente (opcional)",
  "registros": [
    {
      "clave": "pdf-p8-zombi",
      "origen": { "pagina": 8, "nota": "texto libre opcional" },
      "revisado": true,
      "titulo": "Título de la actividad",
      "artistas": ["Nombre"],
      "organizacion": "Nombre o null",
      "categoria": "Nombre de una categoría existente",
      "descripcion": "Texto o null",
      "duracionMin": null,
      "etiqueta": "Entrada Libre | Evento Gratuito | Evento Pagado | null",
      "precioUsd": null,
      "funciones": [
        { "fecha": "2026-11-21", "hora": "19:00", "horaFin": null, "duracionMin": null, "sede": "Nombre de una sede existente" }
      ],
      "franjas": [
        { "sede": "Nombre", "fechas": ["2026-11-21"], "abre": "10:00", "cierra": "14:00" },
        { "sede": "Nombre", "desde": "2026-11-20", "hasta": "2026-11-30", "dias": [1, 2, 3, 4, 5], "abre": "15:00", "cierra": "19:30" }
      ]
    }
  ]
}
```

## Reglas

| Campo | Regla |
|---|---|
| `clave` | Obligatoria y única en el archivo. Si ya se cargó antes, el registro **no se vuelve a cargar** (no se sobrescriben correcciones; FR-022) |
| `origen.pagina` | Obligatoria: número de página del PDF (FR-023) |
| `categoria`, `sede` | Deben existir en los catálogos: créalos antes desde el panel |
| `fecha`, `hora`, `abre`, `cierra` | `AAAA-MM-DD` y `HH:MM` en hora de Loja |
| `dias` | 1 = lunes … 7 = domingo |
| `etiqueta` | `Entrada Libre` y `Evento Gratuito` → gratuita **solo si** `revisado` es `true`; si no, «por confirmar». `Evento Pagado` → de pago; sin `precioUsd`, «precio por confirmar». Sin etiqueta → «por confirmar». La ausencia de precio nunca es gratuidad (FR-024) |
| `revisado` | `true` si el equipo comprobó que la etiqueta corresponde a esta ficha |

Los campos que no se conocen se dejan en `null` o se omiten: **no se completan ni se deducen** (FR-004).

## Vista previa

Antes de crear nada, el sistema devuelve por cada registro: posición, `clave`, `origen`, el contenido convertido, la lista de `errores` (por ejemplo, «la sede X no existe») y `duplicadoDe` (otra posición del archivo o una actividad ya existente). Un registro con errores no se carga hasta corregirse (FR-033).

## Aceptar y publicar

1. `POST /panel/imports/{id}/accept` con las posiciones aceptadas: crea **borradores** y no publica nada.
2. `POST /panel/publish-batch` con los identificadores de actividad que el administrador confirma: solo esos se publican (FR-021).

Hay un archivo de ejemplo con **datos ficticios** en `app/services/programacion/ejemplos/lote-ejemplo.json`: reproduce la forma de los siete casos de referencia del PDF, sin copiar sus datos.
