// Ficha de sede del administrador (spec 003, historia 6): marcador sobre la ilustración, destino de «Cómo llegar»,
// accesibilidad por característica, foto e historial. Sin revisión editorial y sin aviso público (RC-06).
// El servidor verifica el rol de administrador en cada operación; la interfaz no es una barrera de seguridad.
import { h, icono, aviso, campo, campoTextarea, campoSelect, formulario, abrirDialogo } from './dom.js';
import { apiProgramacion } from './api.js';
import { formatoFechaHoraIso } from './format.js';

const FOTO_MAX_BYTES = 1024 * 1024;
const FOTO_MAX_LADO = 1600;

const CARACTERISTICAS = [
  { clave: 'stepFree', ruta: 'step_free', nombre: 'Acceso sin escalones' },
  { clave: 'accessibleToilet', ruta: 'accessible_toilet', nombre: 'Baño accesible' },
];
const ESTADOS = [
  { value: 'unconfirmed', label: 'Por confirmar' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'unavailable', label: 'No disponible' },
];
const ACCIONES = {
  'catalog.venue.created': 'Sede creada',
  'catalog.venue.updated': 'Datos o marcador corregidos',
  'venue.destination.set': 'Destino de «Cómo llegar» registrado',
  'venue.destination.removed': 'Destino de «Cómo llegar» quitado',
  'venue.accessibility.set': 'Accesibilidad registrada',
  'venue.photo.set': 'Foto subida',
  'venue.photo.removed': 'Foto quitada',
};

/** Los errores del servidor llegan con el nombre del campo de la API; aquí los campos llevan prefijo propio. */
function conPrefijo(r, prefijo) {
  if (r && !r.ok && r.datos?.fields) {
    r.datos.fields = Object.fromEntries(Object.entries(r.datos.fields).map(([k, v]) => [`${prefijo}${k}`, v]));
  }
  return r;
}

