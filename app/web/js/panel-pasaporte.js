// Panel del Pasaporte (spec 006, historias 4 y 5): QR por función, ventana de canje, activación y contenido del sello.
// Escritorio primero. El servidor verifica el rol de administrador en cada operación; la interfaz no es una barrera.
import { h, aviso, campo, campoTextarea, formulario } from './dom.js';
import { apiParticipacion, apiProgramacion } from './api.js';
import { formatoFecha, formatoHorarioFuncion } from './format.js';
import { requiereSesion } from './cuenta.js';

const IMAGEN_MAX_LADO = 1600;
const IMAGEN_MAX_BYTES = 1024 * 1024;
const esAdmin = (p) => Boolean(p?.roles?.includes('administrador'));
/** Campos del servidor con el nombre del formulario; sin los que vienen vacíos. */
const renombrar = (pares) => Object.fromEntries(pares.filter(([, msg]) => Boolean(msg)));
const sinPermiso = () => h('section', { class: 'tarjeta-centrada' }, h('h1', {}, 'Pasaporte'), h('p', {}, 'Solo el administrador gestiona el Pasaporte.'));

const ESTADO_QR = {
  active: { texto: 'Canje activo', clase: 'estado-curso' },
  inactive: { texto: 'Canje desactivado', clase: 'estado-pasada' },
  none: { texto: 'Sin QR', clase: 'estado-terminada' },
};

/** Convierte el SVG del QR (generado por el servicio) en nodos, sin insertar HTML (igual que Mis entradas). */
function nodoQr(svg) {
  try {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const raiz = doc.documentElement;
    if (raiz.nodeName.toLowerCase() !== 'svg' || doc.querySelector('script, foreignObject')) return null;
    raiz.setAttribute('role', 'img');
    raiz.setAttribute('aria-label', 'Código QR del Pasaporte');
    raiz.setAttribute('class', 'pasaporte-qr');
    return document.importNode(raiz, true);
  } catch {
    return null;
  }
}

