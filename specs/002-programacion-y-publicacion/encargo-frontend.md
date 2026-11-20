# Encargo de interfaz: spec 002 (Agenda, ficha, «¿Qué hay ahora?» y panel editorial)

Encargo para el agente de diseño (Antigravity, `agy`). El backend del spec 002 está **terminado y probado**. Falta **solo la interfaz**. Copia el bloque de abajo como prompt.

---

```text
Eres el agente de diseño de VIVART (Festival Internacional de Artes Vivas de Loja). Tu tarea es diseñar e implementar
la INTERFAZ del spec 002 «Programación, agenda y publicación» con calidad 10/10: hermosa, clara, rápida, accesible y
excelente tanto en celular como en el navegador de una computadora. El backend ya existe y está probado: NO lo cambies.

## 0. Antes de empezar (obligatorio)
1. Lee y respeta AGENTS.md (reglas del equipo) y .specify/memory/constitution.md.
2. Trabaja SOLO en la rama 002-programacion-y-publicacion. No crees otras ramas. Sin coautoría ni créditos de IA en commits o PR.
   No crees copias del repositorio ni carpetas de prueba.
3. Lee, en este orden:
   - specs/002-programacion-y-publicacion/spec.md            (qué debe pasar: historias, FR y SC)
   - specs/002-programacion-y-publicacion/contracts/programacion.openapi.yaml   (la API que vas a consumir)
   - specs/002-programacion-y-publicacion/contracts/formato-carga.md
   - specs/002-programacion-y-publicacion/data-model.md       (estados editoriales)
   - context/design/navegacion.md                             (navegación y diferencias con los mockups)
   - context/requirements/no-funcionales.md                   (RNF-01, RNF-02, RNF-03, RNF-08)
   - context/assets/mockups/Agenda VIVART_ Vive el Festival.png  (solo referencia visual: si contradice un requisito, gana el requisito)
4. Levanta la demo y carga datos de ejemplo (ficticios) para diseñar con contenido real de la API:
     cd app
     node preparar-entorno.mjs
     docker compose up -d --build
     docker compose exec -e MAIL_TRANSPORT=console identidad node bin/crear-primer-administrador.js --email admin@vivart.test
     docker compose exec programacion node bin/cargar-ejemplo.js
   Abre http://localhost:8080, activa el administrador con el enlace impreso, y desde «Roles» crea cuentas con rol
   editor y publicador para probar el panel. Los correos de la demo están en /demo/buzon.

## 1. Restricciones técnicas (no negociables)
- La web vive en app/web/ (index.html, styles.css, app.js): JavaScript vanilla con módulos ES, SIN framework, SIN paso
  de compilación y SIN dependencias. Puedes dividir app.js en varios módulos dentro de app/web/ (p. ej. app/web/js/...).
- La entrada común (app/edge/server.js) sirve app/web/ con la política CSP "default-src 'self'": nada de CDN, fuentes de
  Google, scripts o estilos en línea (inline) ni atributos style/onclick en el HTML. Si quieres una tipografía, alójala en
  app/web/ (por ejemplo app/web/fuentes/) con licencia libre y documenta la licencia.
- Prohibido innerHTML, outerHTML, insertAdjacentHTML y document.write: construye el DOM con el ayudante h() que ya existe
  (o uno equivalente). Prohibido usar geolocalización. La prueba app/edge/test/edge.test.js lo comprueba: si creas
  subcarpetas en app/web/, actualiza esa prueba para que recorra también las subcarpetas (sin relajar sus reglas).
- Las pantallas existentes del spec 001 (registro, ingresar, verificar, recuperar, restablecer, activar, perfil, retorno,
  panel de roles e historial, demo y buzón) deben seguir funcionando y quedar con el mismo diseño nuevo.
- La API se llama con el prefijo /api/programacion (y /api/identidad para la sesión). Las peticiones que cambian estado
  envían Content-Type: application/json; la cookie de sesión viaja sola (credentials: 'same-origin').
- La navegación es del lado del cliente; la entrada devuelve index.html para cualquier ruta, así que los enlaces directos
  funcionan. La ficha pública vive en /actividad/{id} (el campo shareUrl de la API).
- NO modifiques nada de app/services/, app/edge/server.js, app/docker-compose.yml ni los contratos. Si la API te falta
  algo, NO lo inventes en el cliente: anótalo en specs/002-programacion-y-publicacion/pendientes-frontend.md y avísalo.

## 2. Reglas de producto que la interfaz DEBE respetar
- Nunca inventes ni deduzcas datos (RNF-08): lo que llega null o aparece en `pending` se muestra como «Por confirmar»
  (descripción, organización, duración, precio, acceso, categoría). No muestres duraciones, precios ni cupos que no vengan.
- Precio y acceso: usa `access.label` («Gratuita», «De pago: USD 5,00», «De pago: precio por confirmar», «Acceso por
  confirmar»). Una actividad sin precio NO es gratuita.
- NO hay venta en este spec: no pongas botones de comprar ni «Agregar al carrito» (eso es del spec 005). Publicar no activa ventas.
- Estado temporal de cada función (`timeStatus`): upcoming = «Próxima», in_progress = «En curso», start_passed =
  «Hora de inicio pasada», finished = «Terminada», cancelled = «Cancelada». Nunca muestres «En curso» o «Terminada» si la
  API no lo dice (RC-03).
- Las funciones canceladas siguen visibles en la ficha, marcadas y con su aviso; no aparecen en «¿Qué hay ahora?».
- Muestra siempre los avisos públicos (`notices`) de la ficha y la nota «Programación sujeta a cambios» (subjectToChange).
- La hora es la de Loja: usa `reference` de la API (date, time) para «hoy» y «ahora»; no uses el reloj del navegador.
  Si `reference.fixed` es true, muestra discretamente que el reloj está fijado (demo).
- Los estados no se comunican solo con color: siempre con texto o icono con etiqueta.

## 3. Pantallas públicas (sin sesión; celular primero)
Barra inferior en celular con Mapa · Agenda · Pasaporte (navegacion.md). Mapa y Pasaporte son de otros specs: deja la
pestaña con un estado «Próximamente» honesto, sin inventar contenido. En escritorio la navegación pasa a la cabecera.
1. Agenda (GET /agenda): buscador por título, artista u organización; filtros combinables por fecha (selector de día),
   categoría (GET /categories), sede (GET /venues) y modalidad de acceso (free, paid, unconfirmed); limpiar filtros;
   tarjetas con título, artistas, categoría, próxima fecha (nextDate), sedes, etiqueta de acceso, «Exposición
   permanente» si isPermanent y un distintivo si hasNotices. Estados vacío («Aún no hay actividades publicadas»), sin
   resultados y de error. Los filtros se reflejan en la URL para poder compartirlos.
2. «¿Qué hay ahora?» (GET /now) dentro de la Agenda: secciones «Abierto ahora» (openSlots), «En curso» (inProgress),
   «Próximas hoy» (upcoming) y «Ya empezaron» (startPassed, con el rótulo «Hora de inicio pasada»).
3. Ficha (GET /activities/{id}, ruta /actividad/{id}): título, artistas, organización, categoría, descripción, acceso,
   duración, lista de funciones (fecha, hora, sede, estado temporal), franjas de apertura (días u rango, días de la semana,
   horario; horario partido = varias franjas), avisos, «Por confirmar» donde corresponda, botón Compartir (Web Share API
   si existe; si no, copiar enlace) y 404 amable si no existe o no está publicada. Sede de tipo recorrido (kind=route):
   muestra routeDescription.

## 4. Panel editorial (con sesión; escritorio primero, usable en celular)
Usa /api/identidad/me para saber quién es y sus roles. Muestra solo lo que su rol puede hacer, pero confía en el servidor:
si responde 403, muestra su `message` junto a la acción (dice el rol que falta) sin revelar nada más.
1. Bandeja (GET /panel/activities, filtros por state y mine): editor ve las suyas; publicador y administrador, todas.
   Estados con etiqueta: Borrador, En revisión, Devuelta, Publicada, Publicada con cambios pendientes, Archivada.
2. Editor de actividad (POST /panel/activities, GET y PUT .../draft):
   - Campos: título, artistas (lista), organización, descripción, categoría, duración, modalidad de acceso y precio.
   - Funciones (fecha, hora de inicio, hora de fin opcional, duración opcional, sede) y franjas (sede; lista de fechas
     o rango desde–hasta con días de la semana; abre y cierra). Varias franjas por día (horario partido).
   - Guardar borrador aunque esté incompleto. Muestra `missingForSubmit` como lista de lo que falta para enviar.
   - Envía siempre la `version` recibida. Si responde 409 version_conflict, avisa que otra persona guardó y ofrece recargar.
   - Si responde 409 not_editable (en revisión), deja el formulario en solo lectura con la explicación.
   - Vista previa (GET .../preview) con el MISMO componente de la ficha pública.
   - Enviar a revisión (POST .../submit): con 422 muestra cada mensaje de `fields` junto a su campo (claves como
     "functions[0].startTime"), enfoca el primer error y anúncialo a lectores de pantalla.
   - Si está «Devuelta», muestra las observaciones (reviewNotes) destacadas arriba.
3. Revisión (publicador o administrador): devolver con observaciones obligatorias (POST .../return), publicar
   (POST .../publish). Si la publicación responde 422 notice_required, abre un diálogo accesible que pida motivo interno
   (reason) y aviso público (notice), explique qué cambia (`changes`) y reintente. Descartar revisión pendiente
   (POST .../discard-revision). Confirmación antes de acciones sensibles (RNF-02).
4. Cambios con aviso (publicador o administrador) en cada función publicada: «Reprogramar» y «Cancelar». Antes de
   confirmar, consulta GET /panel/functions/{id}/impact y muestra entradas vendidas y pedidos pendientes; si
   available es false, muestra «No se pudo consultar el servicio de entradas» (NUNCA muestres 0). Formulario con motivo
   interno y aviso público obligatorios; reprogramar permite fecha, hora, hora de fin y sede (cambiar de sede es reprogramar).
5. Administrador: catálogos (ediciones, categorías, sedes con tipo lugar o recorrido y descripción del recorrido;
   POST y PUT /panel/...), reasignar (POST .../reassign), archivar (POST .../archive; si 409 has_scheduled_functions,
   explica que debe cancelar antes esas funciones y enlázalas), borrar borradores nunca publicados (DELETE; si 409
   already_published, sugiere archivar) e historial de la actividad (GET .../history).
6. Carga desde el PDF (administrador): subir un archivo JSON (léelo en el navegador y envíalo como {filename, file}),
   tabla de vista previa con posición, clave, página de origen, título, errores y posible duplicado; seleccionar
   registros (deshabilita los que tienen errores), aceptar (POST .../accept) y ver el resultado (loaded, skipped_existing,
   skipped_error). Después, publicar solo lo que se confirme explícitamente (POST /panel/publish-batch) con una
   confirmación clara. Enlaza el formato (contracts/formato-carga.md) y ofrece descargar el ejemplo (app/services/programacion/ejemplos/lote-ejemplo.json; cópialo a app/web/ si hace falta servirlo).

## 5. Calidad visual y accesibilidad
- Diseño 10/10: identidad visual propia de un festival de artes vivas (color con carácter, tipografía expresiva pero
  legible, buena jerarquía, ritmo y espacio, microinteracciones sobrias). Modo claro siempre, como en los mockups (se descartó el modo oscuro automático por decisión del equipo el 2026-11-20).
  Respeta prefers-reduced-motion. Usa variables CSS (tokens) para color, espacio, radio y tipografía.
- Responsivo y adaptativo de verdad: celular (360 px) sin desplazamiento horizontal y con zonas táctiles de al menos
  44 px; tableta; escritorio que aprovecha el ancho (Agenda en cuadrícula, panel con columnas). Tablas que en celular se
  vuelven tarjetas.
- Accesibilidad (RNF-03): todo usable solo con teclado, foco visible, orden lógico, etiquetas comprensibles, errores junto
  al campo, avisos en una región viva, contraste suficiente, diálogos accesibles (foco atrapado, Escape, devolver el foco),
  el foco va al contenido al cambiar de pantalla.
- No uses la ilustración de Alforjita como avatar (no hay autorización).
- Rendimiento: sin bloqueos; muestra estados de carga (esqueletos) y de error con reintento.

## 6. Cómo comprobar y entregar
1. cd app && docker compose up -d db db-preparar && npm test        (todo debe pasar; no rompas pruebas existentes)
2. Recorre a mano, con la demo y el ejemplo cargado: Agenda con cada filtro, «¿Qué hay ahora?», una ficha compartida en
   otra pestaña sin sesión, y el flujo editor → enviar con errores → completar → devolver → corregir → publicar →
   reprogramar → cancelar → archivar, y la carga del ejemplo. Hazlo con teclado y a 360 px.
3. Anota el resultado en specs/002-programacion-y-publicacion/quickstart.md («Resultados registrados») y añade las
   tareas de interfaz que hiciste al final de specs/002-programacion-y-publicacion/tasks.md, marcadas.
4. Commits pequeños con mensajes en español estilo «feat(002): ...». Abre un PR desde 002-programacion-y-publicacion a
   main, revisa que el CI pase (reglas, pruebas, contenedores, SonarCloud) y corrige lo que falle. No fusiones el PR.
```
