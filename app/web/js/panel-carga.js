// Carga estructurada desde el PDF (FR-020 a FR-024, FR-031, FR-033):
// Subir JSON vivart-programacion/1 -> vista previa -> aceptar seleccionados (borradores) -> publicación explícita.
import { h, icono, aviso, confirmarAccion } from './dom.js';
import { apiProgramacion } from './api.js';
import { etiquetaResultadoCarga } from './format.js';
import { requiereSesion } from './cuenta.js';
import { barraPanel } from './panel-bandeja.js';

export async function pantallaCarga({ persona }) {
  if (!persona) return requiereSesion();
  const subnav = barraPanel(persona, '/panel/carga');

  if (!persona.roles.includes('administrador')) {
    return [
      subnav,
      h('h1', {}, 'Carga desde el PDF'),
      h('p', { class: 'aviso error-caja' }, 'Para cargar lotes de programación falta el rol de administrador.'),
    ];
  }

  let lote = null;
  let seleccionados = new Set();
  let seleccionadosPublicar = new Set();
  let resultadosPublicacion = null;

  const zonaTrabajo = h('div', { class: 'pila' });
  const zonaErrorArchivo = h('p', { class: 'error', hidden: true });

  const inputArchivo = h('input', {
    id: 'archivo-json',
    type: 'file',
    accept: '.json,application/json',
    'aria-describedby': 'ayuda-formato-carga',
  });

  async function subirArchivo() {
    zonaErrorArchivo.hidden = true;
    zonaErrorArchivo.textContent = '';
    const archivo = inputArchivo.files?.[0];
    if (!archivo) {
      zonaErrorArchivo.textContent = 'Selecciona un archivo JSON en formato vivart-programacion/1.';
      zonaErrorArchivo.hidden = false;
      inputArchivo.focus();
      return;
    }
    let contenido;
    try {
      const texto = await archivo.text();
      contenido = JSON.parse(texto);
    } catch {
      zonaErrorArchivo.textContent = 'El archivo no es un JSON válido. Revisa su sintaxis e inténtalo de nuevo.';
      zonaErrorArchivo.hidden = false;
      return;
    }

    const r = await apiProgramacion('POST', '/panel/imports', { filename: archivo.name, file: contenido });
    if (!r.ok) {
      const detalle = r.datos?.fields ? Object.values(r.datos.fields).join(' ') : '';
      aviso(`${r.datos?.message ?? 'No se pudo procesar el archivo.'} ${detalle}`.trim(), 'error');
      return;
    }

    lote = r.datos;
    resultadosPublicacion = null;
    seleccionados = new Set(
      (lote.records ?? [])
        .filter((reg) => reg.outcome === 'pending' && (!reg.errors || reg.errors.length === 0))
        .map((reg) => reg.position),
    );
    seleccionadosPublicar = new Set();
    aviso(`Vista previa generada (${lote.records.length} registros). Ningún borrador se ha creado todavía.`, 'ok');
    pintarLote();
  }

  async function aceptarSeleccionados() {
    if (!lote) return;
    const posiciones = [...seleccionados].sort((a, b) => a - b);
    if (posiciones.length === 0) {
      aviso('Selecciona al menos un registro sin errores para cargar como borrador.', 'error');
      return;
    }
    const r = await apiProgramacion('POST', `/panel/imports/${encodeURIComponent(lote.id)}/accept`, { positions: posiciones });
    if (!r.ok) {
      aviso(r.datos?.message ?? 'No se pudieron aceptar los registros.', 'error');
      return;
    }
    lote = r.datos;
    seleccionados = new Set();
    seleccionadosPublicar = new Set();
    const cargados = lote.records.filter((x) => x.outcome === 'loaded').length;
    const omitidosDup = lote.records.filter((x) => x.outcome === 'skipped_existing').length;
    const omitidosErr = lote.records.filter((x) => x.outcome === 'skipped_error').length;
    aviso(
      `Carga aplicada: ${cargados} borradores creados, ${omitidosDup} omitidos por existir previamente, ${omitidosErr} omitidos por errores. Nada se ha publicado automáticamente.`,
      'ok',
    );
    pintarLote();
  }

  async function publicarSeleccionados() {
    const ids = [...seleccionadosPublicar];
    if (ids.length === 0) {
      aviso('Marca explícitamente qué borradores cargados deseas publicar.', 'error');
      return;
    }
    const ok = await confirmarAccion({
      titulo: 'Confirmar publicación del lote',
      mensaje: `Vas a publicar ${ids.length} ${ids.length === 1 ? 'actividad' : 'actividades'} en la Agenda pública. Publicar no activa ventas.`,
      botonConfirmar: `Publicar (${ids.length})`,
    });
    if (!ok) return;

    const r = await apiProgramacion('POST', '/panel/publish-batch', { activityIds: ids });
    if (!r.ok) {
      aviso(r.datos?.message ?? 'No se pudo publicar el lote.', 'error');
      return;
    }
    resultadosPublicacion = r.datos.results ?? [];
    const okCount = resultadosPublicacion.filter((x) => x.published).length;
    const errCount = resultadosPublicacion.length - okCount;
    aviso(
      `Publicación finalizada: ${okCount} publicadas${errCount ? `, ${errCount} no se pudieron publicar (revisa el detalle)` : ''}.`,
      errCount ? 'alerta' : 'ok',
    );
    pintarLote();
  }

  function pintarLote() {
    if (!lote) {
      zonaTrabajo.replaceChildren();
      return;
    }
    const registros = lote.records ?? [];
    const pendientesValidos = registros.filter((r) => r.outcome === 'pending' && (!r.errors || r.errors.length === 0));
    const cargados = registros.filter((r) => r.outcome === 'loaded' && r.activityId);

    const filas = registros.map((reg) => {
      const tieneErrores = (reg.errors?.length ?? 0) > 0;
      const esPendiente = reg.outcome === 'pending';
      const est = etiquetaResultadoCarga(reg.outcome);

      return h(
        'tr',
        { class: tieneErrores ? 'fila-error' : null },
        h(
          'td',
          { 'data-etiqueta': 'Seleccionar' },
          esPendiente
            ? h('input', {
                type: 'checkbox',
                'aria-label': `Seleccionar registro ${reg.position + 1}: ${reg.content?.title ?? reg.key}`,
                disabled: tieneErrores,
                checked: seleccionados.has(reg.position),
                onchange: (ev) => {
                  if (ev.target.checked) seleccionados.add(reg.position);
                  else seleccionados.delete(reg.position);
                },
              })
            : '—',
        ),
        h('td', { 'data-etiqueta': 'Pos.' }, String(reg.position + 1)),
        h('td', { 'data-etiqueta': 'Clave' }, h('code', {}, reg.key ?? '—')),
        h(
          'td',
          { 'data-etiqueta': 'Origen' },
          reg.source?.page ? `Pág. ${reg.source.page}` : 'Sin página',
          reg.source?.note ? h('div', { class: 'ayuda' }, reg.source.note) : null,
        ),
        h(
          'td',
          { 'data-etiqueta': 'Título' },
          reg.activityId
            ? h('a', { href: `/panel/actividades/${encodeURIComponent(reg.activityId)}`, 'data-enlace': true }, reg.content?.title || 'Sin título')
            : reg.content?.title || 'Sin título',
        ),
        h(
          'td',
          { 'data-etiqueta': 'Duplicado' },
          reg.duplicateOf ? h('span', { class: 'insignia-editorial ed-revision-pendiente' }, reg.duplicateOf) : 'No',
        ),
        h(
          'td',
          { 'data-etiqueta': 'Errores' },
          tieneErrores
            ? h('ul', { class: 'lista-errores-tabla' }, reg.errors.map((e) => h('li', {}, e)))
            : h('span', { class: 'ok' }, 'Sin errores'),
        ),
        h('td', { 'data-etiqueta': 'Resultado' }, h('span', { class: `insignia-editorial ${est.clase}` }, est.texto)),
      );
    });

    const bloquePublicacion = cargados.length
      ? h(
          'section',
          { class: 'tarjeta pila' },
          h('h2', {}, 'Paso 3: Publicar borradores confirmados'),
          h('p', { class: 'ayuda' }, 'Los registros aceptados se guardaron como borradores. Selecciona explícitamente cuáles deseas publicar ahora en la Agenda (FR-021).'),
          h(
            'div',
            { class: 'lista-checks' },
            cargados.map((reg) =>
              h(
                'label',
                { class: 'check-tarjeta' },
                h('input', {
                  type: 'checkbox',
                  checked: seleccionadosPublicar.has(reg.activityId),
                  onchange: (ev) => {
                    if (ev.target.checked) seleccionadosPublicar.add(reg.activityId);
                    else seleccionadosPublicar.delete(reg.activityId);
                  },
                }),
                h(
                  'span',
                  {},
                  h('strong', {}, reg.content?.title || reg.key),
                  ' · ',
                  h('code', {}, reg.activityId),
                  reg.source?.page ? ` (PDF pág. ${reg.source.page})` : '',
                ),
              ),
            ),
          ),
          h(
            'div',
            { class: 'fila-acciones' },
            h(
              'button',
              {
                type: 'button',
                class: 'secundario',
                onclick: () => {
                  cargados.forEach((r) => seleccionadosPublicar.add(r.activityId));
                  pintarLote();
                },
              },
              'Marcar todos',
            ),
            h('button', { type: 'button', onclick: publicarSeleccionados }, 'Publicar seleccionados'),
          ),
          resultadosPublicacion
            ? h(
                'div',
                { class: 'pila-chica' },
                h('h3', {}, 'Resultado de publicación'),
                h(
                  'ul',
                  { class: 'lista-simple' },
                  resultadosPublicacion.map((res) =>
                    h(
                      'li',
                      {},
                      h('code', {}, res.id),
                      ': ',
                      res.published
                        ? h('span', { class: 'ok' }, 'Publicada en la Agenda')
                        : h('span', { class: 'error' }, res.message ?? res.error ?? 'No publicada'),
                    ),
                  ),
                ),
              )
            : null,
        )
      : null;

    zonaTrabajo.replaceChildren(
      ...[
        h(
          'section',
          { class: 'tarjeta pila' },
          h(
            'div',
            { class: 'seccion-cabecera-inline' },
            h('div', {}, h('h2', {}, `Paso 2: Vista previa del lote (${registros.length} registros)`), h('p', { class: 'ayuda' }, `ID de lote: ${lote.id} · Estado: ${lote.status}`)),
            pendientesValidos.length
              ? h(
                  'div',
                  { class: 'fila-acciones' },
                  h(
                    'button',
                    {
                      type: 'button',
                      class: 'secundario',
                      onclick: () => {
                        pendientesValidos.forEach((r) => seleccionados.add(r.position));
                        pintarLote();
                      },
                    },
                    'Seleccionar válidos',
                  ),
                  h('button', { type: 'button', onclick: aceptarSeleccionados }, 'Aceptar seleccionados como borradores'),
                )
              : null,
          ),
          h(
            'div',
            { class: 'tabla-scroll', tabindex: '0', role: 'region', 'aria-label': 'Vista previa de registros del archivo' },
            h(
              'table',
              {},
              h(
                'thead',
                {},
                h(
                  'tr',
                  {},
                  ['Sel.', 'Pos.', 'Clave', 'Origen', 'Título', 'Duplicado', 'Errores', 'Resultado'].map((t) => h('th', { scope: 'col' }, t)),
                ),
              ),
              h('tbody', {}, filas),
            ),
          ),
        ),
        bloquePublicacion,
      ].filter(Boolean),
    );
  }

  const tarjetaSubida = h(
    'section',
    { class: 'tarjeta pila' },
    h('h2', {}, 'Paso 1: Subir archivo estructurado (vivart-programacion/1)'),
    h(
      'p',
      { id: 'ayuda-formato-carga', class: 'ayuda' },
      'El equipo prepara los datos del PDF fuera de VIVART siguiendo el contrato ',
      h('code', {}, 'specs/002-programacion-y-publicacion/contracts/formato-carga.md'),
      '. Las categorías, sedes y edición referenciadas deben existir previamente en Catálogos.',
    ),
    h(
      'div',
      { class: 'fila-acciones' },
      h('a', { href: '/ejemplos/lote-ejemplo.json', download: 'lote-ejemplo.json', class: 'boton secundario' }, 'Descargar archivo de ejemplo (JSON ficticio)'),
    ),
    h('div', { class: 'campo' }, h('label', { for: 'archivo-json' }, 'Archivo JSON de programación'), inputArchivo, zonaErrorArchivo),
    h(
      'div',
      { class: 'fila-acciones' },
      h('button', { type: 'button', onclick: subirArchivo }, icono('subir', 'icono-sm'), 'Analizar y mostrar vista previa'),
    ),
  );

  return [
    subnav,
    h(
      'div',
      { class: 'panel-cabecera' },
      h(
        'div',
        {},
        h('h1', {}, 'Carga desde el PDF'),
        h('p', { class: 'ayuda' }, 'Revisa errores y duplicados antes de crear borradores. Ningún lote se publica automáticamente.'),
      ),
    ),
    tarjetaSubida,
    zonaTrabajo,
  ];
}
