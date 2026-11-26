// Clientes HTTP para /api/identidad y /api/programacion.
// Todas las peticiones viajan con cookie de sesión same-origin; las que cambian estado envían JSON.

const BASES_PERMITIDAS = new Set(['/api/identidad', '/api/programacion', '/api/participacion']);

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

// Despertar servicios dormidos (hospedaje gratis como Render): la entrada responde 503 «service_waking» con la
// dirección /health del servicio. Una visita desde el navegador lo despierta; luego se repite la petición.
const INTENTOS_DESPERTAR = 4;
const ESPERA_DESPERTAR_MS = 45000;
const MENSAJE_DESPERTAR = 'Estamos encendiendo VIVART. La primera carga tarda unos segundos…';

function direccionParaDespertar(datos) {
  try {
    const url = new URL(String(datos?.wake ?? ''));
    return url.protocol === 'https:' && url.pathname === '/health' && !url.search ? url.href : null;
  } catch {
    return null;
  }
}

async function despertar(direccion) {
  const zona = document.querySelector('#avisos');
  if (zona && !zona.textContent) {
    const p = document.createElement('p');
    p.className = 'aviso';
    p.setAttribute('role', 'status');
    p.textContent = MENSAJE_DESPERTAR;
    zona.append(p);
  }
  const corte = new AbortController();
  const temporizador = setTimeout(() => corte.abort(), ESPERA_DESPERTAR_MS);
  try {
    // no-cors: solo importa que la visita llegue; la respuesta no se lee.
    await fetch(direccion, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: corte.signal });
  } catch {
    // Si tarda demasiado, se vuelve a intentar la petición igualmente.
  } finally {
    clearTimeout(temporizador);
  }
}

// Render no cuenta como uso lo que llega desde la entrada: mientras la página está abierta y visible, el navegador
// visita cada 4 minutos los servicios que ya tuvo que despertar, para que no se vuelvan a dormir.
const MANTENER_DESPIERTO_MS = 4 * 60 * 1000;
const despiertos = new Set();
let latido = null;

function mantenerDespierto(direccion) {
  despiertos.add(direccion);
  latido ??= setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    for (const d of despiertos) fetch(d, { mode: 'no-cors', cache: 'no-store', credentials: 'omit' }).catch(() => {});
  }, MANTENER_DESPIERTO_MS);
}

function quitarMensajeDespertar() {
  const zona = document.querySelector('#avisos');
  if (zona && zona.textContent === MENSAJE_DESPERTAR) zona.replaceChildren();
}

async function llamar(base, metodo, ruta, cuerpo) {
  let resultado = await llamarUnaVez(base, metodo, ruta, cuerpo);
  for (let i = 0; i < INTENTOS_DESPERTAR && resultado.status === 503 && resultado.datos?.error === 'service_waking'; i++) {
    const direccion = direccionParaDespertar(resultado.datos);
    if (!direccion) break;
    await despertar(direccion);
    mantenerDespierto(direccion);
    resultado = await llamarUnaVez(base, metodo, ruta, cuerpo);
  }
  quitarMensajeDespertar();
  return resultado;
}

async function llamarUnaVez(base, metodo, ruta, cuerpo) {
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
export const apiParticipacion = (metodo, ruta, cuerpo) => llamar('/api/participacion', metodo, ruta, cuerpo);
