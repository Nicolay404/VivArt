# Arquitectura común de VIVART

**Estado:** propuesta del equipo, decidida como **decisión de trabajo** para el MVP. **No está validada por el docente.** Las cuatro vistas usan una nomenclatura propuesta por el equipo y están pendientes de contrastarse con la que pida el docente.

Este documento es la decisión arquitectónica compartida por los ocho specs. Cumple las restricciones de la constitución (`.specify/memory/constitution.md`, principios III y IV): una sola arquitectura, documentada en cuatro vistas con Mermaid, y **sin monolito modular**.

## Decisión de trabajo

**Arquitectura orientada a servicios, con APIs síncronas, sin broker de eventos y sin monolito modular.** Tres servicios independientes, una interfaz web y una entrada HTTP común, en un solo repositorio.

| Pieza | Specs que cubre | Responsabilidad y datos propios |
|---|---|---|
| **Servicio de identidad** | 001 | Cuentas, sesiones, verificación y recuperación por correo, primer administrador, roles, asignación de funciones al personal de acceso e historial de permisos |
| **Servicio de programación y consulta pública** | 002, 003 y 008 | Actividades, funciones y franjas, flujo editorial y publicación, catálogos de categorías y sedes, datos del mapa, y Alforjita sobre el catálogo publicado |
| **Servicio de participación** | 005, 006 y 007 | Cupos, pedidos, entradas y control de acceso; QR y sellos del Pasaporte; rutas, progreso e insignias |
| **Interfaz web** | todos | Parte pública (celular primero) y panel interno (escritorio primero); Mi recorrido (004) guarda sus datos en el navegador y consulta la programación publicada |
| **Entrada HTTP común** | todos | Enrutamiento sencillo por prefijo hacia la web y los servicios; **no es un gateway dedicado** |

**Una rama por spec no significa un servicio por spec.** Las ramas organizan el trabajo del equipo; los servicios agrupan specs por cohesión de datos y de reglas.

## Reglas de la arquitectura

1. **Un solo repositorio.** Todo el código vive bajo `app/`, con una carpeta por servicio (`app/services/<nombre>/`), la web (`app/web/`) y la entrada común (`app/edge/`). La documentación (`context/`, `specs/`, `docs/`) y las herramientas de agentes quedan fuera de `app/`, para no mezclarlas con el código.
2. **Cada servicio es dueño de sus datos** y se despliega por separado. Ningún servicio escribe en los datos de otro; solo los lee a través de su API.
3. **Para la demo** los servicios pueden compartir una instancia de base de datos si cada uno tiene una base lógica y credenciales propias.
4. **APIs síncronas por HTTP**, versionadas. No hay broker de eventos.
5. **Autorización en cada servicio.** Cada servicio comprueba en su propio servidor identidad, rol, ámbito y propiedad (RNF-04). La interfaz no es una barrera de seguridad.
6. **Identidad compartida por consulta, no por copia.** Los servicios consultan al servicio de identidad los permisos vigentes en las operaciones protegidas, de modo que un rol revocado no siga autorizando acciones con una credencial desactualizada (RF-04b).
7. **No se monta infraestructura extra** (gateway, malla de servicios) si un enrutamiento sencillo resuelve el acceso.

## Cómo se comparten identidad y permisos

- La sesión es **opaca**: un identificador aleatorio en una cookie `HttpOnly`; el servicio de identidad guarda su estado. No se confía en datos dentro de la credencial.
- Cada servicio, para una operación protegida, llama al servicio de identidad (`introspect`) con una credencial de servicio propia y recibe: si la sesión está activa, la persona, sus roles activos, si su correo está verificado y, para el personal de acceso, las funciones asignadas.
- Como la consulta lee el estado actual, **revocar un rol surte efecto en la siguiente consulta**.
- Si el servicio de identidad no responde, las operaciones protegidas fallan cerradas (no se autoriza) y la consulta pública sigue disponible (AN-009).

## Qué se despliega junto y qué por separado

| Unidad desplegable | Se despliega |
|---|---|
| Servicio de identidad | Por separado |
| Servicio de programación y consulta pública | Por separado |
| Servicio de participación | Por separado |
| Interfaz web (archivos estáticos) | Por separado; se sirve detrás de la entrada común |
| Entrada HTTP común | Por separado |
| Base de datos de demo | Una instancia compartida con **tres bases lógicas**, una por servicio, con credenciales propias |

## Flujos críticos

- **Último cupo (RF-20, RC-05):** el servicio de participación es el único dueño del cupo. La retención y la venta se resuelven dentro de ese servicio con una transacción y una restricción en sus propios datos, no en la interfaz.
- **Sello único (RF-26, RC-05):** el servicio de participación garantiza un sello por persona y función con una restricción de unicidad; repetir el canje devuelve el mismo sello. Implementado en el spec 006.
- **Retorno a la acción original (RF-03):** lo describe la vista de comportamiento. El servicio de identidad solo garantiza el regreso y la revalidación; **no ejecuta el pago ni el canje**.

## Propuestas técnicas reversibles (no son requisitos aprobados)

Estas son decisiones de trabajo que se pueden cambiar sin alterar la arquitectura:

- Servicios en Node.js con HTTP simple. Datos en un contenedor PostgreSQL con una base y un usuario propios por servicio (adoptado el 2026-11-20 al cerrar el spec 001).
- Sesiones en servidor con cookie `HttpOnly`; contraseñas con un hash lento (scrypt); enlaces de verificación y recuperación de un solo uso con vencimiento.
- Buzón de pruebas para la demo, sin enviar correos reales.

## Pendiente de validación del docente

1. Si esta distribución cuenta como «no monolito modular», en particular con una base de datos compartida entre servicios en la demo.
2. Qué cuatro vistas y qué nomenclatura se esperan; estas cuatro son la propuesta del equipo.
3. Si Mermaid en el repositorio es suficiente y dónde debe vivir la documentación.
4. Cuántas unidades desplegables independientes se exigen como mínimo.

## Las cuatro vistas

1. [Contexto](01-contexto.md)
2. [Servicios](02-servicios.md)
3. [Despliegue](03-despliegue.md)
4. [Comportamiento](04-comportamiento.md)
