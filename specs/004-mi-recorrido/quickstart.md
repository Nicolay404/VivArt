# Quickstart: Validación de Mi recorrido y alternativas

Guía para probar y validar de punta a punta las funcionalidades del spec 004 (`004-mi-recorrido`).

---

## Prerrequisitos

1. Tener la demo levantada con los datos de ejemplo:
   ```bash
   cd app
   docker compose up -d
   docker compose exec programacion node bin/cargar-ejemplo.js
   ```
2. Abrir la web en el navegador: `http://localhost:8080`.

---

## Escenarios de Validación Manual

### 1. Guardar y ordenar funciones sin cuenta (SC-001, SC-002)
1. Entra a `http://localhost:8080/agenda` sin iniciar sesión.
2. Abre la ficha de una actividad (p. ej. «Obra de ejemplo con doble función»).
3. Pulsa el botón **«Guardar en mi recorrido»** en la función de las 18:00 y en la de las 20:00. Comprueba que el botón muestra la leyenda informativa: *«Guardar no reserva cupo»*.
4. Dirígete a **Mi recorrido** mediante el enlace en la cabecera o navegando a `http://localhost:8080/recorrido`.
5. **Verificación**: Las funciones aparecen ordenadas cronológicamente por fecha y hora de inicio.
6. Cierra la pestaña o el navegador, vuelve a abrir `http://localhost:8080/recorrido`.
7. **Verificación**: El 100% de las funciones sigue guardado en el navegador (`localStorage`).

---

### 2. Detección y advertencia de cruces (SC-003, SC-004)
1. Guarda dos funciones programadas en el mismo día cuyas horas se solapen (p. ej. Función A: 18:00–19:30 y Función B: 19:00–20:30).
2. Guarda también una función sin hora de fin conocida (p. ej. «Concierto de ejemplo sin hora de fin», 18:00).
3. Abre `/recorrido`.
4. **Verificación**:
   - Entre la Función A y la Función B se despliega una advertencia visual destacada de **Cruce de horarios**.
   - Con la función de fin desconocido **no** se advierte cruce (cumpliendo RC-02).
   - Ninguna advertencia bloqueó el guardado de las funciones (SC-004).

---

### 3. Sugerencia de alternativas y sustitución (SC-006, SC-010, SC-011)
1. En `/recorrido`, ubica una función que haya sido cancelada o marcada como agotada (`sold_out`).
2. Pulsa el botón **«Ver alternativas en esta sede»**.
3. Se despliega el panel de alternativas:
   - Todas las opciones pertenecen a la **misma sede** y están programadas a una hora futura no cancelada.
   - Si no hubiese alternativas, se ofrece un enlace directo para volver a la Agenda.
4. En una de las alternativas sugeridas, pulsa **«Sustituir»**.
5. **Verificación**: La función original afectada desaparece del recorrido y la nueva función alternativa queda agregada en un solo paso.

---

### 4. Persistencia de funciones archivadas (SC-009)
1. Guarda una función en Mi recorrido.
2. Desde el panel de administración, archiva dicha actividad (o simula su respuesta 404 en la API).
3. Recarga `http://localhost:8080/recorrido`.
4. **Verificación**: La función permanece visible en el recorrido mostrando el aviso distintivo: *«Ya no está en la programación activa»* hasta que el visitante decida pulsar el botón «Quitar».

---

### 5. Independencia de sesión (SC-008)
1. Con funciones guardadas en Mi recorrido sin sesión, navega a `/ingresar` e inicia sesión con cualquier cuenta registrada.
2. Regresa a `/recorrido`.
3. **Verificación**: El recorrido sigue presente intacto en el navegador; no se asocia a la cuenta ni se envía a un servidor remoto.
4. Cierra la sesión (`Salir`): el recorrido continúa intacto en el almacenamiento local del navegador.

---

## Pruebas Automatizadas

Para ejecutar la suite de pruebas unitarias de la lógica de negocio del recorrido:

```bash
cd app
npm test
```
*(Verifica algoritmos de cruces, ordenamiento cronológico, cálculo de alternativas y resiliencia de almacenamiento local).*
