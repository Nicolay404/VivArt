# Despliegue en Render

VIVART se despliega en Render con el Blueprint [`render.yaml`](../render.yaml): una base PostgreSQL y cuatro
servicios web (identidad, programación, participación y la entrada común). La dirección que abre la gente es la de
la entrada: `https://vivart-entrada.onrender.com`.

## Diferencias con la demo con contenedores

| Demo local (`app/docker-compose.yml`) | Render (plan gratis) | Por qué |
|---|---|---|
| Una base y un usuario por servicio | Una base con un **esquema** por servicio (`DB_SCHEMA`) | Render permite una sola base gratis por workspace |
| Los servicios se llaman por la red interna (`http://identidad:3001`) | Se llaman por su dirección pública `https://…onrender.com` | Los servicios gratis no reciben tráfico de la red privada |
| `programacion-cargar` carga la programación al arrancar | Se carga una vez desde una computadora (paso 3) | Los trabajos de un solo uso no están en el plan gratis |

Sigue en **modo demo**: simulador de pago y buzón de pruebas (`/demo/buzon`), sin cobros ni correos reales.
Los servicios gratis se duermen tras 15 minutos sin uso y la primera visita tarda alrededor de un minuto.
La base gratis de Render vence a los 30 días.

## 1. Crear el Blueprint

1. En Render: **New → Blueprint**, elegir el repositorio y la rama `main`.
2. Render pide los valores marcados como `sync: false`: las claves entre servicios. Se generan al azar y van
   emparejadas así (la misma clave aparece en dos servicios):

   | Servicio | Variable | Valor |
   |---|---|---|
   | vivart-identidad | `SERVICE_KEYS` | `programacion:<clave A>,participacion:<clave B>` |
   | vivart-programacion | `IDENTIDAD_SERVICE_KEY` | `<clave A>` |
   | vivart-programacion | `SERVICE_KEYS` | `participacion:<clave B>` |
   | vivart-participacion | `IDENTIDAD_SERVICE_KEY` | `<clave B>` |
   | vivart-participacion | `SERVICE_KEYS` | `programacion:<clave A>` |

   Para generar una clave: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
   Nunca se escriben en el repositorio.
3. **Apply**. Render construye las cuatro imágenes y crea la base.

## 2. Comprobar las direcciones

`render.yaml` supone que cada servicio queda en `https://<nombre>.onrender.com`. Si Render le añadió un sufijo a
alguno (porque el nombre ya estaba ocupado), hay que corregir esa dirección en las variables `IDENTIDAD_URL`,
`PROGRAMACION_URL`, `PARTICIPACION_URL`, `PUBLIC_BASE_URL` y `ALLOWED_ORIGINS` de los demás servicios.

## 3. Cargar la programación y crear el administrador

Se hace una sola vez, desde una computadora con el repositorio y Node 24. En Render, en la base `vivart-db`,
copiar la **External Database URL** y usarla en estos comandos (desde la raíz del repositorio):

```bash
# Programación oficial FIAVL 2026 (243 actividades) y los 9 lugares del Circuito Cultural en el mapa
cd app/services/programacion && npm ci
DATABASE_URL="<External Database URL>" DB_SCHEMA=programacion node bin/cargar-programacion.js

# Primera cuenta administradora: imprime un enlace de activación de un solo uso
cd ../identidad && npm ci
DATABASE_URL="<External Database URL>" DB_SCHEMA=identidad MAIL_TRANSPORT=console \
  PUBLIC_BASE_URL=https://vivart-entrada.onrender.com \
  node bin/crear-primer-administrador.js --email admin@vivart.test
```

Abrir el enlace impreso y elegir la contraseña. Los dos comandos se pueden repetir sin duplicar nada.
