# Research: Rutas culturales e insignias

**Feature**: `007-rutas-e-insignias`  
**Date**: 2026-11-22  
**Spec**: [spec.md](spec.md)

## 1. Asignación arquitectónica y límites de servicios

### 1.1 Servicio responsable
Siguiendo la **Vista 2 (Servicios)** de la arquitectura del proyecto VIVART (`docs/arquitectura/02-servicios.md`):
- El **Servicio de participación** (`app/services/participacion/`) es el dueño único de las interacciones ciudadanas con el festival: órdenes, entradas, control de acceso, Pasaporte Vivo, sellos, **rutas culturales e insignias**.
- No se crea un microservicio adicional. El servicio `participacion` ya cuenta con persistencia PostgreSQL, integración HTTP con `identidad` y `programacion`, y la infraestructura para el Pasaporte Vivo implementada en el spec 006.

### 1.2 Interacción con otros servicios
1. **Servicio de Identidad (`app/services/identidad/`)**:
   - Sesión de usuario: valida la cookie de sesión o bearer token para identificar al usuario (`user_id`).
   - Permisos administrativos: verifica que el actor cuente con rol `administrador` (o acción de permiso `panel.routes`) para crear, editar o publicar rutas en `/panel/routes`.
2. **Servicio de Programación (`app/services/programacion/`)**:
   - Consulta de funciones elegibles: al crear/editar una ruta o al calcular el estado público de una ruta, se consultan las funciones publicadas para validar que:
     - Tengan Pasaporte habilitado (`passport_enabled = true`).
     - No sean franjas horarias de apertura (FR-002: solo funciones con fecha y hora específicas).
     - Se conozca su estado vigente (`active` o `cancelled`) para detectar cancelaciones.

---

## 2. Decisiones técnicas de diseño

### Decisión 1: Estructura de almacenamiento en PostgreSQL
En la base de datos `participacion`, se añaden tres nuevas tablas relacionales y sus índices correspondientes:
- `routes`: almacena la definición de la ruta, su meta, estado (`draft` o `published`), y los metadatos de la insignia asignada (título, descripción, icono y color).
- `route_functions`: tabla de unión muchos a muchos que asocia cada ruta con sus funciones elegibles (`route_id`, `function_id`).
- `user_badges`: almacena las insignias desbloqueadas por cada usuario (`user_id`, `route_id`), con restricción `UNIQUE (user_id, route_id)` para garantizar atomicidad e idempotencia estricta ante concurrencia.

### Decisión 2: Algoritmo de cálculo de progreso
Para una persona con identificador `user_id` y una ruta `route_id`:
```sql
SELECT COUNT(DISTINCT s.function_id) AS distinct_stamps
FROM stamps s
JOIN route_functions rf ON s.function_id = rf.function_id
WHERE s.user_id = $1 AND rf.route_id = $2;
```
- **Sellos distintos**: Como cada registro en `stamps` ya es único por `(user_id, function_id)`, la intersección con `route_functions` garantiza que solo sumen sellos de funciones elegibles para esa ruta.
- **Sellos no elegibles**: Cualquier sello de otra función que no esté en `route_functions` no se incluye.
- **Funciones canceladas**: Si una función elegible se cancela, su registro en `stamps` para usuarios que ya la canjearon se mantiene intacto (decisión R-06). Por tanto, la consulta continúa sumando ese sello al progreso personal del usuario (FR-020).
- **Denominador**: El progreso se entrega como `{ current: distinct_stamps, goal: route.goal, formatted: "${distinct_stamps} de ${route.goal}" }`. El denominador pertenece exclusivamente a la ruta y nunca se proyecta al pasaporte general (M-01).

### Decisión 3: Desbloqueo inmediato y concurrencia de insignias
- **Punto de disparo principal**: En el momento de canje exitoso de un sello (`POST /passport/claims`):
  1. Se registra el sello en la tabla `stamps`.
  2. En la misma transacción, se identifican las rutas publicadas que contienen esa función (`function_id`).
  3. Para cada ruta elegible donde el usuario aún no posea la insignia:
     - Se calcula si `distinct_stamps >= route.goal`.
     - Si se cumple la meta, se inserta en `user_badges` con `ON CONFLICT (user_id, route_id) DO NOTHING`.
     - Si la inserción fue efectiva (rowCount = 1), se registra en `history` (`entity_type: 'badge'`, `action: 'unlock'`) y se adjunta el objeto `badgeUnlocked` en la respuesta JSON del canje para felicitación instantánea en la interfaz.
- **Mecanismo de reconciliación idempotente**: Al consultar el progreso (`GET /passport/routes` o `GET /passport/routes/:id`), si `distinct_stamps >= route.goal` y no existiese la fila en `user_badges`, se desbloquea atómicamente.

### Decisión 4: Detección dinámica de «Ruta en revisión»
- Una ruta publicada tiene un conjunto de funciones elegibles $F$ y una meta $M$.
- Al consultarla, se comprueba el estado de cada $f \in F$ con el servicio de programación:
  - $F_{\text{activas}} = \{ f \in F \mid f.\text{status} \neq \text{'cancelled'} \}$
  - Si $|F_{\text{activas}}| < M$: la ruta se clasifica con estado derivado `in_review: true`.
