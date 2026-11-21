import { openDb } from './db.js';
import { catalogsRepo } from './repositories/catalogs.js';
import { activitiesRepo } from './repositories/activities.js';
import { publishedRepo } from './repositories/published.js';
import { historyRepo } from './repositories/history.js';
import { importsRepo } from './repositories/imports.js';
import { sedesRepo } from './repositories/sedes.js';
import { createIdentidadClient } from './clients/identidad.js';
import { createParticipacionClient } from './clients/participacion.js';
import { createPermisos } from './domain/permisos.js';
import { createCatalogs } from './domain/catalogs.js';
import { createAgenda } from './domain/agenda.js';
import { createEditorial } from './domain/editorial.js';
import { createChanges } from './domain/changes.js';
import { createImports } from './domain/imports.js';
import { createMapa } from './domain/mapa.js';
import { createSedes } from './domain/sedes.js';

/** Repositorios sobre una conexión (la base o una transacción). */
export const crearRepos = (db) => ({
  catalogs: catalogsRepo(db),
  activities: activitiesRepo(db),
  published: publishedRepo(db),
  history: historyRepo(db),
  imports: importsRepo(db),
  sedes: sedesRepo(db),
});

/** Ensambla la lógica del servicio. Lo comparten la aplicación HTTP y los scripts. */
export async function createServices({ config, db, identidad, participacion }) {
  db ??= await openDb({ url: config.databaseUrl, schema: config.dbSchema, max: config.dbPoolMax, idleTimeoutMillis: config.dbPoolIdleMs });
  identidad ??= createIdentidadClient({ url: config.identidadUrl, serviceKey: config.identidadServiceKey, timeoutMs: config.timeoutMs });
  participacion ??= createParticipacionClient({ url: config.participacionUrl, serviceKey: config.identidadServiceKey, timeoutMs: config.timeoutMs });
  const clock = config.clock;
  const repos = crearRepos(db);
  const permisos = createPermisos(identidad);
  const auditar = (actorId, action, entityType, entityId, details) =>
    repos.history.add({ at: clock().toISOString(), actorId, action, entityType, entityId, details });

  const catalogs = createCatalogs({ repos, auditar, clock });
  const agenda = createAgenda({ db, catalogs, clock, clockFixed: config.clockFixed });
  const editorial = createEditorial({ db, crearRepos, permisos, catalogs, clock });
  const changes = createChanges({ db, crearRepos, permisos, participacion, clock });
  const imports = createImports({ db, crearRepos, permisos, editorial, clock });
  const mapa = createMapa({ repos, clock, clockFixed: config.clockFixed });
  const sedes = createSedes({ repos, permisos, auditar, clock });

  return { db, repos, identidad, permisos, catalogs, agenda, editorial, changes, imports, mapa, sedes, clock };
}
