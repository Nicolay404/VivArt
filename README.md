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
- Pasaporte: el administrador genera y activa el QR de una función en http://localhost:8080/panel/pasaporte; quien abre su enlace con una cuenta verificada recibe el sello en http://localhost:8080/pasaporte. El QR lleva `PUBLIC_BASE_URL` (en la demo, `http://localhost:8080`). Detalles en `specs/006-pasaporte-y-sellos/quickstart.md`.
- Alforjita: en la Agenda, «Pregúntale a Alforjita» abre el asistente sin cuenta. Responde preguntas rápidas y texto libre (por ejemplo, «¿Qué funciones gratuitas de danza hay después de las seis?») con reglas simples sobre la programación publicada, sin IA generativa y sin guardar lo escrito. Detalles en `specs/008-alforjita/quickstart.md`.
- Mapa de sedes: http://localhost:8080/mapa. `cargar-ejemplo.js` coloca marcadores de ejemplo en una ilustración **provisional**; el destino de «Cómo llegar», la accesibilidad y la foto se registran desde el panel (Catálogos → Sedes → «Mapa y datos»). Detalles en `specs/003-mapa-de-sedes/quickstart.md`.
- Apagar sin perder datos: `docker compose stop`. Borrar todo: `docker compose down -v`.

Detalles en `specs/001-identidad-y-permisos/quickstart.md` y `specs/002-programacion-y-publicacion/quickstart.md`.
