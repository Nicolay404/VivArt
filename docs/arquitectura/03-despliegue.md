# Vista 3: Despliegue

Propuesta del equipo, pendiente de contrastar con la nomenclatura que pida el docente.

Muestra qué unidades se despliegan por separado y dónde viven los datos en la demo.

```mermaid
flowchart TB
    subgraph cliente["Dispositivo del visitante o del personal"]
        nav["Navegador"]
    end

    subgraph demo["Entorno de demo"]
        entrada["Entrada HTTP común"]
        web["Interfaz web<br/>archivos estáticos"]
        ident["Servicio de identidad"]
        prog["Servicio de programación<br/>y consulta pública"]
        part["Servicio de participación"]

        subgraph bd["Contenedor PostgreSQL de la demo"]
            dbi[("Base lógica identidad<br/>credenciales propias")]
            dbp[("Base lógica programación<br/>credenciales propias")]
            dbq[("Base lógica participación<br/>credenciales propias")]
        end

        buzon["Buzón de pruebas de correo"]
    end

    nav --> entrada
    entrada --> web
    entrada --> ident
    entrada --> prog
    entrada --> part
    ident --> dbi
    prog --> dbp
    part --> dbq
    ident --> buzon
```

## Qué se despliega y cómo

| Unidad | Despliegue | Datos |
|---|---|---|
| Entrada HTTP común | Independiente | Ninguno |
| Interfaz web | Independiente | Ninguno (Mi recorrido usa el almacenamiento del navegador) |
| Servicio de identidad | Independiente | Base lógica propia |
| Servicio de programación | Independiente | Base lógica propia |
| Servicio de participación | Independiente | Base lógica propia |
| Buzón de pruebas | Solo en demo y pruebas | Mensajes de prueba, nunca correos reales |

## Reglas

- Las tres bases lógicas pueden vivir en **una misma instancia** en la demo, pero cada servicio usa **credenciales propias** y **no escribe** en la base de otro.
- Un servicio se puede publicar sin volver a desplegar los demás, siempre que respete los contratos de las APIs.
- En la demo la instancia es un contenedor **PostgreSQL** (`app/docker-compose.yml`). Al crearse, un script (`app/db/init/`) crea **una base y un usuario por servicio**; cada usuario solo puede conectarse a su base y nadie más que el superusuario entra a las bases administrativas. Hoy existen las de identidad, programación y participación. El script es idempotente y lo ejecuta el contenedor `db-preparar` en cada arranque, así una base nueva aparece sin borrar los datos existentes.
- La base solo publica su puerto en `127.0.0.1` (para las pruebas locales y un cliente de base de datos); los servicios no publican puertos y solo la entrada común es visible desde fuera.
- Las contraseñas de la base y las claves de servicio no se versionan: cada persona las genera con `node preparar-entorno.mjs` en `app/.env`.
- No hay gateway dedicado, broker de eventos ni malla de servicios.
