// Funciones y franjas publicadas (las que consulta el público) y avisos públicos.

export const funcionDesdeFila = (f) =>
  f && {
    id: f.id,
    activityId: f.activity_id,
    date: f.date,
    startTime: f.start_time,
    endTime: f.end_time,
    durationMinutes: f.duration_minutes,
    venueId: f.venue_id,
    status: f.status,
  };

export const franjaDesdeFila = (f) =>
  f && {
    id: f.id,
    activityId: f.activity_id,
    venueId: f.venue_id,
    dates: f.dates,
    from: f.from_date,
    to: f.to_date,
    weekdays: f.weekdays,
    opens: f.opens,
    closes: f.closes,
  };

export const avisoDesdeFila = (f) =>
  f && {
    id: Number(f.id),
    activityId: f.activity_id,
    functionId: f.function_id,
    kind: f.kind,
    text: f.public_text,
    reason: f.internal_reason,
    actorId: f.actor_id,
    at: f.at,
  };

const json = (v) => (v === null || v === undefined ? null : JSON.stringify(v));

export function publishedRepo(db) {
  return {
    async functionsOf(activityId) {
      return (await db.query('SELECT * FROM functions WHERE activity_id = $1 ORDER BY date, start_time', [activityId])).map(funcionDesdeFila);
    },
    async slotsOf(activityId) {
      return (await db.query('SELECT * FROM opening_slots WHERE activity_id = $1 ORDER BY id', [activityId])).map(franjaDesdeFila);
    },
    async findFunction(id) {
      return funcionDesdeFila((await db.query('SELECT * FROM functions WHERE id = $1', [id]))[0]);
    },
    async noticesOf(activityId) {
      return (await db.query('SELECT * FROM notices WHERE activity_id = $1 ORDER BY id DESC', [activityId])).map(avisoDesdeFila);
    },
    upsertFunction: (f, now) =>
      db.run(
        `INSERT INTO functions (id, activity_id, date, start_time, end_time, duration_minutes, venue_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $8)
         ON CONFLICT (id) DO UPDATE SET date = EXCLUDED.date, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time,
           duration_minutes = EXCLUDED.duration_minutes, venue_id = EXCLUDED.venue_id, updated_at = EXCLUDED.updated_at
         WHERE functions.activity_id = EXCLUDED.activity_id AND functions.status = 'scheduled'`,
        [f.id, f.activityId, f.date, f.startTime, f.endTime, f.durationMinutes, f.venueId, now],
      ),
    cancelFunction: (id, now) =>
      db.run("UPDATE functions SET status = 'cancelled', updated_at = $1 WHERE id = $2 AND status = 'scheduled'", [now, id]),
    rescheduleFunction: (id, { date, startTime, endTime, venueId }, now) =>
      db.run(
        `UPDATE functions SET date = $1, start_time = $2, end_time = $3, venue_id = $4, updated_at = $5
         WHERE id = $6 AND status = 'scheduled'`,
        [date, startTime, endTime, venueId, now, id],
      ),
    /** Reemplaza las franjas publicadas de la actividad por las del contenido aprobado. */
    async replaceSlots(activityId, franjas, now) {
      await db.run('DELETE FROM opening_slots WHERE activity_id = $1', [activityId]);
      for (const s of franjas) {
        await db.run(
          `INSERT INTO opening_slots (id, activity_id, venue_id, dates, from_date, to_date, weekdays, opens, closes, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
          [s.id, activityId, s.venueId, json(s.dates), s.from, s.to, json(s.weekdays), s.opens, s.closes, now],
        );
      }
    },
    addNotice: (n) =>
      db.run(
        `INSERT INTO notices (activity_id, function_id, kind, public_text, internal_reason, actor_id, at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [n.activityId, n.functionId ?? null, n.kind, n.text, n.reason, n.actorId, n.at],
      ),
  };
}
