import { routesRepo } from '../repositories/routes.js';
import { pasaporteRepo } from '../repositories/pasaporte.js';
import { historyRepo } from '../repositories/sales.js';
import {
  validarDatosRuta,
  calcularRutaEnRevision,
  formatearProgreso,
  nuevoId,
} from './routes.js';
import { presentarInsignia, presentarInsigniaDesbloqueada } from './badges.js';
import { notFound, AppError, badRequest } from '../http/errors.js';

export function createRoutesService({ db, programacion, permisos, clock }) {
  const repo = routesRepo(db);
  const pRepo = pasaporteRepo(db);
  const ahora = () => clock().toISOString();
  const permitir = (sesion) => permisos.permitir(sesion, 'panel.routes');

  const auditar = (tx, sesion, action, routeId, details) =>
    historyRepo(tx).add({
      at: ahora(),
      actorId: sesion.userId,
      action,
      entityType: 'route',
      entityId: routeId,
      details: JSON.stringify(details),
    });

  /**
   * Verifica que las funciones sean elegibles (FR-002, SC-006):
   * 1. Deben existir en programación, estar publicadas y no ser franjas (deben tener date y startTime).
   * 2. Deben tener Pasaporte habilitado (un QR vigente en passport_qrs).
   */
  async function validarFuncionesElegibles(functionIds) {
    if (!Array.isArray(functionIds) || functionIds.length === 0) {
      throw new AppError(422, 'validation', 'La ruta debe tener al menos una función elegible.', {
        fields: { functionIds: 'Selecciona al menos una función.' },
      });
    }
    const unicos = [...new Set(functionIds)].filter(Boolean);
    const mapaProg = await programacion.functions(unicos);
    const qrsVigentes = await pRepo.qrsVigentes(unicos);
    const setQrs = new Set(qrsVigentes.map((q) => q.function_id));

    for (const fid of unicos) {
      const f = mapaProg.get(fid);
      if (!f || !f.date || !f.startTime) {
        throw new AppError(422, 'ineligible_function', `La función ${fid} no existe, no está publicada o es una franja.`);
      }
      if (!setQrs.has(fid)) {
        throw new AppError(422, 'ineligible_function', `La función «${f.title}» (${fid}) no tiene el Pasaporte habilitado.`);
      }
    }
    return unicos;
  }

  return {
    // ==========================================
    // ADMINISTRACIÓN (User Story 4, P2)
    // ==========================================
    async listarAdmin(sesion) {
      await permitir(sesion);
      const rutas = await repo.rutasAdmin();
      const ids = rutas.map((r) => r.id);
      const funcionesMap = await repo.funcionesDeRutas(ids);
      const todosFids = [...new Set([...funcionesMap.values()].flat())];
      const mapaProg = await programacion.functions(todosFids);

      return {
        items: rutas.map((r) => {
          const fids = funcionesMap.get(r.id) ?? [];
          const funcs = fids.map((fid) => mapaProg.get(fid)).filter(Boolean);
          const inReview = calcularRutaEnRevision(funcs, r.goal);
          return {
            id: r.id,
            title: r.title,
            goal: r.goal,
            functionsCount: fids.length,
            status: r.status,
            inReview,
            badgeTitle: r.badge_title,
            badgeIcon: r.badge_icon,
            badgeColor: r.badge_color,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          };
        }),
      };
    },

    async verAdmin(sesion, id) {
      await permitir(sesion);
      const r = await repo.ruta(id);
      if (!r) throw notFound('No encontramos esta ruta.');
      const functionIds = await repo.funcionesDeRuta(id);
      const mapaProg = await programacion.functions(functionIds);
      const funcs = functionIds.map((fid) => mapaProg.get(fid)).filter(Boolean);
      const inReview = calcularRutaEnRevision(funcs, r.goal);

      return {
        id: r.id,
        title: r.title,
        description: r.description,
        goal: r.goal,
        status: r.status,
        badgeTitle: r.badge_title,
        badgeDescription: r.badge_description,
        badgeIcon: r.badge_icon,
        badgeColor: r.badge_color,
        functionIds,
        inReview,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    },

    async crear(sesion, datos) {
      await permitir(sesion);
      const functionIds = await validarFuncionesElegibles(datos.functionIds);
      const validados = validarDatosRuta(datos, functionIds.length);
      const id = nuevoId('route');
      const now = ahora();
      const status = datos.publish === true || datos.status === 'published' ? 'published' : 'draft';

      await db.transaction(`routes:${id}`, async (tx) => {
        const txRepo = routesRepo(tx);
        await txRepo.insertRuta({
          id,
          title: validados.title,
          description: validados.description,
          badgeTitle: validados.badgeTitle,
          badgeDescription: validados.badgeDescription,
          badgeIcon: validados.badgeIcon,
          badgeColor: validados.badgeColor,
          goal: validados.goal,
          status,
          now,
          actor: sesion.userId,
        });
        await txRepo.reemplazarFunciones(id, functionIds, now, sesion.userId);
        await auditar(tx, sesion, 'route.created', id, {
          title: validados.title,
          goal: validados.goal,
          functionsCount: functionIds.length,
          status,
          badgeTitle: validados.badgeTitle,
        });
      });

      return this.verAdmin(sesion, id);
    },

    async editar(sesion, id, datos) {
      await permitir(sesion);
      const r = await repo.ruta(id);
      if (!r) throw notFound('No encontramos esta ruta.');

      let functionIds = datos.functionIds;
      if (functionIds !== undefined) {
        functionIds = await validarFuncionesElegibles(functionIds);
      } else {
        functionIds = await repo.funcionesDeRuta(id);
      }

      const validados = validarDatosRuta(
        {
          title: datos.title ?? r.title,
          description: datos.description ?? r.description,
          badgeTitle: datos.badgeTitle ?? r.badge_title,
          badgeDescription: datos.badgeDescription ?? r.badge_description,
          badgeIcon: datos.badgeIcon ?? r.badge_icon,
          badgeColor: datos.badgeColor ?? r.badge_color,
          goal: datos.goal ?? r.goal,
        },
        functionIds.length,
      );

      const status = datos.status ?? r.status;
      if (!['draft', 'published'].includes(status)) {
        throw badRequest('El estado debe ser draft o published.');
      }

      const now = ahora();
      await db.transaction(`routes:${id}`, async (tx) => {
        const txRepo = routesRepo(tx);
        await txRepo.updateRuta(id, {
          ...validados,
          status,
          now,
          actor: sesion.userId,
        });
        if (datos.functionIds !== undefined) {
          await txRepo.reemplazarFunciones(id, functionIds, now, sesion.userId);
        }
        await auditar(tx, sesion, 'route.updated', id, {
          title: validados.title,
          goal: validados.goal,
          functionsCount: functionIds.length,
          status,
        });
      });

      return this.verAdmin(sesion, id);
    },

    // ==========================================
    // CONSULTA PÚBLICA Y PROGRESO (US1 & US2)
    // ==========================================
    async listarPublicas(sesionOpcional) {
      const rutas = await repo.rutasPublicadas();
      const ids = rutas.map((r) => r.id);
      const funcionesMap = await repo.funcionesDeRutas(ids);
      const todosFids = [...new Set([...funcionesMap.values()].flat())];
      const mapaProg = await programacion.functions(todosFids);

      let sellosMap = new Map();
      let insigniasMap = new Map();
      if (sesionOpcional?.userId) {
        sellosMap = await repo.sellosDistintosDeUsuarioEnRutas(sesionOpcional.userId, ids);
        insigniasMap = await repo.insigniasDeUsuarioEnRutas(sesionOpcional.userId, ids);
      }

      return {
        items: rutas.map((r) => {
          const fids = funcionesMap.get(r.id) ?? [];
          const funcs = fids.map((fid) => mapaProg.get(fid)).filter(Boolean);
          const inReview = calcularRutaEnRevision(funcs, r.goal);

          let progress = null;
          if (sesionOpcional?.userId) {
            const sellos = sellosMap.get(r.id) ?? new Set();
            const prog = formatearProgreso(sellos.size, r.goal);
            const insignia = insigniasMap.get(r.id);
            progress = {
              ...prog,
              unlockedBadge: Boolean(insignia),
              unlockedAt: insignia?.unlocked_at ?? null,
            };
          }

          return {
            id: r.id,
            title: r.title,
            description: r.description,
            goal: r.goal,
            badge: {
              title: r.badge_title,
              description: r.badge_description,
              icon: r.badge_icon,
              color: r.badge_color,
            },
            inReview,
            progress,
          };
        }),
      };
    },

    async verPublica(sesionOpcional, id) {
      const r = await repo.ruta(id);
      if (!r || r.status !== 'published') {
        throw notFound('No encontramos esta ruta.');
      }
      const functionIds = await repo.funcionesDeRuta(id);
      const mapaProg = await programacion.functions(functionIds);

      let sellosSet = new Set();
      let insignia = null;
      if (sesionOpcional?.userId) {
        const sArr = await repo.sellosDistintosDeUsuarioEnRuta(sesionOpcional.userId, id);
        sellosSet = new Set(sArr);
        insignia = await repo.insigniaDeUsuario(sesionOpcional.userId, id);
      }

      const functions = functionIds.map((fid) => {
        const f = mapaProg.get(fid);
        return {
          functionId: fid,
          title: f?.title ?? 'Función sin confirmar',
          date: f?.date ?? null,
          startTime: f?.startTime ?? null,
          venueName: f?.venueName ?? null,
          status: f?.status === 'cancelled' ? 'cancelled' : 'active',
          hasStamp: sesionOpcional?.userId ? sellosSet.has(fid) : null,
        };
      });

      const inReview = calcularRutaEnRevision(functions, r.goal);

      let progress = null;
      if (sesionOpcional?.userId) {
        const prog = formatearProgreso(sellosSet.size, r.goal);
        progress = {
          ...prog,
          unlockedBadge: Boolean(insignia),
          unlockedAt: insignia?.unlocked_at ?? null,
        };
      }

      return {
        id: r.id,
        title: r.title,
        description: r.description,
        goal: r.goal,
        badge: {
          title: r.badge_title,
          description: r.badge_description,
          icon: r.badge_icon,
          color: r.badge_color,
        },
        inReview,
        progress,
        functions,
      };
    },

    // ==========================================
    // INSIGNIAS (User Story 3)
    // ==========================================
    async misInsignias(sesion) {
      if (!sesion?.userId) throw notFound('Inicia sesión para ver tus insignias.');
      const insignias = await repo.insigniasDeUsuario(sesion.userId);
      return {
        items: insignias.map((i) => presentarInsignia(i)),
      };
    },

    /**
     * Evalúa y otorga de forma atómica e idempotente si un nuevo sello desbloquea alguna insignia (FR-017, FR-018).
     * Se llama dentro de la transacción de canje de sellos.
     */
    async evaluarDesbloqueoEnCanje(tx, userId, functionId) {
      const txRepo = routesRepo(tx);
      const rutasPublicadas = await txRepo.rutasConFuncionPublicadas(functionId);
      if (rutasPublicadas.length === 0) return null;

      const now = ahora();
      let primeraInsigniaDesbloqueada = null;

      for (const r of rutasPublicadas) {
        // Verificar si ya tiene la insignia
        const existente = await txRepo.insigniaDeUsuario(userId, r.id);
        if (existente) continue;

        // Contar sellos distintos de funciones elegibles
        const sellos = await txRepo.sellosDistintosDeUsuarioEnRuta(userId, r.id);
        if (sellos.length >= r.goal) {
          const ubadgeId = nuevoId('ubadge');
          const insertada = await txRepo.insertInsignia({
            id: ubadgeId,
            userId,
            routeId: r.id,
            now,
            stampCount: sellos.length,
          });
          if (insertada) {
            await historyRepo(tx).add({
              at: now,
              actorId: userId,
              action: 'badge.unlocked',
              entityType: 'badge',
              entityId: ubadgeId,
              details: JSON.stringify({
                userId,
                routeId: r.id,
                routeTitle: r.title,
                badgeTitle: r.badge_title,
                stampCount: sellos.length,
              }),
            });
            if (!primeraInsigniaDesbloqueada) {
              primeraInsigniaDesbloqueada = presentarInsigniaDesbloqueada(insertada, r);
            }
          }
        }
      }

      return primeraInsigniaDesbloqueada;
    },
  };
}
