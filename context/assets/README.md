# Archivos de apoyo (`context/assets/`)

## Versionados en Git

| Archivo | Uso |
|---|---|
| `alforjita-referencia.jpeg` | Afiche de la mascota. Referencia visual; usar la ilustración como avatar requiere autorización. |
| `mockups/mapa-isometrico.jpeg` | Referencia del estilo isométrico del mapa. |
| `mockups/Agenda VIVART_ Vive el Festival.png` | Referencia visual de Agenda. |
| `mockups/Pasaporte Vivo por Loja.png` | Referencia visual de Mapa, Pasaporte y Rutas. |

Los mockups no son fuente de horarios, precios, cupos, direcciones ni accesibilidad (véase `../design/navegacion.md`).

## Fuera de Git: el PDF de programación

**Nombre exacto del archivo:** `PROGRAMACION 2026 digital.pdf` (con espacios y en mayúsculas, como se escribe aquí).

**Por qué no viene con el clon:** pesa unos 42 MB y el equipo prefirió conservarlo en una carpeta compartida. Git lo ignora mediante la entrada de `.gitignore` de ese archivo concreto; los mockups y el afiche sí se versionan.

**Enlace de la carpeta compartida:** *pendiente de integración.* Todavía no hay una ubicación compartida accesible para el equipo. Cuando exista, se anota aquí el enlace y quién administra el acceso. No se inventa ni se sustituye por otro archivo.

**Cómo colocarlo en tu copia local:**

1. Descarga `PROGRAMACION 2026 digital.pdf` de la carpeta compartida (cuando exista el enlace) o pídeselo a quien lo tenga.
2. Guárdalo en esta carpeta con el **mismo nombre exacto**: `context/assets/PROGRAMACION 2026 digital.pdf`.
3. Comprueba que Git lo ignora: `git status` no debe mostrarlo como archivo nuevo.

**Si no tienes el PDF:** puedes generar los specs con `context/requirements/funcionales.md`, que ya incluye los casos de referencia con sus páginas. No inventes datos de programación. La carga inicial de datos (RF-11) sí necesita el PDF.
