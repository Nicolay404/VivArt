// Panel de Rutas Culturales e Insignias (spec 007, US4).
// Solo accesible para administradores. Escritorio primero.
import { h, icono, aviso, campo, campoTextarea } from './dom.js';
import { apiParticipacion, apiProgramacion } from './api.js';
import { formatoFecha, formatoHorarioFuncion } from './format.js';
import { requiereSesion } from './cuenta.js';

const esAdmin = (p) => Boolean(p?.roles?.includes('administrador'));
const sinPermiso = () =>
  h('section', { class: 'tarjeta-centrada' }, h('h1', {}, 'Rutas culturales'), h('p', {}, 'Solo el administrador gestiona las rutas.'));

const ICONOS = [
  { id: 'teatro', label: 'Teatro (máscara)' },
  { id: 'musica', label: 'Música (nota musical)' },
  { id: 'danza', label: 'Danza (movimiento)' },
  { id: 'artes-vivas', label: 'Artes Vivas (sol radiante)' },
  { id: 'patrimonio', label: 'Patrimonio (columnas)' },
  { id: 'estrella', label: 'Estrella (excelencia)' },
  { id: 'brujula', label: 'Brújula (explorador)' },
];

const COLORES = [
  { id: 'violeta', label: 'Violeta oficial (#3b0f66)' },
  { id: 'atardecer', label: 'Atardecer / Dorado (#d97706)' },
  { id: 'terracota', label: 'Terracota (#c2410c)' },
  { id: 'esmeralda', label: 'Esmeralda (#0f766e)' },
];

/** Previsualización de la insignia con plantilla común de VIVART */
function vistaPreviaInsignia({ badgeTitle, badgeDescription, badgeIcon, badgeColor }) {
  return h(
    'div',
    { class: `insignia-plantilla insignia-color-${badgeColor ?? 'violeta'}` },
    h('div', { class: 'insignia-emblema' }, icono(badgeIcon ?? 'estrella', 'icono-insignia')),
    h('div', { class: 'insignia-datos' },
      h('h3', { class: 'insignia-titulo' }, badgeTitle || 'Nombre de la insignia'),
      h('p', { class: 'insignia-desc' }, badgeDescription || 'Descripción del mérito de la insignia.'),
    ),
  );
}

export async function pantallaPanelRutas({ persona, barraPanel, navegar }) {
  if (!persona) return requiereSesion();
  if (!esAdmin(persona)) return sinPermiso();

  const r = await apiParticipacion('GET', '/panel/routes');
  const rutas = r.ok ? r.datos.items ?? [] : [];

  const listaNodos = rutas.length
    ? h(
        'div',
        { class: 'pila' },
        rutas.map((ruta) =>
          h(
            'article',
            { class: 'tarjeta panel-item-ruta' },
            h(
              'div',
              { class: 'fila-espaciada' },
              h('div', {},
                h('div', { class: 'fila-alineada' },
                  h('strong', { class: 'ruta-item-titulo' }, ruta.title),
                  h('span', { class: `insignia-estado ${ruta.status === 'published' ? 'estado-curso' : 'estado-pasada'}` },
                    ruta.status === 'published' ? 'Publicada' : 'Borrador',
                  ),
                  ruta.inReview
                    ? h('span', { class: 'insignia-estado estado-cancelada' }, 'Ruta en revisión')
                    : null,
                ),
                h('p', { class: 'ayuda' },
                  `Meta: ${ruta.goal} sellos · Funciones elegibles: ${ruta.functionsCount} · Insignia: ${ruta.badgeTitle}`,
                ),
              ),
              h('div', { class: 'acciones-fila' },
                h(
                  'a',
                  { href: `/panel/rutas/editar/${encodeURIComponent(ruta.id)}`, 'data-enlace': true, class: 'boton secundario boton-sm' },
                  'Editar ruta',
                ),
              ),
            ),
          ),
        ),
      )
    : h('div', { class: 'estado-vacio' },
        h('h2', {}, 'No hay rutas culturales creadas'),
        h('p', {}, 'Crea tu primera ruta para motivar al público a coleccionar sellos.'),
      );

  return [
    barraPanel('/panel/rutas'),
    h('div', { class: 'panel-cabecera-fila' },
      h('h1', {}, 'Rutas culturales'),
      h('a', { href: '/panel/rutas/nueva', 'data-enlace': true, class: 'boton' }, '+ Crear ruta'),
    ),
    h('p', { class: 'ayuda' },
      'Las rutas culturales agrupan funciones elegibles con Pasaporte habilitado. Si cancelaciones reducen las opciones por debajo de la meta, la ruta pasa a «En revisión».',
    ),
    listaNodos,
  ];
}

