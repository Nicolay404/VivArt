# Research: Pasaporte Vivo y sellos

Decisiones técnicas del plan. Todas son reversibles y no cambian requisitos. Las decisiones de producto están en el spec (Clarifications) y en `context/requirements/funcionales.md` (M-01, M-10 a M-13, P-03, R-06; P-14 pendiente).

## Decisiones

| # | Tema | Decisión | Por qué | Alternativas descartadas |
|---|---|---|---|---|
| 1 | Dónde vive | Se amplía `app/services/participacion`: dueño de entradas, y según la vista 2 también de QR, sellos y rutas | Arquitectura; la función se consulta a programación como en el 005 | Un servicio de Pasaporte aparte |
| 2 | Permisos | Acción nueva `passport.manage` (administrador) en identidad, consultada en cada operación del panel con fallo cerrado | FR-017, SC-009; distinta de `sales.configure` porque Pasaporte y venta son operaciones distintas | Reutilizar `sales.configure` (mezcla permisos) |
| 3 | Enlace del QR | `PUBLIC_BASE_URL` + `/pasaporte/canje/{ref}`. `ref` = 22 caracteres base64url = HMAC-SHA256(`TICKET_KEY`, `pasaporte:{qrId}`) recortado a 128 bits. La base guarda solo `sha256(ref)` | M-13: aleatorio, impredecible y no es el id de la función; el administrador puede volver a ver el QR; la ruta es la que identidad ya usa para el retorno de la acción «canje» | `ref` = id de la función (adivinable); guardar el `ref` en claro |
| 4 | QR en SVG | `qrcode` (ya es dependencia) genera el SVG en el servidor con corrección de errores M; el panel lo descarga como archivo `.svg` | FR-027; la CSP no permite librerías externas en la web | Generarlo en el navegador |
| 5 | Un QR vigente | Índice único parcial: un solo QR no reemplazado por función. Reemplazar = marcar el anterior `replaced` y crear uno nuevo en la misma transacción, con un `ref` nuevo | FR-014, FR-026, SC-014 | Cambiar el `ref` del mismo QR (pierde el rastro en el historial) |
| 6 | Ventana | Inicio y fin en hora local de Loja (`AAAA-MM-DD HH:MM`), como las funciones; fin > inicio. Activar sin ventana = 422 | M-10, FR-023; RC-07 | Instantes UTC (el administrador piensa en hora de Loja) |
| 7 | Cambio de la función (P-03) | Al confirmar la ventana se guarda la fecha, hora y sede de la función en ese momento. En cada canje y en el panel se comparan con las vigentes de programación; si cambiaron, el QR pasa a `inactive` con motivo `function_changed`, queda en el historial y el canje se rechaza como «QR desactivado». Para reactivarlo, el administrador confirma una ventana nueva | FR-018, FR-019, SC-005; sin llamadas de programación a participación | Aviso de programación a participación al reprogramar; mover la ventana sola (prohibido) |
| 8 | Sello único | Tabla `stamps` con `UNIQUE (user_id, function_id)`. El canje hace `INSERT … ON CONFLICT DO NOTHING RETURNING` y, si no devuelve fila, lee el existente: las dos solicitudes simultáneas ven el mismo sello | RC-05, RNF-06, SC-002; vista 4 de la arquitectura | Leer y luego insertar (carrera) |
| 9 | Datos del sello (P-14 pendiente) | **Opción simple:** el sello guarda solo función, QR, versión de contenido y fecha de obtención. Título, fecha, hora y sede se piden a programación al mostrar, con su último aviso, como Mis entradas del 005. **Si el equipo elige el recuerdo del momento del canje:** se añaden `function_title`, `function_date`, `function_start` y `venue_name` a `stamps`, rellenados al canjear, y la vista los usa en lugar de los vigentes (el aviso se sigue mostrando) | Planificar sin bloquear; programación sigue siendo la única fuente | Esperar la decisión para planificar |
| 10 | Orden de comprobaciones del canje | 1) formato del `ref` (un contenido `VIVART-E1:` es una entrada: «tipo de código incorrecto»); 2) QR existente; 3) sesión (401 → la web guarda la acción pendiente `canje`); 4) correo verificado; 5) **sello ya existente → se devuelve** aunque el QR esté reemplazado o la ventana cerrada; 6) programación responde (si no, 503 «no confirmado»); 7) función cancelada; 8) QR activo y función sin cambios; 9) ventana; 10) emitir | FR-001 a FR-009; reabrir el enlace siempre muestra el mismo sello (FR-003) | Rechazar una reapertura fuera de la ventana |
| 11 | Motivos de rechazo | `wrong_code_type`, `qr_not_found`, `qr_replaced`, `qr_inactive` (con `cause: manual | function_changed`), `window_not_open`, `window_expired`, `function_cancelled`, `email_not_verified`, `unauthenticated`, `not_verifiable` | FR-007, SC-004 | Mensajes libres |
| 12 | Franjas | Solo hay QR para ids que programación devuelve como **función** (`/internal/functions/{id}`); las franjas no tienen id de función, así que no pueden tener QR | FR-016, SC-008 | Validar contra la actividad |
| 13 | Contenido versionado | `stamp_contents` (función, versión, texto, imagen). Guardar el contenido crea una versión nueva; el canje enlaza la última. Sin contenido = sello con la plantilla común | M-11, FR-022, FR-024, SC-012, SC-013 | Editar en el sitio |
| 14 | Imágenes | `stamp_images` inmutables, nunca se borran (claves foráneas `RESTRICT`); validación con la copia de `imagenes.js`: JPEG, PNG o WebP por sus bytes, hasta 1 MB, sin EXIF, XMP ni comentarios; texto alternativo y autoría obligatorios | M-12, FR-025, SC-015; mismo módulo que la foto de sede | Borrar imágenes sin uso (no hace falta en el MVP) |
| 15 | Texto breve | Texto plano de hasta 280 caracteres, sin caracteres de control; la web lo pinta con `textContent`, nunca como HTML | M-12 | Sanear HTML (no hace falta si nunca se interpreta) |
| 16 | Imagen pública | `GET /passport/images/{id}` sin sesión, con id aleatorio y caché larga (la imagen no cambia) | Es la misma para todos los sellos de esa versión; la web la muestra con `<img>` | Exigir sesión (complica el `<img>` sin beneficio) |
| 17 | Colección | `GET /passport` (sesión): total de sellos e items ordenados por fecha de obtención; `GET /passport/stamps/{id}`: solo si es de la persona (si no, 404, para no revelar que existe) | FR-010 a FR-012, SC-006, SC-007 | 403 (revela la existencia) |
| 18 | Programación caída | Canje: 503 «no confirmado» y nada se emite. Colección: se muestra con lo que se sabe y `verified: false`, y la web dice «datos sin confirmar» | RNF-07, FR-009 | Emitir sin verificar |
| 19 | Retorno tras identificarse | La página de canje pide `POST /passport/claims`; con 401 registra `POST /auth/pending-actions { type: 'canje', ref }` y lleva a iniciar sesión; identidad devuelve a `/pasaporte/canje/{ref}` y el canje se revalida | FR-006, RF-03, flujo 2 de la vista 4; ruta ya implementada en identidad | — |
| 20 | Historial | `passport.qr.generated`, `.activated`, `.deactivated` (con causa), `.replaced`, `.window_set` y `passport.content.set`, en la tabla `history` de solo anexar | FR-020, SC-010 | — |
| 21 | Panel | `/panel/pasaporte`: lista de funciones publicadas (de la Agenda pública) con su estado de Pasaporte; por función, QR grande con su enlace y descarga en SVG, ventana, botones de activar, desactivar y reemplazar, y contenido del sello | FR-014, FR-027 | — |
| 22 | Pestaña Pasaporte | Sin sesión: invitación a identificarse para ver la colección y rutas «Próximamente». Con sesión: «Mi pasaporte: N sellos» y la rejilla de sellos; sin meta, porcentaje ni casillero bloqueado | M-01, M-13, FR-011, FR-013, FR-028 | Copiar el mockup («5 de 12») |
| 23 | Dirección del QR | `PUBLIC_BASE_URL` (en la demo, `http://localhost:8080`); al decidir el dominio (P-12) se cambia en la configuración y se reimprimen los QR | M-13 | Dirección fija en el código |

