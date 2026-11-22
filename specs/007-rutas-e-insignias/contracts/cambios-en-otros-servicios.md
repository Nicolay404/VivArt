# Cambios compatibles en otros servicios

El spec 007 se implementa casi en su totalidad dentro del **servicio de participación** (`app/services/participacion/`) y la capa web (`app/web/`).

A continuación se detallan los requisitos de compatibilidad e interacción con los otros servicios existentes:

---

## 1. Servicio de Identidad (`app/services/identidad/`)

### Permisos y roles
- **Rol requerido**: La administración de rutas culturales (`/panel/routes`) requiere el rol de `administrador` o la acción `panel.routes`.
- Como en los specs 005 y 006, la verificación de sesión pública y del rol interno se delega a `identidad` mediante la llamada HTTP existente `/auth/session` o la verificación de permisos en `identidad`.
- **Acción pendiente**: No requiere nuevos tipos de acción pendiente (el canje ya está soportado desde el spec 006).

---

## 2. Servicio de Programación (`app/services/programacion/`)

### Consulta de funciones elegibles y estado
- Participación utiliza las rutas internas ya existentes:
  - `GET /internal/functions?ids=id1,id2,...`
  - `GET /agenda`
- **Campos consumidos**:
  - `passport_enabled`: Para validar en el panel y en la creación de rutas que la función sea elegible (FR-002).
  - `status`: Si la función pasa a `cancelled`, participación la reconoce como cancelada para marcar la función en la ruta y computar el estado dinámico «Ruta en revisión» si `activas < goal`.
  - `date`, `startTime`, `title`, `venueName`: Para enriquecer la visualización pública de las funciones elegibles en `/pasaporte/ruta/:id`.
- **Sin cambios en el esquema ni contratos de Programación**: No se alteran las bases de datos de programación.

---

## 3. Servicio de Participación (`app/services/participacion/`)

### Modificación en endpoints existentes
- `POST /passport/claims` (Canje de sellos):
  - Se añade de forma retrocompatible la propiedad `badgeUnlocked` en el JSON de respuesta exitosa (200 o 201) cuando el sello canjeado causa que el usuario alcance la meta de una o más rutas culturales:
  ```json
  {
    "created": true,
    "stamp": { ... },
    "badgeUnlocked": {
      "id": "ubadge_123",
      "routeId": "route_456",
      "routeTitle": "Ruta Escénica",
      "title": "Explorador Escénico",
      "icon": "teatro",
      "color": "violeta"
    }
  }
  ```
  Si no se desbloquea ninguna insignia, `badgeUnlocked` es `null`.
