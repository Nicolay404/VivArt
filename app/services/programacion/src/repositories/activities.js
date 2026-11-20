// Actividades y su estado editorial. `version` es el control de edición simultánea: cada cambio la sube.

export function activityDesdeFila(f) {
  if (!f) return undefined;
  return {
    id: f.id,
    ownerId: f.owner_id,
    createdBy: f.created_by,
    editionId: f.edition_id,
    status: f.status,
    publishedAt: f.published_at,
    publishedContent: f.published_content,
    workingContent: f.working_content,
    editorialState: f.editorial_state,
    reviewNotes: f.review_notes,
    version: f.version,
    importKey: f.import_key,
    source: f.source,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
  };
}

const json = (v) => (v === null || v === undefined ? null : JSON.stringify(v));

export function activitiesRepo(db) {
  return {
    async find(id) {
      return activityDesdeFila((await db.query('SELECT * FROM activities WHERE id = $1', [id]))[0]);
    },
    async findByImportKey(key) {
      return activityDesdeFila((await db.query('SELECT * FROM activities WHERE import_key = $1', [key]))[0]);
    },
    create: (a) =>
      db.run(
        `INSERT INTO activities (id, owner_id, created_by, edition_id, status, working_content, editorial_state,
           version, import_key, source, search_text, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'active', $5, 'draft', 1, $6, $7, '', $8, $8)`,
        [a.id, a.ownerId, a.createdBy, a.editionId ?? null, json(a.workingContent), a.importKey ?? null, json(a.source), a.now],
      ),
    /**
     * Actualiza campos solo si la versión no cambió (edición simultánea). Devuelve true si se aplicó.
     * `cambios` usa nombres de columna.
     */
    async update(id, versionEsperada, cambios, now) {
      const columnas = Object.keys(cambios);
      const valores = columnas.map((c) => (['working_content', 'published_content', 'source'].includes(c) ? json(cambios[c]) : cambios[c]));
      const sets = columnas.map((c, i) => `${c} = $${i + 1}`);
      const n = await db.run(
        `UPDATE activities SET ${[...sets, `version = version + 1`, `updated_at = $${columnas.length + 1}`].join(', ')}
         WHERE id = $${columnas.length + 2} AND version = $${columnas.length + 3}`,
        [...valores, now, id, versionEsperada],
      );
      return n > 0;
    },
    /** Bandeja del panel. `ownerId` limita a las de una persona. */
    async list({ ownerId, state } = {}) {
      const condiciones = [];
      const params = [];
      if (ownerId) {
        params.push(ownerId);
        condiciones.push(`owner_id = $${params.length}`);
      }
      if (state === 'archived') condiciones.push("status = 'archived'");
      else if (state === 'published') condiciones.push("status = 'active' AND published_at IS NOT NULL");
      else if (state) {
        params.push(state);
        condiciones.push(`status = 'active' AND editorial_state = $${params.length}`);
      }
      const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
      return (await db.query(`SELECT * FROM activities ${where} ORDER BY updated_at DESC LIMIT 500`, params)).map(activityDesdeFila);
    },
    delete: (id) => db.run('DELETE FROM activities WHERE id = $1 AND published_at IS NULL', [id]),
  };
}
