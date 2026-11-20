import { fechaValida, horaValida } from '../clock.js';
import { normalizar, textoONulo } from './text.js';
import { normalizarContenido, nuevoId } from './content.js';
import { validation, notFound, AppError } from '../http/errors.js';

// Carga desde el archivo estructurado `vivart-programacion/1` (FR-020 a FR-024, FR-031, FR-033).
// El equipo prepara y revisa los datos del PDF fuera de VIVART. Aquí: vista previa con origen, duplicados y errores;
// aceptar crea BORRADORES; publicar exige confirmación explícita; recargar nunca sobrescribe correcciones.
// Ver specs/002-programacion-y-publicacion/contracts/formato-carga.md.

export const FORMATO = 'vivart-programacion/1';
const CLAVE_RE = /^[A-Za-z0-9_.:-]{1,120}$/;
const ETIQUETAS = new Map([
  ['entrada libre', 'free'],
  ['evento gratuito', 'free'],
  ['evento pagado', 'paid'],
]);

/** Modalidad de acceso según la etiqueta del PDF (FR-024). La ausencia de precio nunca es gratuidad. */
export function accesoDesdeEtiqueta(etiqueta, precioUsd, revisado) {
  const precio = precioUsd === null || precioUsd === undefined ? null : Number(precioUsd);
  const conPrecio = Number.isFinite(precio) && precio >= 0 ? precio : null;
  if (etiqueta === null || etiqueta === undefined || etiqueta === '') {
    return { access: conPrecio !== null ? { mode: 'paid', priceUsd: conPrecio } : { mode: 'unconfirmed', priceUsd: null } };
  }
  const tipo = ETIQUETAS.get(normalizar(etiqueta));
  if (!tipo) return { error: `La etiqueta «${etiqueta}» no se reconoce (usa Entrada Libre, Evento Gratuito o Evento Pagado).` };
  // Gratuita solo si la etiqueta se asoció claramente a la ficha y el registro fue revisado.
  if (tipo === 'free') return { access: revisado === true ? { mode: 'free', priceUsd: null } : { mode: 'unconfirmed', priceUsd: null } };
  return { access: { mode: 'paid', priceUsd: conPrecio } };
}

/** Convierte un registro del archivo en contenido y lista de errores. `cat` = mapas nombre normalizado -> id. */
export function convertirRegistro(r, cat) {
  const errores = [];
  const registro = r && typeof r === 'object' ? r : {};
  const clave = typeof registro.clave === 'string' ? registro.clave.trim() : '';
  if (!CLAVE_RE.test(clave)) errores.push('Falta la «clave» o tiene caracteres no permitidos.');
  const pagina = registro.origen?.pagina;
  if (!Number.isInteger(pagina) || pagina < 1) errores.push('Falta «origen.pagina»: la página del PDF de donde sale el dato.');
  const titulo = textoONulo(registro.titulo, 300);
  if (!titulo) errores.push('Falta el «titulo».');

  let categoryId = null;
  if (registro.categoria) {
    categoryId = cat.categorias.get(normalizar(registro.categoria)) ?? null;
    if (!categoryId) errores.push(`La categoría «${registro.categoria}» no existe: créala antes en el panel.`);
  }
  const sede = (nombre, donde) => {
    const id = cat.sedes.get(normalizar(nombre));
    if (!id) errores.push(`${donde}: la sede «${nombre ?? ''}» no existe: créala antes en el panel.`);
    return id ?? null;
  };

  const funciones = (Array.isArray(registro.funciones) ? registro.funciones : []).map((f, i) => {
    const donde = `Función ${i + 1}`;
    if (!fechaValida(f?.fecha)) errores.push(`${donde}: la «fecha» debe ser AAAA-MM-DD.`);
    if (!horaValida(f?.hora)) errores.push(`${donde}: la «hora» debe ser HH:MM.`);
    if (f?.horaFin != null && !horaValida(f.horaFin)) errores.push(`${donde}: la «horaFin» debe ser HH:MM.`);
    return {
      date: f?.fecha ?? null,
      startTime: f?.hora ?? null,
      endTime: f?.horaFin ?? null,
      durationMinutes: Number.isInteger(f?.duracionMin) ? f.duracionMin : null,
      venueId: sede(f?.sede, donde),
    };
  });
  const franjas = (Array.isArray(registro.franjas) ? registro.franjas : []).map((s, i) => {
    const donde = `Franja ${i + 1}`;
    const porFechas = Array.isArray(s?.fechas) && s.fechas.length > 0;
    if (porFechas && s.fechas.some((d) => !fechaValida(d))) errores.push(`${donde}: hay «fechas» que no son AAAA-MM-DD.`);
    if (!porFechas && (!fechaValida(s?.desde) || !fechaValida(s?.hasta) || s.desde > s.hasta)) {
      errores.push(`${donde}: indica «fechas» o un rango «desde»–«hasta» válido.`);
    }
    if (!horaValida(s?.abre) || !horaValida(s?.cierra)) errores.push(`${donde}: «abre» y «cierra» deben ser HH:MM.`);
    return {
      venueId: sede(s?.sede, donde),
      dates: porFechas ? s.fechas : null,
      from: porFechas ? null : (s?.desde ?? null),
      to: porFechas ? null : (s?.hasta ?? null),
      weekdays: Array.isArray(s?.dias) ? s.dias : null,
      opens: s?.abre ?? null,
      closes: s?.cierra ?? null,
    };
  });

  const acceso = accesoDesdeEtiqueta(registro.etiqueta, registro.precioUsd, registro.revisado);
  if (acceso.error) errores.push(acceso.error);

  const content = normalizarContenido({
    title: titulo,
    artists: Array.isArray(registro.artistas) ? registro.artistas : [],
    organization: registro.organizacion ?? null,
    description: registro.descripcion ?? null,
    categoryId,
    durationMinutes: Number.isInteger(registro.duracionMin) ? registro.duracionMin : null,
    access: acceso.access ?? { mode: 'unconfirmed', priceUsd: null },
    functions: funciones,
    slots: franjas,
  });
  return {
    key: clave || null,
    source: { page: Number.isInteger(pagina) ? pagina : null, note: textoONulo(registro.origen?.nota, 500) },
    content,
    errors: errores,
    reviewed: registro.revisado === true,
  };
}

