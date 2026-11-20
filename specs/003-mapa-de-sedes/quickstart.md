# Quickstart: validar el mapa de sedes

Guía de ejecución y comprobación. Los detalles viven en el [contrato](contracts/mapa.openapi.yaml) y en el [modelo de datos](data-model.md). El mapa de pruebas contra cada criterio de éxito está en [research.md](research.md).

## Requisitos

- Docker Desktop abierto y Node.js 24.
- `app/.env` generado con `node preparar-entorno.mjs` (desde `app/`). Este spec no añade variables nuevas.
- Un administrador creado como en `specs/002-programacion-y-publicacion/quickstart.md`.

## Ejecutar las pruebas

```text
cd app
docker compose up -d db db-preparar
npm test
```

Ejecuta las pruebas de todos los servicios y de la entrada común, incluidas las nuevas del mapa: `test/unit/mapa.test.js`, `test/integration/mapa.test.js` y `test/integration/sedes-admin.test.js` en programación, y `edge/test/e2e-mapa.test.js`.

## Ejecutar la demo con contenedores

```text
cd app
docker compose up -d --build
docker compose exec programacion node bin/cargar-ejemplo.js
```

El último comando crea sedes y actividades **ficticias** y coloca sus marcadores en la **ilustración provisional**. No les da destino ni accesibilidad: aparecen sin «Cómo llegar» y con la accesibilidad «por confirmar», porque no se inventan esos datos.

- Mapa en la web: http://localhost:8080/mapa
- API: `http://localhost:8080/api/programacion/map`, `/map/venues`, `/map/venues/{id}`.
- Reloj fijo para probar «Funciones del día» dentro de la edición de ejemplo: `CLOCK_FIXED=2026-11-22T12:00:00-05:00` en el servicio `programacion` (no funciona con `NODE_ENV=production`).

## Escenarios de comprobación manual

| Escenario | Pasos | Resultado esperado |
|---|---|---|
| Mapa sin cuenta | Abrir `/mapa` en una ventana privada a 360 px; desplazar, hacer zoom con los botones y seleccionar un marcador | Sin petición de ubicación ni de sesión; sin desbordamiento horizontal; se abre la tarjeta |
| Ilustración provisional | Abrir `/mapa` | Se ve la leyenda «Ilustración provisional» |
| Lista equivalente | Cambiar a «Lista» y recorrerla solo con teclado (Tab, Enter) | Aparecen todas las sedes, incluido el recorrido ficticio y las sedes sin marcador; se abre la ficha |
| Búsqueda | Escribir el nombre de una sede sin tildes y en minúsculas; después, el título de una obra | La sede aparece; con el título no aparece nada por esa razón y se ve «sin resultados» |
| Funciones del día | Con el reloj fijado, activar «Funciones del día»; después, elegir otro día | Solo sedes con funciones programadas ese día; las que solo tienen franjas no aparecen; el selector ofrece solo días con funciones |
| Hoy fuera de la edición | Sin reloj fijado (hoy fuera de la edición de ejemplo), activar el filtro | Lista vacía con el aviso de que ese día no hay funciones y los días disponibles |
| Cancelada | Cancelar una función desde el panel (spec 002) y abrir su sede | La función aparece como «Cancelada» y no hace aparecer la sede en el filtro si era la única del día |
| Cómo llegar | En `/panel/catalogos`, registrar el destino de una sede con coordenadas comprobadas, fuente y fecha | La tarjeta muestra «Cómo llegar» y abre Google Maps en esas coordenadas; en el recorrido nunca aparece |
| Destino incompleto | Guardar coordenadas sin fuente o sin fecha | Error en el campo; «Cómo llegar» no aparece |
| Accesibilidad | Confirmar «acceso sin escalones» en una sede (con fuente y fecha) y dejar «baño accesible» por confirmar con una nota que diga «accesible» | La tarjeta muestra uno confirmado y otro «por confirmar»; el filtro de baño accesible no la incluye |
| Filtros combinados | Activar «Funciones del día» y «acceso sin escalones» | Solo sedes que cumplen ambos |
| Foto | Subir una foto propia sin texto alternativo; después, con texto alternativo y autoría; después, quitarla | Primero, error; después, foto con texto alternativo y autoría; al quitarla, la tarjeta se ve igual que sin foto |
| Marcador | Colocar el marcador de una sede nueva en la ilustración | Aparece en el mapa; la sede sin marcador sigue en la lista |
| Permisos | Como editor o publicador, `PUT /api/programacion/panel/venues/{id}/destination` | 403 con el rol que falta; nada cambia |
| Historial | Abrir el historial de la sede tras los cambios anteriores | Una entrada por cambio con quién, cuándo y qué campos cambiaron; ningún aviso público |
| Mapa caído | `docker compose stop programacion` y abrir `/agenda` y `/mapa` | La web carga; el mapa muestra un error con enlace a la Agenda. Al volver a levantarlo, todo funciona |

## Resultados registrados

| Fecha | Comprobación | Resultado |
|---|---|---|
| — | Pendiente de implementación (`/speckit-tasks` y `/speckit-implement`) | — |

## Qué NO hace este spec

No cambia la programación ni sus avisos (spec 002), no guarda el recorrido personal (spec 004), no vende (spec 005), no da sellos ni rutas (specs 006 y 007), no entrega la ilustración definitiva (P-13) y no trata las fotos de actividades.
