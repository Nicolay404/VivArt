# Quickstart: validar el Pasaporte Vivo

Guía de ejecución y comprobación. Los detalles viven en el [contrato](contracts/pasaporte.openapi.yaml), en el [modelo de datos](data-model.md) y en los [cambios en otros servicios](contracts/cambios-en-otros-servicios.md). El mapa de pruebas contra cada criterio de éxito está en [research.md](research.md).

## Requisitos

- Docker Desktop abierto y Node.js 24.
- `app/.env` generado con `node preparar-entorno.mjs` (desde `app/`). Este spec no añade secretos: el `ref` del QR usa `TICKET_KEY`.
- Un administrador y una cuenta de usuario con correo verificado, como en `specs/002-programacion-y-publicacion/quickstart.md` (los correos de la demo llegan a http://localhost:8080/demo/buzon).

## Ejecutar las pruebas

```text
cd app
docker compose up -d db db-preparar
npm test
```

Incluye las pruebas nuevas de participación (`pasaporte-canje`, `pasaporte-admin`, `pasaporte-concurrencia` y la unitaria) y `edge/test/e2e-pasaporte.test.js`.

## Ejecutar la demo con contenedores

```text
cd app
docker compose up -d --build
docker compose exec programacion node bin/cargar-ejemplo.js
```

- Panel del Pasaporte: http://localhost:8080/panel/pasaporte (administrador).
- Mi pasaporte: http://localhost:8080/pasaporte.
- Reloj fijo para probar ventanas: `CLOCK_FIXED=2026-11-21T19:30:00-05:00` en los servicios `programacion` y `participacion` (no funciona con `NODE_ENV=production`).
- El QR lleva `PUBLIC_BASE_URL` (en la demo, `http://localhost:8080`). Los QR definitivos se imprimen cuando esté cerrada P-12.

## Escenarios de comprobación manual

| Escenario | Pasos | Resultado esperado |
|---|---|---|
| Generar y activar | En el panel, generar el QR de una función, intentar activarlo sin ventana, fijar la ventana y activarlo | Sin ventana: error; con ventana: activo, con QR grande, enlace y descarga en SVG |
| Canje con sesión | Con una cuenta verificada, abrir el enlace del QR dentro de la ventana | Se muestra el sello nuevo; «Mi pasaporte» suma 1 |
| Repetir | Volver a abrir el enlace | El mismo sello, sin error |
| Canje sin sesión | Abrir el enlace en una ventana privada, iniciar sesión | Pide identificarse y vuelve al canje, que se revalida y entrega el sello |
| Correo sin verificar | Con una cuenta sin verificar, abrir el enlace | Pide verificar el correo; no hay sello |
| Entrada como sello | Abrir `/pasaporte/canje/VIVART-E1:…` (contenido de una entrada) | «Tipo de código incorrecto» |
| Fuera de ventana | Con el reloj fijado antes o después de la ventana | «Aún no abierto» o «vencido» |
| Reemplazar | Reemplazar el QR y abrir el enlace anterior con otra cuenta | «QR desactivado o reemplazado»; los sellos anteriores siguen |
| Reprogramar | Reprogramar la función (Agenda, spec 002) y abrir el enlace con otra cuenta | «QR desactivado» por cambio de la función; en el panel, el QR aparece desactivado hasta confirmar una ventana nueva |
| Cancelar | Cancelar la función y abrir el sello obtenido antes | Sigue en la colección con el aviso de cancelación; un canje nuevo se rechaza |
| Contenido | Añadir texto y una imagen con EXIF; emitir un sello; cambiar el contenido; emitir otro | Cada sello conserva su versión; la imagen servida no tiene EXIF; el texto con `<b>` se ve literal |
| Sin meta | Abrir «Mi pasaporte» | «N sellos», sin meta, porcentaje ni casillero bloqueado; rutas «Próximamente» |
| Permisos | Como publicador, `POST /api/participacion/panel/functions/{id}/passport/qr` | 403 con el rol que falta |

## Resultados registrados

| Fecha | Comprobación | Resultado |
|---|---|---|
| — | Pendiente de implementación (`/speckit-tasks` y `/speckit-implement`) | — |

## Qué NO hace este spec

No vende ni valida entradas (spec 005), no calcula rutas ni insignias (spec 007), no decide los datos de un sello reprogramado (P-14) ni el dominio público (P-12).
