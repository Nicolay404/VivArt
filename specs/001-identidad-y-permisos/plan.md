# Implementation Plan: Identidad, perfil y permisos

**Branch**: `001-identidad-implementacion` (parte de `001-identidad-y-permisos`, PR #5 abierto) | **Date**: 2026-11-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-identidad-y-permisos/spec.md`

## Summary

Se construye el **servicio de identidad** de VIVART: registro con correo y contraseña, verificación de correo, inicio y cierre de sesión, recuperación de acceso, habilitación interna del primer administrador, roles múltiples con permisos como suma, personal de acceso limitado a funciones asignadas, historial de operaciones sensibles y el contrato de retorno a la acción original.

Es un servicio HTTP independiente y dueño de sus datos, dentro de la arquitectura común aprobada como decisión de trabajo (servicios con APIs síncronas, sin broker y sin monolito modular; `docs/arquitectura/`, PR #7). Los demás servicios consultan permisos vigentes mediante **introspección** con credencial de servicio propia, de modo que un rol revocado deja de autorizar en la siguiente consulta. Se añade una interfaz web mínima y una entrada HTTP común sencilla. **No se construyen** carrito, pago, canje ni Pasaporte: solo el contrato de acción pendiente, que nunca ejecuta pagos ni canjes.

## Technical Context

**Language/Version**: JavaScript (módulos ES) sobre Node.js 24

**Primary Dependencies**: Fastify 5 y @fastify/cookie; criptografía, SQLite y pruebas con módulos integrados de Node (`node:crypto`, `node:sqlite`, `node:test`)

**Storage**: SQLite (`node:sqlite`) en un archivo propio del servicio de identidad, detrás de una capa de repositorio reemplazable

**Testing**: `node:test` con `inject` de Fastify para el servicio; pruebas de la entrada común con `node:test`

**Target Platform**: Servidor Node.js 24 (Windows y Linux) y navegador móvil o de escritorio para la interfaz

**Project Type**: Servicio web con interfaz estática y entrada HTTP común (parte de un repositorio con varios servicios)

**Performance Goals**: No se fijan metas de producción (el contexto no las pide). El costo del hash de contraseña es configurable para que las pruebas sean rápidas

**Constraints**: Sin correos reales en demo ni pruebas; sin credenciales predeterminadas; verificación de permisos siempre en el servidor; cookie `HttpOnly`; respuestas neutras que no revelan si un correo existe

**Scale/Scope**: MVP académico. Un servicio, unos 15 endpoints públicos y 2 internos, 6 tablas, una interfaz estática de pocas pantallas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Desarrollo guiado por especificaciones | **Cumple.** Spec revisado y clarificado antes del plan; este plan precede a las tareas y a la implementación |
| II. El contexto es la fuente de verdad | **Cumple.** Cada decisión técnica es reversible y no cambia requisitos. Los pendientes de producto (P-10, P-11) no se resuelven aquí |
| III. Máximo ocho specs | **Cumple.** Este plan pertenece solo al spec 001; no crea specs |
| IV. Arquitectura compartida, cuatro vistas, sin monolito modular | **Cumple con reserva.** Respeta la decisión de trabajo del PR #7; está **pendiente de validación del docente** y no se afirma como validada |
| V. Cada spec es verificable | **Cumple.** Las pruebas se mapean a SC-001 a SC-018 (ver `research.md`) |
| Flujo: una rama por spec | **Desviación justificada.** El PR #5 del spec sigue abierto y no debe mezclar implementación; se usa `001-identidad-implementacion` parte de esa rama. Se renombra o integra al decidir el equipo |
| Sin coautoría de IA; secretos y PDF fuera de Git | **Cumple.** Las credenciales de servicio van en variables de entorno y el repositorio no contiene datos reales |

**Re-evaluación tras el diseño (Fase 1):** sin cambios; no se añadió ninguna pieza fuera de lo aprobado (sin broker, sin gateway, sin carrito ni Pasaporte).

## Project Structure

### Documentation (this feature)

```text
specs/001-identidad-y-permisos/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones técnicas y mapa de pruebas
├── data-model.md        # Fase 1: tablas, estados y reglas
├── quickstart.md        # Fase 1: cómo ejecutar y comprobar
├── contracts/           # Fase 1: contratos HTTP
│   ├── identidad.openapi.yaml
│   └── introspeccion.openapi.yaml
└── tasks.md             # Fase 2 (/speckit-tasks, no lo crea este comando)
```

### Source Code (repository root)

```text
app/                                   # todo el código del producto
├── package.json                       # scripts de conveniencia (npm test)
├── docker-compose.yml                 # demo local: identidad + entrada común
├── services/
│   └── identidad/
│       ├── package.json
│       ├── Dockerfile
│       ├── bin/
│       │   └── crear-primer-administrador.js
│       ├── src/
│       │   ├── server.js              # arranque
│       │   ├── app.js                 # fábrica de la aplicación Fastify
│       │   ├── services.js            # ensambla repositorios y dominio
│       │   ├── config.js              # variables de entorno y valores por defecto
│       │   ├── db.js                  # conexión y esquema
│       │   ├── repositories/          # acceso a datos (reemplazable)
│       │   ├── domain/                # contraseñas, tokens, política, cuentas, roles, acciones pendientes
│       │   ├── mail/                  # puerto de correo, buzón de pruebas y consola
│       │   └── http/                  # rutas, guardas, seguridad y errores
│       └── test/
│           ├── unit/
│           └── integration/
├── web/                               # interfaz estática
│   ├── index.html
│   ├── app.js
│   └── styles.css
└── edge/                              # entrada HTTP común
    ├── server.js                      # sirve web/ y enruta /api/identidad
    ├── Dockerfile
    └── test/
```

Fuera de `app/` quedan la documentación (`context/`, `specs/`, `docs/`), las herramientas de agentes (`.agents/`, `.claude/`, `.specify/`) y la integración continua (`.github/`).

**Structure Decision**: un solo repositorio. Todo el código vive bajo `app/`, con una carpeta por servicio (`app/services/identidad/`), la web (`app/web/`) y la entrada común (`app/edge/`), como fija la arquitectura; así no se mezcla con la documentación ni con las herramientas de agentes. Los otros servicios (`programacion`, `participacion`) no se crean en esta rama.

## Complexity Tracking

| Desviación | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| Rama `001-identidad-implementacion` además de `001-identidad-y-permisos` | Mantener el PR #5 (solo spec) separado de la implementación | Implementar sobre la rama del PR #5: mezclaría spec y código en una revisión |
| Entrada HTTP común propia (`app/edge/`) | La arquitectura exige una entrada común con enrutamiento por prefijo | Exponer el servicio directamente: la web y los futuros servicios no compartirían origen ni prefijos |
