# Constitución de VIVART

## Principios fundamentales

### I. Desarrollo guiado por especificaciones

VIVART se desarrolla con Specification-Driven Development usando Spec Kit. Primero se escribe y se revisa el spec, después el plan técnico y solo al final la implementación. Un spec describe qué necesita el usuario y cómo se comprueba, no cómo se construye. Mientras no exista una instrucción explícita del equipo, nadie implementa el aplicativo.

### II. El contexto del producto es la fuente de verdad

Los requisitos viven en `context/`. Cada spec cita los RF, RC y RNF que cubre y no cambia sus IDs. No se inventan precios, cupos, duraciones, horarios, accesibilidad ni decisiones: lo que falta se señala como pendiente y se pregunta al equipo. Si un mockup contradice un requisito, prevalece el requisito. Cada regla tiene un solo RF dueño; los demás requisitos remiten a él.

### III. Máximo ocho specs

El producto se organiza en un máximo de **ocho specs**, uno por rama. La elección de arquitectura, la documentación y las ramas de integración no cuentan como specs ni pueden convertirse en un noveno.

### IV. Arquitectura compartida, en cuatro vistas, sin monolito modular

El proyecto tiene una sola arquitectura compartida por todos los specs, documentada en **cuatro vistas** con Mermaid o DeepWiki. **No se permite el monolito modular.** El estilo arquitectónico se elige y se acuerda por el equipo antes de los planes técnicos; los specs no lo fijan ni lo suponen.

### V. Cada spec es verificable

Todo spec incluye historias de usuario, requisitos verificables, flujos alternativos y criterios de aceptación. Cubre qué problema resuelve, quién lo usa, qué pasos sigue y qué ocurre cuando algo falla o cambia. Los permisos, la integridad (último cupo, entrada usada, sello único) y la privacidad se especifican de forma comprobable, con la verificación en servidor que exigen los RNF.

## Alcance y restricciones del MVP

- El MVP tiene **pagos de prueba**: no se procesan datos de tarjetas reales ni se hacen cobros reales, reservas gratuitas ni reembolsos.
- La web pública se diseña primero para celular; el panel interno, primero para escritorio.
- La interfaz está en español, los horarios en hora de Loja y los precios en USD.
- La ausencia de precio no significa gratuidad; nunca se completan datos no confirmados.
- Una franja de apertura no entrega sellos ni cuenta para rutas; solo las funciones con fecha y hora.
- El PDF de programación no viene con el clon; se conserva en una carpeta compartida (véase `context/assets/README.md`).

## Flujo de trabajo

- **Una rama por spec**, con tres dígitos y nombre descriptivo (por ejemplo, `001-identidad-y-permisos`). Si Spec Kit crea la rama, se reutiliza.
- Los cambios llegan a `main` mediante pull request; nadie hace push directo a `main` ni fusiona su propio PR sin revisión del equipo.
- Los commits y PR no llevan coautoría ni créditos de ninguna IA.
- El PDF, las credenciales, los archivos `.env` y los archivos generados para un agente concreto no se versionan.

## Gobierno

Esta constitución prevalece sobre las demás prácticas del proyecto. `AGENTS.md` contiene las reglas operativas para los agentes y resume estas restricciones; si difieren, rige este documento. Una enmienda se propone por pull request, se acuerda en el equipo, actualiza la versión y deja constancia de qué cambió. Todo PR de un spec debe verificar que cumple estos principios.

**Version**: 1.0.0 | **Ratified**: 2026-11-19 | **Last Amended**: 2026-11-19
