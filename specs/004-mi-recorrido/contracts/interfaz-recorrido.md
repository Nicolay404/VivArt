# Contrato de Módulo: Interfaz de Mi Recorrido (`recorrido.js`)

Este contrato define las funciones y la interfaz del módulo JavaScript `app/web/js/recorrido.js` que encapsula la lógica de negocio, persistencia en `localStorage`, cálculo de cruces y búsqueda de alternativas.

---

## 1. Métodos de Gestión del Recorrido

### `obtenerRecorrido()`
- **Entrada**: Ninguna.
- **Salida**: `ItemRecorrido[]` ordenado cronológicamente por `date` ascendente y `startTime` ascendente.
- **Comportamiento**: Lee de `localStorage['vivart_recorrido_v1']`. Si la clave no existe o el JSON es inválido, retorna `[]`.

### `guardarEnRecorrido(item)`
- **Entrada**: Objeto con datos de la función o franja.
- **Salida**: `boolean` (`true` si se guardó, `false` si ya estaba guardado o el storage falló).
- **Comportamiento**: Es idempotente. Si el elemento ya existe, no lo duplica. Guarda el snapshot completo en `localStorage`.

### `quitarDeRecorrido(id)`
- **Entrada**: `id` del ítem a remover (p. ej. `fn_12345`).
- **Salida**: `boolean` (`true` si fue removido).
- **Comportamiento**: Elimina el ítem de `localStorage`. Si el recorrido queda vacío, conserva la estructura.

### `estaEnRecorrido(id)`
- **Entrada**: `id` del ítem o `functionId`.
- **Salida**: `boolean`.
- **Uso**: Permite a las tarjetas de la Agenda y Fichas saber si mostrar «Guardar» o «Quitar de mi recorrido».

### `sustituirEnRecorrido(idOriginal, nuevoItem)`
- **Entrada**: `idOriginal` (string), `nuevoItem` (objeto).
- **Salida**: `boolean`.
- **Comportamiento**: Operación atómica que remueve `idOriginal` y agrega `nuevoItem` en `localStorage` (FR-015, FR-021).

### `vaciarRecorrido()`
- **Entrada**: Ninguna.
- **Salida**: `void`.
- **Comportamiento**: Limpia todos los ítems del almacenamiento local.

---

## 2. Métodos de Negocio y Reglas Comunes

### `detectarCruces(items)`
- **Entrada**: `items: ItemRecorrido[]`.
- **Salida**: `CruceHorario[]` (pares de IDs con solapamiento y minutos de cruce).
- **Regla (RC-02, FR-006 a FR-008)**:
  - Solo compara elementos con la misma `date`.
  - Ignora elementos cuyo intervalo no se conozca (`endTime == null` y `durationMinutes == null`).
  - Hay cruce si y solo si:
    $$\text{inicioA} < \text{finB} \quad \land \quad \text{inicioB} < \text{finA}$$
  - Si $\text{finA} == \text{inicioB}$, no es cruce.

### `buscarAlternativas(itemAfectado, itemsAgenda, referencia)`
- **Entrada**:
  - `itemAfectado`: Ítem cancelado, agotado o con inicio pasado.
  - `itemsAgenda`: Catálogo de actividades de `/api/programacion/agenda`.
  - `referencia`: Objeto de tiempo oficial (`reference.now`).
- **Salida**: `AlternativaItem[]`.
- **Regla (FR-012, FR-013, FR-017)**:
  - Misma sede: `venue.id === itemAfectado.venue.id`.
  - Funciones no canceladas (`status !== 'cancelled'`).
  - Funciones que aún no comiencen (`startTime > referencia.time` en la misma fecha o fechas posteriores).
  - Si la lista es vacía, el UI muestra mensaje de sin resultados y enlace a la Agenda.

### `sincronizarRecorrido(items, agenda, saleStatuses)`
- **Entrada**: Ítems locales, catálogo actualizado de Agenda y estados de venta de participación.
- **Salida**: `ItemRecorrido[]` actualizado con horas nuevas, sedes nuevas, avisos de cancelación/reprogramación y marca de `archived` si ya no existe en el catálogo.
