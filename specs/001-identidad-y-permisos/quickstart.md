# Quickstart: validar el servicio de identidad

Guía de ejecución y comprobación. Los detalles viven en los [contratos](contracts/) y en el [modelo de datos](data-model.md). Todo el código está bajo `app/`.

## Requisitos

- Node.js 24 o superior (`node --version`).
- Para las pruebas y la demo sin contenedores: nada más (sin base de datos externa y sin correo real).
- Opcional: Docker, para la demo con contenedores.

## Preparar

```text
cd app/services/identidad
npm install
```

## Ejecutar las pruebas

```text
cd app
npm test
```

Ejecuta las pruebas del servicio de identidad y las de la entrada común (incluido el recorrido de punta a punta). Cada criterio de éxito (SC-001 a SC-018) tiene al menos una prueba; el mapa está en `research.md`.

## Ejecutar la demo sin contenedores

1. Variables de entorno (valores de ejemplo, no son credenciales):
   - `MAIL_TRANSPORT=test` (buzón de pruebas en memoria)
   - `SERVICE_KEYS=programacion:<clave>,participacion:<clave>` (define tus propias claves; no se versionan)
   - `PUBLIC_BASE_URL=http://localhost:8080`
2. Iniciar el servicio: `npm start` dentro de `app/services/identidad` (puerto 3001).
3. Iniciar la entrada común: `node edge/server.js` dentro de `app` (puerto 8080).
4. Abrir `http://localhost:8080`. Los correos de la demo se leen en `/demo/buzon`.

## Ejecutar la demo con contenedores

```text
cd app
docker compose up --build
```

Abre `http://localhost:8080`. Solo la entrada común publica un puerto; el servicio de identidad queda dentro de la red de contenedores. Para borrar todo: `docker compose down -v`. Las imágenes también se construyen y prueban en la integración continua.

## Primer administrador (procedimiento interno)

1. Un integrante del equipo ejecuta, con el correo designado: `node bin/crear-primer-administrador.js --email <correo>` dentro de `app/services/identidad`, con `MAIL_TRANSPORT=console`.
2. El script crea la cuenta pendiente de activación y emite el enlace de activación por consola (no hay correo real).
3. El titular abre el enlace y establece su contraseña. No existen credenciales predeterminadas.
4. Desde ahí, ese administrador asigna roles a otras cuentas desde «Roles».

## Escenarios de comprobación manual

| Escenario | Pasos | Resultado esperado |
|---|---|---|
| Registro y verificación | Crear cuenta; abrir el enlace desde `/demo/buzon` | Cuenta verificada; mismo mensaje exista o no el correo |
| Recuperación | Pedir recuperación; abrir el enlace; usarlo dos veces | La primera vez cambia la contraseña; la segunda se rechaza |
| Roles | Como administrador, asignar `editor` y `publicador`; quitar `editor` (con confirmación) | Conserva solo lo que concede `publicador` |
| Rechazo | Como editor, abrir «Roles» | Mensaje que indica que falta el rol de administrador, sin datos de contenido |
| Retorno a la acción | En «Demo: retorno a la acción», simular un canje sin sesión; iniciar sesión | Pantalla «Volviste a donde estabas» con el destino; bloqueada si el correo no está verificado; no se paga ni se canjea nada |

## Resultados registrados

| Fecha | Tarea | Resultado |
|---|---|---|
| 2026-11-20 | T066 (recorrido del quickstart con contenedores reales) | Correcto: las dos imágenes se construyen y quedan sanas; ambos contenedores corren sin root; solo la entrada común publica un puerto (127.0.0.1:8080); recorrido completo registro → verificación por el buzón → inicio de sesión → retorno a la acción con `executed=false`; un `Origin` ajeno se rechaza con 403. Después se borraron contenedores, volúmenes e imágenes locales |
| pendiente | T067 (teclado y 360 px; SC-019) | Sin hacer. Anotar aquí la fecha, el navegador y cada flujo de FR-038 con OK o el fallo encontrado |

## Qué NO hace esta rama

No incluye carrito, pago, canje ni Pasaporte. El contrato de acción pendiente solo conserva el tipo y la referencia, y devuelve a la persona; la revalidación y el paso final los definen los specs 05 y 06.
