// Clientes HTTP para /api/identidad y /api/programacion.
// Todas las peticiones viajan con cookie de sesión same-origin; las que cambian estado envían JSON.

const BASES_PERMITIDAS = new Set(['/api/identidad', '/api/programacion']);

function construirUrlSegura(base, ruta) {
  if (!BASES_PERMITIDAS.has(base)) throw new Error('Base de API no permitida.');
  const texto = String(ruta ?? '');
  if (!texto.startsWith('/') || texto.startsWith('//') || texto.includes('\\')) {
    throw new Error('Ruta de API inválida.');
  }
  const url = new URL(base + texto, location.origin);
  if (url.origin !== location.origin || !url.pathname.startsWith(`${base}/`)) {
    throw new Error('Destino de API fuera de origen.');
  }
  return url.pathname + url.search;
}

async function llamar(base, metodo, ruta, cuerpo) {
  let destino;
  try {
    destino = construirUrlSegura(base, ruta);
  } catch {
    return {
      ok: false,
      status: 400,
      datos: { error: 'invalid_request', message: 'La solicitud no es válida.' },
    };
  }
  try {
    const respuesta = await fetch(destino, {
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
