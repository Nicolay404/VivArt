# Research: Programación, agenda y publicación

Decisiones técnicas del plan. Todas son reversibles y no cambian requisitos.

## Decisiones

| # | Tema | Decisión | Por qué | Alternativas descartadas |
|---|---|---|---|---|
| 1 | Servicio | `app/services/programacion`, Node 24 + Fastify 5 + `pg`, igual que identidad | Mismo stack: el equipo mantiene un solo estilo | Otro lenguaje por servicio (más costo de aprendizaje) |
| 2 | Datos | PostgreSQL, base `programacion` con usuario propio; pruebas en `programacion_pruebas` con un esquema por aplicación | Cada servicio es dueño de sus datos (arquitectura, regla 2) | Compartir la base de identidad (violaría la arquitectura) |
| 3 | Modelo editorial | La actividad guarda **dos contenidos**: `published_content` (lo que ve el público) y `working_content` (borrador o versión pendiente), con `editorial_state` (`none`, `draft`, `in_review`, `returned`) | Cumple FR-011: la revisión pendiente nunca reemplaza lo publicado hasta aprobarse | Tabla de versiones completa (más compleja; el historial ya registra cada cambio) |
| 4 | Funciones y franjas | En el borrador viven dentro del JSON con un identificador estable; al publicar se sincronizan con las tablas `functions` y `opening_slots`, que usa la consulta pública | Borradores incompletos (FR-030) y consultas rápidas e indexables | Solo JSON (no se puede filtrar bien) |
| 5 | Cambios de asistencia | Cambiar fecha, hora o sede de una función publicada, quitarla, o cambiar una franja publicada exige **motivo interno y aviso público**: por la acción directa «reprogramar»/«cancelar», o al publicar una revisión que los cambie. Quitar una función publicada la **cancela**, nunca la borra | FR-015, FR-016, FR-019 y FR-027 | Permitir ocultar o borrar funciones (prohibido por FR-027) |
| 6 | Permisos | Cada operación del panel llama a `/internal/authorize` del servicio de identidad con la cookie de sesión y la credencial de servicio; si identidad no responde, **503** y no se hace nada | RNF-04 y la regla de fallo cerrado de la arquitectura; la revocación de un rol se nota en la siguiente acción | Copiar roles en programación (se desactualizan) |
| 7 | Acciones nuevas en identidad | `schedule.change` (publicador, administrador), `catalog.manage` (administrador) y `activity.archive` (administrador) | El spec 002 necesita distinguir reprogramar, gestionar catálogos y archivar (FR-015, FR-025, FR-028) | Reutilizar `publish` o `catalog.load` (mezclaría permisos distintos) |
| 8 | Reloj | `clock.js`: hora actual en Loja (UTC−5, sin horario de verano). `CLOCK_FIXED` solo se acepta si `NODE_ENV` no es `production`; en producción se ignora con un aviso | RC-07 y RNF-10 | Reloj del navegador (cada persona vería algo distinto) |
| 9 | Hora de inicio pasada | Estado calculado: `upcoming`, `start_passed` (solo hora de inicio y ya pasó), `in_progress` y `finished` (solo con hora de fin o duración), `cancelled` | RC-03 / FR-006: sin hora de fin nunca se dice «en curso» ni «terminada» | Suponer una duración (inventaría datos) |
| 10 | Búsqueda | Columna `search_text` con título, artistas y organización en minúsculas y sin tildes, calculada al publicar | Buscar «danza» encuentra «Danza» y «danzá» sin extensiones de PostgreSQL | `unaccent` (requiere crear extensiones como superusuario) |
| 11 | Modalidad de acceso | `access.mode`: `free` (gratuita confirmada), `paid` (de pago) o `unconfirmed`; `priceUsd` solo si se conoce. Pago sin precio = «precio por confirmar». Nunca se deduce gratuidad | FR-004, FR-024, FR-030 y SC-013 | Precio 0 para gratuitas (confunde «gratis» con «sin dato») |
| 12 | Venta | Este servicio **no tiene** ningún campo ni ruta de venta | FR-014: publicar no activa ventas; la venta es del spec 05 | Bandera `sales_enabled` aquí (duplicaría al spec 05) |
| 13 | Conteo de entradas (FR-017) | Cliente `participacion`: si `PARTICIPACION_URL` no está configurada o no responde, devuelve `{ available: false }` y la interfaz debe decir «no se pudo consultar»; la operación no se bloquea, pero la respuesta lo indica | Participación aún no existe; inventar ceros violaría RNF-08 | Bloquear toda reprogramación hasta el spec 05 |
| 14 | Edición simultánea | Control optimista: cada guardado envía la `version` leída; si cambió, **409** y no se sobrescribe | Salvaguarda técnica mientras el equipo no decida la regla de producto (sigue pendiente en el spec) | Bloqueo exclusivo del borrador (sería una decisión de producto) |
| 15 | Formato de carga | JSON `vivart-programacion/1` (ver `contracts/formato-carga.md`), con referencia de origen (página) y clave de importación por registro; categorías y sedes por nombre | Fácil de preparar y revisar fuera de VIVART; JSON valida tipos | CSV (no representa bien varias funciones y franjas por actividad) |
| 16 | Duplicados y recarga | Duplicado = misma clave repetida en el archivo, o mismo título normalizado con la misma fecha y sede de alguna función. Si la clave ya fue cargada antes, el registro **no se vuelve a cargar** (FR-022) | Proteger las correcciones revisadas | Sobrescribir con lo nuevo (prohibido) |
| 17 | Publicación de un lote | Aceptar crea borradores; publicar exige una llamada explícita del administrador con la lista de actividades | FR-021 y SC-008 | Publicar al aceptar |
| 18 | Archivo y borrado | Archivar: solo administrador y sin funciones futuras vigentes (hay que cancelarlas antes). Borrar: solo actividades **nunca publicadas**, que no pueden tener ventas ni sellos | FR-027 a FR-029 | Preguntar a participación antes de borrar (aún no existe; nunca publicada ya lo garantiza) |
| 19 | Historial | Tabla `history` de solo anexar (triggers que impiden UPDATE, DELETE y TRUNCATE) con quién, cuándo, acción, entidad y detalle | RC-06 y RNF-09 | Registros solo en el log del proceso |
| 20 | API interna | `GET /internal/functions/{id}` con `X-Service-Key`: estado publicado de una función para participación | La arquitectura dice que participación consulta a programación | Que participación lea las tablas de programación (prohibido) |
| 21 | Contenedor | Imagen `node:24-alpine`, usuario sin privilegios, healthcheck que también consulta la base; no publica puertos | Igual que identidad | — |
| 22 | Preparación de la base | El contenedor `db-preparar` ejecuta en cada arranque un script **idempotente** que crea o actualiza usuarios y bases por servicio | Quien ya tenía la demo del spec 001 recibe la base nueva sin borrar sus datos | Solo `docker-entrypoint-initdb.d` (solo corre la primera vez) |

