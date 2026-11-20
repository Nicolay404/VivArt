# Implementation Plan: Programación, agenda y publicación

**Branch**: `002-programacion-y-publicacion` | **Date**: 2026-11-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-programacion-y-publicacion/spec.md`

## Summary

Se crea el **servicio de programación y consulta pública** (`app/services/programacion`), dueño de actividades, funciones, franjas de apertura, borradores y versiones, avisos públicos, categorías, sedes, ediciones, lotes de carga e historial. Expone:

- una **API pública sin sesión**: Agenda con búsqueda y filtros, ficha con enlace compartible, «¿Qué hay ahora?» y catálogos;
- una **API del panel** con el flujo editorial completo (borrador → revisión → devuelta o publicada), reprogramación y cancelación con aviso, carga desde un archivo estructurado, gestión de catálogos y archivo;
- una **API interna** con credencial de servicio para que el servicio de participación (spec 05 y 06) consulte una función publicada.

Los permisos se verifican en el servidor consultando al servicio de identidad (`/internal/authorize`), con fallo cerrado si no responde. El reloj de referencia es común, en hora de Loja, y solo se puede fijar fuera de producción.

Este plan cubre **todo el backend**, la base de datos, los contenedores, el CI y la documentación. La interfaz (Agenda, ficha y panel) se deja preparada con contratos OpenAPI y un encargo para el agente de diseño ([encargo-frontend.md](encargo-frontend.md)).

## Technical Context

**Language/Version**: JavaScript (módulos ES) sobre Node.js 24

**Primary Dependencies**: Fastify 5, cliente `pg` de PostgreSQL. Sin ORM. Criptografía y pruebas con módulos integrados de Node (`node:crypto`, `node:test`)

**Storage**: PostgreSQL 17 en el contenedor común, con base y usuario propios (`programacion`, y `programacion_pruebas` para las pruebas). Nadie más escribe en ella

**Testing**: `node:test` con `inject` de Fastify y un servicio de identidad simulado; prueba de punta a punta con los dos servicios reales detrás de la entrada común

**Target Platform**: Servidor Node.js 24 en contenedor Linux; consumidores: la web (celular y escritorio) y el servicio de participación

**Project Type**: Servicio web HTTP dentro de un repositorio con varios servicios

**Performance Goals**: No se fijan metas de producción (el contexto no las pide). La Agenda se resuelve con una consulta indexada por fecha y texto normalizado

**Constraints**: No inventar datos (RNF-08); toda acción protegida verificada en el servidor (RNF-04); historial de solo anexar (RNF-09); reloj común en hora de Loja (RNF-10); publicar nunca activa ventas; sin correos editoriales

**Scale/Scope**: MVP académico. Decenas o pocos cientos de actividades por edición. Unos 35 endpoints, 12 tablas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Desarrollo guiado por especificaciones | **Cumple.** El spec está clarificado (sesión 2026-11-20); este plan precede a las tareas y al código |
| II. El contexto es la fuente de verdad | **Cumple.** No se inventan datos de programación: los casos del PDF se prueban con datos ficticios marcados como tales. Dos puntos que el spec deja abiertos (edición simultánea y vigencia de una propuesta sin revisar) **no se resuelven como producto**: se aplica solo una salvaguarda técnica reversible y siguen anotados como pendientes |
| III. Máximo ocho specs | **Cumple.** Solo spec 002 |
| IV. Arquitectura compartida, sin monolito modular | **Cumple.** Servicio independiente con base y usuario propios; consulta permisos por HTTP a identidad; no lee tablas ajenas |
| V. Cada spec es verificable | **Cumple.** Cada SC tiene prueba (ver `research.md`) |
| Flujo: una rama por spec | **Cumple.** Todo en `002-programacion-y-publicacion` |
| Sin coautoría de IA; secretos fuera de Git | **Cumple.** Credenciales en `app/.env` generado localmente |

**Cambio compatible en otro spec:** se añaden tres acciones a la política del servicio de identidad (`schedule.change`, `catalog.manage`, `activity.archive`). No cambia ninguna acción existente ni el contrato de introspección; se documenta en `contracts/` del spec 001.

**Re-evaluación tras el diseño (Fase 1):** sin cambios. No se añadió broker, gateway ni acceso a datos ajenos.

## Project Structure

### Documentation (this feature)

```text
specs/002-programacion-y-publicacion/
├── plan.md               # este archivo
├── research.md           # decisiones técnicas y mapa de pruebas
├── data-model.md         # tablas, estados y reglas
├── quickstart.md         # cómo probarlo
├── encargo-frontend.md   # encargo para el agente de diseño (Agenda, ficha y panel)
├── contracts/
│   ├── programacion.openapi.yaml   # API pública, del panel e interna
│   └── formato-carga.md            # formato del archivo estructurado (JSON)
└── tasks.md              # (/speckit-tasks)
```

### Source Code (repository root)

```text
app/
├── services/
│   ├── identidad/                     # spec 001 (se añaden 3 acciones a la política)
│   └── programacion/
│       ├── Dockerfile
│       ├── package.json
│       ├── bin/
│       │   └── cargar-ejemplo.js      # carga el lote de ejemplo ficticio en la demo
│       ├── ejemplos/
│       │   └── lote-ejemplo.json      # casos de referencia del PDF con datos ficticios
│       ├── src/
│       │   ├── config.js  db.js  app.js  server.js  services.js
│       │   ├── clock.js               # reloj común en hora de Loja
│       │   ├── clients/               # identidad (authorize) y participación (impacto)
│       │   ├── domain/                # contenido, validación, agenda, ahora, editorial, cambios, carga, catálogos
│       │   ├── repositories/          # acceso a datos
│       │   └── http/                  # errores, sesión y permisos, rutas públicas, del panel e internas
│       └── test/
│           ├── helpers.js             # base de pruebas por esquema e identidad simulada
│           ├── unit/
│           └── integration/
├── edge/                              # se añade el prefijo /api/programacion
├── db/init/                           # se añade la base del servicio de programación
└── docker-compose.yml                 # se añade el contenedor programacion
```

**Structure Decision**: un servicio nuevo con la misma organización que identidad. La web (`app/web/`) no se modifica en este plan: el encargo de diseño la desarrolla sobre los contratos.

## Complexity Tracking

| Elección | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| Contenido del borrador en JSON y funciones publicadas en tablas | El borrador puede estar incompleto (FR-030) y la Agenda necesita filtrar por fecha y sede | Todo en tablas (obliga a columnas nulas por todas partes) o todo en JSON (consultas públicas lentas e imposibles de indexar) |
| Identificadores estables de función | Participación (entradas, QR, sellos) referencia funciones; deben sobrevivir a nuevas versiones | Regenerar funciones en cada publicación (rompería las referencias) |
| Cliente de participación que devuelve «no disponible» | FR-017 exige mostrar el conteo y participación aún no existe | Inventar ceros (violaría RNF-08) |
