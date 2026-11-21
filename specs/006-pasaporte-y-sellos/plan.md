# Implementation Plan: Pasaporte Vivo y sellos

**Branch**: `006-pasaporte-y-sellos` | **Date**: 2026-11-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-pasaporte-y-sellos/spec.md`

## Summary

El Pasaporte **no crea un servicio nuevo**. La arquitectura (vista 2) asigna los QR y los sellos al **servicio de participación** (`app/services/participacion`), que ya existe por el spec 005. Este spec lo amplía:

- **QR de Pasaporte por función:**
  - un solo QR vigente por función, con enlace `/pasaporte/canje/{ref}` y un `ref` aleatorio derivado de un secreto del servidor;
  - estados activo, desactivado y reemplazado;
  - ventana de canje obligatoria para activarlo (M-10).
- **Canje:**
  - el servidor comprueba la sesión con correo verificado, el QR vigente, la función publicada y no cancelada, que la función no haya cambiado desde que se fijó la ventana (P-03) y la ventana;
  - un solo sello por persona y función, garantizado por una restricción única en la base (RC-05);
  - si el sello ya existe, devuelve el mismo.
- **Colección:** «Mi pasaporte» con el total de sellos (M-01) y el detalle de cada sello. Usa los datos **vigentes** de la función, consultados a programación, más su aviso de cambio o cancelación.
- **Contenido del sello versionado (M-11):**
  - texto breve de hasta 280 caracteres de texto plano e imagen opcional con las reglas de M-12;
  - cada sello apunta a la versión vigente al emitirse;
  - las imágenes no se borran.
- **Panel del administrador:** generar, activar, desactivar y reemplazar el QR; fijar la ventana; editar el contenido; ver el QR con descarga en SVG y su enlace.
- **Interfaz web:** pestaña Pasaporte (colección y rutas «Próximamente»), página de canje `/pasaporte/canje/{ref}` con retorno tras iniciar sesión, detalle del sello y panel `/panel/pasaporte`.

La función nunca se copia: participación consulta su estado vigente a programación (API interna existente), igual que en el 005.

**P-14 sigue pendiente.** Este plan usa la opción más simple: datos vigentes de la función y ninguna copia en el sello. Si el equipo elige guardar el recuerdo del momento del canje, la ampliación está descrita en `research.md` (decisión 9) y en `data-model.md`.

## Technical Context

**Language/Version**: JavaScript (módulos ES) sobre Node.js 24

**Primary Dependencies**: las del servicio de participación (Fastify 5, `pg`, `qrcode` para el QR en SVG). Criptografía y pruebas con módulos integrados (`node:crypto`, `node:test`). En la web, módulos ES propios sin frameworks

**Storage**: PostgreSQL 17, base `participacion` del propio servicio. Cuatro tablas nuevas (`passport_qrs`, `stamp_contents`, `stamp_images`, `stamps`) creadas de forma idempotente al arrancar, sin borrar datos

**Testing**: `node:test` con `inject` de Fastify, identidad y programación simuladas (como en el 005), y pruebas de concurrencia reales contra PostgreSQL para el sello único. Una prueba de punta a punta en `app/edge` con los tres servicios. La web se comprueba en Chrome a 360 px y a 1440 px

**Target Platform**: servidor Node.js 24 en contenedor Linux. Público en celular primero (se escanea en la sede) y panel en escritorio primero

**Project Type**: ampliación de un servicio web HTTP existente, más pantallas en la web común

**Performance Goals**: sin metas en el contexto. El canje es una consulta a programación y una inserción con restricción única

**Constraints**:
- Sello único ante solicitudes simultáneas (RNF-06).
- Toda acción protegida verificada en el servidor (RNF-04).
- Si no se puede verificar, se muestra «no confirmado» (RNF-07).
- Historial de solo anexar (RC-06).
- Reloj común en hora de Loja (RC-07).
- No inventar contenido del sello ni horarios: ventana sin valor por defecto (M-10).
- Imágenes sin metadatos, validadas en el servidor (M-12).
- Cuerpos JSON de hasta 2 MB.

**Scale/Scope**: MVP académico, con decenas de funciones con Pasaporte y cientos de sellos. 3 endpoints de la persona, 1 público, 8 del panel y 4 tablas nuevas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Desarrollo guiado por especificaciones | **Cumple.** El spec está clarificado (dos sesiones del 2026-11-20); este plan precede a las tareas y al código |
| II. El contexto es la fuente de verdad | **Cumple.** Las decisiones están en `context/` (M-10 a M-13). P-14 **no se resuelve**: se usa la opción sin copia y se documenta la ampliación. No se inventan ventanas ni contenido |
| III. Máximo ocho specs | **Cumple.** Solo spec 006 |
| IV. Arquitectura compartida, sin monolito modular | **Cumple.** Se amplía el servicio de participación, que la vista 2 asigna a los specs 005, 006 y 007. Consulta a programación e identidad solo por HTTP; no lee tablas ajenas; sin broker |
| V. Cada spec es verificable | **Cumple.** Cada SC tiene su prueba (mapa en `research.md`), incluida la concurrencia del sello único |
| Flujo: una rama por spec | **Cumple.** Todo en `006-pasaporte-y-sellos`, incluido el cambio compatible en identidad |
| Sin coautoría de IA; secretos fuera de Git | **Cumple.** El `ref` del QR se deriva de `TICKET_KEY`, que ya está en `app/.env` local; no hay secretos nuevos |

**Cambios compatibles en otros servicios** (detalle en [contracts/cambios-en-otros-servicios.md](contracts/cambios-en-otros-servicios.md)):

- **Identidad (001):** acción nueva `passport.manage` (solo administrador). No cambia ninguna acción existente. La acción pendiente `canje` y su retorno a `/pasaporte/canje/{ref}` ya existen.
- **Programación (002):** ninguno. Se usa `GET /internal/functions?ids=` y `GET /internal/functions/{id}`, que ya devuelven fecha, hora, sede, estado y último aviso.
- **Participación:** variable `PUBLIC_BASE_URL` para la dirección que lleva el QR impreso, la misma que ya usa identidad para los enlaces de correo (P-12).

**Re-evaluación tras el diseño (Fase 1):** sin cambios. No se añadió servicio, broker ni acceso a datos ajenos.

## Project Structure

### Documentation (this feature)

```text
specs/006-pasaporte-y-sellos/
├── plan.md               # este archivo
├── research.md           # decisiones técnicas y mapa de pruebas
├── data-model.md         # tablas, estados, reglas y ampliación prevista para P-14
├── quickstart.md         # cómo probarlo
├── contracts/
│   ├── pasaporte.openapi.yaml           # API de canje, colección y panel
│   └── cambios-en-otros-servicios.md    # identidad y configuración
├── checklists/
│   └── requirements.md
└── tasks.md              # (/speckit-tasks)
```

### Source Code (repository root)

```text
app/
├── services/
│   ├── identidad/src/domain/policy.js        # acción passport.manage (administrador)
│   └── participacion/
│       ├── src/
│       │   ├── config.js                     # PUBLIC_BASE_URL
│       │   ├── db.js                         # tablas passport_qrs, stamp_contents, stamp_images, stamps
│       │   ├── domain/
│       │   │   ├── imagenes.js               # copia idéntica de la de programación (sin EXIF; sonar.cpd.exclusions)
│       │   │   ├── pasaporte.js              # NUEVO: canje, colección y detalle del sello
│       │   │   └── pasaporte-admin.js        # NUEVO: QR, ventana, contenido versionado y QR en SVG
│       │   ├── repositories/pasaporte.js     # NUEVO
│       │   └── http/routes.js                # rutas /passport/* y /panel/functions/{id}/passport*
│       └── test/
│           ├── imagenes-prueba.js            # copia de la de programación
│           ├── unit/pasaporte.test.js        # ref, ventana, clasificación del código, texto plano
│           └── integration/
│               ├── pasaporte-canje.test.js   # canje y rechazos, retorno, colección
│               ├── pasaporte-admin.test.js   # panel, permisos, contenido versionado, historial
│               └── pasaporte-concurrencia.test.js  # sello único con solicitudes simultáneas
├── edge/test/e2e-pasaporte.test.js           # canje real por la entrada común con los tres servicios
└── web/
    ├── js/pasaporte.js                       # NUEVO: Mi pasaporte, detalle del sello y canje
    ├── js/panel-pasaporte.js                 # NUEVO: panel del administrador
    ├── app.js                                # rutas /pasaporte, /pasaporte/canje/{ref}, /pasaporte/sello/{id}, /panel/pasaporte
    └── styles.css                            # estilos con los tokens existentes
```

**Structure Decision**: se amplía el servicio de participación, como prevé la arquitectura. La interfaz se desarrolla dentro de este plan, como en el 003 y el 005.

## Complexity Tracking

| Elección | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| Guardar la fecha, hora y sede de la función al confirmar la ventana | Es la forma de saber, sin que programación avise, que la función cambió y el canje debe quedar desactivado (P-03) | Que programación llame a participación al reprogramar (otra dependencia en sentido contrario) |
| Contenido del sello en versiones | Los sellos emitidos conservan su contenido (M-11) | Un único contenido editable (cambiaría los sellos ya emitidos) |
| `ref` derivado con HMAC y guardado como huella | El administrador puede volver a ver e imprimir el QR, y la base no guarda el enlace en claro | `ref` aleatorio guardado en claro (si se filtra la base, se pueden reclamar todos los sellos) |
| Copia de `imagenes.js` en participación | Cada servicio se despliega por separado y no comparten librería (decisión del proyecto, `sonar.cpd.exclusions`) | Paquete compartido entre servicios |
