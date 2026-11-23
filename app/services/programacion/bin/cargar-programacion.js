#!/usr/bin/env node
// Carga en la DEMO la programación oficial FIAVL 2026 (ejemplos/programacion-fiavl-2026.json, convertida del CSV
// del festival) y la publica, para que toda la demo del equipo tenga las mismas actividades reales.
// Lo ejecuta el contenedor `programacion-cargar` en cada `docker compose up`. Es idempotente (ver src/domain/carga-demo.js).
// Se niega a ejecutarse con NODE_ENV=production.
//
//   docker compose exec programacion node bin/cargar-programacion.js      (manual, desde app/)
import { readFileSync } from 'node:fs';
import { loadConfig } from '../src/config.js';
import { createServices } from '../src/services.js';
import { cargarProgramacionDemo } from '../src/domain/carga-demo.js';

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
  const r = await cargarProgramacionDemo(servicios, sesion, { lote, direcciones: leer('sedes-fiavl-2026.json'), year: 2026 });
  for (const nombre of r.edicionesDesactivadas) console.log(`Edición desactivada (sigue guardada): ${nombre}`);
  if (r.conErrores.length) console.warn(`Registros con errores (no se cargan): ${r.conErrores.join(', ')}`);
  console.log(
    r.yaCargada
      ? `La programación FIAVL 2026 ya estaba cargada (${lote.registros.length} actividades): no se vuelve a cargar.`
      : `Listo: ${r.publicadas} actividades de la programación FIAVL 2026 publicadas.`,
  );
} catch (error) {
  console.error(`No se pudo cargar la programación: ${error.message}`);
  process.exitCode = 1;
} finally {
  await servicios.db.close();
}
