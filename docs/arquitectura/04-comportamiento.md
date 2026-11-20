# Vista 4: Comportamiento

Propuesta del equipo, pendiente de contrastar con la nomenclatura que pida el docente.

Muestra los flujos críticos entre piezas. Los dos primeros son del spec 001 y el tercero del spec 005, todos implementados; el cuarto **está identificado pero no implementado**.

## 1. Inicio de sesión (spec 001)

```mermaid
sequenceDiagram
    actor U as Usuario
    participant W as Interfaz web
    participant E as Entrada HTTP
    participant I as Servicio de identidad

    U->>W: Escribe correo y contraseña
    W->>E: POST /api/identidad/auth/login
    E->>I: POST /auth/login
    I->>I: Comprueba credenciales y estado de la cuenta
    I-->>E: 200 con cookie de sesión opaca (HttpOnly)
    E-->>W: 200 persona, roles y correo verificado
    W-->>U: Sesión iniciada
```

## 2. Retorno a la acción original tras identificarse (spec 001)

El servicio de identidad conserva la acción pendiente y devuelve a la persona al punto de origen. **No ejecuta el pago ni el canje**: el servicio dueño revalida y define qué ocurre después.

```mermaid
sequenceDiagram
    actor U as Visitante
    participant W as Interfaz web
    participant I as Servicio de identidad
    participant P as Servicio de participación

    U->>W: Intenta pagar o abre el QR de un sello
    W->>I: POST /auth/pending-actions (tipo y referencia)
    I-->>W: Acción pendiente guardada, requiere identificarse
    W-->>U: Pide iniciar sesión o registrarse
    U->>W: Se identifica (si es nueva, verifica su correo y vuelve a iniciar sesión)
    W->>I: GET /auth/resume
    I-->>W: Destino de retorno, correo verificado, sin ejecutar nada
    W-->>U: Vuelve al carrito o al enlace del QR
    W->>P: Revalida la vigencia (reglas del spec 05 o 06)
    P->>I: introspect de la sesión
    I-->>P: Persona, roles y correo verificado
    P-->>W: Vigente o motivo de rechazo
    W-->>U: Muestra el resultado, el paso final lo define el spec dueño
```

## 3. Retención y venta del último cupo (spec 005)

Implementado con un bloqueo de la fila de venta de cada función (`SELECT … FOR UPDATE`) dentro de la transacción que crea el pedido; probado con veinte solicitudes simultáneas.

```mermaid
sequenceDiagram
    actor U1 as Usuario A
    actor U2 as Usuario B
    participant P as Servicio de participación
    participant D as Datos de participación

    U1->>P: Inicia el pago de la última entrada
    U2->>P: Inicia el pago de la última entrada
    P->>D: Transacción: retener cupo si hay disponible
    D-->>P: Retención concedida a A
    P->>D: Transacción: retener cupo si hay disponible
    D-->>P: Sin cupo disponible
    P-->>U1: Pedido pendiente con retención de 10 minutos
    P-->>U2: Sin cupo: revisa tu carrito
```

## 4. Canje de un sello único (spec 006, identificado, no implementado)

```mermaid
sequenceDiagram
    actor U as Usuario
    participant P as Servicio de participación
    participant D as Datos de participación

    U->>P: Abre el enlace del QR dos veces a la vez
    P->>D: Crear sello (usuario, función) con restricción única
    D-->>P: Primer intento crea el sello
    P->>D: Crear sello (usuario, función) con restricción única
    D-->>P: Segundo intento encuentra el sello existente
    P-->>U: Muestra el mismo sello en ambos casos
```