export async function pantallaPanelRutaFormulario({ persona, barraPanel, navegar, id }) {
  if (!persona) return requiereSesion();
  if (!esAdmin(persona)) return sinPermiso();

  const esEdicion = Boolean(id && id !== 'nueva');
  let rutaExistente = null;

  if (esEdicion) {
    const res = await apiParticipacion('GET', `/panel/routes/${encodeURIComponent(id)}`);
    if (!res.ok) {
      return [
        barraPanel('/panel/rutas'),
        h('p', { class: 'aviso error-caja' }, res.datos?.message ?? 'No se encontró la ruta.'),
      ];
    }
    rutaExistente = res.datos;
  }

  // Obtener funciones publicadas de la agenda para seleccionar
  const resAgenda = await apiProgramacion('GET', '/agenda');
  const actividades = resAgenda.ok ? resAgenda.datos.items ?? [] : [];

  // Recolectar funciones detalladas
  const funcionesDisponibles = [];
  for (const act of actividades) {
    if (!act.functions || act.functions.length === 0) continue;
    for (const f of act.functions) {
      if (f.date && f.startTime) {
        funcionesDisponibles.push({
          id: f.id,
          activityTitle: act.title,
          date: f.date,
          startTime: f.startTime,
          venueName: f.venueName,
          status: f.status,
        });
      }
    }
  }

  // Formulario y estado
  const fidsSeleccionados = new Set(rutaExistente?.functionIds ?? []);
  const form = h('form', { class: 'tarjeta pila formulario-ruta' });

  const inputTitulo = campo({
    id: 'ruta-title',
    etiqueta: 'Título de la ruta',
    valor: rutaExistente?.title ?? '',
    requerido: true,
    min: 3,
    max: 120,
    ayuda: 'De 3 a 120 caracteres.',
  });

  const inputDesc = campoTextarea({
    id: 'ruta-desc',
    etiqueta: 'Descripción de la ruta',
    valor: rutaExistente?.description ?? '',
    requerido: true,
    filas: 3,
    ayuda: 'De 10 a 500 caracteres. Explica al público qué propone este recorrido.',
  });

  const inputMeta = campo({
    id: 'ruta-goal',
    etiqueta: 'Meta de sellos requeridos',
    tipo: 'number',
    valor: rutaExistente?.goal ?? (fidsSeleccionados.size || 1),
    requerido: true,
    min: 1,
    ayuda: 'Cantidad de sellos distintos para completar la ruta (no puede superar las funciones elegibles).',
  });

  const inputBadgeTitle = campo({
    id: 'badge-title',
    etiqueta: 'Nombre de la insignia',
    valor: rutaExistente?.badgeTitle ?? '',
    requerido: true,
    min: 3,
    max: 80,
  });

  const inputBadgeDesc = campoTextarea({
    id: 'badge-desc',
    etiqueta: 'Mérito de la insignia',
    valor: rutaExistente?.badgeDescription ?? '',
    requerido: true,
    filas: 2,
    ayuda: 'De 5 a 280 caracteres. Describe el logro obtenido por el visitante.',
  });

  const selectIcono = h(
    'select',
    { id: 'badge-icon', class: 'campo-select' },
    ICONOS.map((ic) =>
      h('option', { value: ic.id, selected: (rutaExistente?.badgeIcon ?? 'teatro') === ic.id }, ic.label),
    ),
  );

  const selectColor = h(
    'select',
    { id: 'badge-color', class: 'campo-select' },
    COLORES.map((c) =>
      h('option', { value: c.id, selected: (rutaExistente?.badgeColor ?? 'violeta') === c.id }, c.label),
    ),
  );

  const checkPublicar = h('input', {
    type: 'checkbox',
    id: 'ruta-publish',
    checked: rutaExistente?.status === 'published',
  });

  // Zona de vista previa
  const zonaPrevia = h('div', { class: 'pila' },
    h('h3', {}, 'Vista previa de la insignia'),
    vistaPreviaInsignia({
      badgeTitle: rutaExistente?.badgeTitle,
      badgeDescription: rutaExistente?.badgeDescription,
      badgeIcon: rutaExistente?.badgeIcon ?? 'teatro',
      badgeColor: rutaExistente?.badgeColor ?? 'violeta',
    }),
  );

  function refrescarPrevia() {
    zonaPrevia.replaceChildren(
      h('h3', {}, 'Vista previa de la insignia'),
      vistaPreviaInsignia({
        badgeTitle: form.querySelector('#badge-title')?.value,
        badgeDescription: form.querySelector('#badge-desc')?.value,
        badgeIcon: selectIcono.value,
        badgeColor: selectColor.value,
      }),
    );
  }

  selectIcono.addEventListener('change', refrescarPrevia);
  selectColor.addEventListener('change', refrescarPrevia);

  // Lista de selección de funciones elegibles
  const listaFuncionesNode = h(
    'div',
    { class: 'selector-funciones-lista' },
    funcionesDisponibles.map((f) => {
      const chk = h('input', {
        type: 'checkbox',
        id: `chk-func-${f.id}`,
        value: f.id,
        checked: fidsSeleccionados.has(f.id),
        onchange: () => {
          if (chk.checked) fidsSeleccionados.add(f.id);
          else fidsSeleccionados.delete(f.id);
        },
      });
      return h(
        'label',
        { class: 'selector-funcion-item', for: `chk-func-${f.id}` },
        chk,
        h('div', { class: 'selector-funcion-datos' },
          h('strong', {}, f.activityTitle),
          h('span', {}, `${formatoFecha(f.date)} · ${f.startTime} · ${f.venueName ?? 'Sede a confirmar'}`),
        ),
      );
    }),
  );

  const mensajeError = h('div', { class: 'error-caja aviso', hidden: true });

  form.append(
    mensajeError,
    inputTitulo,
    inputDesc,
    h('fieldset', { class: 'pila' },
      h('legend', {}, 'Funciones elegibles de la ruta'),
      h('p', { class: 'ayuda' }, 'Marca las funciones que cuentan para esta ruta. Solo funciones con Pasaporte habilitado pueden sumar.'),
      funcionesDisponibles.length
        ? listaFuncionesNode
        : h('p', { class: 'ayuda' }, 'No hay funciones publicadas en la agenda.'),
    ),
    inputMeta,
    h('fieldset', { class: 'pila' },
      h('legend', {}, 'Plantilla visual de la insignia'),
      h('p', { class: 'ayuda' }, 'Selecciona un motivo temático oficial de VIVART y un color de acento.'),
      inputBadgeTitle,
      inputBadgeDesc,
      h('div', { class: 'campo-grupo' },
        h('label', { for: 'badge-icon' }, 'Icono temático'),
        selectIcono,
      ),
      h('div', { class: 'campo-grupo' },
        h('label', { for: 'badge-color' }, 'Color de acento'),
        selectColor,
      ),
      zonaPrevia,
    ),
    h('label', { class: 'fila-alineada' },
      checkPublicar,
      h('span', {}, 'Publicar ruta (hacerla visible para el público en Pasaporte)'),
    ),
    h('div', { class: 'acciones-fila' },
      h('button', { type: 'submit', class: 'boton' }, esEdicion ? 'Guardar cambios' : 'Crear ruta'),
      h('a', { href: '/panel/rutas', 'data-enlace': true, class: 'boton secundario' }, 'Cancelar'),
    ),
  );

  form.addEventListener('input', refrescarPrevia);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    mensajeError.hidden = true;

    const functionIds = Array.from(fidsSeleccionados);
    const goal = Number(form.querySelector('#ruta-goal')?.value);

    if (functionIds.length === 0) {
      mensajeError.textContent = 'Debes seleccionar al menos una función elegible.';
      mensajeError.hidden = false;
      return;
    }
    if (goal > functionIds.length) {
      mensajeError.textContent = `La meta (${goal}) no puede ser mayor que las funciones seleccionadas (${functionIds.length}).`;
      mensajeError.hidden = false;
      return;
    }

    const payload = {
      title: form.querySelector('#ruta-title')?.value?.trim(),
      description: form.querySelector('#ruta-desc')?.value?.trim(),
      goal,
      badgeTitle: form.querySelector('#badge-title')?.value?.trim(),
      badgeDescription: form.querySelector('#badge-desc')?.value?.trim(),
      badgeIcon: selectIcono.value,
      badgeColor: selectColor.value,
      functionIds,
      status: checkPublicar.checked ? 'published' : 'draft',
      publish: checkPublicar.checked,
    };

    const metodo = esEdicion ? 'PUT' : 'POST';
    const rutaUrl = esEdicion ? `/panel/routes/${encodeURIComponent(id)}` : '/panel/routes';

    const resp = await apiParticipacion(metodo, rutaUrl, payload);
    if (!resp.ok) {
      mensajeError.textContent = resp.datos?.message ?? 'No se pudo guardar la ruta.';
      mensajeError.hidden = false;
      return;
    }

    aviso(esEdicion ? 'Ruta actualizada con éxito.' : 'Ruta creada con éxito.', 'ok');
    navegar('/panel/rutas');
  });

  return [
    barraPanel('/panel/rutas'),
    h('a', { href: '/panel/rutas', 'data-enlace': true, class: 'enlace-volver' }, '← Rutas culturales'),
    h('h1', {}, esEdicion ? `Editar: ${rutaExistente.title}` : 'Crear nueva ruta cultural'),
    rutaExistente?.inReview
      ? h('p', { class: 'aviso alerta-caja' },
          'Esta ruta está en revisión porque funciones elegibles fueron canceladas. Añade nuevas funciones elegibles para alcanzar la meta.',
        )
      : null,
    form,
  ];
}
