# Research: Mi recorrido y alternativas

Decisiones técnicas del plan para el spec 004 (`004-mi-recorrido`). Todas son reversibles y no alteran los requisitos funcionales de `spec.md` ni las reglas del contexto de VIVART.

## Decisiones técnicas

| # | Tema | Decisión | Por qué | Alternativas descartadas |
|---|---|---|---|---|
| 1 | Dónde vive el estado | En el navegador (`localStorage`), bajo la clave `vivart_recorrido_v1`. No hay servicio backend nuevo ni tablas en PostgreSQL | Decisión de producto **P-05** y Principio IV de la Constitución (las 4 vistas de arquitectura asignan Mi recorrido al navegador) | Crear un microservicio de recorrido (viola la arquitectura compartida y el límite de servicios del proyecto) |
| 2 | Independencia de sesión | Iniciar sesión, cerrar sesión o cambiar de usuario no altera ni borra `localStorage` del recorrido | Requisitos FR-004, SC-008 y principio de privacidad (RF-01) | Sincronizar con cuenta de usuario (expresamente fuera del MVP en P-05 y RF-16) |
| 3 | Datos guardados (Snapshot de persistencia) | Se guarda un registro con: ID de función/franja, ID de actividad, título, artistas, fecha, hora inicio, hora fin, duración, sede (ID, nombre, tipo), avisos conocidos y fecha de guardado | Si el equipo archiva una actividad en el backend, la API pública responde 404 (FR-018); con el snapshot, el navegador puede seguir mostrándola como «Ya no está en la programación activa» | Guardar solo `functionId` (imposibilitaría mostrar la función archivada tras recibir 404) |
| 4 | Detección de cambios y cancelaciones | Al cargar la pantalla de Mi recorrido (o al consultar la web), el cliente sincroniza los ítems guardados con `/api/programacion/agenda` y/o `/api/programacion/activities/{id}` | Mantiene actualizados horarios, cambios de sede y avisos públicos de reprogramación y cancelación (FR-009, FR-010, RC-06) | Polling continuo en segundo plano (innecesario y consume recursos) |
| 5 | Detección de función agotada | Consulta al endpoint público del servicio de participación: `GET /api/participacion/sale-status?functionIds=id1,id2,...` (spec 005) | Reutiliza el contrato ya implementado por Diego sin duplicar datos ni lógica de cupos; si el servicio de participación no responde, hay degradación suave | Consultar endpoints privados o deducir cupos en el frontend (inseguro e impracticable) |
| 6 | Algoritmo de cruces (RC-02) | Dos eventos en la misma fecha se cruzan si y solo si ambos tienen hora de fin (o duración) conocida y se cumple `inicioA < finB && inicioB < finA`. Si `finA == inicioB` (tangentes), **no** hay cruce. Si falta fin o duración, **no** hay cruce | Cumple estrictamente RC-02, FR-006, FR-008 y SC-003. No asume duración arbitraria | Asumir 60 minutos si falta duración (prohibido por RNF-08: no inventar datos) |
| 7 | Búsqueda de alternativas | Se filtran las actividades de la Agenda pública (`/api/programacion/agenda`): misma sede (`venueId`), `status === 'scheduled'`, no canceladas, y cuya hora de inicio sea posterior a la referencia temporal actual (`reference.now` en hora de Loja) | Cumple FR-012, FR-013, FR-017 y SC-006. No calcula distancias ni usa sedes vecinas | Usar geolocalización o radios de cercanía (prohibido en el MVP por RNF-05 y decisión R-04) |
| 8 | Interacción de sustitución (FR-015) | En el modal/panel de alternativas, cada opción ofrece «Sustituir» (quita la original y guarda la alternativa atómicamente) y «Conservar ambas» (agrega la alternativa sin quitar la original) | Resuelve el caso de uso del visitante en un solo paso cómodo y sin fricción | Obligar al usuario a quitar una manualmente y luego ir a la Agenda a buscar la otra |
| 9 | Advertencia visual de cruces | Se muestra un cartel/alerta visual no bloqueante en cada par de funciones que se cruzan. Nunca deshabilita el botón de guardar ni impide mantenerlas | Cumple FR-007, RC-02 y SC-004: la advertencia informa, jamás bloquea | Bloquear el guardado si hay cruce (prohibido por RC-02) |
| 10 | Reloj de referencia común (RC-07) | El cliente lee `reference` de las respuestas de `/api/programacion/agenda` o `/now` para determinar la fecha/hora actual de Loja y si está fijado en demo | Cumple RC-07 y RNF-10: permite reproducir la programación de 2026 de forma idéntica en pruebas y demo | Usar el reloj local de la computadora (fallaría si el dispositivo está en otra zona horaria) |
| 11 | Sistema visual y accesibilidad | Sigue `app/web/styles.css`: modo claro, paleta violeta (`#3b0f66`) y atardecer, tipografías Bricolage Grotesque y Figtree; foco visible y soporte de teclado | Cumple RNF-01, RNF-03 y las reglas del equipo sobre taste-skill | Aplicar modo oscuro o alterar los colores de la marca |

---

## Mapa de pruebas contra los criterios de éxito

| Criterio | Cómo se prueba | Tipo de prueba |
|---|---|---|
| **SC-001** | Se guardan 3 funciones en `localStorage`, se simula recarga del navegador y se verifica que siguen presentes | Unitaria / Integración frontend |
| **SC-002** | Se guardan funciones en desorden y franjas; se verifica que la lista resultante está ordenada cronológicamente | Unitaria |
| **SC-003** | Casos de prueba: a) solapamiento conocido -> cruce; b) tangentes (`finA == inicioB`) -> no cruce; c) función sin fin conocido -> no cruce | Unitaria de algoritmos de cruce |
| **SC-004** | Se guarda una función que se cruza con otra ya guardada; se comprueba que el guardado se realiza exitosamente | Unitaria / Interfaz |
| **SC-005** | Una función guardada se actualiza con cambio de hora o cancelación en el backend; al abrir el recorrido refleja la hora nueva y el aviso | Integración frontend |
| **SC-006** | Se solicita alternativa para una cancelada en «Teatro Bolívar»; solo devuelve funciones no canceladas y futuras en «Teatro Bolívar»; si no hay, ofrece enlace a Agenda | Unitaria / Integración |
| **SC-007** | Función como «Lo que Somos» (solo inicio 09h00): al pasar las 09h00 muestra «Hora de inicio pasada» y nunca «Terminada» | Unitaria / Lógica de estados |
| **SC-008** | Se guardan funciones sin sesión, se inicia sesión con una cuenta, y se comprueba que el recorrido sigue intacto en `localStorage` y no se envía al backend | Integración web |
| **SC-009** | Función archivada que devuelve 404 en la API: se muestra en el recorrido con el distintivo de «Ya no está en la programación activa» y conserva su aviso | Unitaria / Integración frontend |
| **SC-010** | Se simula función agotada (`sold_out`) según `/sale-status`: se ofrece ver alternativas; si el servicio de venta responde error 500 o no responde, el recorrido no se rompe | Integración / Resiliencia |
| **SC-011** | Al pulsar «Sustituir» en una alternativa, la función previa es eliminada y la nueva es agregada en la misma operación | Unitaria / Estado |
