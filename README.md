# VivArt

Festival Internacional de Artes Vivas de Loja: web pública y panel interno.

## Estructura

- `app/`: todo el código (servicios, web y entrada común).
- `context/`, `specs/`, `docs/`: producto, especificaciones y arquitectura.
- `AGENTS.md`: reglas de trabajo para cualquier agente y para el equipo.
- `.github/`: integración y entrega continuas.

Empieza por `context/README.md` y `AGENTS.md`.

## Levantar la demo

Necesitas Docker Desktop abierto y Node.js 24. Desde la carpeta `app/`:

```text
node preparar-entorno.mjs                 # crea o completa app/.env con contraseñas aleatorias
docker compose up -d --build              # base de datos, servicios de identidad y programación, y entrada común
docker compose exec -e MAIL_TRANSPORT=console identidad node bin/crear-primer-administrador.js --email admin@vivart.test
docker compose exec programacion node bin/cargar-ejemplo.js   # opcional: actividades FICTICIAS para ver la Agenda
```

Si ya tenías la demo de antes, vuelve a ejecutar `node preparar-entorno.mjs`: solo añade las variables nuevas y no toca las tuyas. Tus datos se conservan.

Abre http://localhost:8080 y activa el administrador con el enlace que imprime el último comando. Los correos de la demo llegan a http://localhost:8080/demo/buzon (no se envía ninguno real). Cada persona tiene su propia base de datos: las cuentas no se comparten por Git.

- Pruebas: `docker compose up -d db db-preparar` y luego `npm test` (en `app/`).
- API de programación: `http://localhost:8080/api/programacion/agenda` (contrato en `specs/002-programacion-y-publicacion/contracts/`).
- Apagar sin perder datos: `docker compose stop`. Borrar todo: `docker compose down -v`.

Detalles en `specs/001-identidad-y-permisos/quickstart.md` y `specs/002-programacion-y-publicacion/quickstart.md`.
