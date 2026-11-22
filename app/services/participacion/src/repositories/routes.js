// Repositorio de rutas culturales e insignias (spec 007).
// `db` puede ser la conexión principal o una transacción.

export function routesRepo(db) {
  return {
    // ---------- Rutas ----------
    async ruta(id) {
      const filas = await db.query('SELECT * FROM routes WHERE id = $1', [id]);
      return filas[0] ?? null;
    },

    async rutasPublicadas() {
      return db.query("SELECT * FROM routes WHERE status = 'published' ORDER BY created_at DESC");
    },

    async rutasAdmin() {
      return db.query('SELECT * FROM routes ORDER BY updated_at DESC');
    },

    async insertRuta(r) {
      await db.run(
        `INSERT INTO routes (id, title, description, badge_title, badge_description, badge_icon, badge_color,
                             goal, status, created_at, created_by, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          r.id,
          r.title,
          r.description,
          r.badgeTitle,
          r.badgeDescription,
          r.badgeIcon,
          r.badgeColor,
          r.goal,
          r.status ?? 'draft',
          r.now,
          r.actor,
          r.now,
          r.actor,
        ],
      );
    },

    async updateRuta(id, r) {
      await db.run(
        `UPDATE routes
         SET title = $2, description = $3, badge_title = $4, badge_description = $5,
             badge_icon = $6, badge_color = $7, goal = $8, status = $9,
             updated_at = $10, updated_by = $11
         WHERE id = $1`,
        [
          id,
          r.title,
          r.description,
          r.badgeTitle,
          r.badgeDescription,
          r.badgeIcon,
          r.badgeColor,
          r.goal,
          r.status,
          r.now,
          r.actor,
        ],
      );
    },

    // ---------- Funciones elegibles ----------
    async reemplazarFunciones(routeId, functionIds, now, actor) {
      await db.run('DELETE FROM route_functions WHERE route_id = $1', [routeId]);
      const unicos = [...new Set(functionIds)].filter(Boolean);
      for (const fid of unicos) {
        await db.run(
          'INSERT INTO route_functions (route_id, function_id, added_at, added_by) VALUES ($1, $2, $3, $4)',
          [routeId, fid, now, actor],
        );
      }
    },

    async funcionesDeRuta(routeId) {
      const filas = await db.query(
        'SELECT function_id FROM route_functions WHERE route_id = $1 ORDER BY added_at ASC',
        [routeId],
      );
      return filas.map((f) => f.function_id);
    },

    async funcionesDeRutas(routeIds) {
      if (!routeIds || routeIds.length === 0) return new Map();
      const filas = await db.query(
        'SELECT route_id, function_id FROM route_functions WHERE route_id = ANY($1) ORDER BY added_at ASC',
        [routeIds],
      );
      const mapa = new Map();
      for (const r of routeIds) mapa.set(r, []);
      for (const fila of filas) {
        if (!mapa.has(fila.route_id)) mapa.set(fila.route_id, []);
        mapa.get(fila.route_id).push(fila.function_id);
      }
      return mapa;
    },

    async rutasConFuncionPublicadas(functionId) {
      return db.query(
        `SELECT r.* FROM routes r
         JOIN route_functions rf ON r.id = rf.route_id
         WHERE rf.function_id = $1 AND r.status = 'published'`,
        [functionId],
      );
    },

    // ---------- Sellos coincidentes y progreso ----------
    async sellosDistintosDeUsuarioEnRuta(userId, routeId) {
      const filas = await db.query(
        `SELECT DISTINCT s.function_id
         FROM stamps s
         JOIN route_functions rf ON s.function_id = rf.function_id
         WHERE s.user_id = $1 AND rf.route_id = $2`,
        [userId, routeId],
      );
      return filas.map((f) => f.function_id);
    },

    async sellosDistintosDeUsuarioEnRutas(userId, routeIds) {
      if (!routeIds || routeIds.length === 0) return new Map();
      const filas = await db.query(
        `SELECT DISTINCT rf.route_id, s.function_id
         FROM stamps s
         JOIN route_functions rf ON s.function_id = rf.function_id
         WHERE s.user_id = $1 AND rf.route_id = ANY($2)`,
        [userId, routeIds],
      );
      const mapa = new Map();
      for (const id of routeIds) mapa.set(id, new Set());
      for (const fila of filas) {
        if (!mapa.has(fila.route_id)) mapa.set(fila.route_id, new Set());
        mapa.get(fila.route_id).add(fila.function_id);
      }
      return mapa;
    },

    // ---------- Insignias de usuario ----------
    async insigniaDeUsuario(userId, routeId) {
      const filas = await db.query(
        'SELECT * FROM user_badges WHERE user_id = $1 AND route_id = $2',
        [userId, routeId],
      );
      return filas[0] ?? null;
    },

    async insigniasDeUsuario(userId) {
      return db.query(
        `SELECT ub.id, ub.user_id, ub.route_id, ub.unlocked_at, ub.stamp_count_at_unlock,
                r.title AS route_title, r.badge_title, r.badge_description, r.badge_icon, r.badge_color
         FROM user_badges ub
         JOIN routes r ON ub.route_id = r.id
         WHERE ub.user_id = $1
         ORDER BY ub.unlocked_at DESC`,
        [userId],
      );
    },

    async insigniasDeUsuarioEnRutas(userId, routeIds) {
      if (!routeIds || routeIds.length === 0) return new Map();
      const filas = await db.query(
        'SELECT * FROM user_badges WHERE user_id = $1 AND route_id = ANY($2)',
        [userId, routeIds],
      );
      const mapa = new Map();
      for (const fila of filas) mapa.set(fila.route_id, fila);
      return mapa;
    },

    /**
     * Otorga la insignia de forma atómica e idempotente (SC-004, RC-05, RNF-06).
     * Devuelve la fila insertada o null si ya había sido otorgada.
     */
    async insertInsignia(b) {
      const filas = await db.query(
        `INSERT INTO user_badges (id, user_id, route_id, unlocked_at, stamp_count_at_unlock)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, route_id) DO NOTHING
         RETURNING *`,
        [b.id, b.userId, b.routeId, b.now, b.stampCount],
      );
      return filas[0] ?? null;
    },
  };
}
