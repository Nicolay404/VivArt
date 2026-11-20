// Datos del mapa de sedes (spec 003): accesibilidad, fotos, destino y funciones visibles por sede.
// Las sedes son la tabla `venues` del spec 002; aquí no se duplica el catálogo.

// Funciones visibles para el público: actividad publicada, no archivada y de una edición activa (o sin edición),
// igual que la Agenda. Las franjas de apertura (`opening_slots`) no son funciones y nunca entran (M-06).
const VISIBLES = `
  FROM functions f
  JOIN activities a ON a.id = f.activity_id
  LEFT JOIN editions e ON e.id = a.edition_id
  WHERE a.status = 'active' AND a.published_at IS NOT NULL AND (a.edition_id IS NULL OR e.active)`;

export const accesibilidadDesdeFila = (f) => ({
  status: f.status,
  source: f.source ?? null,
  verifiedOn: f.verified_on ?? null,
  note: f.note ?? null,
  updatedAt: f.updated_at ?? null,
});

export const fotoDesdeFila = (f) => f && { mime: f.mime, alt: f.alt, credit: f.credit, sha256: f.sha256, size: Number(f.size ?? 0), updatedAt: f.updated_at };

export function sedesRepo(db) {
  return {
    listVenues: () => db.query('SELECT * FROM venues ORDER BY name_key'),
    findVenue: async (id) => (await db.query('SELECT * FROM venues WHERE id = $1', [id]))[0],

    /** Mapa venue_id -> { step_free, accessible_toilet } con las filas existentes. */
    async accessibility(ids) {
      const filas = ids
        ? await db.query('SELECT * FROM venue_accessibility WHERE venue_id = ANY($1)', [ids])
        : await db.query('SELECT * FROM venue_accessibility');
      const mapa = new Map();
      for (const f of filas) {
        if (!mapa.has(f.venue_id)) mapa.set(f.venue_id, {});
        mapa.get(f.venue_id)[f.feature] = accesibilidadDesdeFila(f);
      }
      return mapa;
    },
    setAccessibility: (venueId, feature, a, now) =>
      db.run(
        `INSERT INTO venue_accessibility (venue_id, feature, status, source, verified_on, note, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (venue_id, feature) DO UPDATE SET status = EXCLUDED.status, source = EXCLUDED.source,
           verified_on = EXCLUDED.verified_on, note = EXCLUDED.note, updated_at = EXCLUDED.updated_at`,
        [venueId, feature, a.status, a.source, a.verifiedOn, a.note, now],
      ),

    /** Metadatos de las fotos (sin los bytes): venue_id -> foto. */
    async photos(ids) {
      const columnas = 'venue_id, mime, alt, credit, sha256, updated_at, octet_length(bytes) AS size';
      const filas = ids
        ? await db.query(`SELECT ${columnas} FROM venue_photos WHERE venue_id = ANY($1)`, [ids])
        : await db.query(`SELECT ${columnas} FROM venue_photos`);
      return new Map(filas.map((f) => [f.venue_id, fotoDesdeFila(f)]));
    },
    photoBytes: async (venueId) => (await db.query('SELECT mime, bytes, sha256 FROM venue_photos WHERE venue_id = $1', [venueId]))[0],
    setPhoto: (venueId, p, now) =>
      db.run(
        `INSERT INTO venue_photos (venue_id, mime, bytes, alt, credit, sha256, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (venue_id) DO UPDATE SET mime = EXCLUDED.mime, bytes = EXCLUDED.bytes, alt = EXCLUDED.alt,
           credit = EXCLUDED.credit, sha256 = EXCLUDED.sha256, updated_at = EXCLUDED.updated_at`,
        [venueId, p.mime, p.bytes, p.alt, p.credit, p.sha256, now],
      ),
    deletePhoto: (venueId) => db.run('DELETE FROM venue_photos WHERE venue_id = $1', [venueId]),

    setDestination: (venueId, d, now) =>
      db.run(
        'UPDATE venues SET dest_lat = $1, dest_lng = $2, dest_source = $3, dest_verified_on = $4, updated_at = $5 WHERE id = $6',
        [d?.lat ?? null, d?.lng ?? null, d?.source ?? null, d?.verifiedOn ?? null, now, venueId],
      ),

    /** Días con al menos una función visible y programada (M-06). */
    async days() {
      const filas = await db.query(`SELECT DISTINCT f.date ${VISIBLES} AND f.status = 'scheduled' ORDER BY f.date`);
      return filas.map((f) => f.date);
    },

    /** venue_id -> número de funciones visibles y programadas ese día. */
    async dayCounts(day) {
      const filas = await db.query(
        `SELECT f.venue_id, COUNT(*)::int AS n ${VISIBLES} AND f.status = 'scheduled' AND f.date = $1 GROUP BY f.venue_id`,
        [day],
      );
      return new Map(filas.map((f) => [f.venue_id, f.n]));
    },

    /** Funciones visibles de una sede: las de `day`, o desde `desde` en adelante. Incluye canceladas. */
    functionsOf(venueId, { day, desde }) {
      const [condicion, valor] = day ? ['f.date = $2', day] : ['f.date >= $2', desde];
      return db.query(
        `SELECT f.*, a.published_content->>'title' AS title, a.published_content->'durationMinutes' AS activity_duration
         ${VISIBLES} AND f.venue_id = $1 AND ${condicion}
         ORDER BY f.date, f.start_time, title`,
        [venueId, valor],
      );
    },
  };
}
