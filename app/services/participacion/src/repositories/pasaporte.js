// Datos del Pasaporte (spec 006): QR por función, contenido versionado del sello, imágenes y sellos.
// `db` puede ser la base o una transacción. Los ids de función y persona son de programación e identidad.

export function pasaporteRepo(db) {
  return {
    // ---------- QR ----------
    qrVigente: async (functionId) =>
      (await db.query("SELECT * FROM passport_qrs WHERE function_id = $1 AND status <> 'replaced'", [functionId]))[0],
    qrPorHuella: async (refHash) => (await db.query('SELECT * FROM passport_qrs WHERE ref_hash = $1', [refHash]))[0],
    qrsVigentes: (functionIds) =>
      db.query("SELECT * FROM passport_qrs WHERE function_id = ANY($1) AND status <> 'replaced'", [functionIds]),
    insertQr: (q) =>
      db.run(
        `INSERT INTO passport_qrs (id, function_id, ref_hash, status, inactive_cause, window_start, window_end, confirmed_for,
                                   created_at, created_by, updated_at, updated_by)
         VALUES ($1, $2, $3, 'inactive', NULL, $4, $5, $6, $7, $8, $7, $8)`,
        [q.id, q.functionId, q.refHash, q.windowStart ?? null, q.windowEnd ?? null, q.confirmedFor ? JSON.stringify(q.confirmedFor) : null, q.now, q.actor],
      ),
    marcarReemplazado: (id, now, actor) =>
      db.run("UPDATE passport_qrs SET status = 'replaced', updated_at = $2, updated_by = $3 WHERE id = $1 AND status <> 'replaced'", [id, now, actor]),
    guardarVentana: (id, v, now, actor) =>
      db.run('UPDATE passport_qrs SET window_start = $2, window_end = $3, confirmed_for = $4, updated_at = $5, updated_by = $6 WHERE id = $1', [
        id,
        v.start,
        v.end,
        JSON.stringify(v.confirmedFor),
        now,
        actor,
      ]),
    activar: (id, now, actor) =>
      db.run("UPDATE passport_qrs SET status = 'active', inactive_cause = NULL, updated_at = $2, updated_by = $3 WHERE id = $1 AND status <> 'replaced'", [
        id,
        now,
        actor,
      ]),
    /** Desactiva solo si estaba activo; devuelve las filas afectadas (0 si otra solicitud ya lo hizo). */
    desactivar: (id, causa, now, actor) =>
      db.run("UPDATE passport_qrs SET status = 'inactive', inactive_cause = $2, updated_at = $3, updated_by = $4 WHERE id = $1 AND status = 'active'", [
        id,
        causa,
        now,
        actor,
      ]),

    // ---------- Contenido e imágenes ----------
    contenidoActual: async (functionId) =>
      (await db.query('SELECT * FROM stamp_contents WHERE function_id = $1 ORDER BY version DESC LIMIT 1', [functionId]))[0],
    contenidos: (ids) => db.query('SELECT * FROM stamp_contents WHERE id = ANY($1)', [ids]),
    insertContenido: (c) =>
      db.run(
        `INSERT INTO stamp_contents (id, function_id, version, text, image_id, created_at, created_by)
         VALUES ($1, $2, (SELECT COALESCE(MAX(version), 0) + 1 FROM stamp_contents WHERE function_id = $2), $3, $4, $5, $6)`,
        [c.id, c.functionId, c.text, c.imageId, c.now, c.actor],
      ),
    insertImagen: (i) =>
      db.run('INSERT INTO stamp_images (id, mime, bytes, alt, credit, sha256, created_at, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [
        i.id,
        i.mime,
        i.bytes,
        i.alt,
        i.credit,
        i.sha256,
        i.now,
        i.actor,
      ]),
    imagenesMeta: (ids) => db.query('SELECT id, mime, alt, credit FROM stamp_images WHERE id = ANY($1)', [ids]),
    imagenBytes: async (id) => (await db.query('SELECT mime, bytes FROM stamp_images WHERE id = $1', [id]))[0],

    // ---------- Sellos ----------
    /** Emite el sello si no existe (restricción única): devuelve la fila nueva o undefined si ya había uno. */
    insertSello: async (s) =>
      (
        await db.query(
          `INSERT INTO stamps (id, user_id, function_id, qr_id, content_id, obtained_at) VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id, function_id) DO NOTHING RETURNING *`,
          [s.id, s.userId, s.functionId, s.qrId, s.contentId, s.now],
        )
      )[0],
    selloDe: async (userId, functionId) => (await db.query('SELECT * FROM stamps WHERE user_id = $1 AND function_id = $2', [userId, functionId]))[0],
    sello: async (id) => (await db.query('SELECT * FROM stamps WHERE id = $1', [id]))[0],
    sellosDe: (userId) => db.query('SELECT * FROM stamps WHERE user_id = $1 ORDER BY obtained_at DESC, id', [userId]),
    async conteos(functionIds) {
      const filas = await db.query('SELECT function_id, COUNT(*)::int AS n FROM stamps WHERE function_id = ANY($1) GROUP BY function_id', [functionIds]);
      return new Map(filas.map((f) => [f.function_id, f.n]));
    },
  };
}
