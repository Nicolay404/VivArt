# Research: Mapa isométrico de sedes

Decisiones técnicas del plan. Todas son reversibles y no cambian requisitos. Las decisiones de producto están en el spec (Clarifications) y en `context/requirements/funcionales.md` (M-06 a M-09, P-13).

## Decisiones

| # | Tema | Decisión | Por qué | Alternativas descartadas |
|---|---|---|---|---|
| 1 | Dónde vive | Se amplía `app/services/programacion`: ya es dueño de las sedes, las funciones publicadas y el historial | La arquitectura le asigna «sedes y datos del mapa» (specs 002, 003 y 008); el encargo pide no duplicar el catálogo | Un servicio de mapa aparte (tendría que copiar sedes y funciones o consultarlas en cada petición) |
| 2 | Permisos | Toda modificación de una sede exige la acción `catalog.manage` (administrador), ya definida en identidad, y se consulta en cada operación con fallo cerrado | FR-021; sin cambios en el contrato de identidad | Una acción nueva `venue.manage` (mismo rol, más cambios en otro spec) |
| 3 | Ilustración vigente | Constante del servicio (`domain/mapa.js`) con `id`, ruta del archivo en la web, ancho, alto y `provisional: true`. La entrega el endpoint `GET /map` | Cambiarla cuando llegue la definitiva (P-13) es reemplazar un archivo y una constante; la web no fija nada | Tabla de ilustraciones con subida desde el panel (más superficie para un archivo que cambia una vez) |
| 4 | Ilustración provisional | SVG propio (`app/web/img/mapa-provisional.svg`): manzanas isométricas genéricas con la paleta de `styles.css` y la leyenda visible «Ilustración provisional». No dibuja calles reales de Loja | FR-028 y P-13; no se inventa geografía (RNF-08). SVG, como pide el equipo, porque se hace zoom | Usar el mockup `mapa-isometrico.jpeg` (no es Loja: solo es referencia de estilo) |
| 5 | Marcador | `{ illustrationId, x, y }` con `x` e `y` entre 0 y 1, relativos al ancho y alto de la ilustración. Si `illustrationId` no es el de la vigente, la sede se trata como **sin marcador** (sigue en la lista) | Independiente del tamaño de pantalla; al cambiar de ilustración no aparecen marcadores fuera de lugar. FR-020 y FR-022: no es una coordenada real | Píxeles absolutos (dependen del archivo) o latitud y longitud (prohibido: el marcador no es coordenada) |
| 6 | Marcadores antiguos | Un `marker` guardado por el 002 sin el formato nuevo se ignora al leer (sede sin marcador) y no se migra | No hay datos reales colocados; evita inventar una posición | Convertirlos (no hay ilustración de origen) |
| 7 | Destino verificado | Columnas `dest_lat`, `dest_lng` (numéricas), `dest_source` (texto) y `dest_verified_on` (fecha de Loja). Se guardan los cuatro juntos o ninguno. Latitud entre −90 y 90, longitud entre −180 y 180, fecha no posterior a hoy. Un recorrido (`kind = route`) no admite destino | FR-012, FR-023 y M-08; «verificado» = los cuatro presentes | Un enlace pegado por el administrador (no se puede validar ni garantizar que sea de Google Maps) |
| 8 | Enlace «Cómo llegar» | Lo arma el servidor: `https://www.google.com/maps/search/?api=1&query={lat},{lng}`, con seis decimales. En la web se abre en una pestaña nueva con `rel="noopener"`; la entrada ya envía `referrer-policy: no-referrer` | Formato documentado de Google Maps («Maps URLs»), sin clave de API; en celular abre la aplicación si está instalada. No pide la ubicación de la persona (RNF-05) | Inserción de un mapa de Google (exige clave, carga scripts externos y la CSP lo bloquea) |
| 9 | Accesibilidad | Tabla `venue_accessibility (venue_id, feature, status, source, verified_on, note)`. `feature` ∈ `step_free`, `accessible_toilet`; `status` ∈ `confirmed`, `unavailable`, `unconfirmed`. Sin fila = `unconfirmed`. `confirmed` y `unavailable` exigen fuente y fecha; la nota es libre y nunca entra en el filtro | FR-013, FR-018, FR-024 y SC-007 | Un JSON libre en `venues` (no se puede validar ni filtrar bien) |
| 10 | Foto | Tabla `venue_photos (venue_id, mime, bytes, alt, credit, sha256, updated_at)`. Se sube en JSON (`dataBase64`, `alt`, `credit`): solo JPEG, PNG o WebP comprobados por sus bytes iniciales, hasta 1 MB. La web reduce la foto en el navegador (máximo 1600 px de lado) antes de enviarla. Se sirve en `GET /map/venues/{id}/photo` con el tipo guardado y una versión (`?v=sha256`) en la URL | FR-025 y M-09. JSON mantiene la defensa CSRF actual (solo `application/json`); 1 MB en base64 cabe en el límite de 2 MB del servicio. La CSP solo admite imágenes del mismo sitio | Subida `multipart` (rompe la regla de solo JSON) o SVG (puede llevar código) |
| 11 | Funciones que cuentan | Solo filas de `functions` de actividades **publicadas, no archivadas y de una edición activa** (o sin edición), igual que la Agenda. Las franjas (`opening_slots`) no cuentan | FR-007 y M-06; misma regla de visibilidad que el spec 002 | Incluir franjas (contradice RF-12 y la constitución) |
| 12 | «Funciones del día» | Parámetro `day` (AAAA-MM-DD). Una sede pasa el filtro si tiene al menos una función `scheduled` ese día, haya empezado o no. «Hoy» lo da el reloj común; la web activa el filtro con `reference.date` | FR-007, FR-008, SC-003 y SC-004 | Calcular «hoy» en el navegador (reloj de cada persona; RC-07) |
| 13 | Días elegibles | `GET /map` devuelve las fechas distintas con alguna función `scheduled` según la regla 11, ordenadas | M-06: no cambia el modelo del 002 | Fechas de inicio y fin en `editions` (cambio de modelo descartado por el equipo) |
| 14 | Hoy fuera de la edición | Si `day` no está entre los días elegibles, la respuesta trae la lista vacía y `dayHasFunctions: false`; la web dice que ese día no hay funciones y ofrece los días disponibles | Caso límite aprobado; no se cambia el día por defecto | Saltar al primer día de la edición (contradice M-05) |
| 15 | Combinación de filtros | Con «y», en el servidor: texto, día, `stepFree` y `accessibleToilet` | Clarification del 2026-11-20; se prueba en el servidor (SC-003, SC-007) | Filtrar en el navegador (las pruebas no cubrirían la regla) |
| 16 | Búsqueda | Sobre `name_key`, que ya se guarda sin mayúsculas ni tildes con `normalizar`; coincidencia parcial. Solo sedes: nunca títulos de funciones | FR-005, FR-006, FR-027 y SC-005, SC-014 | Buscar también en funciones (prohibido por M-02) |
| 17 | Qué sedes se listan | Todas las filas de `venues`, con o sin funciones y con o sin marcador, incluidos los recorridos | FR-015, M-07 y SC-002 | Solo sedes con funciones (corregido por el equipo) |
| 18 | Ficha de sede | Funciones según la regla 11 desde hoy (o solo del día pedido), con actividad, fecha, hora, `status` y `timeStatus` calculado con `estadoTemporal` del 002. Las canceladas se devuelven con `status: cancelled` y la web muestra «Cancelada» | FR-011 y M-08; mismo cálculo que la ficha de actividad | Ocultar canceladas (el equipo pidió mostrarlas marcadas) |
| 19 | Historial | Cada cambio registra `catalog.venue.updated`, `venue.destination.set` y `.removed`, `venue.accessibility.set` y `venue.photo.set` y `.removed`, con los **campos cambiados** (antes y después, sin los bytes de la foto). `GET /panel/venues/{id}/history` lo muestra | FR-017, SC-009, RC-06 y RNF-09; tabla `history` de solo anexar | Registrar solo el nombre (no dice qué cambió) |
| 20 | Sin aviso público | Corregir datos, marcador, destino, accesibilidad o foto **no** crea aviso. Cambiar la sede de una función sigue siendo `reschedule` del 002 | FR-019 y RC-06 | — |
| 21 | Carga diferida | `app.js` importa `js/mapa.js` con `import()` solo en `/mapa`; si falla, la pestaña muestra un error con enlace a la Agenda | FR-004 y SC-010 | Importarlo siempre (la Agenda esperaría al mapa) |
| 22 | Vista isométrica | Un contenedor con la ilustración y los marcadores como `<button>` encima. Transformación CSS (`translate` y `scale`): arrastre con *pointer events*, rueda, pellizco, botones «+» y «−» y teclado (flechas, `+`, `-`). Zoom de 1× a 4×. Los marcadores mantienen su tamaño. Sin botón «ubicarme» | FR-001, FR-003, FR-026 y el caso «sin zoom táctil» | Librería de mapas (CSP) |
| 23 | Lista equivalente | Alternar Mapa o Lista; la lista es una `<ul>` de botones con nombre, dirección o referencia, cantidad de funciones del día (si el filtro está activo) y accesibilidad en texto e icono, nunca solo con color | FR-015, FR-016 y SC-008 | — |
| 24 | Estado en la URL | `/mapa?q=&dia=&sinEscalones=1&banio=1&vista=lista&sede={id}`, como la Agenda | Enlace compartible y botón «atrás» coherente | Estado solo en memoria |
| 25 | Datos de ejemplo | `cargar-ejemplo.js` coloca marcadores de ejemplo en la ilustración provisional para las sedes ficticias; no les da destino ni accesibilidad (quedan «por confirmar») ni foto | No inventar coordenadas ni accesibilidad (RNF-08); la demo prueba «Cómo llegar» registrándolo desde el panel | Coordenadas ficticias (parecerían reales) |