## Pendientes de producto (no se resuelven en el plan)

- **Edición simultánea** del mismo borrador: hoy gana el primero que guarda; el segundo recibe un conflicto y debe recargar.
- **Vigencia de una propuesta sin revisar**: hoy no vence.
- **Conteo real de entradas y pedidos**: llega con el spec 05.

## Mapa de pruebas contra los criterios de éxito

| Criterio | Cómo se prueba | Tipo |
|---|---|---|
| SC-001 | Agenda con actividades en cada estado: solo aparecen las publicadas | Integración |
| SC-002 | Búsqueda por título y artista (con y sin tildes) y los cuatro filtros combinados | Integración |
| SC-003 | Ficha con duración, precio y descripción ausentes: se devuelven como pendientes, nunca deducidos | Integración |
| SC-004 | Reloj fijado: canceladas fuera, solo hora de inicio pasada como `start_passed`, nunca `in_progress` ni `finished` | Unitaria e integración |
| SC-005 | Editor y usuario sin rol intentan publicar por solicitud directa: 403 | Integración |
| SC-006 | Revisión pendiente de una ficha publicada: la Agenda y la ficha siguen mostrando la versión publicada | Integración |
| SC-007 | Reprogramar y cancelar crean aviso e historial; corregir texto o categoría no exige aviso | Integración |
| SC-008 | Lote aceptado sin publicar; publicar solo lo confirmado; recarga sin sobrescribir | Integración |
| SC-009 | Cada actividad importada conserva su página de origen | Integración |
| SC-010 | Los siete casos de referencia del PDF, con datos ficticios, se representan sin inventar | Integración |
| SC-011 | No se borra una actividad publicada; archivar conserva historial | Integración |
| SC-012 | Enviar sin título, categoría o función o franja válida: 422 con cada campo; guardar incompleto sí se permite | Unitaria e integración |
| SC-013 | Función sin precio: modalidad sin precio y sin marca gratuita; no existe campo de venta | Integración |
| SC-014 | Vista previa con origen, duplicados y errores; registros con errores no se cargan | Integración |
| SC-015 | Devolver deja «Devuelta» con observaciones y no envía correos | Integración |
