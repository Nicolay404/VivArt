import { normalizar, textoONulo } from './text.js';
import { nuevoId } from './content.js';
import { validation, conflict, notFound } from '../http/errors.js';
import { esDuplicado } from '../db.js';
import { venueDesdeFila, categoriaDesdeFila, edicionDesdeFila } from '../repositories/catalogs.js';

// Ediciones, categorías y sedes (FR-025). Solo el administrador (acción catalog.manage); sin revisión editorial;
// cada cambio queda en el historial. Corregir una dirección o un marcador NO crea aviso público (RC-06).

const PRESENTAR = { editions: edicionDesdeFila, categories: categoriaDesdeFila, venues: venueDesdeFila };
const ENTIDAD = { editions: 'edition', categories: 'category', venues: 'venue' };

function filaDesde(tabla, cuerpo) {
  const name = textoONulo(cuerpo?.name, 200);
  if (!name) throw validation({ name: 'Escribe un nombre.' });
  const fila = { name, name_key: normalizar(name) };
  if (tabla === 'editions') {
    const year = cuerpo.year === undefined || cuerpo.year === null ? null : Number(cuerpo.year);
    if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2200)) throw validation({ year: 'El año no es válido.' });
    fila.year = year;
    fila.active = cuerpo.active === undefined ? true : Boolean(cuerpo.active);
  }
  if (tabla === 'venues') {
    const kind = cuerpo.kind ?? 'place';
    if (!['place', 'route'].includes(kind)) throw validation({ kind: 'El tipo debe ser «place» (lugar) o «route» (recorrido).' });
    fila.kind = kind;
    fila.address = textoONulo(cuerpo.address, 500);
    fila.route_description = textoONulo(cuerpo.routeDescription, 2000);
    const m = cuerpo.marker;
    fila.marker = m && typeof m === 'object' && !Array.isArray(m) ? JSON.stringify(m).length <= 2000 ? JSON.stringify(m) : null : null;
  }
  return fila;
}

export function createCatalogs({ repos, auditar, clock }) {
  const ahora = () => clock().toISOString();

  return {
    async list(tabla) {
      return (await repos.catalogs.list(tabla)).map(PRESENTAR[tabla]);
    },

    async create(actorId, tabla, cuerpo) {
      const fila = { ...filaDesde(tabla, cuerpo), id: nuevoId(tabla.slice(0, 3)), created_at: ahora(), updated_at: ahora() };
      try {
        await repos.catalogs.insert(tabla, fila);
      } catch (error) {
        if (esDuplicado(error)) throw conflict('duplicate_name', 'Ya existe uno con ese nombre.');
        throw error;
      }
      await auditar(actorId, `catalog.${ENTIDAD[tabla]}.created`, ENTIDAD[tabla], fila.id, { name: fila.name });
      return PRESENTAR[tabla](await repos.catalogs.find(tabla, fila.id));
    },

    async update(actorId, tabla, id, cuerpo) {
      const actual = await repos.catalogs.find(tabla, id);
      if (!actual) throw notFound();
      const fila = { ...filaDesde(tabla, { ...PRESENTAR[tabla](actual), ...cuerpo }), updated_at: ahora() };
      try {
        await repos.catalogs.update(tabla, id, fila);
      } catch (error) {
        if (esDuplicado(error)) throw conflict('duplicate_name', 'Ya existe uno con ese nombre.');
        throw error;
      }
      await auditar(actorId, `catalog.${ENTIDAD[tabla]}.updated`, ENTIDAD[tabla], id, { name: fila.name });
      return PRESENTAR[tabla](await repos.catalogs.find(tabla, id));
    },

    /** Mapas para presentar fichas: id -> objeto público. */
    async mapas() {
      const [sedes, categorias] = await Promise.all([repos.catalogs.list('venues'), repos.catalogs.list('categories')]);
      return {
        venues: new Map(sedes.map((f) => [f.id, venueDesdeFila(f)])),
        categories: new Map(categorias.map((f) => [f.id, categoriaDesdeFila(f)])),
      };
    },
  };
}
