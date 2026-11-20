// Enlaces de un solo uso. Solo se guarda el hash; `consume` es atómico: un token sirve una única vez,
// aunque lleguen dos solicitudes a la vez (una sola sentencia UPDATE ... RETURNING).
export function tokensRepo(db) {
  return {
    create: ({ hash, userId, purpose, expiresAt, now }) =>
      db.run(
        'INSERT INTO email_tokens (token_hash, user_id, purpose, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)',
        [hash, userId, purpose, expiresAt, now],
      ),
    find: async (hash) => (await db.query('SELECT * FROM email_tokens WHERE token_hash = $1', [hash]))[0],
    /** Devuelve la fila del token si se pudo consumir ahora; si ya se usó, venció o no existe, devuelve undefined. */
    consume: async (hash, purpose, now) =>
      (
        await db.query(
          `UPDATE email_tokens SET used_at = $1
           WHERE token_hash = $2 AND purpose = $3 AND used_at IS NULL AND expires_at > $1
           RETURNING *`,
          [now, hash, purpose],
        )
      )[0],
    invalidateFor: (userId, purpose, now) =>
      db.run('UPDATE email_tokens SET used_at = $1 WHERE user_id = $2 AND purpose = $3 AND used_at IS NULL', [now, userId, purpose]),
  };
}