## Pendientes de producto (no se resuelven en el plan)

- **P-13:** quién entrega la ilustración definitiva y cuándo. El plan deja el cambio en un archivo y una constante.
- **Fotos de actividades (spec 002):** se decidirán aparte; este plan solo trata la foto de la sede.

## Mapa de pruebas contra los criterios de éxito

| Criterio | Cómo se prueba | Tipo |
|---|---|---|
| SC-001 | `GET /map`, `/map/venues` y `/map/venues/{id}` sin cookie responden 200; la web no llama a `navigator.geolocation` (búsqueda en el código) y la entrada mantiene `geolocation=()` | Integración y estática |
| SC-002 | Sedes con y sin funciones, con y sin marcador, con marcador de otra ilustración y un recorrido: todas en `/map/venues` sin filtros | Integración |
| SC-003 | Reloj fijado: el filtro devuelve exactamente las sedes con función `scheduled` ese día (incluida una que aún no empieza); una sede con solo franjas no aparece; otro día elegido cambia el resultado | Integración |
| SC-004 | Sede cuya única función del día está cancelada: no aparece; en su ficha la función llega con `status: cancelled` | Integración |
| SC-005 | Buscar el título de una función no devuelve sedes por esa razón; un nombre que no es sede no aparece | Integración |
| SC-006 | Sede con los cuatro datos del destino: `directionsUrl` de Google Maps; sin ellos o recorrido: `directionsUrl: null` | Unitaria e integración |
| SC-007 | Por cada característica: `confirmed` entra en el filtro; `unavailable`, `unconfirmed` y sin fila no entran; una nota que dice «accesible» no cambia nada | Integración |
| SC-008 | Recorrido con teclado de la lista y la tarjeta en Chrome sin ventana; los estados llevan texto | Comprobación en navegador |
| SC-009 | Cada cambio del panel deja una fila en `history` con quién, cuándo, sede y campos cambiados | Integración |
| SC-010 | Con el servicio de programación caído, `/agenda` y `/actividad/{id}` de la web cargan y `/mapa` muestra el error con enlace a la Agenda | Punta a punta |
| SC-011 | Destino sin fuente o sin fecha: 422 y no se guarda; el marcador nunca se usa para el enlace | Unitaria e integración |
| SC-012 | Sede sin marcador o con marcador fuera de la ilustración vigente: `marker: null` y presente en la lista | Integración |
| SC-013 | Subir foto sin texto alternativo o sin autoría: 422; con ambos: la ficha devuelve `photo.alt` y `photo.credit` | Integración |
| SC-014 | «teatro bolivar», «TEATRO BOLÍVAR» y «Bolív» encuentran «Teatro Bolívar» (sede ficticia de prueba) | Integración |
| FR-021 | Editor, publicador y visitante sin sesión reciben 401 o 403 en cada ruta del panel de sedes; con identidad caída, 503 | Integración |
| FR-025 | GIF, SVG, bytes que no coinciden con el tipo y fotos de más de 1 MB: 422 | Unitaria e integración |
