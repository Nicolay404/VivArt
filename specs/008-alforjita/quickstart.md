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
