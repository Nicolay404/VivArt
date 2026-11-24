// Alforjita, asistente del festival (spec 008). Se importa solo al abrir el panel, para que la Agenda no la espere (RNF-07).
// Sin cuenta, sin datos personales y sin ubicación (RNF-05). La conversación vive solo en este módulo mientras la pestaña
// está abierta: no se guarda en el navegador ni en el servidor (M-17). Todo el texto se pinta con nodos de texto, nunca HTML.

import { h, icono } from './dom.js';
import { apiProgramacion } from './api.js';
import { formatoFechaCorta, etiquetaTiempo, etiquetaAviso, claseAcceso } from './format.js';

const ESPERA_MS = 8000;
const MAX_TEXTO = 200;

export const PREGUNTAS_RAPIDAS = [
  { quick: 'today', label: '¿Qué hay hoy?' },
  { quick: 'free_today', label: '¿Qué hay gratis hoy?' },
  { quick: 'tonight', label: '¿Qué hay esta noche?' },
  { quick: 'venue', label: '¿Qué hay en una sede?' },
  { quick: 'changes', label: '¿Hubo cambios?' },
  { quick: 'passport_routes', label: '¿Cómo funcionan el Pasaporte y las rutas?' },
];

const BIENVENIDA = {
  de: 'alforjita',
  datos: {
    kind: 'welcome',
    message: '¡Hola! Soy Alforjita. Te ayudo a encontrar funciones del festival por día, hora, categoría, sede o si son gratuitas. Elige una pregunta o escribe la tuya.',
  },
};

/** Conversación en memoria del módulo: sobrevive a ir a una ficha y volver, y se borra al recargar o cerrar la pestaña. */
let mensajes = [BIENVENIDA];
let dialogo = null;
let lista = null;
let campoTexto = null;
let ocupado = false;
/** Elemento que abrió el panel (botón flotante o el de la Agenda): recibe el foco al cerrar. */
let origen = null;

/** Llama a la API con un límite de espera; cualquier fallo es «falla del servicio» (FR-014). */
async function consultar(cuerpo) {
  let temporizador;
  const espera = new Promise((resolver) => {
    temporizador = setTimeout(() => resolver({ ok: false, status: 0, datos: null }), ESPERA_MS);
  });
  try {
    return await Promise.race([apiProgramacion('POST', '/assistant/answers', cuerpo), espera]);
  } finally {
    clearTimeout(temporizador);
  }
}

async function preguntar(cuerpo, burbuja) {
  if (ocupado) return;
  ocupado = true;
  mensajes.push({ de: 'visitante', texto: burbuja });
  const pensando = { de: 'alforjita', pensando: true };
  mensajes.push(pensando);
  pintar();
  const r = await consultar(cuerpo);
  mensajes = mensajes.filter((m) => !m.pensando);
  if (r.ok) mensajes.push({ de: 'alforjita', datos: r.datos });
  else if (r.status === 422) mensajes.push({ de: 'alforjita', datos: { kind: 'invalid', message: mensajeValidacion(r.datos) } });
  else mensajes.push({ de: 'alforjita', falla: true });
  ocupado = false;
  pintar();
}

function mensajeValidacion(datos) {
  const campos = datos?.fields ?? {};
  return Object.values(campos)[0] ?? 'No pude leer esa pregunta. Prueba de nuevo.';
}

// ---------- Pintado ----------

function textoHorario(item) {
  if (item.type === 'slot') return `Abierto de ${item.startTime} a ${item.endTime}`;
  return item.endTime ? `${item.startTime} a ${item.endTime}` : item.startTime;
}

function tarjeta(item) {
  const estado = item.type === 'function' ? etiquetaTiempo(item.timeStatus) : null;
  const horario = textoHorario(item);
  return h(
    'li',
    { class: 'alforjita-resultado' },
    h('a', { href: item.href, 'data-enlace': true, class: 'alforjita-resultado-titulo' }, item.title),
    h(
      'p',
      { class: 'alforjita-resultado-meta' },
      h('span', {}, `${formatoFechaCorta(item.date)} · ${horario}`),
      item.venue ? h('span', {}, item.venue.name) : null,
      h('span', { class: `alforjita-acceso ${claseAcceso(item.access.mode)}` }, item.access.label),
    ),
    estado && item.timeStatus !== 'upcoming' ? h('span', { class: `insignia-estado ${estado.clase}` }, estado.texto) : null,
    item.notice ? h('p', { class: 'alforjita-aviso' }, h('strong', {}, `${etiquetaAviso(item.notice.kind)}: `), item.notice.text) : null,
  );
}

function botonesConsulta(opciones) {
  return h(
    'div',
    { class: 'alforjita-opciones' },
    opciones.map((o) => h('button', { type: 'button', class: 'pildora', onclick: () => preguntar(o.cuerpo, o.label) }, o.label)),
  );
}

function enlaces(links) {
  return h(
    'p',
    { class: 'alforjita-enlaces' },
    links.map((l) => h('a', { href: l.href, 'data-enlace': true, class: 'boton secundario' }, l.label)),
  );
}