function descargarSvg(svg, nombre) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const a = h('a', { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reduce la imagen en el navegador (máximo 1600 px) y la codifica en JPEG de hasta 1 MB; el servidor vuelve a validarla. */
async function prepararImagen(archivo) {
  const mapa = await createImageBitmap(archivo);
  const escala = Math.min(1, IMAGEN_MAX_LADO / Math.max(mapa.width, mapa.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(mapa.width * escala);
  lienzo.height = Math.round(mapa.height * escala);
  lienzo.getContext('2d').drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
  for (const calidad of [0.86, 0.76, 0.66, 0.56]) {
    const blob = await new Promise((r) => lienzo.toBlob(r, 'image/jpeg', calidad));
    if (blob && blob.size <= IMAGEN_MAX_BYTES) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binario = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCodePoint(...bytes.subarray(i, i + 0x8000));
      return btoa(binario);
    }
  }
  return null;
}

export async function pantallaPanelPasaporte({ persona, barraPanel }) {
  if (!persona) return requiereSesion();
  if (!esAdmin(persona)) return sinPermiso();
  const r = await apiProgramacion('GET', '/agenda');
  const actividades = r.ok ? r.datos.items.filter((a) => !a.isPermanent || a.nextDate) : [];
  return [
    barraPanel('/panel/pasaporte'),
    h('h1', {}, 'Pasaporte'),
    h('p', { class: 'ayuda' }, 'Cada función con fecha y hora puede tener un QR del Pasaporte. Las franjas de apertura no entregan sellos. Los QR definitivos se imprimen cuando esté decidido el dominio público (P-12).'),
    h(
      'section',
      { class: 'tarjeta pila' },
      h('h2', {}, 'Actividades publicadas'),
      actividades.length
        ? h(
            'ul',
            { class: 'lista-carrito' },
            actividades.map((a) =>
              h(
                'li',
                { class: 'carrito-item' },
                h('div', { class: 'carrito-item-datos' }, h('strong', {}, a.title), h('span', {}, a.nextDate ? `Próxima: ${formatoFecha(a.nextDate)}` : 'Sin fecha próxima')),
                h('a', { href: `/panel/pasaporte/actividad/${encodeURIComponent(a.id)}`, 'data-enlace': true, class: 'boton secundario boton-sm' }, 'Ver funciones'),
              ),
            ),
          )
        : h('p', { class: 'ayuda' }, 'No hay actividades publicadas.'),
    ),
  ];
}

export async function pantallaPanelPasaporteActividad({ persona, barraPanel, id }) {
  if (!persona) return requiereSesion();
  if (!esAdmin(persona)) return sinPermiso();
  const rf = await apiProgramacion('GET', `/activities/${encodeURIComponent(id)}`);
  if (!rf.ok) return [barraPanel('/panel/pasaporte'), h('p', { class: 'aviso error-caja' }, rf.datos?.message ?? 'No se pudo cargar la actividad.')];
  const ficha = rf.datos;
  const funciones = ficha.functions ?? [];
  const contenedor = h('div', { class: 'pila' }, await Promise.all(funciones.map(tarjetaFuncion)));
  return [
    barraPanel('/panel/pasaporte'),
    h('a', { href: '/panel/pasaporte', 'data-enlace': true, class: 'enlace-volver' }, '← Pasaporte'),
    h('h1', {}, ficha.title),
    funciones.length ? contenedor : h('p', { class: 'ayuda' }, 'Esta actividad no tiene funciones con fecha y hora: solo franjas de apertura, que no entregan sellos.'),
  ];
}

/** Tarjeta de una función: se vuelve a pintar tras cada operación con la vista que devuelve el servidor. */
async function tarjetaFuncion(fn) {
  const tarjeta = h('article', { class: 'tarjeta pila pasaporte-funcion' });
  const base = `/panel/functions/${encodeURIComponent(fn.id)}/passport`;

  async function operar(metodo, ruta, cuerpo, mensaje) {
    const r = await apiParticipacion(metodo, `${base}${ruta}`, cuerpo);
    if (r.ok) {
      aviso(mensaje, 'ok');
      pintar(r.datos);
    } else if (!r.datos?.fields) {
      aviso(r.datos?.message ?? 'No se pudo completar la operación.', 'error');
    }
    return r;
  }

  function pintar(v) {
    const qr = v.qr;
    const estado = ESTADO_QR[qr?.status ?? 'none'];
    const titulo = h(
      'div',
      { class: 'venta-funcion-cabecera' },
      h('h2', {}, `${formatoFecha(fn.date)} · ${formatoHorarioFuncion(fn)}`),
      h('span', { class: `insignia-estado ${estado.clase}` }, estado.texto),
    );
    const sede = h('p', { class: 'ayuda' }, `${fn.venue?.name ?? 'Sede por confirmar'} · Sellos emitidos: ${v.stampsCount}`);
    if (!qr) {
      tarjeta.replaceChildren(titulo, sede, h('button', { type: 'button', onclick: () => operar('POST', '/qr', undefined, 'QR generado. Fija la ventana y actívalo.') }, 'Generar QR'));
      return;
    }

    const avisoCambio = qr.functionChanged
      ? h('p', { class: 'aviso alerta-caja' }, 'La función cambió de fecha, hora o sede: el canje está desactivado. Confirma una ventana nueva y vuelve a activarlo.')
      : null;
    const inicio = campo({ id: `ini-${fn.id}`, etiqueta: 'Inicio (AAAA-MM-DD HH:MM, hora de Loja)', valor: qr.window?.start ?? '', placeholder: '2026-11-21 18:00' });
    const fin = campo({ id: `fin-${fn.id}`, etiqueta: 'Fin (AAAA-MM-DD HH:MM, hora de Loja)', valor: qr.window?.end ?? '', placeholder: '2026-11-21 23:00' });
    const mapear = (r) => {
      if (r && !r.ok && r.datos?.fields) r.datos.fields = renombrar([[`ini-${fn.id}`, r.datos.fields.start], [`fin-${fn.id}`, r.datos.fields.end]]);
      return r;
    };
    const formVentana = formulario({
      campos: [inicio, fin],
      boton: qr.window ? 'Confirmar ventana' : 'Fijar ventana',
      alEnviar: async (vals) => mapear(await operar('PUT', '/window', { start: vals[`ini-${fn.id}`], end: vals[`fin-${fn.id}`] }, 'Ventana guardada.')),
    });

    const svg = nodoQr(qr.svg);
    // replaceChildren convierte null en texto: el aviso de cambio solo se añade si existe.
    tarjeta.replaceChildren(
      titulo,
      sede,
      ...(avisoCambio ? [avisoCambio] : []),
      h(
        'div',
        { class: 'pasaporte-qr-bloque' },
        svg ?? h('p', { class: 'aviso error-caja' }, 'No se pudo mostrar el QR.'),
        h(
          'div',
          { class: 'pila' },
          h('p', { class: 'ayuda' }, 'Enlace del QR:'),
          h('code', { class: 'pasaporte-enlace' }, qr.url),
          h(
            'div',
            { class: 'acciones-fila' },
            h('button', { type: 'button', class: 'secundario boton-sm', onclick: () => descargarSvg(qr.svg, `pasaporte-${fn.id}.svg`) }, 'Descargar SVG'),
            h('button', { type: 'button', class: 'secundario boton-sm', onclick: () => operar('POST', '/qr/replace', undefined, 'QR reemplazado: el anterior ya no vale. Imprime el nuevo y actívalo.') }, 'Reemplazar QR'),
          ),
        ),
      ),
      h('h3', {}, 'Ventana de canje'),
      formVentana,
      h(
        'div',
        { class: 'acciones-fila' },
        qr.status === 'active'
          ? h('button', { type: 'button', class: 'secundario', onclick: () => operar('POST', '/deactivate', undefined, 'Canje desactivado.') }, 'Desactivar canje')
          : h('button', { type: 'button', onclick: () => operar('POST', '/activate', undefined, 'Canje activo.') }, 'Activar canje'),
      ),
      contenidoSello(v, operar, fn.id),
    );
  }

  const r = await apiParticipacion('GET', base);
  if (!r.ok) {
    tarjeta.append(h('h2', {}, `${formatoFecha(fn.date)} · ${formatoHorarioFuncion(fn)}`), h('p', { class: 'aviso error-caja' }, r.datos?.message ?? 'No se pudo cargar el Pasaporte de esta función.'));
    return tarjeta;
  }
  pintar(r.datos);
  return tarjeta;
}

/** Contenido del sello (M-11, M-12): cada guardado crea una versión; los sellos emitidos conservan la suya. */
function contenidoSello(v, operar, fid) {
  const c = v.content;
  const texto = campoTextarea({ id: `txt-${fid}`, etiqueta: 'Texto breve (opcional, hasta 280 caracteres)', valor: c?.text ?? '', filas: 3 });
  texto.input.maxLength = 280;
  const contador = h('p', { class: 'ayuda', 'aria-live': 'polite' }, `${[...texto.input.value].length}/280`);
  texto.input.addEventListener('input', () => {
    contador.textContent = `${[...texto.input.value].length}/280`;
  });
  const archivo = h('input', { id: `img-${fid}`, type: 'file', accept: 'image/jpeg,image/png,image/webp' });
  const errorArchivo = h('p', { class: 'error', hidden: true });
  const campoArchivo = {
    el: h('div', { class: 'campo' }, h('label', { for: `img-${fid}` }, 'Imagen nueva (opcional; JPEG, PNG o WebP)'), archivo, errorArchivo),
    input: archivo,
    mostrarError(t) {
      errorArchivo.textContent = t;
      errorArchivo.hidden = false;
    },
    limpiar() {
      errorArchivo.hidden = true;
    },
  };
  const alt = campo({ id: `alt-${fid}`, etiqueta: 'Texto alternativo de la imagen', requerido: false });
  const credito = campo({ id: `cred-${fid}`, etiqueta: 'Fuente o autoría (propia o con licencia que permita reutilizarla)', requerido: false });
  const quitar = h('input', { type: 'checkbox', id: `quitar-${fid}` });

  return h(
    'section',
    { class: 'pila contenido-sello' },
    h('h3', {}, 'Contenido del sello'),
    h('p', { class: 'ayuda' }, c ? `Versión ${c.version}. Los sellos ya emitidos conservan la versión que tenían.` : 'Sin contenido: los sellos usan la plantilla común de VIVART.'),
    c?.image ? h('figure', { class: 'contenido-sello-imagen' }, h('img', { src: c.image.url, alt: c.image.alt }), h('figcaption', {}, `Imagen: ${c.image.credit}`)) : null,
    formulario({
      campos: [texto, campoArchivo, alt, credito],
      boton: 'Guardar como versión nueva',
      alEnviar: async (vals) => {
        const cuerpo = { text: vals[`txt-${fid}`] || null };
        const elegido = archivo.files?.[0];
        if (elegido) {
          let datos = null;
          try {
            datos = await prepararImagen(elegido);
          } catch {
            datos = null;
          }
          if (!datos) {
            campoArchivo.mostrarError('No se pudo leer la imagen o pesa demasiado incluso reducida.');
            return null;
          }
          cuerpo.image = { dataBase64: datos, alt: vals[`alt-${fid}`], credit: vals[`cred-${fid}`] };
        } else if (quitar.checked) {
          cuerpo.image = null;
        }
        const r = await operar('PUT', '/content', cuerpo, 'Contenido guardado como versión nueva.');
        if (r && !r.ok && r.datos?.fields) {
          const f = r.datos.fields;
          r.datos.fields = renombrar([[`txt-${fid}`, f.text], [`alt-${fid}`, f.alt], [`cred-${fid}`, f.credit]]);
          if (f.image) campoArchivo.mostrarError(f.image);
        }
        return r;
      },
    }),
    c?.image ? h('label', { class: 'opcion-check' }, quitar, ' Quitar la imagen en la versión nueva') : null,
  );
}
