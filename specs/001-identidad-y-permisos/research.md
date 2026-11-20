# Research: Identidad, perfil y permisos

Todas las decisiones son **técnicas, reversibles y no cambian ningún requisito**. Se documentan aquí para poder cambiarlas sin tocar el spec.

## Decisiones técnicas

| # | Tema | Decisión | Motivo | Alternativas descartadas |
|---|---|---|---|---|
| 1 | Plataforma | Node.js 24, JavaScript con módulos ES | Disponible en el equipo; `node:crypto` y `node:test` integrados reducen dependencias | Python (ruedas nativas para algunas librerías), Java (más configuración) |
| 2 | Servidor HTTP | Fastify 5 + @fastify/cookie | Validación de esquemas, `inject` para pruebas sin abrir puertos | Express (sin validación integrada); `http` puro (más código propio) |
| 3 | Almacenamiento | PostgreSQL 17 en contenedor, con base y usuario propios por servicio, detrás de la capa de repositorio (cliente `pg`). **Cambio del 2026-11-20:** antes era `node:sqlite` en un archivo | Base visible y consultable con cualquier cliente; transacciones y bloqueos adecuados para la concurrencia que vendrá en el spec 05 (último cupo, RNF-06); cada servicio sigue siendo dueño de sus datos porque su usuario solo entra a su base. Las pruebas usan un esquema nuevo por aplicación en `identidad_pruebas` y lo borran al terminar | SQLite en archivo (usado al inicio; un solo escritor y datos dentro del contenedor); un contenedor de base por servicio (más aislado, pero más contenedores sin ganancia para el MVP) |
| 4 | Hash de contraseñas | `scrypt` de Node, sal aleatoria de 16 bytes y parámetros guardados con el hash (`scrypt$N$r$p$sal$hash`) | Hash lento integrado, sin compilar módulos nativos | argon2id (requiere dependencia nativa); bcrypt (límite de 72 bytes) |
| 5 | Contraseñas | 15 a 128 caracteres, normalización NFKC, espacios permitidos, sin reglas de composición | Cumple FR-028 (15 mínimas, máximo admitido de al menos 64) | Reglas de mayúsculas, números o símbolos (descartadas por el spec) |
| 6 | Sesiones | Token opaco de 32 bytes aleatorios; en base de datos solo su hash SHA-256; cookie `vivart_sid` `HttpOnly`, `SameSite=Lax`, `Secure` en producción | Revocable al instante; no hay datos de permisos dentro de la credencial | Tokens firmados autocontenidos (no se pueden revocar sin consulta) |
| 7 | Vigencia de sesión | Máximo absoluto de 7 días; cierre por inactividad tras 2 h si la cuenta tiene algún rol interno y tras 7 días si no (`last_seen_at`, anotada como mucho una vez por minuto) | Decisión P-10 del 2026-11-20 (FR-041). El servidor decide por los roles de la cuenta, no por la pantalla abierta, así no depende de la interfaz | Cierre por inactividad solo en el navegador (se puede saltar con solicitudes directas) |
| 8 | Tokens de correo | 32 bytes aleatorios, solo su hash en base de datos, un solo uso, vencimiento configurable: verificación 24 h, recuperación 1 h, activación del primer administrador 72 h | Cumple FR-029 (enlace de un solo uso y con vencimiento); plazos exactos son del plan técnico (FR-030) | — |
| 9 | Acción pendiente | Registro propio con vigencia de 24 h | Decisión P-11 del 2026-11-20 (FR-042): igual que el enlace de verificación; siempre se revalida al retomar | — |
| 10 | Correo | Puerto de correo con dos transportes: **buzón de pruebas en memoria** (demo y pruebas) y **consola** (procedimiento interno del primer administrador). No hay transporte real en esta rama | FR-030: la demo comprueba verificación y recuperación sin correos reales | Proveedor real (queda para producción, sin cambiar el puerto) |
| 11 | Autorización entre servicios | Introspección: `POST /internal/introspect` y `POST /internal/authorize` con cabecera de credencial de servicio por consumidor (variables de entorno) | Arquitectura: los servicios consultan permisos vigentes; un rol revocado deja de autorizar en la siguiente consulta (RF-04b) | Copiar roles dentro de la sesión (se desactualiza) |
| 12 | CSRF | Los métodos que cambian estado exigen `Content-Type: application/json` y, si llega `Origin`, que esté en la lista permitida; `SameSite=Lax` | Defensa simple sin dependencias | Token CSRF por formulario (más pieza para una interfaz de pocas pantallas) |
| 13 | Limitación de intentos | En memoria: inicio de sesión 10 intentos por 15 min por correo+IP; recuperación y registro 5 por hora por IP | Reduce fuerza bruta y abuso de correos; se reinicia al reiniciar el servicio | Limitador distribuido (no hay más de una instancia en el MVP) |
| 14 | Privacidad de respuestas | Recuperación y reenvío responden igual exista o no el correo (FR-029). El registro con un correo ya registrado responde igual que uno nuevo y envía un aviso por correo al titular | Evita enumerar cuentas | Mensaje «correo ya registrado» (revela cuentas) |
| 15 | Igualar tiempos | Si el correo no existe, se ejecuta igualmente un hash ficticio en el inicio de sesión | Reduce la diferencia de tiempos entre cuentas existentes e inexistentes | — |
| 16 | Primer administrador | Script interno `bin/crear-primer-administrador.js --email <correo>`: crea la cuenta **pendiente de activación** con rol administrador y emite un enlace de activación donde su titular establece su contraseña. Sin credenciales predeterminadas | FR-027 | Registro especial o cuenta sembrada con contraseña (descartados por el spec) |
| 17 | Roles | Roles guardados: editor, publicador, administrador y personal de acceso. «Usuario registrado» es implícito para toda cuenta activa y «visitante» para quien no tiene sesión | RC-01: permisos como suma de roles activos | Guardar también los roles implícitos (redundante) |
| 18 | Política de permisos | Tabla de acciones declarada en código (`domain/policy`) con los roles que las conceden; `authorize` devuelve `allowed` o el rol que falta sin revelar contenido | FR-009 a FR-017, FR-022 y FR-023 | — |
| 19 | Interfaz | Web estática con JavaScript sin dependencias: etiquetas, errores junto al campo, foco visible y teclado | RNF-02, RNF-03 | Un framework (innecesario para pocas pantallas) |
| 20 | Entrada común | Servidor Node mínimo que sirve `app/web/` y enruta `/api/identidad` al servicio, quitando el prefijo | La arquitectura pide enrutamiento simple, no gateway dedicado | Nginx u otro proxy (infraestructura extra) |

