# Quickstart: Rutas culturales e insignias (Spec 007)

Guía rápida para verificar y probar las funcionalidades de rutas culturales e insignias tanto en el entorno de desarrollo como en la suite automatizada de pruebas.

---

## 1. Pruebas automatizadas

Ejecutar la suite completa del servicio de participación y la web:

```bash
# Pruebas unitarias y de integración de Participación
cd app/services/participacion && npm test

# Pruebas del frontend web
cd ../../web && npm test

# Verificación de reglas del proyecto y estilo
bash .github/scripts/verificar-reglas.sh
```

---

## 2. Flujo de prueba manual / integración paso a paso

### Paso 1: Crear y publicar una ruta cultural (Administrador)
1. Iniciar sesión con un usuario que posea el rol `administrador`.
2. Ingresar al panel en `/panel/rutas` y pulsar en **«Crear ruta»**.
3. Rellenar los campos:
   - **Título**: `Ruta Teatral de Loja`
   - **Descripción**: `Disfruta de tres grandes obras de artes escénicas en las sedes principales del festival.`
   - **Nombre de insignia**: `Maestro del Escenario`
   - **Descripción de insignia**: `Reuniste los 3 sellos de la Ruta Teatral.`
   - **Icono temático**: Seleccionar `teatro`.
   - **Color de insignia**: Seleccionar `violeta`.
   - **Funciones elegibles**: Seleccionar al menos 3 funciones que tengan el Pasaporte habilitado.
   - **Meta**: Fijar en `3` (el sistema valida que `meta <= total_elegibles`).
4. Marcar **«Publicar ruta»** y guardar.
5. Verificar que la ruta aparece en el listado de `/panel/rutas` con estado `Publicada`.

### Paso 2: Consulta pública sin cuenta (Visitante)
1. Abrir un navegador en modo incógnito (sin sesión iniciada).
2. Dirigirse a `/pasaporte`.
3. Comprobar que en la sección **«Rutas culturales»** aparece la tarjeta de la `Ruta Teatral de Loja` con su meta (3 sellos), icono y descripción.
4. Hacer clic en la tarjeta para ver `/pasaporte/ruta/{id}`:
   - Se listan las funciones elegibles con fecha, hora y sede.
   - Aparece un botón de llamada a identificarse para registrar progreso.

### Paso 3: Ver progreso con usuario registrado
1. Iniciar sesión con una cuenta de usuario visitante normal.
2. Ingresar a `/pasaporte`.
3. La tarjeta de la ruta ahora muestra el progreso con denominador: `0 de 3`.
4. El bloque **«Mis insignias»** indica que aún no se han obtenido insignias.

### Paso 4: Canjear sellos y desbloquear la insignia
1. Escanear o reclamar el QR de una de las funciones de la ruta (`POST /passport/claims` con el `ref` de la función).
2. El progreso en la ruta pasa a `1 de 3`.
3. Reclamar el segundo y tercer sello de funciones de la ruta:
   - Al reclamar el 3er sello, la respuesta del canje incluye `badgeUnlocked: { title: 'Maestro del Escenario', ... }`.
   - En la interfaz aparece la felicitación inmediata de insignia desbloqueada.
4. Volver a `/pasaporte`:
   - El apartado **«Mis insignias»** muestra la insignia ganada con su icono temático `teatro` y fecha.
   - La ruta muestra estado `3 de 3` (Completada).

### Paso 5: Manejo de cancelaciones y «Ruta en revisión»
1. Simular la cancelación de una función elegible en una ruta con 3 funciones y meta 3.
2. Al quedar 2 funciones activas y la meta en 3 ($2 < 3$):
   - La ruta muestra la insignia de estado **«Ruta en revisión»**.
   - Los sellos ya reclamados por los usuarios para la función cancelada **siguen contando** en su progreso.
   - La función cancelada se etiqueta visualmente como `Cancelada` y no permite nuevos canjes.
3. El administrador entra a `/panel/rutas`, edita la ruta, agrega una cuarta función elegible activa y guarda.
4. Como ahora hay 3 funciones activas ($3 \ge 3$), el distintivo **«Ruta en revisión»** desaparece automáticamente y la viabilidad queda restaurada.
