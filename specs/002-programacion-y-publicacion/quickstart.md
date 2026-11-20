# Quickstart: validar el servicio de programación

Guía de ejecución y comprobación. Los detalles viven en los [contratos](contracts/) y en el [modelo de datos](data-model.md).

## Requisitos

- Docker Desktop abierto y Node.js 24.
- `app/.env` generado con `node preparar-entorno.mjs` (desde `app/`). Si lo generaste con el spec 001, bórralo y vuelve a generarlo: ahora incluye las credenciales del servicio de programación. Tus datos no se pierden: la base se actualiza al levantar.

## Preparar

```text
cd app
node preparar-entorno.mjs
cd services/programacion && npm install
cd ../identidad && npm install
```

## Ejecutar las pruebas

```text
cd app
docker compose up -d db db-preparar
npm test
```

Ejecuta las pruebas de identidad, de programación y de la entrada común (incluido el recorrido de punta a punta con los dos servicios). Cada criterio de éxito (SC-001 a SC-015) tiene al menos una prueba; el mapa está en `research.md`.

## Ejecutar la demo con contenedores

```text
cd app
docker compose up -d --build
docker compose exec -e MAIL_TRANSPORT=console identidad node bin/crear-primer-administrador.js --email admin@vivart.test
docker compose exec programacion node bin/cargar-ejemplo.js
```

El último comando crea categorías, sedes y actividades **ficticias** de ejemplo y las publica, para ver la Agenda con datos. No son datos del festival.

- API pública: `http://localhost:8080/api/programacion/agenda`, `/now`, `/activities/{id}`.
- API del panel: `http://localhost:8080/api/programacion/panel/...` con la sesión iniciada en la web.
- Reloj fijo para la demo: añade `CLOCK_FIXED=2026-11-21T19:30:00-05:00` al servicio `programacion` (no funciona con `NODE_ENV=production`).

## Escenarios de comprobación manual

| Escenario | Pasos | Resultado esperado |
|---|---|---|
| Agenda pública | Abrir `/agenda?q=danza` sin sesión | Solo actividades publicadas que coinciden |
| Datos pendientes | Abrir una ficha sin duración ni precio | Esos datos llegan como `null` y en `pending` |
| ¿Qué hay ahora? | Fijar el reloj y abrir `/now` | Franjas abiertas, próximas; las canceladas no; solo hora de inicio pasada en `startPassed` |
| Flujo editorial | Editor crea, guarda incompleto, intenta enviar sin categoría, completa y envía; publicador devuelve con observaciones; editor corrige y reenvía; publicador publica | 422 con el campo que falta; «Devuelta» con observaciones; la ficha aparece en la Agenda |
| Editor no publica | Como editor, `POST /panel/activities/{id}/publish` | 403 con el rol que falta |
| Versión pendiente | Editar una ficha publicada | La Agenda sigue mostrando la versión publicada hasta aprobar |
| Reprogramar | `POST /panel/functions/{id}/reschedule` con motivo y aviso | La ficha muestra los datos nuevos y el aviso; el historial registra quién y cuándo |
| Carga | Subir `ejemplos/lote-ejemplo.json` desde `POST /panel/imports`, aceptar y publicar solo algunas | Vista previa con origen, duplicados y errores; borradores; solo se publican las confirmadas |
| Archivo | Archivar una actividad con funciones futuras | 409 hasta cancelarlas |

## Resultados registrados

| Fecha | Comprobación | Resultado |
|---|---|---|
| 2026-11-20 | `npm test` en `app/` | 174 pruebas: 108 de identidad, 55 de programación y 11 de la entrada común (incluida la de punta a punta con los dos servicios reales). Todas pasan |
| 2026-11-20 | Prueba de mutación | Mostrar borradores en la Agenda y presentar como «en curso» una función sin hora de fin hacen fallar 7 pruebas: las pruebas detectan esos errores |
| 2026-11-20 | Demo con contenedores | Cuatro contenedores sanos (`db`, `identidad`, `programacion`, `entrada`) más `db-preparar`, que creó las bases nuevas **sin borrar** los datos que ya existían; servicios sin root; prueba de humo correcta; `cargar-ejemplo.js` publicó 7 actividades ficticias y una segunda ejecución no duplicó nada |
| pendiente | Interfaz | Encargada al agente de diseño con [encargo-frontend.md](encargo-frontend.md) |

## Qué NO hace este spec

No vende entradas ni activa ventas (spec 05), no dibuja el mapa (spec 03) y no implementa la interfaz: la Agenda, la ficha y el panel los diseña otro agente con [encargo-frontend.md](encargo-frontend.md).
