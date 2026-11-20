# Encargo de pulido visual: spec 005 (carrito, pedido, Mis entradas, control de acceso y panel de ventas)

Encargo para el agente de diseño (Antigravity, `agy`). El spec 005 está **terminado y probado**: backend, interfaz funcional y pruebas. Falta **solo pulir el aspecto**. Copia el bloque de abajo como prompt.

---

```text
Eres el agente de diseño de VIVART (Festival Internacional de Artes Vivas de Loja). Tu tarea es PULIR el aspecto de
las pantallas del spec 005 «Carrito, compra y control de entradas»: que se vean hermosas, claras y excelentes en
celular. La interfaz ya funciona y está probada: NO cambies su lógica.

## 0. Antes de empezar (obligatorio)
1. Lee y respeta AGENTS.md y .specify/memory/constitution.md.
2. Trabaja en una rama derivada de 005-compra-y-entradas, llamada 005-pulido-visual, SOLO después de que el PR de
   005-compra-y-entradas esté fusionado en main (actualiza main antes). Se borra al fusionarse. Sin coautoría ni
   créditos de IA en commits o PR. No crees copias del repositorio ni carpetas de prueba. Nunca fusiones el PR.
3. Lee, en este orden:
   - specs/005-compra-y-entradas/spec.md           (qué debe pasar; las reglas que la pantalla no puede ocultar)
   - context/design/navegacion.md
   - context/assets/mockups/Agenda VIVART_ Vive el Festival.png y Pasaporte Vivo por Loja.png (referencia visual:
     las tarjetas con fotos, píldoras, jerarquía y sellos; NO hay mockup de estas pantallas, así que tú las propones)
   - app/web/styles.css  (el sistema visual vigente: tokens, modo claro, Bricolage Grotesque + Figtree, violeta)
   - los módulos de las pantallas: app/web/js/carrito.js, entradas.js, acceso.js, panel-ventas.js, y el botón de
     compra en app/web/js/ficha-componente.js
4. Levanta la demo (Docker Desktop abierto):
     cd app
     node preparar-entorno.mjs
     docker compose up -d --build
     docker compose exec programacion node bin/cargar-ejemplo.js
   Crea cuentas desde /registro y /demo/buzon; el administrador y la persona de acceso se preparan como en
   specs/005-compra-y-entradas/quickstart.md. Para comprar, el administrador debe habilitar la venta de una
   función de una actividad de pago CON precio (por ejemplo «Obra de ejemplo con doble función»).

## 1. Pantallas a pulir (todas)
- Estado de venta y «Agregar al carrito» dentro de la ficha (/actividad/{id}).
- Carrito (/carrito): cantidades, total en USD, aviso de cruces de horario, motivos por los que algo no se vende.
- Pedido (/pedido/{id}): cuenta regresiva de la retención y el simulador de pago de prueba (tres botones).
- Mis entradas (/mis-entradas): tarjeta de entrada con QR grande y legible, código alternativo, estados
  (válida, usada, invalidada, función cancelada, estado sin confirmar) y el aviso de que el estado puede estar
  desactualizado sin conexión.
- Control de acceso (/acceso): pensado para una persona de pie en la puerta con el celular: abrir y cerrar el
  control, el campo del código y un resultado ENORME, inconfundible y legible al sol (Admitida / Rechazada con su motivo).
- Panel de ventas (/panel/ventas y /panel/ventas/actividad/{id}), escritorio primero.

## 2. Restricciones técnicas (no negociables)
- JavaScript vanilla con módulos ES, SIN framework, SIN compilación, SIN dependencias, SIN CDN. La CSP es
  "default-src 'self'". Prohibido innerHTML, outerHTML, insertAdjacentHTML, document.write y geolocalización.
  Los atributos style en línea y los scripts en línea están prohibidos. app/edge/test/edge.test.js lo comprueba.
- Puedes tocar libremente app/web/styles.css y la estructura de DOM (clases, orden, iconos) de esas pantallas.
- NO cambies: las llamadas a la API, las rutas, las reglas ni los textos que explican una regla (límite de seis,
  «Por confirmar», «no se cobra dinero», «Estado sin confirmar», motivos de rechazo). NO toques app/services/,
  app/edge/server.js, docker-compose ni los contratos.
- El QR se inserta con DOMParser desde el SVG del servidor: no lo reemplaces por otra técnica sin revisar la CSP.
- La copia sin conexión de Mis entradas usa la Cache API: no la cambies a localStorage (SonarCloud lo rechaza).

## 3. Reglas de producto que el diseño NO puede ocultar
- Pagos de prueba: debe verse que «no se cobra dinero ni se piden datos de tarjeta». No pidas ningún dato de tarjeta.
- Nunca muestres el número de cupos al público: solo «Entradas disponibles», «Agotada» o «Venta cerrada».
- Un precio ausente NO es gratis. Lo que no se sabe se muestra como «Por confirmar».
- Una función gratuita no ofrece carrito. Máximo seis entradas por pedido.
- Un resultado de acceso rechazado debe mostrar su motivo; nunca solo un color.

## 4. Criterios de calidad
- Celular primero: probar a 360 px y 390 px, y escritorio a 1440 px. Zonas táctiles de 44 px o más. Sin
  desplazamiento horizontal.
- Contraste AA, foco visible, navegación completa por teclado y lector de pantalla (RNF-03). Respeta
  prefers-reduced-motion. Siempre modo claro (decisión del equipo, no hay modo oscuro).
- Coherencia con el diseño vigente (violeta, atardecer de Loja, tarjetas redondeadas). Si usas la skill
  design-taste-frontend, úsala solo como guía: prevalecen los mockups y styles.css, y no cambies la paleta.

## 5. Antes de terminar
1. Corre las pruebas: cd app && npm test (debe seguir todo en verde). Si añadiste subcarpetas en app/web/, la
   prueba de la entrada ya las recorre.
2. Revisa en el navegador, a 360 px y 1440 px, cada pantalla de la sección 1, con datos reales de la demo.
3. Registra lo comprobado en specs/005-compra-y-entradas/quickstart.md (tabla «Resultados registrados»).
4. Abre un PR hacia main y revisa que la CI y SonarCloud pasen; corrige lo que falle. NO lo fusiones.
5. Resume qué cambiaste y qué dejaste sin hacer.
```
