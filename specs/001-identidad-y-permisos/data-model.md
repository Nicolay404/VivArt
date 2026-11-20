# Data Model: Identidad, perfil y permisos

Base de datos propia del servicio de identidad (PostgreSQL: base `identidad` con su propio usuario). Ningún otro servicio escribe en ella; la consultan solo a través de la API de introspección.

## Entidades

### users (cuenta de usuario)

| Campo | Tipo | Reglas |
|---|---|---|
| id | texto (UUID) | Clave primaria |
| email | texto | **Único**, guardado en minúsculas y sin espacios; no se guarda cédula, teléfono ni dirección (FR-028) |
| password_hash | texto, opcional | `scrypt$N$r$p$sal$hash`; vacío mientras la cuenta está pendiente de activación |
| status | texto | `pending_activation` o `active` |
| email_verified_at | fecha, opcional | Vacío = correo sin verificar (FR-029) |
| created_at, updated_at | fecha | |

Transiciones: `registro → active` (correo sin verificar) → verificar → correo verificado. Primer administrador: `pending_activation → active` con correo verificado al activar con el enlace recibido (valor técnico a confirmar en P-11).

### role_assignments (asignación de rol)

| Campo | Tipo | Reglas |
|---|---|---|
| id | entero | Clave primaria |
| user_id | texto | Referencia a `users` |
| role | texto | `editor`, `publicador`, `administrador` o `personal_acceso` |
| assigned_by | texto | Cuenta que la asignó |
| assigned_at | fecha | |

Único por (`user_id`, `role`). No se puede quitar `administrador` a la última cuenta administradora activa, y nadie se asigna filas a sí mismo (P-10, FR-039 y FR-040). **«Usuario registrado»** es implícito para toda cuenta activa y **«visitante»** para quien no tiene sesión; no se guardan. Los permisos de una persona son la **suma** de sus roles activos (RC-01). Un registro público **nunca** crea filas aquí.

### function_assignments (funciones del personal de acceso)

| Campo | Tipo | Reglas |
|---|---|---|
| user_id | texto | Debe tener el rol `personal_acceso` |
| function_id | texto | Identificador de la función (lo define el servicio de programación; aquí es un valor opaco) |
| assigned_by, assigned_at | texto, fecha | |

Único por (`user_id`, `function_id`). Revocar el rol `personal_acceso` elimina estas filas (FR-015, FR-018).

### sessions (sesión)

| Campo | Tipo | Reglas |
|---|---|---|
| id | texto | Hash SHA-256 del token opaco; el token solo existe en la cookie |
| user_id | texto | |
| created_at, expires_at | fecha | Vencimiento absoluto de 7 días (P-10) |
| last_seen_at | fecha | Última actividad; la sesión se cierra tras 2 h sin uso si la cuenta tiene un rol interno y tras 7 días si no (P-10, FR-041) |

Se elimina al cerrar sesión, al restablecer la contraseña (todas las sesiones de la cuenta) y al vencer.

### email_tokens (enlaces de un solo uso)

| Campo | Tipo | Reglas |
|---|---|---|
| token_hash | texto | Hash SHA-256 del token enviado por correo; clave primaria |
| user_id | texto | |
| purpose | texto | `verify`, `reset` o `activate` |
| expires_at | fecha | Por defecto 24 h, 1 h y 72 h según el propósito |
| used_at | fecha, opcional | Si no está vacío, el token ya no sirve |

### pending_actions (acción pendiente de identificación)

| Campo | Tipo | Reglas |
|---|---|---|
| id | texto | Aleatorio; viaja en la cookie `vivart_pa` |
| type | texto | `compra` o `canje` (nada más) |
| ref | texto | Referencia opaca de la acción: para `canje`, el identificador del QR de la función, con el patrón `^[A-Za-z0-9_-]{1,64}$`; para `compra`, opcional con el mismo patrón |
| user_id | texto, opcional | Se asocia al identificarse |
| created_at, expires_at | fecha | Vigencia de 24 h (P-11, FR-042) |

**Destino de retorno** (lo fija el servicio, nunca la persona): `compra → /carrito` y `canje → /pasaporte/canje/{ref}`. Esto evita redirecciones abiertas. La fila **no ejecuta nada**: solo conserva el tipo y la referencia.

### audit_log (historial de operaciones sensibles)

| Campo | Tipo | Reglas |
|---|---|---|
| id | entero | |
| at | fecha | |
| actor_id | texto | Quién lo hizo |
| action | texto | `role.assigned`, `role.revoked`, `function.assigned`, `function.revoked`, `admin.activated`, `password.reset`, entre otras |
| target_type, target_id | texto | Sobre qué registro |
| details | texto (JSON) | Detalle no sensible; **nunca** contraseñas ni tokens |

Solo un administrador lo consulta (FR-025). Es de solo anexar.

## Relaciones

- `users` 1 — N `role_assignments`, `function_assignments`, `sessions`, `email_tokens`.
- `pending_actions` se asocia a un `users` al identificarse.
- Los identificadores de función son valores opacos: el servicio de programación es su dueño.

## Política de permisos (acciones declaradas)

Tabla en código; cada servicio la consulta con `authorize`. Roles que conceden cada acción:

| Acción | Roles que la conceden | Contexto adicional |
|---|---|---|
| `roles.manage`, `audit.view` | administrador | — |
| `draft.edit_own`, `draft.submit` | editor | `ownerId` debe ser la propia persona |
| `draft.edit_any`, `draft.review`, `publish` | publicador, administrador | — |
| `draft.reassign`, `event.create_publish`, `catalog.load` | administrador | — |
| `sales.configure` | administrador | — |
| `schedule.change` | publicador, administrador | Reprogramar o cancelar funciones con aviso (añadida para el spec 002) |
| `catalog.manage` | administrador | Ediciones, categorías y sedes (añadida para el spec 002) |
| `activity.archive` | administrador | Archivar actividades (añadida para el spec 002) |
| `access.validate` | personal de acceso | `functionId` asignado a la persona |
| `panel.access` | cualquier rol interno | — |

Reglas de las respuestas de rechazo: indican el **rol que falta** y los roles aceptados, y **nunca** incluyen títulos, textos ni autores de contenido (FR-022, FR-023).
