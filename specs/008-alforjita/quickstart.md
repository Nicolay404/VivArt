# Quickstart: Alforjita

## Pruebas automáticas

```bash
cd app
docker compose up -d postgres
npm --prefix services/programacion test   # unitarias del intérprete y de las respuestas, integración de la API
npm test                                  # todo, incluida edge/test/e2e-alforjita.test.js (compara con la Agenda)
```

## Demo local

```bash
cd app
node preparar-entorno.mjs
docker compose up -d --build
docker compose exec programacion node bin/cargar-ejemplo.js
```

Abre <http://localhost:8080/agenda> **sin iniciar sesión** y pulsa «Pregúntale a Alforjita».

| Prueba | Qué esperar |
|---|---|
| Pregunta rápida «¿Qué hay hoy?» | Funciones de hoy que aún no empiezan, con enlace a su ficha, y «Asumí hoy, …» |
| Escribe «¿Qué funciones gratuitas de danza hay después de las seis?» | Solo gratuitas confirmadas de esa categoría desde las 18:00, o «sin coincidencias» con los criterios y sugerencias |
| Escribe «¿Cuánto cuesta …?» con el título de una actividad de pago sin precio | «El precio aún no está confirmado», nunca «gratuita» |
| Escribe «Quiero comprar una entrada» | Explica que no puede y enlaza a la ficha y al Carrito |
| Escribe «Mis sellos» | No consulta datos personales y enlaza al Pasaporte |
| Escribe «asdf qwer» | No la entiende: ofrece las preguntas rápidas y la Agenda |
| Detén programación (`docker compose stop programacion`) y pregunta | «No pude consultar la programación» y «Ir a la Agenda» |
| Solo con teclado | Tab hasta el botón, Enter abre, Tab recorre, Esc cierra y el foco vuelve al botón |
| Celular (360 px) | El panel ocupa toda la pantalla, sin desplazamiento horizontal |

Para fijar el reloj en la demo, pon `CLOCK_FIXED=2026-11-21T17:00:00-05:00` en el servicio de programación (solo fuera de producción, RNF-10).

## Comprobar que el texto no se registra

```bash
docker compose logs programacion | grep -i "danza"   # no debe aparecer nada de lo escrito
```

## Resultados de la verificación (2026-11-22)

- `npm test` desde `app/`: 321 pruebas en verde (114 de identidad, 99 de programación, 64 de participación, 17 de la entrada común y 27 de la web), entre ellas 9 unitarias del intérprete, 12 de integración de Alforjita y 2 de punta a punta.
- Chrome sin ventana a 360 px y a 1440 px, sobre la demo con `cargar-ejemplo.js`:
  - `alforjita.js` no se descarga hasta pulsar el botón;
  - con teclado: Enter abre el panel con el foco en el campo, Esc lo cierra y el foco vuelve al botón;
  - preguntas rápidas, el ejemplo de la danza (sin coincidencias ese día, con «Sin “Danza”» y «Abrir la Agenda»), «quiero comprar una entrada», «mis sellos» y un texto sin sentido responden como se espera;
  - el panel mide 360 px en celular y 420 px en escritorio, sin desplazamiento horizontal; 0 peticiones de ubicación, 0 datos en el almacenamiento del navegador y 0 errores de JavaScript.
