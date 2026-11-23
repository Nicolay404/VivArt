#!/usr/bin/env node
// Carga en la DEMO la programación oficial FIAVL 2026 (ejemplos/programacion-fiavl-2026.json, convertida del CSV
// del festival) y la publica, para que toda la demo del equipo tenga las mismas actividades reales.
// Lo ejecuta el contenedor `programacion-cargar` en cada `docker compose up`. Es IDEMPOTENTE: si la programación ya
// está cargada no hace nada, y nunca sobrescribe correcciones hechas desde el panel.
// Las sedes solo reciben la dirección que trae el CSV; destino, accesibilidad y marcador quedan por confirmar (RNF-08).
// Se niega a ejecutarse con NODE_ENV=production.
//
//   docker compose exec programacion node bin/cargar-programacion.js      (manual, desde app/)
import { readFileSync } from 'node:fs';
import { loadConfig } from '../src/config.js';
import { createServices } from '../src/services.js';
import { normalizar } from '../src/domain/text.js';

const leer = (nombre) => JSON.parse(readFileSync(new URL(`../ejemplos/${nombre}`, import.meta.url), 'utf8'));

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
  const lote = leer('programacion-fiavl-2026.json');
  const direcciones = leer('sedes-fiavl-2026.json');

  // Si todas las claves ya existen, la programación está cargada: no se crea otra vista previa en el historial.
  const faltan = [];
  for (const r of lote.registros) if (!(await servicios.repos.activities.findByImportKey(r.clave))) faltan.push(r);
  if (faltan.length === 0) {
    console.log(`La programación FIAVL 2026 ya estaba cargada (${lote.registros.length} actividades): no se vuelve a cargar.`);
  } else {
    // La primera vez, la edición real queda activa y las demás (p. ej. la de ejemplo ficticio) salen de la Agenda.
    // No se borra nada: se pueden reactivar desde el panel.
    const ediciones = await servicios.catalogs.list('editions');
    if (!ediciones.some((e) => normalizar(e.name) === normalizar(lote.edicion))) {
      await servicios.catalogs.create(sesion.userId, 'editions', { name: lote.edicion, year: 2026, active: true });
      for (const e of ediciones.filter((x) => x.active)) {
        await servicios.catalogs.update(sesion.userId, 'editions', e.id, { active: false });
        console.log(`Edición desactivada (sigue guardada): ${e.name}`);
      }
    }

    const crearSiFalta = async (tabla, cuerpos) => {
      const ya = new Set((await servicios.catalogs.list(tabla)).map((x) => normalizar(x.name)));
      // Dos nombres que solo cambian en mayúsculas o tildes son el mismo: se crea solo el primero.
      for (const cuerpo of cuerpos) {
        if (ya.has(normalizar(cuerpo.name))) continue;
        ya.add(normalizar(cuerpo.name));
        await servicios.catalogs.create(sesion.userId, tabla, cuerpo);
      }
    };
    const sedes = [...new Set(lote.registros.flatMap((r) => [...(r.funciones ?? []), ...(r.franjas ?? [])].map((x) => x.sede)))];
    await crearSiFalta('categories', [...new Set(lote.registros.map((r) => r.categoria))].map((name) => ({ name })));
    await crearSiFalta('venues', sedes.map((name) => ({ name, kind: 'place', ...(direcciones[name] ? { address: direcciones[name] } : {}) })));

    const previa = await servicios.imports.vistaPrevia(sesion, { file: lote, filename: 'programacion-fiavl-2026.json' });
    const conErrores = previa.records.filter((r) => r.errors.length);
    if (conErrores.length) console.warn(`Registros con errores (no se cargan): ${conErrores.map((r) => r.key).join(', ')}`);
    const aceptado = await servicios.imports.aceptar(sesion, previa.id, { positions: previa.records.map((r) => r.position) });
    const nuevas = aceptado.records.filter((r) => r.outcome === 'loaded').map((r) => r.activityId);
    if (nuevas.length) {
      const r = await servicios.imports.publicarLote(sesion, { activityIds: nuevas });
      console.log(`Listo: ${r.results.filter((x) => x.published).length} actividades de la programación FIAVL 2026 publicadas.`);
    } else {
      console.log('No había actividades nuevas que cargar.');
    }
  }
} catch (error) {
  console.error(`No se pudo cargar la programación: ${error.message}`);
  process.exitCode = 1;
} finally {
  await servicios.db.close();
}
