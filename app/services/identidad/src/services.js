import { openDb } from './db.js';
import { usersRepo } from './repositories/users.js';
import { rolesRepo } from './repositories/roles.js';
import { sessionsRepo } from './repositories/sessions.js';
import { tokensRepo } from './repositories/tokens.js';
import { pendingRepo } from './repositories/pending.js';
import { auditRepo } from './repositories/audit.js';
import { createMailer } from './mail/index.js';
import { createAccounts } from './domain/accounts.js';
import { createRoles } from './domain/roles.js';
import { createPending } from './domain/pending.js';
import { iso } from './domain/tokens.js';

/** Ensambla repositorios y lógica de dominio. Lo comparten la aplicación HTTP y el script interno. */
export async function createServices({ config, db, mailer = createMailer(config) }) {
  db ??= await openDb({ url: config.databaseUrl, schema: config.dbSchema });
  const clock = config.clock;
  const repos = {
    users: usersRepo(db),
    roles: rolesRepo(db),
    sessions: sessionsRepo(db),
    tokens: tokensRepo(db),
    pending: pendingRepo(db),
    audit: auditRepo(db),
  };
  const audit = (actorId, action, targetType, targetId, details) =>
    repos.audit.add({ at: iso(clock()), actorId, action, targetType, targetId, details });

  return {
    db,
    repos,
    mailer,
    audit,
    clock,
    accounts: createAccounts({ repos, config, mailer, audit, clock }),
    roles: createRoles({ repos, audit, clock }),
    pending: createPending({ repos, config, clock }),
  };
}
