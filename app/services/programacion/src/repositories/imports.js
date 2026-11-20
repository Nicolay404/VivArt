// Lotes de carga y sus registros (vista previa y resultado).
const json = (v) => (v === null || v === undefined ? null : JSON.stringify(v));

const registroDesdeFila = (f) => ({
  position: f.position,
  key: f.import_key,
  source: f.source_ref,
  content: f.data,
  errors: f.errors ?? [],
  duplicateOf: f.duplicate_of,
  outcome: f.outcome,
  activityId: f.activity_id,
});

export function importsRepo(db) {
  return {
    createBatch: (b) =>
      db.run(
        "INSERT INTO import_batches (id, uploaded_by, uploaded_at, filename, edition_id, status) VALUES ($1, $2, $3, $4, $5, 'preview')",
        [b.id, b.uploadedBy, b.at, b.filename ?? null, b.editionId ?? null],
      ),
    addRecord: (batchId, r) =>
      db.run(
        `INSERT INTO import_records (batch_id, position, import_key, source_ref, data, errors, duplicate_of)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [batchId, r.position, r.key, json(r.source), json(r.content), json(r.errors), r.duplicateOf],
      ),
    async findBatch(id) {
      const b = (await db.query('SELECT * FROM import_batches WHERE id = $1', [id]))[0];
      if (!b) return undefined;
      const registros = await db.query('SELECT * FROM import_records WHERE batch_id = $1 ORDER BY position', [id]);
      return {
        id: b.id,
        uploadedBy: b.uploaded_by,
        uploadedAt: b.uploaded_at,
        filename: b.filename,
        editionId: b.edition_id,
        status: b.status,
        records: registros.map(registroDesdeFila),
      };
    },
    setOutcome: (batchId, position, outcome, activityId = null) =>
      db.run('UPDATE import_records SET outcome = $1, activity_id = $2 WHERE batch_id = $3 AND position = $4', [
        outcome,
        activityId,
        batchId,
        position,
      ]),
    markAccepted: (id) => db.run("UPDATE import_batches SET status = 'accepted' WHERE id = $1", [id]),
  };
}
