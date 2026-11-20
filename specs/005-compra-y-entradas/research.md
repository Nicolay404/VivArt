# Research: Carrito, compra y control de entradas

Decisiones técnicas del plan. Todas son reversibles y no cambian requisitos.

## Decisiones

| # | Tema | Decisión | Por qué | Alternativas descartadas |
|---|---|---|---|---|
| 1 | Servicio | `app/services/participacion`, Node 24 + Fastify 5 + `pg`, igual que los otros dos. Puerto 3003 | La vista 2 de la arquitectura ya define este servicio para los specs 005, 006 y 007; mismo stack para todo el equipo | Un servicio solo para ventas (la arquitectura lo agrupa con sellos y rutas) |
| 2 | Datos | Base `participacion` con usuario propio; pruebas en `participacion_pruebas` con un esquema por ejecución | Cada servicio es dueño de sus datos | Compartir la base de programación |
| 3 | Fuente de la función | En cada operación que depende de la función (cotizar, retener, confirmar, validar) se consulta `GET /internal/functions/{id}` de programación. Para listas (estado de venta, Mis entradas) se usa la consulta de varias funciones | La cancelación y la reprogramación se notan sin copiar datos ni usar eventos (FR-031, FR-035) | Copia local de las funciones |
| 4 | Precio | El precio es `access.priceUsd` de la actividad publicada (spec 02). Solo se vende si `access.mode = paid` y hay precio. Se guarda en centavos enteros | Clarificación 2 (una sola fuente); enteros evitan errores de redondeo en USD | Precio propio en la venta |
| 5 | Programación no responde | Cotizar, pagar y validar devuelven **503** con «no se pudo verificar» y no hacen nada. Mis entradas muestra las entradas con «estado no confirmado» | RNF-07 y FR-018: si no se puede verificar, no se confirma | Usar el último dato conocido para admitir una entrada |
| 6 | Cupo y concurrencia | Tabla `sales` (una fila por función con venta). Al crear el pedido, en una transacción: `SELECT … FOR UPDATE` de las filas de sus funciones en orden de id (evita interbloqueos), cálculo de disponible = cupo − vendidas − retenidas vigentes, y alta del pedido con sus ítems | FR-029, SC-002, vista 4 de la arquitectura | Bloqueo optimista con reintentos (más complejo de probar) |
| 7 | Retención | El pedido guarda `expires_at = creado + plazo vigente` y el total validado. Una retención está vigente si el pedido está `pending` y `expires_at` > ahora. No hay tarea que libere cupos: el cálculo los ignora al vencer | FR-008, FR-009, FR-012 (el plazo nuevo no altera pedidos ya creados) | Temporizador en memoria |
| 8 | Cierre de venta | Cerrada si ahora ≥ inicio − plazo de cierre (30 min por defecto), en hora de Loja. Se comprueba al cotizar y al crear el pedido; **no** al confirmar un pedido ya creado | FR-039 (el pedido pendiente anterior al cierre termina dentro de su retención) | Comprobar también al confirmar (contradice la clarificación) |
| 9 | Ajustes | Tabla `settings` con `hold_minutes` (10) y `sale_close_minutes` (30). Solo el administrador los cambia; el historial registra el cambio | FR-012, FR-039, P-07 | Variables de entorno (no las cambia el administrador) |
| 10 | Pago de prueba | Simulador `POST /orders/{id}/simulate-payment` con `confirmed`, `failed` o `confirmed_late`, disponible solo si `PAYMENT_SIMULATOR=on` y `NODE_ENV` no es `production`. En otro entorno no existe la ruta y el pedido queda «pago no disponible» | FR-036, FR-013, SC-013: sin dinero ni datos de tarjeta | Pasarela de pago de pruebas externa (pediría datos de tarjeta y credenciales) |
| 11 | Confirmación idempotente | Cada confirmación lleva una referencia de pago; `payments.reference` es único. Solo un pedido `pending` con retención vigente pasa a `confirmed` y emite N entradas en la misma transacción; repetir la misma referencia devuelve el resultado anterior | FR-015, SC-004 | Confiar en que no llegue dos veces |
| 12 | Pago tardío | Si la confirmación llega con la retención vencida (o el simulador elige `confirmed_late`), el pedido pasa a `in_review` y se crea una incidencia. No se emiten entradas ni se recupera cupo | FR-016, FR-022, P-02 | Emitir si aún queda cupo |
| 13 | Entradas y QR | Cada entrada tiene un **secreto aleatorio** de 128 bits (base64url) que va en el QR como `VIVART-E1:<secreto>` y un **código alternativo** de 10 caracteres (alfabeto sin 0/O ni 1/I/L) para escribir a mano. La base guarda solo el hash SHA-256 de ambos. El QR se genera como SVG en el servidor | FR-024, RC-04 (el prefijo distingue la entrada del QR de Pasaporte), RNF-05 (códigos privados fuera de registros) | QR con el id de la entrada (adivinable); guardar el secreto en claro |
| 14 | Tipo de código | La validación rechaza con `wrong_code_type` cualquier contenido que no empiece con `VIVART-E1:` y parezca de Pasaporte o un enlace; un texto de 10 caracteres se trata como código alternativo | FR-026, FR-027, SC-007 | Distinguir por longitud únicamente |
| 15 | Validación atómica | `UPDATE tickets SET used_at = …, used_by = … WHERE id = … AND status = 'valid' AND used_at IS NULL RETURNING …`; si no devuelve fila, se relee para dar el motivo | FR-028, SC-006: dos validaciones simultáneas, una sola admitida | Leer y luego escribir sin condición |
| 16 | Motivos de rechazo | `wrong_code_type`, `not_found`, `already_used`, `wrong_function`, `function_cancelled`, `not_valid` (no confirmada o invalidada), `access_closed`, `not_verifiable` (programación no responde) | FR-026 y RNF-07 | Mensajes libres |
| 17 | Control de acceso | Tabla `access_controls` (función, abierto o cerrado, quién y cuándo). Solo el personal con `access.validate` para esa función lo abre, lo cierra y valida. Nunca se cierra solo | FR-023 (el cierre no se deduce de una duración desconocida) | Cierre automático al terminar |
| 18 | Cancelación de la función | No se guarda aquí: se consulta a programación. Con la función cancelada: la cotización y el pedido se rechazan, la confirmación de un pedido pendiente se rechaza y su retención deja de contar, la validación responde `function_cancelled`, y Mis entradas muestra «Función cancelada» con el aviso público | FR-031, FR-032 | Marcar las entradas al cancelar (necesitaría un evento) |
| 19 | Quién cancela con ventas | Programación pide el impacto antes de cancelar. Si hay entradas vendidas, **o si el impacto no está disponible**, exige la acción nueva `schedule.cancel_with_sales` (solo administrador) | FR-030 y fallo cerrado: si no se sabe si hay ventas, se trata como si las hubiera | Permitir al publicador cuando no se sabe |
| 20 | Impacto | `GET /internal/functions/{id}/impact` → `{ soldTickets, pendingOrders }`: entradas válidas no usadas y pedidos pendientes con retención vigente. Contrato que programación ya consume | FR-042, SC-018 | — |
| 21 | Reprogramación | Las entradas no cambian: siguen apuntando a la misma función, cuyo dato vigente se consulta al validar y al mostrarlas. Una entrada usada sigue usada | FR-035, SC-009 | Reemitir entradas |
| 22 | Estado de venta público | `GET /sale-status?functionIds=…` → `available`, `sold_out` o `closed` por función con venta habilitada; nunca el número de cupos | FR-041, SC-017 | Exponer cupos restantes |
| 23 | Cruces en el carrito | La cotización marca pares de funciones cuyos intervalos se solapan, solo si ambos tienen fin conocido (hora de fin o duración); si falta, no se advierte | FR-005, RC-02 (no inventar duraciones) | Suponer una duración |
| 24 | Carrito local | El carrito sin sesión se guarda en `localStorage` como `[{ functionId, quantity }]`; el servidor nunca confía en precios del navegador: cotiza de nuevo | FR-006, FR-007 | Carrito en el servidor sin cuenta |
| 25 | Retorno tras identificarse | La web registra la acción pendiente `checkout` en identidad (spec 001) y, al volver, abre el carrito y lo cotiza de nuevo | RF-03, flujo 2 de la vista 4 | — |
| 26 | Entradas sin conexión | Al abrir Mis entradas con conexión se guarda en `localStorage` una copia de cada entrada (título, fecha, sede, QR en SVG, código alternativo y la hora de la copia). Sin conexión se muestra esa copia con el aviso «Estado sin confirmar: puede haber cambiado» | FR-040, SC-016; la admisión se decide en el servidor | Service worker (más complejo; no hace falta para mostrar lo ya abierto) |
| 27 | Escaneo | La pantalla de acceso usa `BarcodeDetector` del navegador cuando existe; si no, o si no hay permiso de cámara, se escribe el código alternativo | FR-024, Historia 5 escenario 6; sin librerías externas | Librería de lectura de QR |
| 28 | Invalidación | Solo administrador, con motivo; la entrada pasa a `invalidated` y conserva quién, cuándo y por qué. No repone cupo | FR-037, SC-014 | — |
| 29 | Historial | Tabla `history` de solo anexar (triggers que impiden UPDATE, DELETE y TRUNCATE), igual que programación | RC-06 | Solo registros del proceso |
| 30 | Datos de tarjeta | No existe ningún campo para ellos; el registro de peticiones excluye cuerpos y cabeceras de cookies | RNF-05, SC-011 | — |

