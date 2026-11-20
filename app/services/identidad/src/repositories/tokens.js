// Enlaces de un solo uso. Solo se guarda el hash; `consume` es atómico: un token sirve una única vez.
export function tokensRepo(db) {
  const crear = db.prepare(
    'INSERT INTO email_tokens (token_hash, user_id, purpose, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  const buscar = db.prepare('SELECT * FROM email_tokens WHERE token_hash = ?');
  const consumir = db.prepare(
    `UPDATE email_tokens SET used_at = ?
     WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?`,
  );
  const invalidar = db.prepare(
    'UPDATE email_tokens SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL',
  );

  return {
    create: ({ hash, userId, purpose, expiresAt, now }) => crear.run(hash, userId, purpose, expiresAt, now),
    find: (hash) => buscar.get(hash),
    /** Devuelve la fila del token si se pudo consumir ahora; si ya se usó, venció o no existe, devuelve undefined. */
    consume(hash, purpose, now) {
      const { changes } = consumir.run(now, hash, purpose, now);
      return Number(changes) > 0 ? buscar.get(hash) : undefined;
    },
    invalidateFor: (userId, purpose, now) => Number(invalidar.run(now, userId, purpose).changes),
  };
}
