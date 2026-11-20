// Clientes HTTP para /api/identidad y /api/programacion.
// Todas las peticiones viajan con cookie de sesión same-origin; las que cambian estado envían JSON.

async function llamar(base, metodo, ruta, cuerpo) {
  try {
    const respuesta = await fetch(base + ruta, {
      method: metodo,
      credentials: 'same-origin',
      headers: cuerpo !== undefined ? { 'content-type': 'application/json' } : {},
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
    let datos = null;
    if (respuesta.status !== 204) {
      try {
        datos = await respuesta.json();
      } catch {
        datos = null;
      }
    }
    return { ok: respuesta.ok, status: respuesta.status, datos };
  } catch {
    return {
      ok: false,
      status: 0,
      datos: { error: 'network_error', message: 'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.' },
    };
  }
}

export const apiIdentidad = (metodo, ruta, cuerpo) => llamar('/api/identidad', metodo, ruta, cuerpo);
export const apiProgramacion = (metodo, ruta, cuerpo) => llamar('/api/programacion', metodo, ruta, cuerpo);
