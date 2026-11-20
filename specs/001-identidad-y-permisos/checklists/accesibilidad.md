# Checklist de accesibilidad: Identidad, perfil y permisos

**Propósito**: comprobar que los requisitos de accesibilidad y uso móvil del spec 001 están completos, claros y se pueden medir. Evalúa lo **escrito**, no si el código funciona.

**Creado**: 2026-11-20

**Feature**: [spec.md](../spec.md)

**Nota de propiedad**: `[x]` significa que quien revisa considera que el requisito está bien escrito. La primera evaluación la hizo un agente a pedido del equipo y debe confirmarla una persona.

## Cobertura de RNF-01, RNF-02 y RNF-03

- [x] CHK001 - ¿El spec cita RNF-03 (contraste, foco visible, teclado, etiquetas, estados no solo por color)? El alcance cita RNF-02, 04, 05 y 09, pero no RNF-03; solo T031 y T067 lo mencionan. [Gap, Spec §Alcance] **Resuelto:** el alcance y la trazabilidad citan RNF-03 (FR-038).
- [x] CHK002 - ¿El spec cita RNF-01 (uso desde navegador móvil sin desbordamiento horizontal) para registro, inicio de sesión, verificación y recuperación? Solo aparece en AN-010 como restricción general. [Gap, Spec §AN-010] **Resuelto:** el alcance y la trazabilidad citan RNF-01; FR-038 lista los flujos de identidad.
- [x] CHK003 - ¿Se exigen campos etiquetados y errores junto al campo en el panel interno? [Completeness, Spec §FR-022, Historia 6 escenario 3, RNF-02]
- [x] CHK004 - ¿Se exige confirmación antes de revocar un permiso? [Completeness, RNF-02; tasks T056]
- [x] CHK005 - ¿Se exige que el error de contraseña se explique junto al campo? [Clarity, Spec §Historia 7 escenario 6]

## Claridad y medición

- [x] CHK006 - ¿Está definido un criterio medible de accesibilidad (por ejemplo, nivel de contraste o recorrido completo solo con teclado)? Ningún SC lo mide. [Measurability, Gap] **Resuelto:** SC-019: 100 % de los flujos solo con teclado y a 360 px, comprobado en T067.
- [x] CHK007 - ¿Se define el ancho de pantalla mínimo para comprobar «sin desbordamiento horizontal»? [Clarity, Gap, RNF-01] **Resuelto:** SC-019 fija 360 px.
- [x] CHK008 - ¿Se define cómo se anuncian los avisos y rechazos a lectores de pantalla (región viva)? Está en la web, no en los requisitos. [Gap] **Resuelto:** FR-038 exige anunciar avisos y errores a lectores de pantalla.
- [x] CHK009 - ¿Los mensajes de rechazo usan texto comprensible y no solo color o códigos? [Clarity, Spec §FR-022, SC-006]

## Escenarios

- [x] CHK010 - ¿Hay requisitos de foco tras cambiar de pantalla o tras un error (a dónde va el foco)? [Gap, Coverage] **Resuelto:** FR-038: foco al contenido al cambiar de pantalla y al campo con error tras un error.
- [x] CHK011 - ¿Se cubre el uso de los enlaces de correo (verificar, recuperar, activar) desde el celular, donde la persona suele abrirlos? [Coverage, Gap] **Resuelto:** FR-038 incluye las pantallas de verificar, restablecer y activar a las que llevan los correos.
- [x] CHK012 - ¿Se permite pegar la contraseña desde un gestor (no bloquear el pegado)? [Completeness, Spec §FR-028, Edge Cases]
- [x] CHK013 - ¿Se aclara que las pantallas de registro, inicio de sesión, Perfil y panel no tienen mockup y se diseñan desde los requisitos? [Assumption, Spec §Assumptions]

## Notas

- Revisado el 2026-11-20: 13 de 13. T067 se hizo y su resultado está en `quickstart.md`. Revisión delegada por el equipo en el agente.