## Pendientes de producto (no se resuelven en el plan)

- **Cuánto tiempo se conserva una entrada después de la edición:** no se borra nada hasta que el equipo lo decida.

## Mapa de pruebas contra los criterios de éxito

| Criterio | Cómo se prueba | Tipo |
|---|---|---|
| SC-001 | Cotizar gratuitas, de pago sin precio, sin cupo y sin venta habilitada: ninguna se acepta | Integración |
| SC-002 | 20 pedidos simultáneos por el último cupo: exactamente uno queda pendiente | Concurrencia |
| SC-003 | Pago fallido y retención vencida (reloj fijo) liberan el cupo; un cambio de precio no altera el total del pedido vigente | Integración |
| SC-004 | Confirmar un pedido de 3 entradas emite 3 con secretos distintos; repetir la confirmación no emite más | Integración y concurrencia |
| SC-005 | `confirmed_late` crea incidencia y 0 entradas | Integración |
| SC-006 | 20 validaciones simultáneas de la misma entrada: una admitida | Concurrencia |
| SC-007 | Validar QR de Pasaporte, entrada de otra función, usada y de función cancelada: cada una con su motivo | Integración |
| SC-008 | Cancelar en programación simulada: se bloquean compra y validación, la retención deja de contar, Mis entradas muestra el aviso | Integración |
| SC-009 | Reprogramar en programación simulada: la entrada sigue válida; una usada no se reactiva | Integración |
| SC-010 | Publicador y editor intentan configurar venta, cambiar plazos y cancelar con ventas (llamada directa): 403 | Integración (los dos servicios) |
| SC-011 | Ningún campo ni registro contiene datos de tarjeta; el simulador no los pide | Unidad y revisión de registros |
| SC-012 | Una cuenta pide pedidos y entradas de otra: no los ve (404) | Integración |
| SC-013 | Con `NODE_ENV=production` el simulador no existe | Integración |
| SC-014 | Invalidación por no administrador: 403; por administrador: motivo guardado, acceso rechazado, cupo sin cambio | Integración |
| SC-015 | Pedido de 7 unidades repartidas en dos funciones: rechazado; cantidad mayor que el cupo: rechazada | Integración |
| SC-016 | Copia local de la entrada visible sin conexión; el servidor rechaza una entrada usada aunque se muestre | Prueba en el navegador (quickstart) e integración |
| SC-017 | Estado de venta sin número de cupos; todo vendido o retenido → `sold_out` | Integración |
| SC-018 | Impacto con entradas y pedidos reales; participación caída → programación informa «no disponible» | Integración y punta a punta |