function respuesta(m) {
  if (m.pensando) return h('p', { class: 'alforjita-pensando' }, 'Buscando en la programación…');
  if (m.falla) {
    return [
      h('p', {}, 'No pude consultar la programación en este momento. La Agenda sigue disponible para buscar a mano.'),
      enlaces([{ label: 'Ir a la Agenda', href: '/agenda' }]),
    ];
  }
  const d = m.datos;
  const partes = [h('p', {}, d.message)];
  // En la bienvenida, Alforjita aparece bailando (ilustración oficial del festival, usada con permiso).
  if (d.kind === 'welcome') partes.unshift(h('img', { class: 'alforjita-bienvenida', src: '/img/alforjita/alforjita-baile.jpg', alt: '', width: '404', height: '495' }));
  if (d.items?.length) partes.push(h('ul', { class: 'alforjita-resultados' }, d.items.map(tarjeta)));
  if (d.total > (d.items?.length ?? 0) && d.agendaUrl) {
    partes.push(enlaces([{ label: `Ver las ${d.total} en la Agenda`, href: d.agendaUrl }]));
  }
  if (d.accessibility?.length) {
    partes.push(
      h(
        'ul',
        { class: 'alforjita-accesibilidad' },
        d.accessibility.map((x) =>
          h(
            'li',
            {},
            icono(x.feature === 'step_free' ? 'accesible' : 'bano', 'icono-xs'),
            `${x.label[0].toUpperCase()}${x.label.slice(1)}: `,
            h('strong', {}, { confirmed: 'confirmado', unavailable: 'no disponible', unconfirmed: 'por confirmar' }[x.status]),
          ),
        ),
      ),
    );
  }
  if (d.suggestions?.length) partes.push(botonesConsulta(d.suggestions.map((s) => ({ label: s.label, cuerpo: { criteria: s.criteria } }))));
  if (d.options?.length) partes.push(botonesConsulta(d.options.map((o) => ({ label: o.name, cuerpo: o.request }))));
  if (d.links?.length) partes.push(enlaces(d.links));
  if (d.kind === 'not_understood' || d.kind === 'welcome') partes.push(botonesConsulta(rapidas()));
  return partes;
}

const rapidas = () => PREGUNTAS_RAPIDAS.map((p) => ({ label: p.label, cuerpo: { quick: p.quick } }));

function pintar() {
  if (!lista) return;
  lista.replaceChildren(
    ...mensajes.map((m) =>
      m.de === 'visitante'
        ? h('li', { class: 'alforjita-burbuja alforjita-visitante' }, h('span', { class: 'sr-only' }, 'Tú: '), m.texto)
        : h('li', { class: 'alforjita-burbuja alforjita-respuesta' }, h('span', { class: 'sr-only' }, 'Alforjita: '), respuesta(m)),
    ),
  );
  lista.lastElementChild?.scrollIntoView?.({ block: 'nearest' });
  if (campoTexto) campoTexto.disabled = ocupado;
}

function construir() {
  lista = h('ol', { class: 'alforjita-conversacion', 'aria-live': 'polite', 'aria-label': 'Conversación con Alforjita' });
  campoTexto = h('input', {
    id: 'alforjita-texto',
    type: 'text',
    maxlength: String(MAX_TEXTO),
    autocomplete: 'off',
    placeholder: 'Ej.: ¿Qué hay de danza gratis el domingo?',
  });
  const formulario = h(
    'form',
    {
      class: 'alforjita-formulario',
      onsubmit: (ev) => {
        ev.preventDefault();
        const texto = campoTexto.value.trim();
        if (!texto) return;
        campoTexto.value = '';
        void preguntar({ text: texto.slice(0, MAX_TEXTO) }, texto.slice(0, MAX_TEXTO)).then(() => campoTexto.focus());
      },
    },
    h('label', { for: 'alforjita-texto', class: 'sr-only' }, 'Escribe tu pregunta (máximo 200 caracteres)'),
    campoTexto,
    h('button', { type: 'submit', class: 'boton' }, 'Preguntar'),
  );
  const cerrar = h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Cerrar Alforjita', onclick: () => dialogo.close() }, icono('cerrar'));
  const nueva = h(
    'button',
    {
      type: 'button',
      class: 'boton-texto',
      'aria-label': 'Nueva conversación',
      onclick: () => {
        mensajes = [BIENVENIDA];
        pintar();
        campoTexto.focus();
      },
    },
    'Nueva',
  );
  dialogo = h(
    'dialog',
    { class: 'alforjita-panel', 'aria-labelledby': 'alforjita-titulo' },
    h(
      'div',
      { class: 'alforjita-cabecera' },
      h('span', { class: 'alforjita-avatar' }, h('img', { src: '/img/alforjita/alforjita-saludo.jpg', alt: '', width: '404', height: '495' })),
      h('div', {}, h('h2', { id: 'alforjita-titulo' }, 'Alforjita'), h('p', { class: 'ayuda' }, 'Programación publicada')),
      nueva,
      cerrar,
    ),
    lista,
    formulario,
  );
  // Al seguir un enlace a una ficha o a otra pantalla se cierra el panel; la conversación se conserva.
  dialogo.addEventListener('click', (ev) => {
    if (ev.target.closest?.('a[href]')) dialogo.close();
  });
  dialogo.addEventListener('close', () => (origen?.isConnected ? origen : document.getElementById('alforjita-flotante'))?.focus());
  document.body.append(dialogo);
}

/** Abre el panel. Esc y «Cerrar» lo cierran (nativo de <dialog>) y el foco vuelve al botón que lo abrió. */
export function abrirAlforjita() {
  origen = document.activeElement;
  if (!dialogo) construir();
  pintar();
  if (!dialogo.open) dialogo.showModal();
  campoTexto.focus();
}
