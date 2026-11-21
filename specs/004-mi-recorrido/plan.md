# Implementation Plan: Mi recorrido y alternativas

**Branch**: `004-mi-recorrido` | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-mi-recorrido/spec.md`

## Summary

Mi recorrido **no crea un nuevo servicio de backend ni tablas en la base de datos**. Cumple la decisión **P-05** y la arquitectura compartida del proyecto en cuatro vistas: el estado del recorrido reside 100% en el navegador (`localStorage`) del visitante, sin exigir cuenta ni sincronizar con el servidor.

Este spec implementa en el frontend web (`app/web/`):
- **Módulo de lógica y persistencia (`app/web/js/recorrido.js`)**:
  - Almacenamiento local idempotente con snapshot completo de datos (`id`, `title`, horarios, sede, avisos).
  - Algoritmo de detección de cruces de horario en intervalos conocidos en la misma fecha (RC-02).
  - Algoritmo de búsqueda de alternativas futuras en la misma sede (FR-012, FR-013, FR-017).
  - Operaciones de guardar, quitar y sustitución atómica de alternativas (FR-015, FR-021).
  - Sincronización con `/api/programacion/agenda` y `/api/programacion/activities/{id}` para cambios, cancelaciones y archivado.
  - Consulta a `/api/participacion/sale-status` para funciones agotadas (`sold_out`) con degradación suave.
- **Interfaz de usuario (`app/web/js/recorrido-ui.js` / `app/web/app.js`)**:
  - Pantalla principal `/recorrido` con vista cronológica por fecha y horario.
  - Indicadores visuales de advertencia de cruces (no bloqueantes).
  - Avisos visibles de reprogramación, cancelación o actividad archivada.
  - Modal/panel interactivo de alternativas en la misma sede con opciones «Sustituir» y «Conservar ambas».
  - Estado vacío accesible con enlace para volver a la Agenda.
  - Botones «Guardar en mi recorrido» / «Quitar» en fichas de actividad y tarjetas de la Agenda con la leyenda «Guardar no reserva cupo».
- **Estilos (`app/web/styles.css`)**:
  - Integración en el sistema visual existente (modo claro, paleta violeta `#3b0f66` y atardecer, tipografías Bricolage Grotesque y Figtree).

---

## Technical Context

**Language/Version**: JavaScript (módulos ES nativos) sobre Node.js 24 en navegador web moderno.

**Primary Dependencies**: Ninguna dependencia de terceros en frontend (módulos ES propios, sin frameworks ni empaquetadores), respetando la CSP del proyecto (`default-src 'self'`). Para pruebas unitarias, `node:test` y `node:assert`.

**Storage**: Almacenamiento local del navegador (`localStorage`), bajo la clave `vivart_recorrido_v1`. Cero almacenamiento en base de datos de servidor.

**Testing**: Pruebas unitarias de la lógica del recorrido con `node:test` (`test/unit/recorrido.test.js`), probando algoritmos de cruces (solapamientos, tangentes, horas no confirmadas), ordenamiento cronológico, búsqueda de alternativas, persistencia en storage y sustitución.

**Target Platform**: Navegadores móviles (celular primero) y de escritorio.

**Project Type**: Módulo frontend web interactivo dentro de la interfaz existente (`app/web/`).

**Performance Goals**: Carga inmediata desde `localStorage`; sincronización asíncrona de fondo sin bloquear el hilo principal de la interfaz ni la navegación.

**Constraints**:
- Privacidad y anonimato (RNF-05): No pide cuenta ni almacena datos del usuario en el servidor.
- No inventar datos (RNF-08): Si una función no tiene hora de fin, nunca se calcula cruce ni se marca como terminada.
- No geolocalización: No calcula distancias ni usa GPS para sedes vecinas en el MVP.
- Tolerancia a fallos: Si el servicio de participación o la red fallan, el recorrido se muestra con degradación suave sin romperse.
- Modo claro y paleta oficial del festival (violeta y atardecer).

**Scale/Scope**: 1 ruta nueva de frontend (`/recorrido`), 1 módulo de negocio (`recorrido.js`), integración en componentes de ficha y agenda, y suite de pruebas unitarias.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| **I. Desarrollo guiado por especificaciones** | **Cumple.** Spec clarificado y validado en `spec.md`; plan técnico y artefactos de diseño completos antes de escribir tareas e implementación. |
| **II. El contexto es la fuente de verdad** | **Cumple.** Sigue RF-16 a RF-18, RC-02, RC-03, RC-06, RC-07 y decisiones P-05 y R-04. No duplica catálogos y no inventa datos de programación. |
| **III. Máximo ocho specs** | **Cumple.** Spec 004 de 8 en su rama correspondiente `004-mi-recorrido`. |
| **IV. Arquitectura compartida, sin monolito modular** | **Cumple.** Mi recorrido no crea servicio nuevo ni base de datos nueva; vive en el navegador y consume las APIs síncronas existentes de Programación y Participación. |
| **V. Cada spec es verificable** | **Cumple.** Todos los criterios de éxito (SC-001 a SC-011) tienen escenarios de validación y mapa de pruebas documentado en `research.md` y `quickstart.md`. |
| **Flujo: una rama por spec** | **Cumple.** Trabajo confinado en `004-mi-recorrido`. |
| **Sin coautoría de IA; secretos fuera de Git** | **Cumple.** Sin metadatos de autoría de IA y sin secretos en código ni commits. |

**Re-evaluación tras el diseño (Fase 1):** Aprobado sin cambios. No se agregaron servicios, dependencias externas ni bases de datos.

---

## Project Structure

### Documentation (this feature)

```text
specs/004-mi-recorrido/
├── plan.md              # Este plan de implementación
├── research.md          # Decisiones técnicas y mapa de pruebas contra criterios de éxito
├── data-model.md        # Estructura del storage local, modelo de cruces y estados
├── quickstart.md        # Guía de validación paso a paso de los escenarios
├── contracts/
│   ├── consumo-apis.md       # Contrato de consumo de APIs públicas (Programación y Participación)
│   └── interfaz-recorrido.md # Contrato de funciones y API del módulo recorrido.js
├── checklists/
│   └── requirements.md
└── tasks.md             # Tareas de implementación (/speckit-tasks)
```

### Source Code (repository root)

```text
app/
├── web/
│   ├── js/
│   │   ├── recorrido.js          # Lógica de dominio, storage, cruces y alternativas
│   │   ├── recorrido-ui.js       # Componente de la pantalla /recorrido y modales
│   │   ├── ficha-componente.js   # Botón de guardar/quitar en ficha de actividad
│   │   └── publico.js            # Botón de guardar/quitar y acceso a Mi recorrido en Agenda
│   ├── app.js                    # Registro de ruta /recorrido y enlace en menú
│   ├── styles.css                # Estilos visuales de Mi recorrido y advertencias de cruce
│   └── test/
│       └── recorrido.test.js     # Pruebas unitarias de lógica de recorrido y cruces
```

---

## Complexity Tracking

> **No hay violaciones constitucionales.** No aplica justificación de complejidad adicional.
