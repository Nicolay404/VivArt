// Catálogos: ediciones, categorías y sedes. Los nombres son únicos sin distinguir mayúsculas ni tildes (name_key).
const TABLAS = {
  editions: { columnas: ['name', 'year', 'active'] },
  categories: { columnas: ['name'] },
  venues: { columnas: ['name', 'kind', 'address', 'route_description', 'marker'] },
};

export const venueDesdeFila = (f) =>
  f && { id: f.id, name: f.name, kind: f.kind, address: f.address, routeDescription: f.route_description, marker: f.marker ?? null };
export const categoriaDesdeFila = (f) => f && { id: f.id, name: f.name };
export const edicionDesdeFila = (f) => f && { id: f.id, name: f.name, year: f.year, active: f.active };

export function catalogsRepo(db) {
  return {
    list: (tabla) => db.query(`SELECT * FROM ${tabla} ORDER BY name_key`),
    find: async (tabla, id) => (await db.query(`SELECT * FROM ${tabla} WHERE id = $1`, [id]))[0],
    findByKey: async (tabla, nameKey) => (await db.query(`SELECT * FROM ${tabla} WHERE name_key = $1`, [nameKey]))[0],
    async insert(tabla, fila) {
      const columnas = ['id', 'name_key', 'created_at', 'updated_at', ...TABLAS[tabla].columnas];
      const valores = columnas.map((c) => fila[c] ?? null);
      await db.run(
        `INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES (${columnas.map((_, i) => `$${i + 1}`).join(', ')})`,
        valores,
      );
    },
    async update(tabla, id, fila) {
      const columnas = ['name_key', 'updated_at', ...TABLAS[tabla].columnas];
      const valores = columnas.map((c) => fila[c] ?? null);
      return db.run(
        `UPDATE ${tabla} SET ${columnas.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${columnas.length + 1}`,
        [...valores, id],
      );
    },
    /** Conjuntos de identificadores existentes, para validar el contenido de una actividad. */
    async ids() {
      const [cats, sedes] = await Promise.all([db.query('SELECT id FROM categories'), db.query('SELECT id FROM venues')]);
      return { categorias: new Set(cats.map((f) => f.id)), sedes: new Set(sedes.map((f) => f.id)) };
    },
  };
}
