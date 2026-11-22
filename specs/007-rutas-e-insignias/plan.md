# Implementation Plan: Rutas culturales e insignias

**Branch**: `007-rutas-e-insignias` | **Date**: 2026-11-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-rutas-e-insignias/spec.md`

---

## Summary

Las **Rutas culturales e insignias** (RF-28 a RF-30) **no crean un nuevo microservicio**. La arquitectura de VIVART (Vista 2) asigna la participación del público al **servicio de participación** (`app/services/participacion/`), que ya aloja ventas, entradas y el Pasaporte Vivo (specs 005 y 006). Este spec lo amplía:

1. **Gestión de rutas por el Administrador (`/panel/rutas`)**:
   - Crear y editar rutas culturales definiendo título, descripción, meta y funciones elegibles.
   - Solo funciones con Pasaporte habilitado (`passport_enabled = true`) en programación pueden seleccionarse; las franjas horarias quedan excluidas (FR-002).
   - Validación de meta alcanzable: el sistema rechaza cualquier meta estrictamente mayor al número de funciones elegibles asociadas ($\text{meta} \le \text{total\_elegibles}$) (FR-003).
   - Asignación de insignias mediante plantillas visuales comunes de VIVART (nombre, descripción, icono SVG temático oficial y color de acento de la paleta), sin requerir archivos adjuntos ni imágenes arbitrarias (FR-004, FR-021).
   - Estados de ruta: `draft` y `published`. Solo las publicadas son visibles para el visitante.

2. **Consulta pública y detalle de ruta (`/pasaporte` y `/pasaporte/ruta/:id`)**:
   - El visitante sin cuenta puede consultar las rutas publicadas, su meta y las funciones que la componen (FR-008).
   - Pantalla de detalle de ruta con lista de funciones elegibles, estado de cancelación y botón para identificarse si no hay sesión.

3. **Cálculo de progreso y denominadores (M-01, FR-012 a FR-016)**:
   - Progreso por ruta con denominador («2 de 3»): cuenta **únicamente sellos distintos de funciones elegibles** de esa ruta.
   - Sellos de funciones no elegibles no suman. Dos sellos de la misma función cuentan 1 vez.
   - El denominador pertenece estrictamente a la ruta y nunca se proyecta al pasaporte general (M-01).

4. **Desbloqueo de insignias y concurrencia (RC-05, RNF-06, FR-017 a FR-019)**:
   - Al alcanzar la meta, la persona obtiene la insignia una sola vez (`UNIQUE (user_id, route_id)` en `user_badges`).
   - Se evalúa de manera atómica durante el canje del sello (`POST /passport/claims`) informando inmediatamente en la respuesta, y de manera reconciliadora al consultar el progreso.
   - Dos solicitudes concurrentes no otorgan duplicados.

5. **Manejo de cancelaciones y «Ruta en revisión» (R-07, RF-30, FR-020)**:
   - Si se cancela una función elegible: sus sellos ya obtenidos **siguen contando** para el usuario.
   - La función se marca como cancelada y no permite nuevos canjes.
   - Si las funciones elegibles activas restantes son menores a la meta ($\text{activas\_restantes} < \text{meta}$), la ruta se marca dinámicamente como **«Ruta en revisión»**.
   - No se reduce la meta de forma automática ni se revocan sellos o insignias otorgadas. El administrador puede añadir nuevas funciones elegibles desde `/panel/rutas` para restaurar la viabilidad.

6. **Trazabilidad en historial de solo anexar (RC-06, FR-007)**:
   - Creación, modificación y publicación de rutas, así como el desbloqueo de insignias, se registran en la tabla `history`.

---

## Technical Context

**Language/Version**: JavaScript (módulos ES nativos) sobre Node.js 24.

**Primary Dependencies**: 
- Fastify 5 (`app/services/participacion/`)
- Driver PostgreSQL `pg`
- Módulos nativos de Node.js (`node:crypto`, `node:test`, `node:assert`)
- Frontend web nativo en `app/web/` con módulos ES, sin frameworks ni empaquetadores.

**Storage**: PostgreSQL 17 (base de datos `participacion`).
- 3 tablas nuevas: `routes`, `route_functions`, `user_badges`.
- Consultas coordinadas con las tablas existentes `stamps` y `history`.
- Migración idempotente sin borrado de datos al arrancar el servicio.

**Testing**: 
- Suite de pruebas unitarias e integración en `app/services/participacion/test/` con `node:test`.
- Pruebas de concurrencia para el desbloqueo único de insignias.
- Pruebas en el frontend web (`app/web/test/`) verificando renderizado de tarjetas, denominadores, insignias y estados en revisión.
- Verificación de extremo a extremo en `app/edge/test/`.

**Target Platform**: Servidor Node.js 24 en contenedor Linux. Web pública móvil primero (360 px a 1440 px) y panel administrativo escritorio primero.

**Project Type**: Ampliación del servicio backend HTTP existente `participacion` y adición de vistas/componentes en la aplicación web común.

**Performance Goals**: Tiempos de respuesta p95 < 50 ms en consultas de rutas y progreso en local.

**Constraints**:
- Atomicidad e idempotencia estricta en el desbloqueo de insignias (RNF-06, RC-05).
- Control de acceso administrativo en el servidor (RNF-04).
- Modo claro, paleta oficial (violeta `#3b0f66`, atardecer `#d97706`, terracota `#c2410c`), Bricolage Grotesque + Figtree.
- Cero archivos/imágenes subidos para rutas o insignias (FR-021).
- Inmutabilidad del historial (RC-06).