/** Huella para detectar posibles duplicados: título normalizado + fecha y sede de cada función. */
const huellas = (contenido) =>
  contenido.title ? contenido.functions.filter((f) => f.date && f.venueId).map((f) => `${normalizar(contenido.title)}|${f.date}|${f.venueId}`) : [];

export function createImports({ db, crearRepos, permisos, editorial, clock }) {
  const repos = crearRepos(db);
  const ahora = () => clock().toISOString();

  async function mapasPorNombre() {
    const [cats, sedes, ediciones] = await Promise.all([
      repos.catalogs.list('categories'),
      repos.catalogs.list('venues'),
      repos.catalogs.list('editions'),
    ]);
    return {
      categorias: new Map(cats.map((c) => [c.name_key, c.id])),
      sedes: new Map(sedes.map((s) => [s.name_key, s.id])),
      ediciones: new Map(ediciones.map((e) => [e.name_key, e.id])),
    };
  }

  /** Huellas de las actividades existentes (publicadas o en borrador) para avisar de posibles duplicados. */
  async function huellasExistentes() {
    const filas = await db.query("SELECT id, published_content, working_content FROM activities WHERE status = 'active'");
    const m = new Map();
    for (const f of filas) {
      for (const c of [f.published_content, f.working_content]) if (c) for (const h of huellas(normalizarContenido(c))) m.set(h, f.id);
    }
    return m;
  }

  return {
    async vistaPrevia(sesion, { file, filename } = {}) {
      await permisos.permitir(sesion, 'catalog.load');
      if (!file || typeof file !== 'object' || file.formato !== FORMATO || !Array.isArray(file.registros)) {
        throw validation({ file: `El archivo debe tener "formato": "${FORMATO}" y una lista "registros".` }, 'El archivo no tiene el formato esperado.');
      }
      if (file.registros.length === 0) throw validation({ file: 'El archivo no tiene registros.' }, 'El archivo está vacío.');
      if (file.registros.length > 2000) throw validation({ file: 'Como máximo 2000 registros por archivo.' });

      const cat = await mapasPorNombre();
      let editionId = null;
      if (file.edicion) {
        editionId = cat.ediciones.get(normalizar(file.edicion)) ?? null;
        if (!editionId) throw validation({ edicion: `La edición «${file.edicion}» no existe: créala antes en el panel.` });
      }
      const existentes = await huellasExistentes();
      const vistas = new Map();
      const huellasLote = new Map();
      const registros = [];
      for (const [i, r] of file.registros.entries()) {
        const conv = convertirRegistro(r, cat);
        let duplicateOf = null;
        if (conv.key && vistas.has(conv.key)) {
          conv.errors.push(`La clave «${conv.key}» se repite en el archivo (registro ${vistas.get(conv.key) + 1}).`);
          duplicateOf = `registro:${vistas.get(conv.key) + 1}`;
        }
        if (conv.key && !vistas.has(conv.key)) vistas.set(conv.key, i);
        const ya = conv.key ? await repos.activities.findByImportKey(conv.key) : undefined;
        if (ya) duplicateOf = `actividad:${ya.id}`;
        for (const h of huellas(conv.content)) {
          if (!duplicateOf && huellasLote.has(h)) duplicateOf = `registro:${huellasLote.get(h) + 1}`;
          if (!duplicateOf && existentes.has(h)) duplicateOf = `actividad:${existentes.get(h)}`;
          if (!huellasLote.has(h)) huellasLote.set(h, i);
        }
        registros.push({ position: i, key: conv.key, source: conv.source, content: conv.content, errors: conv.errors, duplicateOf });
      }

      const id = nuevoId('lote');
      await db.transaction(`lote:${id}`, async (tx) => {
        const r = crearRepos(tx);
        await r.imports.createBatch({ id, uploadedBy: sesion.userId, at: ahora(), filename: textoONulo(filename, 200), editionId });
        for (const reg of registros) await r.imports.addRecord(id, reg);
        await r.history.add({ at: ahora(), actorId: sesion.userId, action: 'import.previewed', entityType: 'import', entityId: id, details: { records: registros.length } });
      });
      return repos.imports.findBatch(id);
    },

    async ver(sesion, id) {
      await permisos.permitir(sesion, 'catalog.load');
      const lote = await repos.imports.findBatch(id);
      if (!lote) throw notFound();
      return lote;
    },

    /** Crea borradores con los registros aceptados. No publica nada (FR-021). */
    async aceptar(sesion, id, { positions } = {}) {
      await permisos.permitir(sesion, 'catalog.load');
      if (!Array.isArray(positions) || positions.some((p) => !Number.isInteger(p))) {
        throw validation({ positions: 'Indica las posiciones aceptadas (números).' });
      }
      return db.transaction(`lote:${id}`, async (tx) => {
        const r = crearRepos(tx);
        const lote = await r.imports.findBatch(id);
        if (!lote) throw notFound();
        const aceptadas = new Set(positions);
        const momento = ahora();
        for (const reg of lote.records) {
          if (!aceptadas.has(reg.position) || reg.outcome !== 'pending') continue;
          // Registro con errores: no se carga hasta corregirlo (FR-033).
          if (reg.errors.length) {
            await r.imports.setOutcome(id, reg.position, 'skipped_error');
            continue;
          }
          // Clave ya cargada: no se vuelve a cargar, para no sobrescribir correcciones (FR-022).
          const existente = await r.activities.findByImportKey(reg.key);
          if (existente) {
            await r.imports.setOutcome(id, reg.position, 'skipped_existing', existente.id);
            continue;
          }
          const actividad = nuevoId('act');
          await r.activities.create({
            id: actividad,
            ownerId: sesion.userId,
            createdBy: sesion.userId,
            editionId: lote.editionId,
            workingContent: reg.content,
            importKey: reg.key,
            source: { batchId: id, page: reg.source.page, note: reg.source.note },
            now: momento,
          });
          await r.imports.setOutcome(id, reg.position, 'loaded', actividad);
          await r.history.add({
            at: momento,
            actorId: sesion.userId,
            action: 'activity.created',
            entityType: 'activity',
            entityId: actividad,
            details: { importBatch: id, page: reg.source.page, key: reg.key },
          });
        }
        await r.imports.markAccepted(id);
        await r.history.add({ at: momento, actorId: sesion.userId, action: 'import.accepted', entityType: 'import', entityId: id, details: { positions } });
        return r.imports.findBatch(id);
      });
    },

    /** Publica solo las actividades que el administrador confirma explícitamente (FR-021). */
    async publicarLote(sesion, { activityIds } = {}) {
      await permisos.permitir(sesion, 'catalog.load');
      if (!Array.isArray(activityIds) || activityIds.length === 0 || activityIds.some((x) => typeof x !== 'string')) {
        throw validation({ activityIds: 'Indica qué actividades confirmas para publicar.' });
      }
      const resultados = [];
      for (const id of [...new Set(activityIds)]) {
        try {
          await editorial.publicarInterno(sesion.userId, id);
          resultados.push({ id, published: true });
        } catch (error) {
          if (!(error instanceof AppError)) throw error;
          resultados.push({ id, published: false, error: error.code, message: error.message, fields: error.extra?.fields });
        }
      }
      return { results: resultados };
    },
  };
}
