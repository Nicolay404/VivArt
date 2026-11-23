// Carga de un lote de programación en la DEMO (lo usa bin/cargar-programacion.js al arrancar `docker compose`).
// Es IDEMPOTENTE: si todas las claves del lote ya existen no hace nada, y nunca sobrescribe correcciones del panel.
// La primera vez deja activa la edición del lote y desactiva las demás (no se borran: se reactivan desde el panel).
// Las sedes solo reciben la dirección que trae la fuente; destino, accesibilidad y marcador quedan por confirmar (RNF-08).
import { normalizar } from './text.js';

/** Quita los nombres repetidos (los que solo cambian en mayúsculas o tildes son el mismo) y los que ya existen. */
function nuevosPorNombre(cuerpos, existentes) {
  const vistos = new Set(existentes.map((x) => normalizar(x.name)));
  return cuerpos.filter((c) => {
    const clave = normalizar(c.name);
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

async function crearFaltantes(servicios, actor, tabla, cuerpos) {
  const nuevos = nuevosPorNombre(cuerpos, await servicios.catalogs.list(tabla));
  await Promise.all(nuevos.map((c) => servicios.catalogs.create(actor, tabla, c)));
}

/** Crea la edición del lote si no existe; en ese caso desactiva las demás. Devuelve los nombres desactivados. */
async function prepararEdicion(servicios, actor, nombre, year) {
  const ediciones = await servicios.catalogs.list('editions');
  if (ediciones.some((e) => normalizar(e.name) === normalizar(nombre))) return [];
  await servicios.catalogs.create(actor, 'editions', { name: nombre, year, active: true });
  const activas = ediciones.filter((e) => e.active);
  await Promise.all(activas.map((e) => servicios.catalogs.update(actor, 'editions', e.id, { active: false })));
  return activas.map((e) => e.name);
}

/**
 * Carga y publica el lote. Devuelve un resumen: { yaCargada, publicadas, conErrores, edicionesDesactivadas }.
 * `direcciones` es un mapa { nombre de sede: dirección }.
 */
export async function cargarProgramacionDemo(servicios, sesion, { lote, direcciones = {}, year = null }) {
  const existentes = await Promise.all(lote.registros.map((r) => servicios.repos.activities.findByImportKey(r.clave)));
  if (existentes.every(Boolean)) return { yaCargada: true, publicadas: 0, conErrores: [], edicionesDesactivadas: [] };

  const edicionesDesactivadas = lote.edicion ? await prepararEdicion(servicios, sesion.userId, lote.edicion, year) : [];
  const sedes = [...new Set(lote.registros.flatMap((r) => [...(r.funciones ?? []), ...(r.franjas ?? [])].map((x) => x.sede)))];
  await crearFaltantes(servicios, sesion.userId, 'categories', [...new Set(lote.registros.map((r) => r.categoria))].map((name) => ({ name })));
  await crearFaltantes(
    servicios,
    sesion.userId,
    'venues',
    sedes.map((name) => ({ name, kind: 'place', ...(direcciones[name] ? { address: direcciones[name] } : {}) })),
  );

  const previa = await servicios.imports.vistaPrevia(sesion, { file: lote, filename: 'programacion-demo.json' });
  const conErrores = previa.records.filter((r) => r.errors.length).map((r) => r.key);
  const aceptado = await servicios.imports.aceptar(sesion, previa.id, { positions: previa.records.map((r) => r.position) });
  const nuevas = aceptado.records.filter((r) => r.outcome === 'loaded').map((r) => r.activityId);
  let publicadas = 0;
  if (nuevas.length) {
    const r = await servicios.imports.publicarLote(sesion, { activityIds: nuevas });
    publicadas = r.results.filter((x) => x.published).length;
  }
  return { yaCargada: false, publicadas, conErrores, edicionesDesactivadas };
}
