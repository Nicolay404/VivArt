# Implementation Plan: Carrito, compra y control de entradas

**Branch**: `005-compra-y-entradas` | **Date**: 2026-11-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-compra-y-entradas/spec.md`

## Summary

Se crea el **servicio de participación** (`app/services/participacion`), que la arquitectura ya prevé para los specs 005, 006 y 007 (`docs/arquitectura/02-servicios.md`). En este spec es dueño de la configuración de venta, los pedidos, las retenciones de cupo, las entradas con QR, los controles de acceso, las incidencias de pago y los ajustes de venta. Expone:

- una **API pública** sin sesión: cotizar un carrito (precios vigentes, cupo, cruces de horario, límite de seis) y el estado de venta de las funciones («Disponible», «Agotada», «Venta cerrada»);
- una **API de la persona** con sesión y correo verificado: crear el pedido con retención, pagar con el simulador de prueba, ver Mis pedidos y Mis entradas;
- una **API del panel** para el administrador (configurar venta, ajustes de plazos, consultar ventas, invalidar entradas, resolver incidencias) y para el personal de acceso (abrir y cerrar el control y validar entradas);
- una **API interna** para programación: el impacto en entradas y pedidos antes de reprogramar o cancelar.

Participación **no copia** la programación: consulta a programación por HTTP el estado vigente de cada función (fecha, hora, sede, cancelada, precio de la actividad) cada vez que vende o valida. Así la cancelación y la reprogramación se notan al instante sin eventos ni broker. Los permisos se verifican en identidad con fallo cerrado.

Este plan cubre el backend, los cambios compatibles en identidad y programación, la base de datos, los contenedores, el CI, la documentación y **la interfaz web** (carrito, pago de prueba, Mis entradas, panel de ventas y control de acceso), con el sistema visual actual de `app/web`.

## Technical Context

**Language/Version**: JavaScript (módulos ES) sobre Node.js 24

**Primary Dependencies**: Fastify 5, `pg`, `qrcode` (genera el QR como SVG en el servidor). Criptografía y pruebas con módulos integrados (`node:crypto`, `node:test`). En la web, sin frameworks: módulos ES propios, como el resto de `app/web`

**Storage**: PostgreSQL 17 en el contenedor común, con base y usuario propios (`participacion` y `participacion_pruebas`). El carrito sin sesión vive en el navegador (FR-006); las entradas ya abiertas se guardan en el navegador para verlas sin conexión (FR-040)

**Testing**: `node:test` con `inject` de Fastify, identidad y programación simuladas; pruebas de concurrencia con solicitudes simultáneas reales contra PostgreSQL (último cupo, entrada usada dos veces, confirmación repetida); prueba de punta a punta con los tres servicios detrás de la entrada común

**Target Platform**: Servidor Node.js 24 en contenedor Linux; consumidores: la web (celular para el público y el personal de acceso, escritorio para el panel) y el servicio de programación

**Project Type**: Servicio web HTTP dentro de un repositorio con varios servicios, más pantallas en la web común

**Performance Goals**: Sin metas de producción en el contexto. La retención y la validación son una transacción corta con bloqueo de una fila

**Constraints**: Pagos solo de prueba, sin datos de tarjeta (RNF-05, FR-013); integridad ante solicitudes simultáneas (RNF-06); toda acción protegida verificada en el servidor (RNF-04); si no se puede verificar, «no confirmado» (RNF-07); horarios en hora de Loja y precios en USD (RNF-08); no inventar precios ni cupos

**Scale/Scope**: MVP académico. Decenas de funciones con venta, cientos de entradas. Unos 25 endpoints y 8 tablas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Desarrollo guiado por especificaciones | **Cumple.** Spec clarificado (sesión 2026-11-20, cinco preguntas); este plan precede a las tareas y al código |
| II. El contexto es la fuente de verdad | **Cumple.** El precio sale de la programación (no se configura otro); los cupos los fija el administrador; los plazos (10 y 30 minutos) vienen del spec. La conservación de entradas tras la edición sigue pendiente y **no se resuelve**: no se borra nada |
| III. Máximo ocho specs | **Cumple.** Solo spec 005 |
| IV. Arquitectura compartida, sin monolito modular | **Cumple.** Es el servicio de participación que ya figura en la vista 2, con base propia; consulta a identidad y a programación solo por HTTP; no lee tablas ajenas; sin broker |
| V. Cada spec es verificable | **Cumple.** Cada SC tiene prueba (mapa en `research.md`), incluidas las de concurrencia |
| Flujo: una rama por spec | **Cumple.** Todo en `005-compra-y-entradas`, incluidos los cambios compatibles en identidad y programación |
| Sin coautoría de IA; secretos fuera de Git | **Cumple.** La credencial de participación ya se genera en `app/.env` |

**Cambios compatibles en otros specs** (detalle en [contracts/cambios-en-otros-servicios.md](contracts/cambios-en-otros-servicios.md)):

- **Identidad (001):** acción nueva `schedule.cancel_with_sales` (solo administrador). No cambia ninguna acción existente.
- **Programación (002):** la función interna añade el acceso y el precio de su actividad; nueva consulta interna de varias funciones; cancelar una función con entradas vendidas (o cuando no se puede saber) exige `schedule.cancel_with_sales` (FR-030, regla dueña de este spec).
- **Entrada común:** prefijo `/api/participacion`, y `Permissions-Policy` permite la cámara solo en el propio sitio para escanear QR (`camera=(self)`); la ubicación sigue bloqueada (RNF-05).

**Re-evaluación tras el diseño (Fase 1):** sin cambios. No se añadió broker ni acceso a datos ajenos; programación sigue sin ningún dato de venta.

## Project Structure

### Documentation (this feature)

```text
specs/005-compra-y-entradas/
├── plan.md               # este archivo
├── research.md           # decisiones técnicas y mapa de pruebas
├── data-model.md         # tablas, estados y reglas
├── quickstart.md         # cómo probarlo
├── contracts/
│   ├── participacion.openapi.yaml        # API pública, de la persona, del panel e interna
│   └── cambios-en-otros-servicios.md     # cambios compatibles en identidad, programación y entrada
└── tasks.md              # (/speckit-tasks)
```

### Source Code (repository root)

```text
app/
├── services/
│   ├── identidad/            # + acción schedule.cancel_with_sales
│   ├── programacion/         # + acceso y precio en la función interna, consulta de varias, regla de cancelación con ventas
│   └── participacion/
│       ├── Dockerfile
│       ├── package.json
│       ├── src/
│       │   ├── config.js  db.js  app.js  server.js  services.js
│       │   ├── clock.js                 # reloj común en hora de Loja (mismo criterio que programación)
│       │   ├── clients/                 # identidad (introspect, authorize) y programación (funciones)
│       │   ├── domain/                  # carrito, venta, pedidos, pago de prueba, entradas, acceso, impacto, ajustes
│       │   ├── repositories/            # acceso a datos
│       │   └── http/                    # errores, sesión, rutas públicas, de la persona, del panel e internas
│       └── test/
│           ├── helpers.js               # base por esquema, identidad y programación simuladas
│           ├── unit/
│           └── integration/             # incluye concurrencia
├── web/
│   └── js/
│       ├── carrito.js                   # carrito local, cotización y pago de prueba
│       ├── entradas.js                  # Mis entradas, QR y copia sin conexión
│       ├── panel-ventas.js              # configuración de venta, ajustes, consultas, invalidación, incidencias
│       └── acceso.js                    # control de acceso: abrir, cerrar, escanear o escribir el código
├── edge/                                # + prefijo /api/participacion y cámara para el propio sitio
├── db/init/                             # + base del servicio de participación
└── docker-compose.yml                   # + contenedor participacion
```

**Structure Decision**: un servicio nuevo con la misma organización que identidad y programación. A diferencia del spec 002, la interfaz se desarrolla dentro de este plan, porque el sistema visual ya está definido en `app/web`.

## Complexity Tracking

| Elección | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| Fila de venta por función bloqueada con `SELECT … FOR UPDATE` al retener | El último cupo no puede venderse dos veces (FR-029, SC-002) | Contar en la aplicación sin bloqueo (dos pedidos ven el mismo cupo libre) |
| Consultar a programación en cada venta y validación | La cancelación y la reprogramación deben notarse al instante (FR-031, FR-035) sin broker | Copiar el estado de las funciones (se desactualiza; obligaría a eventos) |
| Retención vencida evaluada al leer (sin tareas programadas) | Una retención vale mientras `expires_at` sea futura; no hace falta un proceso que la libere | Un temporizador que libere cupos (falla si el proceso se reinicia) |
| QR generado en el servidor como SVG | La web no puede cargar librerías externas (CSP `default-src 'self'`) y el SVG se guarda tal cual para verlo sin conexión | Generar el QR en el navegador con una librería copiada al repositorio |
