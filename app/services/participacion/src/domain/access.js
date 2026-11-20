import { historyRepo } from '../repositories/sales.js';
import { clasificar, huella } from './codes.js';

// Control de acceso en la sede (FR-023 a FR-028). Solo el personal con la función asignada abre, cierra y valida.
// La admisión es atómica: dos validaciones simultáneas de la misma entrada admiten exactamente una (FR-028).

const MENSAJES = {
  admitted: 'Entrada admitida.',
  wrong_code_type: 'Tipo de código incorrecto: no es una entrada de VIVART.',
  not_found: 'Código no encontrado.',
  already_used: 'Entrada ya usada.',
  wrong_function: 'Función incorrecta: esta entrada es de otra función.',
  function_cancelled: 'Función cancelada.',
  not_valid: 'Entrada no confirmada o invalidada.',
  access_closed: 'Control de acceso cerrado.',
  not_verifiable: 'No se pudo verificar la función: la entrada no queda admitida.',
};

const rechazo = (reason, extra = {}) => ({ admitted: false, reason, message: MENSAJES[reason], ...extra });

export function createAccess({ db, programacion, permisos, clock }) {
  const permitir = (sesion, functionId) => permisos.permitir(sesion, 'access.validate', { functionId });

  async function cambiar(sesion, functionId, abierto) {
    await permitir(sesion, functionId);
    const momento = clock().toISOString();
    await db.transaction(null, async (tx) => {
      await tx.run(
        `INSERT INTO access_controls (function_id, open, changed_at, changed_by) VALUES ($1, $2, $3, $4)
         ON CONFLICT (function_id) DO UPDATE SET open = EXCLUDED.open, changed_at = EXCLUDED.changed_at, changed_by = EXCLUDED.changed_by`,
        [functionId, abierto, momento, sesion.userId],
      );
      await historyRepo(tx).add({
        at: momento,
        actorId: sesion.userId,
        action: abierto ? 'access.opened' : 'access.closed',
        entityType: 'function',
        entityId: functionId,
      });
    });
    return { functionId, open: abierto };
  }

  return {
    /** Funciones asignadas a la persona de acceso; vacío si no tiene ninguna. */
    async asignadas(sesion) {
      const ids = sesion.functionIds;
      if (ids.length === 0) return { items: [] };
      const controles = new Map(
        (await db.query('SELECT function_id, open FROM access_controls WHERE function_id = ANY($1)', [ids])).map((c) => [c.function_id, c.open]),
      );
      let funciones = new Map();
      let verificable = true;
      try {
        funciones = await programacion.functions(ids);
      } catch {
        verificable = false;
      }
      return {
        verified: verificable,
        items: ids.map((id) => {
          const f = funciones.get(id);
          return {
            functionId: id,
            title: f?.title ?? null,
            date: f?.date ?? null,
            startTime: f?.startTime ?? null,
            venueName: f?.venueName ?? null,
            cancelled: f ? f.status === 'cancelled' : null,
            open: controles.get(id) === true,
          };
        }),
      };
    },

    abrir: (sesion, functionId) => cambiar(sesion, functionId, true),
    cerrar: (sesion, functionId) => cambiar(sesion, functionId, false),

    async validar(sesion, functionId, codigo) {
      await permitir(sesion, functionId);
      const [control] = await db.query('SELECT open FROM access_controls WHERE function_id = $1', [functionId]);
      if (!control?.open) return rechazo('access_closed');

      const leido = clasificar(codigo);
      if (leido.tipo === 'otro') return rechazo('wrong_code_type');
      const columna = leido.tipo === 'qr' ? 'secret_hash' : 'code_hash';
      const valor = huella(leido.tipo === 'qr' ? leido.secreto : leido.codigo);
      const [t] = await db.query(`SELECT * FROM tickets WHERE ${columna} = $1`, [valor]);
      if (!t) return rechazo('not_found');
      const [item] = await db.query('SELECT function_title FROM order_items WHERE order_id = $1 AND function_id = $2', [t.order_id, t.function_id]);
      const datos = { ticket: { functionTitle: item?.function_title ?? null, usedAt: t.used_at } };
      if (t.function_id !== functionId) return rechazo('wrong_function', datos);

      let f;
      try {
        f = await programacion.function(functionId);
      } catch {
        return rechazo('not_verifiable', datos);
      }
      if (!f || f.status === 'cancelled' || f.activityStatus === 'archived') return rechazo('function_cancelled', datos);
      if (t.status !== 'valid') return rechazo('not_valid', datos);
      if (t.used_at) return rechazo('already_used', datos);

      const momento = clock().toISOString();
      const resultado = await db.transaction(null, async (tx) => {
        const filas = await tx.query(
          `UPDATE tickets SET used_at = $2, used_by = $3 WHERE id = $1 AND status = 'valid' AND used_at IS NULL RETURNING used_at`,
          [t.id, momento, sesion.userId],
        );
        if (filas.length === 0) return null;
        await historyRepo(tx).add({ at: momento, actorId: sesion.userId, action: 'ticket.used', entityType: 'ticket', entityId: t.id, details: { functionId } });
        return filas[0];
      });
      if (!resultado) {
        // Otra validación ganó la carrera o la entrada se invalidó entre la lectura y la escritura.
        const [actual] = await db.query('SELECT status, used_at FROM tickets WHERE id = $1', [t.id]);
        return rechazo(actual?.status !== 'valid' ? 'not_valid' : 'already_used', { ticket: { ...datos.ticket, usedAt: actual?.used_at ?? null } });
      }
      return { admitted: true, reason: null, message: MENSAJES.admitted, ticket: { ...datos.ticket, usedAt: resultado.used_at } };
    },
  };
}
