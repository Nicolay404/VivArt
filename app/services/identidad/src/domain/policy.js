// Política de permisos del servicio de identidad (FR-009 a FR-017).
// Una persona tiene permisos como SUMA de sus roles activos; si ningún rol concede la acción, se rechaza.
// «Visitante» es quien no tiene sesión y «usuario registrado» es implícito para toda cuenta activa.

export const INTERNAL_ROLES = ['editor', 'publicador', 'administrador', 'personal_acceso'];
export const ALL_ROLES = ['usuario_registrado', ...INTERNAL_ROLES];

const ACCIONES = {
  'roles.manage': { roles: ['administrador'] },
  'audit.view': { roles: ['administrador'] },
  'draft.edit_own': { roles: ['editor'], needsOwner: true },
  'draft.submit': { roles: ['editor'] },
  'draft.edit_any': { roles: ['publicador', 'administrador'] },
  'draft.review': { roles: ['publicador', 'administrador'] },
  publish: { roles: ['publicador', 'administrador'] },
  'draft.reassign': { roles: ['administrador'] },
  'event.create_publish': { roles: ['administrador'] },
  'catalog.load': { roles: ['administrador'] },
  // Spec 002: reprogramar o cancelar funciones con aviso, gestionar catálogos y archivar actividades.
  'schedule.change': { roles: ['publicador', 'administrador'] },
  'catalog.manage': { roles: ['administrador'] },
  'activity.archive': { roles: ['administrador'] },
  // Spec 005: cancelar una función con entradas vendidas es solo del administrador (FR-030).
  'schedule.cancel_with_sales': { roles: ['administrador'] },
  // Publicar no concede activar ventas: solo el administrador (RF-04, RF-22).
  'sales.configure': { roles: ['administrador'] },
  'access.validate': { roles: ['personal_acceso'], needsFunction: true },
  'panel.access': { roles: INTERNAL_ROLES },
};

export const ACTION_NAMES = Object.keys(ACCIONES);

/**
 * @param persona {{ userId: string, roles: string[], functionIds: string[] } | null}
 * @param action nombre de la acción
 * @param context {{ ownerId?: string, functionId?: string }}
 * No devuelve nunca datos del contenido protegido: solo el motivo y el rol que falta.
 */
export function authorize(persona, action, context = {}) {
  const regla = ACCIONES[action];
  if (!regla) return { allowed: false, reason: 'unknown_action', acceptedRoles: [] };
  if (!persona) return { allowed: false, reason: 'no_session', acceptedRoles: regla.roles };

  const concedidos = regla.roles.filter((r) => persona.roles.includes(r));
  if (concedidos.length === 0) {
    return { allowed: false, reason: 'missing_role', missingRole: regla.roles[0], acceptedRoles: regla.roles };
  }
  if (regla.needsOwner && (!context.ownerId || context.ownerId !== persona.userId)) {
    // Editar borradores ajenos corresponde a publicador o administrador.
    return { allowed: false, reason: 'not_owner', missingRole: 'publicador', acceptedRoles: ['publicador', 'administrador'] };
  }
  if (regla.needsFunction && !persona.functionIds.includes(context.functionId)) {
    return { allowed: false, reason: 'function_not_assigned', missingRole: 'personal_acceso', acceptedRoles: ['personal_acceso'] };
  }
  return { allowed: true, grantedBy: concedidos };
}
