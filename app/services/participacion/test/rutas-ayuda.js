import { pedir } from './helpers.js';
import { qrActivo } from './pasaporte-ayuda.js';

export const DATOS_RUTA_DEFECTO = {
  title: 'Ruta Escénica de Loja',
  description: 'Un recorrido por las mejores expresiones teatrales y dancísticas del festival.',
  goal: 3,
  badgeTitle: 'Explorador Escénico',
  badgeDescription: 'Completaste 3 funciones de la Ruta Escénica de Loja.',
  badgeIcon: 'teatro',
  badgeColor: 'violeta',
};

/**
 * Prepara N funciones con Pasaporte habilitado (QR generado y activo).
 */
export async function prepararFuncionesConPasaporte(ctx, functionIds = ['f-obra', 'f-danza', 'f-sin-fin']) {
  const refs = new Map();
  for (const fid of functionIds) {
    const { ref } = await qrActivo(ctx, fid);
    refs.set(fid, ref);
  }
  return refs;
}

/**
 * Crea una ruta administrativa vía API del panel.
 */
export async function crearRuta(ctx, quien = 'admin', datos = {}) {
  const cuerpo = {
    ...DATOS_RUTA_DEFECTO,
    ...datos,
  };
  return pedir(ctx, quien, 'POST', '/panel/routes', cuerpo);
}

/**
 * Crea una ruta ya publicada con sus funciones elegibles.
 */
export async function crearRutaPublicada(ctx, functionIds = ['f-obra', 'f-danza', 'f-sin-fin'], goal = 3, extra = {}) {
  const r = await crearRuta(ctx, 'admin', {
    ...DATOS_RUTA_DEFECTO,
    functionIds,
    goal,
    publish: true,
    ...extra,
  });
  if (r.status >= 300) {
    throw new Error(`Error creando ruta publicada: ${r.status} ${r.body}`);
  }
  return r.json;
}