/** Reduce la foto en el navegador (máximo 1600 px de lado) y la codifica en JPEG de hasta 1 MB. */
async function prepararFoto(archivo) {
  const mapa = await createImageBitmap(archivo);
  const escala = Math.min(1, FOTO_MAX_LADO / Math.max(mapa.width, mapa.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(mapa.width * escala);
  lienzo.height = Math.round(mapa.height * escala);
  lienzo.getContext('2d').drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
  for (const calidad of [0.86, 0.76, 0.66, 0.56]) {
    const blob = await new Promise((r) => lienzo.toBlob(r, 'image/jpeg', calidad));
    if (blob && blob.size <= FOTO_MAX_BYTES) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binario = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(binario);
    }
  }
  return null;
}

export async function abrirFichaSede(sedeId, { alCambiar } = {}) {
  const cuerpo = h('div', { class: 'ficha-sede-panel' }, h('p', { class: 'cargando' }, 'Cargando la sede…'));
  const rMapa = await apiProgramacion('GET', '/map');
  const ilustracion = rMapa.ok ? rMapa.datos.illustration : null;
  let cambiado = false;

  abrirDialogo({
    titulo: 'Mapa y datos de la sede',
    ancho: 'grande',
    contenido: cuerpo,
    alCerrar: () => {
      if (cambiado && alCambiar) void alCambiar();
    },
  });

  async function tras(r, mensaje) {
    if (r.ok) {
      cambiado = true;
      aviso(mensaje, 'ok');
      await pintar();
    }
    return r;
  }

  async function pintar() {
    const r = await apiProgramacion('GET', `/panel/venues/${encodeURIComponent(sedeId)}`);
    if (!r.ok) {
      cuerpo.replaceChildren(h('p', { class: 'aviso error-caja' }, r.datos?.message ?? 'No se pudo cargar la sede.'));
      return;
    }
    const s = r.datos;
    const rHist = await apiProgramacion('GET', `/panel/venues/${encodeURIComponent(sedeId)}/history`);
    cuerpo.replaceChildren(
      h('h3', { class: 'ficha-sede-nombre' }, s.name, s.kind === 'route' ? h('span', { class: 'chip-sutil' }, 'Recorrido') : null),
      h('p', { class: 'ayuda' }, 'Estos cambios no pasan por revisión editorial ni crean avisos públicos; quedan en el historial. Cambiar la sede de una función es una reprogramación con aviso (Agenda).'),
      seccionMarcador(s),
      seccionDestino(s),
      seccionAccesibilidad(s),
      seccionFoto(s),
      seccionHistorial(rHist.ok ? rHist.datos.items : []),
    );
  }

  // ---------- Marcador sobre la ilustración (FR-022) ----------
  function seccionMarcador(s) {
    if (!ilustracion) return h('section', { class: 'ficha-sede-seccion' }, h('h4', {}, 'Marcador en el mapa'), h('p', { class: 'aviso error-caja' }, 'No se pudo cargar la ilustración.'));
    const actual = s.marker ? { x: s.marker.x, y: s.marker.y } : null;
    const x = campo({ id: 'marcador-x', etiqueta: 'Posición horizontal (0 a 1)', tipo: 'number', valor: actual?.x ?? '', min: 0, max: 1, step: 'any', requerido: false });
    const y = campo({ id: 'marcador-y', etiqueta: 'Posición vertical (0 a 1)', tipo: 'number', valor: actual?.y ?? '', min: 0, max: 1, step: 'any', requerido: false });
    const punto = h('span', { class: 'marcador-sede marcador-previa', 'aria-hidden': 'true' }, icono('sede', 'icono-sm'));
    const moverPunto = () => {
      const px = Number(x.input.value);
      const py = Number(y.input.value);
      const valido = x.input.value !== '' && y.input.value !== '' && px >= 0 && px <= 1 && py >= 0 && py <= 1;
      punto.hidden = !valido;
      if (valido) {
        punto.style.left = `${px * 100}%`;
        punto.style.top = `${py * 100}%`;
      }
    };
    x.input.addEventListener('input', moverPunto);
    y.input.addEventListener('input', moverPunto);
    const plano = h(
      'div',
      {
        class: 'plano-marcador',
        onclick: (e) => {
          const caja = plano.getBoundingClientRect();
          x.input.value = ((e.clientX - caja.left) / caja.width).toFixed(4);
          y.input.value = ((e.clientY - caja.top) / caja.height).toFixed(4);
          moverPunto();
        },
      },
      h('img', { src: ilustracion.src, alt: 'Ilustración del mapa: haz clic donde quieras colocar el marcador', draggable: 'false' }),
      punto,
    );
    moverPunto();
    return h(
      'section',
      { class: 'ficha-sede-seccion' },
      h('h4', {}, 'Marcador en el mapa'),
      ilustracion.provisional ? h('p', { class: 'aviso alerta-caja' }, 'La ilustración es provisional (P-13). Al llegar la definitiva habrá que colocar los marcadores de nuevo.') : null,
      !s.marker && s.storedMarker ? h('p', { class: 'aviso alerta-caja' }, 'El marcador guardado es de otra ilustración y no se muestra: colócalo de nuevo.') : null,
      h('p', { class: 'ayuda' }, 'Haz clic sobre la ilustración o escribe la posición. El marcador no es una coordenada real: «Cómo llegar» usa el destino verificado.'),
      plano,
      formulario({
        campos: [x, y],
        boton: 'Guardar marcador',
        clase: 'form-en-linea',
        alEnviar: async (v) => {
          if (v['marcador-x'] === '' || v['marcador-y'] === '') {
            x.mostrarError('Coloca el marcador en la ilustración.');
            return null;
          }
          const marker = { illustrationId: ilustracion.id, x: Number(v['marcador-x']), y: Number(v['marcador-y']) };
          return tras(conPrefijo(await apiProgramacion('PUT', `/panel/venues/${encodeURIComponent(sedeId)}`, { marker }), 'marcador-'), 'Marcador guardado.');
        },
      }),
      s.marker
        ? h(
            'button',
            {
              type: 'button',
              class: 'secundario boton-sm',
              onclick: async () => tras(await apiProgramacion('PUT', `/panel/venues/${encodeURIComponent(sedeId)}`, { marker: null }), 'Marcador quitado: la sede sigue en la lista.'),
            },
            'Quitar marcador',
          )
        : null,
    );
  }

  // ---------- Destino de «Cómo llegar» (FR-012, FR-023) ----------
  function seccionDestino(s) {
    const titulo = h('h4', {}, 'Cómo llegar');
    if (s.kind === 'route') {
      return h('section', { class: 'ficha-sede-seccion' }, titulo, h('p', { class: 'ayuda' }, 'Un recorrido no tiene un destino único: «Cómo llegar» no se ofrece.'));
    }
    const d = s.destination;
    const lat = campo({ id: 'destino-lat', etiqueta: 'Latitud', tipo: 'number', valor: d?.lat ?? '', min: -90, max: 90, step: 'any' });
    const lng = campo({ id: 'destino-lng', etiqueta: 'Longitud', tipo: 'number', valor: d?.lng ?? '', min: -180, max: 180, step: 'any' });
    const fuente = campo({ id: 'destino-source', etiqueta: 'Fuente de la verificación', valor: d?.source ?? '', ayuda: 'Por ejemplo: «Revisión en sitio» o «Responsable de la sede».' });
    const fecha = campo({ id: 'destino-verifiedOn', etiqueta: 'Fecha de verificación', tipo: 'date', valor: d?.verifiedOn ?? '' });
    return h(
      'section',
      { class: 'ficha-sede-seccion' },
      titulo,
      h('p', { class: 'ayuda' }, d ? 'Destino verificado: el mapa ofrece «Cómo llegar» con Google Maps.' : 'Sin destino verificado: el mapa no ofrece «Cómo llegar». Comprueba las coordenadas antes de guardarlas.'),
      formulario({
        campos: [lat, lng, fuente, fecha],
        boton: d ? 'Guardar destino' : 'Registrar destino',
        alEnviar: async (v) =>
          tras(
            conPrefijo(
              await apiProgramacion('PUT', `/panel/venues/${encodeURIComponent(sedeId)}/destination`, {
                lat: v['destino-lat'] === '' ? null : Number(v['destino-lat']),
                lng: v['destino-lng'] === '' ? null : Number(v['destino-lng']),
                source: v['destino-source'],
                verifiedOn: v['destino-verifiedOn'],
              }),
              'destino-',
            ),
            'Destino guardado.',
          ),
      }),
      d
        ? h(
            'button',
            {
              type: 'button',
              class: 'secundario boton-sm',
              // Sin diálogo de confirmación: el modal es único y lo cerraría. Se puede volver a registrar y queda en el historial.
              onclick: async () => tras(await apiProgramacion('DELETE', `/panel/venues/${encodeURIComponent(sedeId)}/destination`), 'Destino quitado: «Cómo llegar» ya no se ofrece.'),
            },
            'Quitar destino',
          )
        : null,
    );
  }

  // ---------- Accesibilidad por característica (FR-013, FR-018, FR-024) ----------
  function seccionAccesibilidad(s) {
    return h(
      'section',
      { class: 'ficha-sede-seccion' },
      h('h4', {}, 'Accesibilidad'),
      h('p', { class: 'ayuda' }, 'Confirmada o no disponible exigen fuente y fecha. Solo «confirmada» hace aparecer la sede en el filtro; la observación no cambia el filtro.'),
      h(
        'div',
        { class: 'rejilla-accesibilidad' },
        CARACTERISTICAS.map((c) => {
          const a = s.accessibilityDetail?.[c.clave] ?? { status: 'unconfirmed' };
          const p = `${c.ruta}-`;
          const estado = campoSelect({ id: `${p}status`, etiqueta: 'Estado', valor: a.status, opciones: ESTADOS });
          const fuente = campo({ id: `${p}source`, etiqueta: 'Fuente', valor: a.source ?? '', requerido: false });
          const fecha = campo({ id: `${p}verifiedOn`, etiqueta: 'Fecha de verificación', tipo: 'date', valor: a.verifiedOn ?? '', requerido: false });
          const nota = campoTextarea({ id: `${p}note`, etiqueta: 'Observación (opcional)', valor: a.note ?? '', filas: 2 });
          return h(
            'div',
            { class: 'tarjeta-accesibilidad' },
            h('h5', {}, c.nombre),
            formulario({
              campos: [estado, fuente, fecha, nota],
              boton: 'Guardar',
              alEnviar: async (v) =>
                tras(
                  conPrefijo(
                    await apiProgramacion('PUT', `/panel/venues/${encodeURIComponent(sedeId)}/accessibility/${c.ruta}`, {
                      status: v[`${p}status`],
                      source: v[`${p}source`] || null,
                      verifiedOn: v[`${p}verifiedOn`] || null,
                      note: v[`${p}note`] || null,
                    }),
                    p,
                  ),
                  `${c.nombre}: guardado.`,
                ),
            }),
          );
        }),
      ),
    );
  }

  // ---------- Foto opcional (FR-025, M-09) ----------
  function seccionFoto(s) {
    const archivo = h('input', { id: 'foto-archivo', type: 'file', accept: 'image/jpeg,image/png,image/webp' });
    const campoArchivo = {
      el: h('div', { class: 'campo' }, h('label', { for: 'foto-archivo' }, 'Foto (JPEG, PNG o WebP)'), archivo, h('p', { class: 'error', id: 'foto-archivo-error', hidden: true })),
      input: archivo,
      mostrarError(texto) {
        const e = campoArchivo.el.querySelector('.error');
        e.textContent = texto;
        e.hidden = false;
      },
      limpiar() {
        campoArchivo.el.querySelector('.error').hidden = true;
      },
    };
    const alt = campo({ id: 'foto-alt', etiqueta: 'Texto alternativo', valor: s.photo?.alt ?? '', ayuda: 'Describe la foto para quien no puede verla.' });
    const credito = campo({ id: 'foto-credit', etiqueta: 'Fuente o autoría', valor: s.photo?.credit ?? '', ayuda: 'Solo fotos propias o con licencia que permita reutilizarlas.' });
    return h(
      'section',
      { class: 'ficha-sede-seccion' },
      h('h4', {}, 'Foto de la sede'),
      s.photo
        ? h('figure', { class: 'foto-sede foto-sede-panel' }, h('img', { src: s.photo.url, alt: s.photo.alt }), h('figcaption', {}, `Foto: ${s.photo.credit}`))
        : h('p', { class: 'ayuda' }, 'Sin foto: la tarjeta pública se muestra sin imagen.'),
      formulario({
        campos: [campoArchivo, alt, credito],
        boton: s.photo ? 'Reemplazar foto' : 'Subir foto',
        alEnviar: async (v) => {
          const elegido = archivo.files?.[0];
          if (!elegido) {
            campoArchivo.mostrarError('Elige una foto.');
            return null;
          }
          let datos = null;
          try {
            datos = await prepararFoto(elegido);
          } catch {
            datos = null;
          }
          if (!datos) {
            campoArchivo.mostrarError('No se pudo leer la foto o pesa demasiado incluso reducida.');
            return null;
          }
          const r = await apiProgramacion('PUT', `/panel/venues/${encodeURIComponent(sedeId)}/photo`, { dataBase64: datos, alt: v['foto-alt'], credit: v['foto-credit'] });
          if (r && !r.ok && r.datos?.fields?.photo) campoArchivo.mostrarError(r.datos.fields.photo);
          return tras(conPrefijo(r, 'foto-'), 'Foto guardada.');
        },
      }),
      s.photo
        ? h(
            'button',
            {
              type: 'button',
              class: 'secundario boton-sm',
              onclick: async () => tras(await apiProgramacion('DELETE', `/panel/venues/${encodeURIComponent(sedeId)}/photo`), 'Foto quitada: la tarjeta se muestra sin foto.'),
            },
            'Quitar foto',
          )
        : null,
    );
  }

  // ---------- Historial (FR-017, SC-009) ----------
  function seccionHistorial(items) {
    return h(
      'section',
      { class: 'ficha-sede-seccion' },
      h('h4', {}, 'Historial de la sede'),
      items.length
        ? h(
            'ol',
            { class: 'historial-sede' },
            items.map((e) => h('li', {}, h('strong', {}, ACCIONES[e.action] ?? e.action), h('span', { class: 'ayuda' }, ` · ${formatoFechaHoraIso(e.at)} · ${e.actorId}`))),
          )
        : h('p', { class: 'ayuda' }, 'Sin cambios registrados.'),
    );
  }

  await pintar();
}
