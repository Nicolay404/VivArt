// Utilidades de DOM seguro (solo createElement / createTextNode), formularios accesibles,
// iconos SVG locales y diálogos modales con trampa de foco y cierre con Escape (RNF-02, RNF-03).

const SVG_NS = 'http://www.w3.org/2000/svg';

export function h(etiqueta, atributos = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos)) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2), v);
    } else if (k === 'value') {
      el.value = String(v);
    } else if (k === 'checked') {
      el.checked = Boolean(v);
    } else if (k === 'selected') {
      el.selected = Boolean(v);
    } else if (k === 'disabled') {
      el.disabled = Boolean(v);
    } else {
      el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return el;
}

/** Construye un icono SVG limpio y compatible con CSP (sin atributos de estilo ni cadenas de marcado). */
// Iconos del mapa de sedes (spec 003) como tabla de trazos: [etiqueta, atributos].
const TRAZOS_MAPA = {
  mas: [['line', { x1: 12, y1: 5, x2: 12, y2: 19 }], ['line', { x1: 5, y1: 12, x2: 19, y2: 12 }]],
  menos: [['line', { x1: 5, y1: 12, x2: 19, y2: 12 }]],
  centrar: [['path', { d: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' }]],
  lista: [
    ['line', { x1: 9, y1: 6, x2: 20, y2: 6 }],
    ['line', { x1: 9, y1: 12, x2: 20, y2: 12 }],
    ['line', { x1: 9, y1: 18, x2: 20, y2: 18 }],
    ['circle', { cx: 4.5, cy: 6, r: 1 }],
    ['circle', { cx: 4.5, cy: 12, r: 1 }],
    ['circle', { cx: 4.5, cy: 18, r: 1 }],
  ],
  mapa: [
    ['path', { d: 'M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z' }],
    ['line', { x1: 9, y1: 4, x2: 9, y2: 17.5 }],
    ['line', { x1: 15, y1: 6.5, x2: 15, y2: 20 }],
  ],
  accesible: [['circle', { cx: 12, cy: 4.5, r: 1.7 }], ['path', { d: 'M6 8.5h12M12 8.5v5.5M12 14l-3.5 6.5M12 14l3.5 6.5' }]],
  bano: [['rect', { x: 4, y: 3, width: 16, height: 18, rx: 2 }], ['circle', { cx: 12, cy: 8, r: 1.6 }], ['path', { d: 'M9 17v-4.5a3 3 0 0 1 6 0V17' }]],
  externo: [['path', { d: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5' }]],
};

export function icono(nombre, clase = 'icono') {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.9');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('class', clase);

  const trazo = (tag, attrs) => {
    const n = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    s.append(n);
  };

  if (Object.hasOwn(TRAZOS_MAPA, nombre)) {
    for (const [tag, attrs] of TRAZOS_MAPA[nombre]) trazo(tag, attrs);
    return s;
  }

  switch (nombre) {
    case 'calendario':
      trazo('rect', { x: 3, y: 5, width: 18, height: 16, rx: 2 });
      trazo('line', { x1: 16, y1: 3, x2: 16, y2: 7 });
      trazo('line', { x1: 8, y1: 3, x2: 8, y2: 7 });
      trazo('line', { x1: 3, y1: 10, x2: 21, y2: 10 });
      break;
    case 'reloj':
      trazo('circle', { cx: 12, cy: 12, r: 9 });
      trazo('polyline', { points: '12 7 12 12 15.5 14' });
      break;
    case 'sede':
      trazo('path', { d: 'M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11z' });
      trazo('circle', { cx: 12, cy: 10, r: 2.3 });
      break;
    case 'recorrido':
      trazo('circle', { cx: 6, cy: 18, r: 2.5 });
      trazo('circle', { cx: 18, cy: 6, r: 2.5 });
      trazo('path', { d: 'M8.5 18H13a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h4.5' });
      break;
    case 'pasaporte':
      trazo('rect', { x: 4, y: 3, width: 16, height: 18, rx: 2 });
      trazo('circle', { cx: 12, cy: 11, r: 3 });
      trazo('line', { x1: 8, y1: 17, x2: 16, y2: 17 });
      break;
    case 'buscar':
      trazo('circle', { cx: 11, cy: 11, r: 7 });
      trazo('line', { x1: 20, y1: 20, x2: 16.2, y2: 16.2 });
      break;
    case 'compartir':
      trazo('circle', { cx: 18, cy: 5, r: 2.5 });
      trazo('circle', { cx: 6, cy: 12, r: 2.5 });
      trazo('circle', { cx: 18, cy: 19, r: 2.5 });
      trazo('line', { x1: 8.3, y1: 10.8, x2: 15.7, y2: 6.2 });
      trazo('line', { x1: 8.3, y1: 13.2, x2: 15.7, y2: 17.8 });
      break;
    case 'aviso':
      trazo('path', { d: 'M12 3 2.5 19.5h19L12 3z' });
      trazo('line', { x1: 12, y1: 9.5, x2: 12, y2: 14 });
      trazo('circle', { cx: 12, cy: 16.8, r: 0.7 });
      break;
    case 'check':
      trazo('polyline', { points: '20 6 9 17 4 12' });
      break;
    case 'cerrar':
      trazo('line', { x1: 18, y1: 6, x2: 6, y2: 18 });
      trazo('line', { x1: 6, y1: 6, x2: 18, y2: 18 });
      break;
    case 'teatro':
      trazo('path', { d: 'M4 6h16v6a8 8 0 0 1-16 0V6z' });
      trazo('circle', { cx: 9.5, cy: 10, r: 0.8 });
      trazo('circle', { cx: 14.5, cy: 10, r: 0.8 });
      trazo('path', { d: 'M9 14c1.5 1.3 4.5 1.3 6 0' });
      break;
    case 'musica':
      trazo('path', { d: 'M9 18V6l11-2v12' });
      trazo('circle', { cx: 6.5, cy: 18, r: 2.5 });
      trazo('circle', { cx: 17.5, cy: 16, r: 2.5 });
      break;
    case 'danza':
      trazo('circle', { cx: 12, cy: 5, r: 2 });
      trazo('path', { d: 'M6 10.5 12 9l6 1.5M12 9v5.5l-4 5.5M12 14.5l4 5.5' });
      break;
    case 'arte':
      trazo('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 });
      trazo('circle', { cx: 8.5, cy: 9.5, r: 1.5 });
      trazo('path', { d: 'm21 16-5-5-4 4-3-3-6 6' });
      break;
    case 'estrella':
      trazo('polygon', { points: '12 3 14.8 8.8 21 9.6 16.5 14 17.6 20.2 12 17.2 6.4 20.2 7.5 14 3 9.6 9.2 8.8 12 3' });
      break;
    case 'panel':
      trazo('rect', { x: 3, y: 3, width: 7, height: 7, rx: 1.5 });
      trazo('rect', { x: 14, y: 3, width: 7, height: 7, rx: 1.5 });
      trazo('rect', { x: 3, y: 14, width: 7, height: 7, rx: 1.5 });
      trazo('rect', { x: 14, y: 14, width: 7, height: 7, rx: 1.5 });
      break;
    case 'usuario':
      trazo('circle', { cx: 12, cy: 8, r: 4 });
      trazo('path', { d: 'M5 20a7 7 0 0 1 14 0' });
      break;
    case 'subir':
      trazo('path', { d: 'M12 16V4M7 9l5-5 5 5' });
      trazo('path', { d: 'M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3' });
      break;
    case 'volver':
      trazo('line', { x1: 19, y1: 12, x2: 5, y2: 12 });
      trazo('polyline', { points: '12 19 5 12 12 5' });
      break;
    case 'carrito':
      trazo('circle', { cx: 9, cy: 20, r: 1.5 });
      trazo('circle', { cx: 18, cy: 20, r: 1.5 });
      trazo('path', { d: 'M2.5 4h2.5l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h9.4a1.5 1.5 0 0 0 1.5-1.1L21 7.5H6' });
      break;
    case 'entrada':
      trazo('path', { d: 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z' });
      trazo('line', { x1: 14, y1: 6, x2: 14, y2: 18 });
      break;
    case 'camara':
      trazo('path', { d: 'M4 8h3l1.5-2h7L17 8h3a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 4 8z' });
      trazo('circle', { cx: 12, cy: 13.5, r: 3.5 });
      break;
    case 'escudo':
      trazo('path', { d: 'M12 3 4.5 6.2v5.6c0 4.6 3.2 8.2 7.5 9.2 4.3-1 7.5-4.6 7.5-9.2V6.2L12 3z' });
      trazo('polyline', { points: '9 12 11 14 15.5 9.5' });
      break;
    default:
      trazo('circle', { cx: 12, cy: 12, r: 8 });
      break;
  }
  return s;
}

const zonaAvisos = () => document.querySelector('#avisos');

export function aviso(texto, tipo = 'info') {
  const zona = zonaAvisos();
  if (!zona) return;
  zona.replaceChildren();
  if (!texto) return;
  const clases = { error: 'aviso error-caja', ok: 'aviso ok-caja', alerta: 'aviso alerta-caja' };
  const clase = clases[tipo] ?? 'aviso';
  zona.append(h('p', { class: clase, role: tipo === 'error' ? 'alert' : 'status' }, texto));
}

export function campo({ id, etiqueta, tipo = 'text', autocompletar, ayuda, valor = '', placeholder, requerido = true, deshabilitado = false, min, max, step }) {
  const ayudaId = ayuda ? `${id}-ayuda` : null;
  const errorId = `${id}-error`;
  const input = h('input', {
    id,
    name: id,
    type: tipo,
    autocomplete: autocompletar,
    value: valor ?? '',
    placeholder,
    required: requerido,
    disabled: deshabilitado,
    min,
    max,
    step,
    'aria-describedby': [ayudaId, errorId].filter(Boolean).join(' '),
  });
  const error = h('p', { id: errorId, class: 'error', hidden: true });
  const el = h(
    'div',
    { class: 'campo' },
    h('label', { for: id }, etiqueta),
    input,
    ayuda ? h('p', { id: ayudaId, class: 'ayuda' }, ayuda) : null,
    error,
  );
  return {
    el,
    input,
    mostrarError(texto) {
      error.textContent = texto;
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
    },
    limpiar() {
      error.hidden = true;
      error.textContent = '';
      input.removeAttribute('aria-invalid');
    },
  };
}

export function campoTextarea({ id, etiqueta, ayuda, valor = '', filas = 4, placeholder, requerido = false, deshabilitado = false }) {
  const ayudaId = ayuda ? `${id}-ayuda` : null;
  const errorId = `${id}-error`;
  const input = h('textarea', {
    id,
    name: id,
    rows: filas,
    placeholder,
    required: requerido,
    disabled: deshabilitado,
    'aria-describedby': [ayudaId, errorId].filter(Boolean).join(' '),
  });
  input.value = valor ?? '';
  const error = h('p', { id: errorId, class: 'error', hidden: true });
  const el = h(
    'div',
    { class: 'campo' },
    h('label', { for: id }, etiqueta),
    input,
    ayuda ? h('p', { id: ayudaId, class: 'ayuda' }, ayuda) : null,
    error,
  );
  return {
    el,
    input,
    mostrarError(texto) {
      error.textContent = texto;
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
    },
    limpiar() {
      error.hidden = true;
      error.textContent = '';
      input.removeAttribute('aria-invalid');
    },
  };
}

export function campoSelect({ id, etiqueta, opciones, valor = '', ayuda, requerido = false, deshabilitado = false }) {
  const ayudaId = ayuda ? `${id}-ayuda` : null;
  const errorId = `${id}-error`;
  const select = h(
    'select',
    {
      id,
      name: id,
      required: requerido,
      disabled: deshabilitado,
      'aria-describedby': [ayudaId, errorId].filter(Boolean).join(' '),
    },
    opciones.map((o) => h('option', { value: o.value, selected: String(o.value) === String(valor ?? '') }, o.label)),
  );
  const error = h('p', { id: errorId, class: 'error', hidden: true });
  const el = h(
    'div',
    { class: 'campo' },
    h('label', { for: id }, etiqueta),
    select,
    ayuda ? h('p', { id: ayudaId, class: 'ayuda' }, ayuda) : null,
    error,
  );
  return {
    el,
    input: select,
    mostrarError(texto) {
      error.textContent = texto;
      error.hidden = false;
      select.setAttribute('aria-invalid', 'true');
    },
    limpiar() {
      error.hidden = true;
      error.textContent = '';
      select.removeAttribute('aria-invalid');
    },
  };
}

/** Formulario con errores junto al campo (RNF-02) y foco en el primer error. */
export function formulario({ campos, boton, alEnviar, clase = '' }) {
  const porId = Object.fromEntries(campos.map((c) => [c.input.id, c]));
  const enviar = h('button', { type: 'submit' }, boton);
  const form = h('form', { novalidate: true, class: clase || null }, ...campos.map((c) => c.el), enviar);
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    campos.forEach((c) => c.limpiar());
    aviso('');
    enviar.disabled = true;
    try {
      const valores = Object.fromEntries(campos.map((c) => [c.input.id, c.input.value]));
      const r = await alEnviar(valores);
      if (r && !r.ok) {
        if (r.datos?.fields) {
          let primero = null;
          for (const [k, msg] of Object.entries(r.datos.fields)) {
            if (porId[k]) {
              porId[k].mostrarError(msg);
              if (!primero) primero = porId[k].input;
            }
          }
          if (primero) primero.focus();
          aviso(r.datos.message ?? 'Revisa los campos marcados.', 'error');
        } else {
          const objetivo = porId[r.datos?.field];
          if (objetivo) {
            objetivo.mostrarError(r.datos.message);
            objetivo.input.focus();
          } else {
            aviso(r.datos?.message ?? 'No se pudo completar la operación.', 'error');
          }
        }
      }
    } finally {
      enviar.disabled = false;
    }
  });
  return form;
}

export function esqueletoTarjetas(cantidad = 3) {
  const items = [];
  for (let i = 0; i < cantidad; i += 1) {
    items.push(
      h(
        'div',
        { class: 'esqueleto-tarjeta', 'aria-hidden': 'true' },
        h('div', { class: 'esqueleto-linea corta' }),
        h('div', { class: 'esqueleto-linea titulo' }),
        h('div', { class: 'esqueleto-linea media' }),
        h('div', { class: 'esqueleto-linea larga' }),
      ),
    );
  }
  return h('div', { class: 'esqueleto-grid', role: 'status', 'aria-label': 'Cargando contenido' }, items);
}

/* ---------- Diálogo modal accesible (trampa de foco, Escape y devolución de foco) ---------- */

const FOCUSEABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function abrirDialogo({ titulo, contenido, ancho = 'normal', alCerrar }) {
  const raiz = document.querySelector('#modal-raiz');
  if (!raiz) return { cerrar: () => {} };
  const previo = document.activeElement;
  const tituloId = `modal-titulo-${Date.now()}`;

  function cerrar() {
    document.removeEventListener('keydown', onKeyDown);
    raiz.replaceChildren();
    document.body.classList.remove('modal-abierto');
    if (alCerrar) alCerrar();
    if (previo && typeof previo.focus === 'function') previo.focus();
  }

  const botonCerrar = h(
    'button',
    { type: 'button', class: 'boton-icono modal-cerrar', 'aria-label': 'Cerrar diálogo', onclick: cerrar },
    icono('cerrar'),
  );

  const caja = h(
    'div',
    {
      class: `modal-caja ${ancho === 'grande' ? 'modal-grande' : ''}`,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': tituloId,
      tabindex: '-1',
    },
    h('div', { class: 'modal-cabecera' }, h('h2', { id: tituloId, class: 'modal-titulo' }, titulo), botonCerrar),
    h('div', { class: 'modal-cuerpo' }, typeof contenido === 'function' ? contenido(cerrar) : contenido),
  );

  const fondo = h(
    'div',
    {
      class: 'modal-fondo',
      onclick: (ev) => {
        if (ev.target === fondo) cerrar();
      },
    },
    caja,
  );

  function onKeyDown(ev) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      cerrar();
      return;
    }
    if (ev.key === 'Tab') {
      const lista = [...caja.querySelectorAll(FOCUSEABLES)];
      if (!lista.length) return;
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (ev.shiftKey && document.activeElement === primero) {
        ev.preventDefault();
        ultimo.focus();
      } else if (!ev.shiftKey && document.activeElement === ultimo) {
        ev.preventDefault();
        primero.focus();
      }
    }
  }

  raiz.replaceChildren(fondo);
  document.body.classList.add('modal-abierto');
  document.addEventListener('keydown', onKeyDown);

  const primerControl = caja.querySelector(FOCUSEABLES);
  (primerControl ?? caja).focus();

  return { cerrar };
}

export function confirmarAccion({ titulo, mensaje, botonConfirmar = 'Confirmar', peligro = false }) {
  return new Promise((resolver) => {
    let resuelto = false;
    const finalizar = (valor, cerrar) => {
      if (resuelto) return;
      resuelto = true;
      cerrar();
      resolver(valor);
    };
    abrirDialogo({
      titulo,
      alCerrar: () => {
        if (!resuelto) {
          resuelto = true;
          resolver(false);
        }
      },
      contenido: (cerrar) =>
        h(
          'div',
          { class: 'pila' },
          typeof mensaje === 'string' ? h('p', {}, mensaje) : mensaje,
          h(
            'div',
            { class: 'fila-acciones' },
            h('button', { type: 'button', class: 'secundario', onclick: () => finalizar(false, cerrar) }, 'Cancelar'),
            h(
              'button',
              { type: 'button', class: peligro ? 'peligro-solido' : '', onclick: () => finalizar(true, cerrar) },
              botonConfirmar,
            ),
          ),
        ),
    });
  });
}
