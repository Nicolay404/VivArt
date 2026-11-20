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
node preparar-entorno.mjs                 # una sola vez: crea app/.env con contraseñas aleatorias
docker compose up -d --build              # base de datos, servicio de identidad y entrada común
docker compose exec -e MAIL_TRANSPORT=console identidad node bin/crear-primer-administrador.js --email admin@vivart.test
```

Abre http://localhost:8080 y activa el administrador con el enlace que imprime el último comando. Los correos de la demo llegan a http://localhost:8080/demo/buzon (no se envía ninguno real). Cada persona tiene su propia base de datos: las cuentas no se comparten por Git.

- Pruebas: `docker compose up -d db` y luego `npm test` (en `app/`).
- Apagar sin perder datos: `docker compose stop`. Borrar todo: `docker compose down -v`.

Detalles en `specs/001-identidad-y-permisos/quickstart.md`.