**Scale/Scope**: Catálogo de decenas de rutas culturales, cientos de funciones elegibles y miles de insignias ganadas.

---

## Constitution Check

*GATE: Evaluado antes de la fase de tareas.*

| Principio / Restricción | Evaluación | Detalle |
|---|---|---|
| **I. Desarrollo guiado por especificaciones** | **Cumple** | Clarificaciones completadas e incorporadas al `spec.md`. `research.md`, `data-model.md`, contratos y `quickstart.md` preparados antes de implementar. |
| **II. El contexto es la fuente de verdad** | **Cumple** | Cumple RF-28 a RF-30, M-01, M-13, R-07. No se alteran IDs de requisitos ni se inventan datos. |
| **III. Máximo ocho specs** | **Cumple** | Se trabaja exclusivamente en el spec 007 dentro de su rama correspondiente `007-rutas-e-insignias`. |
| **IV. Arquitectura compartida, sin monolito modular** | **Cumple** | Se amplía el servicio `participacion` respetando la Vista 2. La comunicación con `identidad` y `programacion` es estrictamente mediante clientes HTTP; sin acceso a bases externas ni brokers. |
| **V. Cada spec es verificable** | **Cumple** | Todos los criterios de éxito (SC-001 a SC-013) cuentan con casos de prueba definidos en `research.md`. |
| **Flujo: Una rama por spec** | **Cumple** | Trabajo aislado en `007-rutas-e-insignias`. |
| **Sin coautoría de IA** | **Cumple** | Ningún crédito ni coautoría en commits, PRs o ficheros. |

---

## Project Structure

### Documentation (this feature)

```text
specs/007-rutas-e-insignias/
├── spec.md              # Requisitos funcionales y clarificaciones
├── plan.md              # Este plan de implementación
├── research.md          # Decisiones de diseño y mapa de pruebas
├── data-model.md        # Esquema relacional, estados y reglas
├── quickstart.md        # Guía paso a paso de verificación
├── contracts/
│   ├── participacion-rutas.openapi.yaml   # Contrato API OpenAPI
│   └── cambios-en-otros-servicios.md      # Interacción con identidad y programación
├── checklists/
│   └── requirements.md
└── tasks.md             # Tareas ordenadas por dependencias (/speckit-tasks)
```

### Source Code (repository root)

```text
app/
├── services/
│   └── participacion/
│       ├── src/
│       │   ├── db.js                      # Migraciones idempotentes (routes, route_functions, user_badges)
│       │   ├── domain/
│       │   │   ├── routes.js              # Lógica de dominio: validación, progreso, ruta en revisión
│       │   │   └── badges.js              # Desbloqueo atómico de insignias
│       │   ├── repositories/
│       │   │   └── routes.js              # Consultas y transacciones PostgreSQL para rutas e insignias
│       │   └── http/
│       │       └── routes.js              # Endpoints públicos y administrativos
│       └── test/
│           ├── routes.test.js             # Pruebas de dominio, progreso y concurrencia
│           └── routes-http.test.js        # Pruebas de integración HTTP y autorización
└── web/
    ├── js/
    │   ├── pasaporte.js                   # Secciones Mis insignias, Rutas culturales y /pasaporte/ruta/:id
    │   ├── panel-rutas.js                 # Panel administrativo de rutas (/panel/rutas)
    │   └── panel-bandeja.js               # Enlace a rutas en barra de navegación del panel
    └── styles.css                         # Estilos para tarjetas de rutas, progreso y plantillas de insignias
```

---

## Re-evaluación post-diseño (Fase 1)

El diseño detallado confirma:
1. No se agregan librerías externas ni dependencias pesadas; se reutiliza la infraestructura probada de Fastify, `pg` y el frontend ES nativo.
2. La base de datos `participacion` mantiene su aislamiento: claves foráneas únicamente internas (`routes` → `route_functions`, `routes` → `user_badges`).
3. El frontend respeta plenamente el sistema visual (modo claro, paleta violeta/atardecer, Figtree/Bricolage Grotesque).
