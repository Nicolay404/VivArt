# Quickstart: validar la compra y el control de entradas

Guía de ejecución y comprobación. Los detalles viven en los [contratos](contracts/) y en el [modelo de datos](data-model.md).

## Requisitos

- Docker Desktop abierto y Node.js 24.
- `app/.env` generado con `node preparar-entorno.mjs` (desde `app/`). Si ya existía, vuelve a ejecutarlo: añade las variables nuevas de participación sin cambiar las que ya tenías.

## Ejecutar las pruebas

```text
cd app
docker compose up -d db db-preparar
npm test
```

Ejecuta las pruebas de identidad, programación, participación (incluidas las de concurrencia) y de la entrada común, con el recorrido de punta a punta de los tres servicios.

## Ejecutar la demo

```text
cd app
docker compose up -d --build
docker compose exec programacion node bin/cargar-ejemplo.js
```

El simulador de pago está activo en la demo (`PAYMENT_SIMULATOR=on`). Nada cobra dinero ni pide datos de tarjeta.

Para la demo hacen falta tres cuentas: un **administrador**, un **usuario con correo verificado** y una **persona de acceso** con una función asignada (las asigna el administrador desde Roles).

## Escenarios de comprobación manual

| Escenario | Pasos | Resultado esperado |
|---|---|---|
| Configurar venta | Como administrador, en la ficha de una función de pago con precio, poner cupo 2 y habilitar la venta | La Agenda muestra «Disponible» y la ficha «Agregar al carrito» |
| Sin precio | Intentar habilitar la venta de una función gratuita o sin precio | Rechazado: «la actividad no es de pago con precio» |
| Carrito sin cuenta | Sin sesión, agregar 2 entradas de dos funciones; intentar llegar a 7 | Total en USD; aviso de cruce si ambas tienen fin conocido; no deja pasar de 6 |
| Pagar | Iniciar el pago sin sesión, identificarse y volver | Vuelve al carrito cotizado; al aceptar, pedido pendiente con 10 minutos |
| Último cupo | Con cupo 1, dos navegadores inician el pago a la vez | Solo uno obtiene el pedido; el otro ve «agotada» |
| Pago confirmado | En el simulador elegir «confirmado» | Aparecen N entradas en Mis entradas con QR y código distintos |
| Pago tardío | Elegir «confirmado después de vencer» | Pedido «en revisión»; incidencia en el panel; sin entradas |
| Cierre de venta | Fijar `CLOCK_FIXED` a 20 minutos antes del inicio | La función se ve «Venta cerrada» y no entra al carrito |
| Sin conexión | Abrir Mis entradas, cortar la red y recargar | Se ve el QR con «Estado sin confirmar» |
| Validar | Como persona de acceso: abrir el control, escribir el código alternativo; repetir | Primero «Admitida»; después «Entrada ya usada» |
| Rechazos | Validar una entrada de otra función y con el control cerrado | «Función incorrecta» y «Control de acceso cerrado» |
| Cancelar con ventas | Como publicador, cancelar la función con entradas | Rechazado: hace falta administrador. Como administrador: se cancela, Mis entradas muestra «Función cancelada» con el aviso y el acceso la rechaza |
| Reprogramar | Reprogramar la función con una entrada sin usar | La misma entrada se admite con los datos nuevos |
| Invalidar | Como administrador, invalidar una entrada con motivo | Mis entradas la muestra invalidada; el acceso la rechaza |

## Resultados registrados

| Fecha | Comprobación | Resultado |
|---|---|---|
| 2026-11-20 | `npm test` (identidad, programación, participación y entrada común) | 220 pruebas en verde, incluidas las de concurrencia (último cupo, entrada usada dos veces, confirmación repetida) y el recorrido de punta a punta con los tres servicios |
| 2026-11-20 | Demo en el navegador (escritorio) | Configurar venta (cupo 2), agregar al carrito, pagar con el simulador, ver dos entradas con QR y código, admitir con el código alternativo y rechazar al repetirlo («Entrada ya usada»). Sin errores en la consola |
| 2026-11-20 | Pendiente de comprobar | Lectura del QR con la cámara de un celular real (Chrome Android) y la copia sin conexión de Mis entradas |
