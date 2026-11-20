# Quickstart: validar el servicio de identidad

Guía de ejecución y comprobación. Los detalles viven en los [contratos](contracts/) y en el [modelo de datos](data-model.md).

## Requisitos

- Node.js 24 o superior (`node --version`).
- Sin base de datos externa, sin Docker y sin correo real.

## Preparar

```text
cd services/identidad
npm install
```

## Ejecutar las pruebas

```text
npm test
```

Resultado esperado: todas las pruebas pasan y cada criterio de éxito (SC-001 a SC-018) tiene al menos una prueba (véase el mapa en `research.md`).

Desde la raíz del repositorio, `npm test` ejecuta también las pruebas de la entrada común.

## Ejecutar la demo

1. Variables de entorno (valores de ejemplo, no son credenciales):
   - `MAIL_TRANSPORT=test` (buzón de pruebas en memoria)
   - `SERVICE_KEYS=programacion:<clave>,participacion:<clave>`
   - `PUBLIC_BASE_URL=http://localhost:8080`
2. Iniciar el servicio: `npm start` dentro de `services/identidad` (puerto 3001).
3. Iniciar la entrada común: `node edge/server.js` en la raíz (puerto 8080).
4. Abrir `http://localhost:8080`.

## Primer administrador (procedimiento interno)

1. Un integrante del equipo ejecuta, con el correo designado: `node services/identidad/bin/crear-primer-administrador.js --email <correo>`.
2. El script crea la cuenta pendiente de activación y emite el enlace de activación por el transporte configurado (consola, no hay correo real).
3. El titular abre el enlace y establece su contraseña. No existen credenciales predeterminadas.
4. Desde ahí, ese administrador asigna roles a otras cuentas.

## Escenarios de comprobación manual

| Escenario | Pasos | Resultado esperado |
|---|---|---|
| Registro y verificación | Registrarse; abrir el enlace del buzón de pruebas | Cuenta verificada; mismo mensaje exista o no el correo |
| Recuperación | Pedir recuperación; abrir el enlace; usarlo dos veces | Primera vez cambia la contraseña; segunda se rechaza |
| Roles | Como administrador, asignar `editor` y `publicador`; revocar `editor` | Conserva solo lo que concede `publicador` |
| Rechazo | Como editor, pedir `publish` a `/internal/authorize` | `allowed=false` y falta el rol de publicador, sin datos de contenido |
| Retorno a la acción | Sin sesión, guardar una acción `canje`; iniciar sesión; llamar a `/auth/resume` | Destino de retorno, `executed=false`; bloqueado si el correo no está verificado |

## Qué NO hace esta rama

No incluye carrito, pago, canje ni Pasaporte. El contrato de acción pendiente solo conserva el tipo y la referencia, y devuelve a la persona; la revalidación y el paso final los definen los specs 05 y 06.
