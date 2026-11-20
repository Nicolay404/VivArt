# Checklist de seguridad: Identidad, perfil y permisos

**Propósito**: comprobar que los requisitos de seguridad del spec 001 están completos, claros, coherentes y se pueden medir. Evalúa lo **escrito** (spec, plan, research y contratos), no si el código funciona.

**Creado**: 2026-11-20

**Feature**: [spec.md](../spec.md)

**Nota de propiedad**: `[x]` significa que quien revisa considera que el requisito está bien escrito; no significa que la implementación esté terminada. La primera evaluación la hizo un agente a pedido del equipo y debe confirmarla una persona.

## Autenticación y credenciales

- [x] CHK001 - ¿Están definidos los datos exactos que pide el registro y los que no debe pedir? [Completeness, Spec §FR-028, SC-010]
- [x] CHK002 - ¿Está cuantificado el requisito de contraseña (mínimo 15, máximo admitido de al menos 64, sin reglas de composición, espacios permitidos)? [Clarity, Spec §FR-028, SC-011]
- [x] CHK003 - ¿Se especifica que la recuperación responde igual exista o no el correo? [Completeness, Spec §FR-029, SC-013]
- [x] CHK004 - ¿Se especifica que el **registro** tampoco revela si un correo ya existe? El spec solo dice que no se crea una segunda cuenta; la respuesta neutra está en el plan, no en el spec. [Gap, Spec §Edge Cases, research.md] **Resuelto:** FR-036 y SC-020 exigen la misma respuesta para correo nuevo y repetido.
- [x] CHK005 - ¿Están definidos el uso único y el vencimiento de los enlaces de verificación y recuperación? [Completeness, Spec §FR-029, SC-014]
- [x] CHK006 - ¿Los plazos exactos de los enlaces están asignados a un documento dueño (plan técnico)? [Traceability, Spec §FR-030, research.md]
- [x] CHK007 - ¿Se define un límite de intentos de inicio de sesión o de recuperación en los requisitos? Solo aparece en el plan como valor técnico; el spec no lo pide. [Gap, plan.md] **Resuelto:** FR-037 lo exige; los valores están en el plan (`research.md`, decisión 13), sin inventar números en el spec.
- [x] CHK008 - ¿Se define la vigencia de la sesión y el cierre por inactividad? Pendiente de producto P-10. [Gap, Spec §Assumptions] **Resuelto:** FR-041 y SC-023 (P-10): 2 h sin uso con rol interno, 7 días sin él, máximo de 7 días.

## Autorización

- [x] CHK009 - ¿Está escrito que los permisos se verifican en el servidor, incluso con solicitudes directas? [Completeness, Spec §FR-012, FR-017, SC-001]
- [x] CHK010 - ¿Está definida la regla de permisos como suma de roles activos y rechazo por defecto? [Clarity, Spec §FR-010]
- [x] CHK011 - ¿Se especifica que la revocación surte efecto en la siguiente acción, sin depender de lo que muestre la interfaz? [Clarity, Spec §FR-017, Edge Cases]
- [x] CHK012 - ¿Se define qué ocurre al revocar el último administrador o al auto-revocarse un administrador? Pendiente P-10. [Gap, Spec §Edge Cases] **Resuelto:** FR-039 y SC-021 (P-10): no se quita el rol a la última cuenta administradora, ni con revocaciones simultáneas.
- [x] CHK013 - ¿Se define si una persona puede auto-asignarse roles? Se asume que no (RF-04), pero no hay requisito explícito. [Ambiguity, Spec §Assumptions] **Resuelto:** FR-040 y SC-022 (P-10): nadie se asigna roles ni funciones.
- [x] CHK014 - ¿Está acotado el personal de acceso a sus funciones asignadas, incluido el caso de cero funciones? [Coverage, Spec §FR-015, Edge Cases, SC-009]
- [x] CHK015 - ¿Se especifica que el registro público nunca otorga permisos internos y que no hay credenciales predeterminadas? [Completeness, Spec §FR-027, FR-028, SC-015]
- [x] CHK016 - ¿Está definido cómo autentican los otros servicios al consultar permisos (credencial de servicio)? [Completeness, contracts/introspeccion.openapi.yaml]

## Privacidad y rechazos

- [x] CHK017 - ¿Está escrito que el rechazo indica el rol faltante sin revelar título, texto ni autor? [Clarity, Spec §FR-022, FR-023, SC-006]
- [x] CHK018 - ¿Está prohibido exponer credenciales o códigos privados en registros operativos? [Completeness, Spec §FR-026]
- [x] CHK019 - ¿Está definido que el historial guarda quién, cuándo y sobre qué, y que solo lo consulta el administrador? [Completeness, Spec §FR-024, FR-025, SC-007]
- [x] CHK020 - ¿Se define cuánto tiempo se conserva el historial y si se puede borrar? El plan lo hace de solo anexar, pero el spec no fija retención. [Gap, Spec §FR-024] **Resuelto:** FR-025: durante el MVP el historial se conserva completo, sin plazo de borrado y sin poder modificarse.

## Retorno a la acción

- [x] CHK021 - ¿Está escrito que retomar no ejecuta pagos ni canjes? [Clarity, Spec §FR-033, SC-017]
- [x] CHK022 - ¿El destino del retorno está definido por el sistema y no por la persona (sin redirecciones abiertas)? [Completeness, data-model.md §pending_actions]
- [x] CHK023 - ¿Se define cuánto tiempo se conserva la acción pendiente mientras se verifica el correo? Pendiente P-11. [Gap, Spec §Assumptions] **Resuelto:** FR-042 (P-11): 24 h y revalidación al retomar.

## Coherencia

- [x] CHK024 - ¿El máximo de contraseña es coherente entre documentos? El spec pide «al menos 64», el plan fija 128 y SC-011 solo mide de 15 a 64: no hay contradicción, pero el máximo real (128) no aparece en el spec. [Consistency, Spec §FR-028, research.md] **Resuelto:** FR-028 cita el máximo de 128 del plan; SC-011 mide de 15 a 64 y la prueba unitaria cubre 128 y 129.
- [x] CHK025 - ¿Está claro quién ejecuta y registra la reasignación de borradores? FR-024 la pone en el historial de este spec, pero el servicio de identidad solo concede el permiso `draft.reassign`; el registro real depende del spec 02. [Conflict, Spec §FR-020, FR-024] **Resuelto:** FR-020 y FR-024: el permiso es de este spec; la reasignación y su registro, del spec 02.

## Notas

- Revisado el 2026-11-20: 25 de 25. P-10 y P-11 los decidió el equipo; el resto se resolvió en la redacción del spec. Revisión delegada por el equipo en el agente.
