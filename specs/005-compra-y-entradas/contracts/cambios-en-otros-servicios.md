# Cambios compatibles en otros servicios

El spec 005 necesita tres ajustes fuera de su servicio. Ninguno cambia el comportamiento existente para quien ya los usa; se hacen en la rama `005-compra-y-entradas`.

## Identidad (spec 001)

| Acción nueva | Roles | Para qué |
|---|---|---|
| `schedule.cancel_with_sales` | `administrador` | Cancelar una función con entradas vendidas (FR-030) |

Las acciones que ya existían se reutilizan: `sales.configure` (administrador) para configurar la venta, cambiar los plazos, consultar ventas, invalidar entradas y resolver incidencias; `access.validate` (personal de acceso, con la función asignada) para abrir, cerrar y validar.

Participación usa la acción pendiente `checkout` del flujo de retorno (`POST /auth/pending-actions`), que el spec 001 ya admite para compras.

## Programación (spec 002)

1. **`GET /internal/functions/{id}`** añade el acceso de su actividad publicada:

   ```yaml
   access:
     mode: free | paid | unconfirmed
     priceUsd: number | null
   ```

2. **`GET /internal/functions?ids=a,b,c`** (nuevo, con `X-Service-Key`): la misma forma para varias funciones; las que no existen o no están publicadas se omiten. Para el estado de venta y Mis entradas.

3. **Cancelar con ventas** (`POST /panel/functions/{id}/cancel`): antes de cancelar se consulta el impacto. Si `soldTickets > 0`, o si el impacto no está disponible, se exige `schedule.cancel_with_sales`; sin ventas confirmadas basta `schedule.change`. El error es `403` con `missingRole: administrador`. Reprogramar no cambia: lo puede hacer el publicador, y las entradas siguen válidas (FR-035).

## Entrada común

- Prefijo `/api/participacion` → `http://participacion:3003`.
- `Permissions-Policy: geolocation=(), camera=(self), microphone=()`: la cámara solo para escanear QR en el propio sitio; la ubicación sigue bloqueada (RNF-05).
