# Cambios compatibles en otros servicios

El spec 006 necesita un ajuste en identidad y una variable de configuración. Ninguno cambia el comportamiento existente; se hacen en la rama `006-pasaporte-y-sellos`.

## Identidad (spec 001)

| Acción nueva | Roles | Para qué |
|---|---|---|
| `passport.manage` | `administrador` | Generar, activar, desactivar y reemplazar el QR del Pasaporte, fijar la ventana y editar el contenido del sello (FR-017) |

La acción pendiente `canje` ya existe: `POST /auth/pending-actions { type: 'canje', ref }` y el retorno a `/pasaporte/canje/{ref}` tras iniciar sesión (spec 001, RF-03). No se cambia.

## Programación (spec 002)

Ninguno. Participación usa la API interna que ya existe (`GET /internal/functions/{id}` y `GET /internal/functions?ids=`), que devuelve título, fecha, hora, sede, estado y último aviso de la función. Las franjas de apertura no tienen id de función: no pueden tener QR (FR-016).

## Participación (configuración)

| Variable | Valor en la demo | Para qué |
|---|---|---|
| `PUBLIC_BASE_URL` | `http://localhost:8080` | Dirección que lleva el QR impreso. Es la misma que ya usa identidad para los enlaces de correo. Al cerrar P-12 (dominio) se cambia aquí y se reimprimen los QR |

El `ref` del QR se deriva de `TICKET_KEY`, que ya existe en `app/.env`: no hay secretos nuevos.

## Calidad (SonarCloud)

`app/services/*/src/domain/imagenes.js` y `app/services/*/test/imagenes-prueba.js` se repiten a propósito en programación y participación (no hay librería compartida entre servicios) y se excluyen solo del cálculo de duplicados (`sonar.cpd.exclusions`).
