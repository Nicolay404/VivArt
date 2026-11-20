# Contexto de VIVART

Esta carpeta reúne los insumos para generar las especificaciones de VIVART con Spec Kit. Sirve a cualquier agente o persona que trabaje en el repositorio. **No contiene los specs finales ni fija una arquitectura.** Las reglas de trabajo del repositorio están en `../AGENTS.md`.

## Qué leer

1. `idea/idea.md`: propósito, público y alcance del proyecto.
2. `requirements/funcionales.md`: capacidades, actores, reglas comunes (RC), flujos de la web pública y del panel interno, y las decisiones aún pendientes.
3. `requirements/no-funcionales.md`: condiciones de accesibilidad, seguridad, integridad y funcionamiento, con la columna que las enlaza a los RF y RC.
4. `design/navegacion.md`: organización de las pantallas, referencias visuales y pantallas sin mockup.
5. `assets/PROGRAMACION 2026 digital.pdf`: fuente para contrastar la programación y sus casos especiales. **El PDF no viene con el clon**: Git lo ignora y se conserva en una carpeta compartida (enlace pendiente). Cómo colocarlo localmente está en `assets/README.md`. Los mockups no son fuentes de horarios, precios o cupos.
6. `assets/alforjita-referencia.jpeg`: afiche de la mascota. Es una referencia; usarlo como avatar requiere autorización.
7. `assets/mockups/`: referencias visuales (mapa isométrico, Agenda, y Mapa, Pasaporte y Rutas). Sus diferencias con los requisitos y las pantallas que aún no tienen mockup están en `design/navegacion.md`.
8. `research/`: notas técnicas, si existen. No es un requisito para iniciar los specs.

## Encargo para Spec Kit

Lee el contexto y propón primero cómo organizar VIVART en **un máximo de ocho specs**. Para cada uno, indica objetivo, actores, alcance, flujo principal y dependencias. Conserva los requisitos del público, de los editores, de los publicadores, de los administradores y del personal de acceso. Señala las decisiones pendientes (`funcionales.md`, «Decisiones pendientes») sin inventarlas.

Después de revisar el reparto, genera cada spec con sus historias de usuario, requisitos verificables, flujos alternativos y criterios de aceptación. El equipo trabajará **una rama por spec**. No implementes el aplicativo en esta etapa.

## Restricciones académicas

Usar **Specification-Driven Development con Spec Kit**. El proyecto tendrá **una arquitectura compartida**, documentada en **cuatro vistas** con Mermaid o DeepWiki. **No se permite el monolito modular**. La elección del estilo arquitectónico se toma aparte, antes de los planes técnicos; no debe convertirse en un noveno spec.
