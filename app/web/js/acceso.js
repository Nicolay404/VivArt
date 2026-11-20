// Control de acceso en la sede (spec 005: FR-023 a FR-028). Celular primero.
// El personal abre el control de su función y valida escaneando el QR (si el navegador lo permite) o
// escribiendo el código alternativo. El servidor decide; la pantalla solo muestra el resultado y su motivo.
import { h, icono, aviso } from './dom.js';
import { apiParticipacion } from './api.js';
import { formatoFecha } from './format.js';

function resultado(r) {
  if (!r) return h('div', { class: 'acceso-resultado', 'aria-live': 'assertive' });
  return h(
    'div',
    { class: `acceso-resultado ${r.admitted ? 'acceso-admitida' : 'acceso-rechazada'}`, role: 'status', 'aria-live': 'assertive' },
    icono(r.admitted ? 'check' : 'cerrar', 'icono'),
    h('strong', {}, r.admitted ? 'Admitida' : 'Rechazada'),
    h('span', {}, r.message),
    r.ticket?.functionTitle ? h('span', { class: 'ayuda' }, r.ticket.functionTitle) : null,
  );
}

/** Lector de QR con la cámara si el navegador tiene BarcodeDetector; si no, solo el código escrito. */
function lectorQr(alLeer) {
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
    return h('p', { class: 'ayuda' }, 'Este navegador no puede leer QR con la cámara: escribe el código alternativo.');
  }
  const video = h('video', { class: 'acceso-video', playsinline: true, muted: true, hidden: true });
  let flujo = null;
  let activo = false;

  async function detener() {
    activo = false;
    flujo?.getTracks().forEach((t) => t.stop());
    flujo = null;
    video.hidden = true;
    boton.textContent = 'Escanear con la cámara';
  }

  async function iniciar() {
    if (activo) return detener();
    try {
      flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch {
      return aviso('No se pudo usar la cámara. Escribe el código alternativo.', 'alerta');
    }
    video.srcObject = flujo;
    video.hidden = false;
    await video.play();
    activo = true;
    boton.textContent = 'Detener la cámara';
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const buscar = async () => {
      if (!activo || !video.isConnected) return detener();
      try {
        const [codigo] = await detector.detect(video);
        if (codigo?.rawValue) {
          await detener();
          return alLeer(codigo.rawValue);
        }
      } catch {
        // Fotograma ilegible: se intenta con el siguiente.
      }
      requestAnimationFrame(buscar);
    };
    buscar();
  }

  const boton = h('button', { type: 'button', class: 'secundario', onclick: iniciar }, 'Escanear con la cámara');
  return h('div', { class: 'pila' }, boton, video);
}

function controlFuncion(f, refrescar) {
  let zonaResultado = resultado(null);
  const entrada = h('input', { id: `codigo-${f.functionId}`, name: 'codigo', autocomplete: 'off', autocapitalize: 'characters', placeholder: 'Ej.: K7M2P 9QXRT' });

  async function validar(codigo) {
    const r = await apiParticipacion('POST', `/access/functions/${encodeURIComponent(f.functionId)}/validate`, { code: codigo });
    const nuevo = resultado(r.ok ? r.datos : { admitted: false, message: r.datos?.message ?? 'No se pudo validar.' });
    zonaResultado.replaceWith(nuevo);
    zonaResultado = nuevo;
    entrada.value = '';
    entrada.focus();
  }

  async function cambiar(abrir) {
    const r = await apiParticipacion('POST', `/access/functions/${encodeURIComponent(f.functionId)}/${abrir ? 'open' : 'close'}`);
    if (!r.ok) return aviso(r.datos?.message ?? 'No se pudo cambiar el control de acceso.', 'error');
    aviso(abrir ? 'Control de acceso abierto.' : 'Control de acceso cerrado.', 'ok');
    refrescar();
  }

  return h(
    'article',
    { class: 'tarjeta pila acceso-funcion' },
    h(
      'div',
      { class: 'entrada-cabecera' },
      h('h2', {}, f.title ?? 'Función'),
      h('span', { class: `insignia-estado ${f.open ? 'acceso-abierto' : ''}` }, f.open ? 'Abierto' : 'Cerrado'),
    ),
    f.date ? h('p', { class: 'ayuda' }, `${formatoFecha(f.date)} · ${f.startTime}${f.venueName ? ` · ${f.venueName}` : ''}`) : null,
    f.cancelled ? h('p', { class: 'aviso error-caja' }, 'Función cancelada: sus entradas se rechazan.') : null,
    h(
      'div',
      { class: 'fila-acciones' },
      f.open
        ? h('button', { type: 'button', class: 'secundario', onclick: () => cambiar(false) }, 'Cerrar el control')
        : h('button', { type: 'button', onclick: () => cambiar(true) }, 'Abrir el control'),
    ),
    f.open
      ? h(
          'form',
          {
            class: 'pila',
            onsubmit: (ev) => {
              ev.preventDefault();
              if (entrada.value.trim()) validar(entrada.value.trim()).catch(() => aviso('No se pudo validar.', 'error'));
            },
          },
          lectorQr((codigo) => validar(codigo)),
          h('div', { class: 'campo' }, h('label', { for: entrada.id }, 'Código de la entrada'), entrada),
          h('button', { type: 'submit' }, 'Validar'),
          zonaResultado,
        )
      : null,
  );
}

export async function pantallaAcceso({ persona, navegar }) {
  if (!persona?.roles?.includes('personal_acceso')) {
    return h('section', { class: 'tarjeta-centrada' }, h('h1', {}, 'Control de acceso'), h('p', {}, 'Esta pantalla es para el personal de acceso con funciones asignadas.'));
  }
  const r = await apiParticipacion('GET', '/access/functions');
  if (!r.ok) return h('section', { class: 'tarjeta-centrada' }, h('h1', {}, 'Control de acceso'), h('p', { class: 'aviso error-caja' }, r.datos?.message ?? 'No se pudo cargar.'));
  const refrescar = () => navegar('/acceso', false, false);
  return h(
    'section',
    { class: 'pila' },
    h('h1', {}, 'Control de acceso'),
    r.datos.items.length
      ? r.datos.items.map((f) => controlFuncion(f, refrescar))
      : h('div', { class: 'estado-vacio' }, h('p', {}, 'No tienes funciones asignadas. Pide al administrador que te asigne una.')),
  );
}