## Decisiones de producto aplicadas (2026-11-20)

- **P-10 (FR-039 a FR-041):** la revocación del rol de administrador se hace en una transacción con bloqueo y solo procede si queda otro administrador activo (las cuentas pendientes de activación no cuentan); nadie se asigna roles ni funciones a sí mismo; cierre de sesión por inactividad según los roles de la cuenta.
- **P-11 (FR-042):** acción pendiente de 24 h; activar la cuenta del primer administrador verifica su correo.

## Dependencias con otros specs

- Qué ocurre tras revalidar una acción (confirmar o no antes de pagar o reclamar): lo definen los specs 05 y 06.

## Mapa de pruebas contra los criterios de éxito

| Criterio | Cómo se comprueba | Tipo |
|---|---|---|
| SC-001 (acciones no concedidas se rechazan, incluso directas) | Matriz de la política contra `authorize` y contra las rutas protegidas sin pasar por la web | Contrato e integración |
| SC-002 (consulta pública sin identificación ni ubicación) | La entrada común y el servicio no exigen sesión en rutas públicas; la web no pide permisos de ubicación | Integración y manual |
| SC-003 (retorno a la acción y motivo cuando ya no es válida) | `pending-actions` y `resume` conservan tipo y referencia; el destino lo fija el servicio | Integración |
| SC-004 (roles múltiples y revocación parcial) | Asignar dos roles y revocar uno | Integración |
| SC-005 (revocar no pierde trabajo ni despublica) | La política no elimina nada de otros servicios; se comprueba que la revocación solo borra la asignación | Integración |
| SC-006 (rechazos con rol faltante y sin revelar contenido) | Forma de la respuesta 403 | Contrato |
| SC-007 y SC-008 (historial y datos propios) | `audit` registra cada cambio; `/me` y rutas de usuario solo devuelven la propia cuenta | Integración |
| SC-009 (personal de acceso por función) | `authorize` con y sin función asignada | Integración |
| SC-010 y SC-011 (registro con dos datos y contraseñas) | Validación de esquema y de contraseñas 14, 15, 64 y 128 con espacios | Unitaria e integración |
| SC-012 (sin correo verificado no se completa nada) | `resume` devuelve `canProceed=false` y `introspect` informa `emailVerified` | Integración |
| SC-013 y SC-014 (mismo mensaje y enlaces de un solo uso) | Respuestas idénticas con correo existente y no existente; segundo uso y vencidos se rechazan | Integración |
| SC-015 (registro no da permisos internos; sin credenciales predeterminadas) | Registrar con el correo designado no crea roles; búsqueda de credenciales en el repositorio | Integración y revisión |
| SC-016 (demo sin correos reales) | Todo el flujo funciona con el buzón de pruebas | Integración |
| SC-017 y SC-018 (revalidación, sin ejecutar pago ni canje, con motivo) | `resume` devuelve `executed=false` y el servicio dueño revalida; no existe ninguna ruta que pague o canjee | Integración |
| SC-019 (flujos de identidad con teclado y a 360 px) | Recorrido manual de los flujos de FR-038 sin ratón y en modo dispositivo de 360 px | Manual (T067) |
| SC-021 a SC-023 (último administrador, sin auto-asignación, inactividad) | Revocación del último administrador, incluida la simultánea; auto-asignación de roles y funciones; reloj simulado para 2 h, 7 días y el máximo absoluto | Integración |
| SC-020 (registro neutro y límite de intentos) | Misma respuesta para correo nuevo y repetido; respuesta 429 al superar el límite en inicio de sesión, registro y recuperación | Integración |