- **Comportamiento ante «Ruta en revisión»**:
  - En la vista pública y en el panel se despliega el cartel / badge «Ruta en revisión».
  - Las funciones canceladas se muestran con su indicador de cancelación y dejan de figurar como disponibles para nuevos canjes.
  - La meta $M$ **nunca** se reduce de forma automática (FR-020).
  - Ningún progreso ni insignia ganada se retira.
  - El administrador puede ingresar a `/panel/rutas` y editar la ruta (por ejemplo, incorporando una nueva función elegible activa) para que $|F_{\text{activas}}| \ge M$, con lo cual la ruta deja de estar en revisión automáticamente.

### Decisión 5: Plantillas visuales oficiales de VIVART (sin subida de archivos)
- Para cumplir estrictamente con RF-28, FR-004 y FR-021:
  - La ruta no admite subida de archivos binarios ni URLs externas.
  - El administrador elige:
    - `title`: Título de la ruta (máx. 120 caracteres).
    - `description`: Descripción de la ruta (máx. 500 caracteres).
    - `badge_title`: Nombre de la insignia (máx. 80 caracteres).
    - `badge_description`: Descripción del logro de la insignia (máx. 280 caracteres).
    - `badge_icon`: Catálogo cerrado de iconos SVG temáticos de VIVART: `['teatro', 'musica', 'danza', 'artes-vivas', 'patrimonio', 'estrella', 'brujula']`.
    - `badge_color`: Catálogo cerrado de acentos de la paleta oficial: `['violeta', 'atardecer', 'terracota', 'esmeralda']`.
  - La interfaz renderiza las insignias mediante el componente SVG oficial con los colores del tema VIVART, garantizando contraste y accesibilidad.

### Decisión 6: Interfaz de usuario (Público y Panel)
- **Web pública (`app/web/js/pasaporte.js`)**:
  - Sustituye el bloque estático provisional `seccionRutas()` («Próximamente») por:
    1. Sección `Mis insignias`: listado de insignias obtenidas con su icono temático, título, fecha de desbloqueo y enlace a la ruta.
    2. Sección `Mi pasaporte`: sellos individuales y total sin denominador global (M-01).
    3. Sección `Rutas culturales`: tarjetas de rutas publicadas con su meta, denominador «X de Y» (si hay sesión) o llamada a ingresar.
  - Nueva vista de detalle `/pasaporte/ruta/:id`: muestra la ficha de la ruta, su estado («Ruta en revisión» si aplica), la lista de funciones elegibles detallando cuáles tienen sello obtenido, cuáles están pendientes y cuáles están canceladas.
- **Panel interno (`app/web/js/panel-rutas.js`)**:
  - Ruta `/panel/rutas`: accesible exclusivamente para el rol `administrador` (FR-005).
  - Lista todas las rutas (publicadas y borradores), destacando aquellas en revisión.
  - Formulario de creación y edición: selector de funciones elegibles (filtrando aquellas con `passport_enabled`), campo numérico de meta (validando que $\text{meta} \le \text{total\_elegibles}$), selector de icono y color de insignia, y botón para publicar o guardar borrador.

---

## 3. Mapeo de pruebas y criterios de éxito

| Criterio de Éxito | Descripción | Prueba asociada |
|---|---|---|
| **SC-001** | Visitante sin cuenta consulta rutas públicas, funciones, meta e insignia; 0 no publicadas visibles | Prueba de integración `GET /passport/routes` sin token y verificación de exclusión de borradores |
| **SC-002** | Progreso cuenta exactamente sellos distintos de funciones elegibles (0 duplicados, 0 no elegibles) | Prueba unitaria y de repositorio calculando progreso con sellos repetidos y funciones ajenas |
| **SC-003** | «Mi pasaporte» muestra 0 denominadores globales; 100% de rutas muestra el suyo | Prueba de interfaz web validando renderizado de total vs «X de Y» |
| **SC-004** | Al alcanzar meta, 100% obtiene insignia exactamente 1 vez (incluso con 2 peticiones concurrentes) | Prueba de concurrencia contra PostgreSQL ejecutando dos claims simultáneos que cruzan la meta |
| **SC-005** | Editar una ruta retira 0 insignias ya ganadas | Prueba de integración: editar funciones/meta tras otorgar insignia y verificar persistencia en `user_badges` |
| **SC-006** | 0 franjas de apertura son elegibles ni suman al progreso | Prueba de validación al crear ruta rechazando franjas, y asegurando que solo funciones con fecha/hora suman |
| **SC-007** | 100% de metas mayores a funciones elegibles son rechazadas | Prueba de validación en `POST /panel/routes` y `PUT /panel/routes/:id` con `goal > functions.length` |
| **SC-008** | 0 usuarios sin rol administrador crean o publican rutas | Prueba de autorización 403 Forbidden para visitantes o usuarios sin rol |
| **SC-009** | 0 usuarios ven el progreso o insignias de otra cuenta | Prueba de aislamiento de datos en `/passport/routes` y `/passport/badges` |
| **SC-010** | 100% de cambios en rutas e insignias quedan en el historial (RC-06) | Verificación de inserciones en la tabla `history` de solo anexar |
| **SC-011** | 100% de rutas cuya meta no se puede completar tras cancelación se marcan «Ruta en revisión» y 0 metas se reducen solas | Prueba de cálculo dinámico simulando cancelación de función y verificando bandera `in_review: true` sin mutación de `goal` |
| **SC-012** | Tras cancelación, sellos obtenidos siguen contando y 0 insignias se retiran | Prueba de progreso con sellos de función cancelada |
| **SC-013** | 100% de rutas se publican con plantillas visuales comunes sin subir archivos | Verificación de esquema y contrato: no hay campos multipart ni binarios para rutas e insignias |