## Pendientes de producto (no se resuelven en el plan)

- **P-14:** datos de un sello cuya función se reprograma después del canje. El plan usa los datos vigentes; la ampliación está en la decisión 9.
- **P-12:** dominio público; los QR definitivos se imprimen cuando se cierre.

## Mapa de pruebas contra los criterios de éxito

| Criterio | Cómo se prueba | Tipo |
|---|---|---|
| SC-001 | Canje válido con función gratuita y de pago, sin pedidos ni entradas: emite el sello | Integración |
| SC-002 | Veinte solicitudes simultáneas del mismo usuario con el mismo `ref`: exactamente un sello y todas las respuestas con el mismo id; reaperturas posteriores devuelven el mismo | Concurrencia |
| SC-003 | `ref` = `VIVART-E1:…`: `wrong_code_type` y 0 sellos | Unitaria e integración |
| SC-004 | Cada motivo con su código y mensaje: QR desactivado, reemplazado, vencido, no abierto, función cancelada, correo sin verificar | Integración |
| SC-005 | Reemplazar el QR y reprogramar la función: los sellos siguen; el `ref` anterior da `qr_replaced` y la reprogramación da `qr_inactive` (`function_changed`) | Integración |
| SC-006 | `GET /passport` devuelve `total` y ningún campo de meta, porcentaje ni casillero | Integración |
| SC-007 | Una persona pide el sello de otra: 404; su colección no incluye sellos ajenos | Integración |
| SC-008 | Generar QR para un id que no es función (por ejemplo, una franja): 404 | Integración |
| SC-009 | Editor, publicador, personal de acceso y usuario en cada ruta del panel: 403; sin sesión 401; identidad caída 503 | Integración |
| SC-010 | Cada operación del panel deja su entrada en el historial | Integración |
| SC-011 | Función cancelada: el sello anterior sigue con el aviso; un canje nuevo da `function_cancelled` | Integración |
| SC-012 | Sello emitido sin contenido: plantilla común, `content: null` | Integración |
| SC-013 | Cambiar el contenido después de emitir: los sellos anteriores conservan su texto e imagen; la imagen sigue servida | Integración |
| SC-014 | Activar sin ventana: 422; dos QR vigentes para la misma función son imposibles (restricción) | Integración |
| SC-015 | Imagen con EXIF: se sirve sin él; sin texto alternativo o autoría: 422; un texto con `<b>` se devuelve como texto literal | Unitaria e integración |
