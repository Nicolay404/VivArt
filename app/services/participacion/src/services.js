import { openDb } from './db.js';
import { createIdentidadClient } from './clients/identidad.js';
import { createProgramacionClient } from './clients/programacion.js';
import { createPermisos } from './domain/permisos.js';
import { createCodes } from './domain/codes.js';
import { createCart } from './domain/cart.js';
import { createOrders } from './domain/orders.js';
import { createTickets } from './domain/tickets.js';
import { createAccess } from './domain/access.js';
import { createAdmin } from './domain/admin.js';
import { createPasaporte, createRefs } from './domain/pasaporte.js';
import { createPasaporteAdmin } from './domain/pasaporte-admin.js';
import { createRoutesService } from './domain/routes-service.js';

/** Ensambla la lógica del servicio. Identidad y programación se pueden sustituir en las pruebas. */
export async function createServices({ config, db, identidad, programacion }) {
  const codes = createCodes(config.ticketKey);
  db ??= await openDb({ url: config.databaseUrl, schema: config.dbSchema, max: config.dbPoolMax, idleTimeoutMillis: config.dbPoolIdleMs });
  identidad ??= createIdentidadClient({ url: config.identidadUrl, serviceKey: config.identidadServiceKey, timeoutMs: config.timeoutMs });
  programacion ??= createProgramacionClient({ url: config.programacionUrl, serviceKey: config.identidadServiceKey, timeoutMs: config.timeoutMs });
  const clock = config.clock;
  const permisos = createPermisos(identidad);

  const cart = createCart({ db, programacion, clock });
  const orders = createOrders({ db, cart, programacion, codes, clock, simulador: config.paymentSimulator });
  const tickets = createTickets({ db, programacion, codes });
  const access = createAccess({ db, programacion, permisos, clock });
  const admin = createAdmin({ db, programacion, permisos, clock });
  // Pasaporte (spec 006): el ref del QR se deriva de TICKET_KEY con otra etiqueta, sin secretos nuevos.
  const refs = createRefs(config.ticketKey);
  // Rutas e insignias (spec 007)
  const routes = createRoutesService({ db, programacion, permisos, clock });
  const pasaporte = createPasaporte({ db, programacion, clock, routes });
  const pasaporteAdmin = createPasaporteAdmin({ db, programacion, permisos, refs, clock, publicBaseUrl: config.publicBaseUrl });

  return { db, identidad, programacion, permisos, codes, cart, orders, tickets, access, admin, refs, pasaporte, pasaporteAdmin, routes, clock };
}
