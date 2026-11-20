#!/usr/bin/env node
// Carga en la DEMO el lote de ejemplo con datos FICTICIOS (ejemplos/lote-ejemplo.json) y lo publica, para ver
// la Agenda con contenido. Crea las categorías, sedes y la edición que el ejemplo necesita si no existen.
// No son datos del festival. Se niega a ejecutarse con NODE_ENV=production.
//
//   docker compose exec programacion node bin/cargar-ejemplo.js      (desde app/)
import { readFileSync } from 'node:fs';
import { loadConfig } from '../src/config.js';
import { createServices } from '../src/services.js';
import { normalizar } from '../src/domain/text.js';

const config = loadConfig();
if (config.production) {
  console.error('Este script es solo para la demo: no se ejecuta con NODE_ENV=production.');
  process.exit(2);
}

// Procedimiento interno de la demo: actúa como «procedimiento-demo» con todos los permisos, sin pasar por identidad.
const sesion = { token: 'procedimiento-demo', userId: 'procedimiento-demo' };
const identidad = { introspect: async () => null, authorize: async () => ({ allowed: true }) };
const servicios = await createServices({ config, identidad });

try {
  const lote = JSON.parse(readFileSync(new URL('../ejemplos/lote-ejemplo.json', import.meta.url), 'utf8'));
  const existentes = async (tabla) => new Set((await servicios.catalogs.list(tabla)).map((x) => normalizar(x.name)));
  const crearSiFalta = async (tabla, cuerpos) => {
    const ya = await existentes(tabla);
    for (const cuerpo of cuerpos) if (!ya.has(normalizar(cuerpo.name))) await servicios.catalogs.create(sesion.userId, tabla, cuerpo);
  };
  const nombres = (campo) => [...new Set(lote.registros.flatMap((r) => [...(r.funciones ?? []), ...(r.franjas ?? [])].map((x) => x[campo])))];

  await crearSiFalta('editions', [{ name: lote.edicion, year: 2026 }]);
  await crearSiFalta('categories', [...new Set(lote.registros.map((r) => r.categoria))].map((name) => ({ name })));
  await crearSiFalta(
    'venues',
    nombres('sede').map((name) => (/recorrido/i.test(name) ? { name, kind: 'route', routeDescription: 'Tramo de calle ficticio' } : { name, kind: 'place' })),
  );

  const previa = await servicios.imports.vistaPrevia(sesion, { file: lote, filename: 'lote-ejemplo.json' });
  const conErrores = previa.records.filter((r) => r.errors.length);
  if (conErrores.length) console.warn(`Registros con errores (no se cargan): ${conErrores.map((r) => r.key).join(', ')}`);
  const aceptado = await servicios.imports.aceptar(sesion, previa.id, { positions: previa.records.map((r) => r.position) });
  const nuevas = aceptado.records.filter((r) => r.outcome === 'loaded').map((r) => r.activityId);
  if (nuevas.length === 0) {
    console.log('El ejemplo ya estaba cargado: no se vuelve a cargar (no se sobrescriben correcciones).');
  } else {
    const r = await servicios.imports.publicarLote(sesion, { activityIds: nuevas });
    console.log(`Listo: ${r.results.filter((x) => x.published).length} actividades ficticias publicadas. Mira /api/programacion/agenda.`);
  }
} catch (error) {
  console.error(`No se pudo cargar el ejemplo: ${error.message}`);
  process.exitCode = 1;
} finally {
  await servicios.db.close();
}
