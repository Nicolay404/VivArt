import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crearApp, pedir } from '../helpers.js';
import { cargarProgramacionDemo, colocarMarcadoresDemo, asegurarSedes } from '../../src/domain/carga-demo.js';
import { ILUSTRACION } from '../../src/domain/mapa.js';
import { normalizar } from '../../src/domain/text.js';

// Carga de la programación oficial FIAVL 2026 en la demo (bin/cargar-programacion.js): usa el archivo real del repositorio.
const leer = (nombre) => JSON.parse(readFileSync(new URL(`../../ejemplos/${nombre}`, import.meta.url), 'utf8'));
const LOTE = leer('programacion-fiavl-2026.json');
const DIRECCIONES = leer('sedes-fiavl-2026.json');
const ADMIN = { token: 'tok-admin', userId: 'u-admin' };

test('la programación FIAVL 2026 se carga y publica entera, sin registros con errores', async () => {
  const ctx = await crearApp();
  const r = await cargarProgramacionDemo(ctx.services, ADMIN, { lote: LOTE, direcciones: DIRECCIONES, year: 2026 });
  assert.equal(r.yaCargada, false);
  assert.deepEqual(r.conErrores, []);
  assert.equal(r.publicadas, LOTE.registros.length);

  // Las sedes solo llevan la dirección que trae el CSV; las demás quedan sin dirección (por confirmar).
  const sedes = (await pedir(ctx, 'admin', 'GET', '/venues')).json.items;
  const [conDireccion, direccion] = Object.entries(DIRECCIONES)[0];
  assert.equal(sedes.find((s) => s.name === conDireccion).address, direccion);
  assert.ok(sedes.some((s) => !s.address));
});

test('es idempotente: una segunda carga no duplica nada ni crea otra vista previa', async () => {
  const ctx = await crearApp();
  await cargarProgramacionDemo(ctx.services, ADMIN, { lote: LOTE, direcciones: DIRECCIONES, year: 2026 });
  const contar = async (tabla) => Number((await ctx.services.db.query(`SELECT COUNT(*) AS n FROM ${tabla}`))[0].n);
  const [actividades, importaciones] = [await contar('activities'), await contar('import_batches')];

  const r = await cargarProgramacionDemo(ctx.services, ADMIN, { lote: LOTE, direcciones: DIRECCIONES, year: 2026 });
  assert.equal(r.yaCargada, true);
  assert.equal(r.publicadas, 0);
  assert.equal(await contar('activities'), actividades);
  assert.equal(await contar('import_batches'), importaciones);
});

test('la primera vez desactiva las demás ediciones sin borrarlas y no repite catálogos que ya existen', async () => {
  const ctx = await crearApp();
  await pedir(ctx, 'admin', 'POST', '/panel/editions', { name: 'Edición de ejemplo', year: 2026 });
  // Ya existe con otras mayúsculas y tildes: no se crea otra.
  const categoria = LOTE.registros[0].categoria;
  await pedir(ctx, 'admin', 'POST', '/panel/categories', { name: categoria.toUpperCase() });

  const r = await cargarProgramacionDemo(ctx.services, ADMIN, { lote: LOTE, direcciones: DIRECCIONES, year: 2026 });
  assert.deepEqual(r.edicionesDesactivadas, ['Edición de ejemplo']);
  const ediciones = (await pedir(ctx, 'admin', 'GET', '/editions')).json.items;
  assert.equal(ediciones.find((e) => e.name === 'Edición de ejemplo').active, false);
  assert.equal(ediciones.find((e) => e.name === LOTE.edicion).active, true);
  const categorias = (await pedir(ctx, 'admin', 'GET', '/categories')).json.items;
  assert.equal(categorias.filter((c) => c.name.toLowerCase() === categoria.toLowerCase()).length, 1);
});

test('los marcadores del centro de Loja se colocan una vez y no pisan los movidos desde el panel', async () => {
  const ctx = await crearApp();
  await cargarProgramacionDemo(ctx.services, ADMIN, { lote: LOTE, direcciones: DIRECCIONES, year: 2026 });
  const POSICIONES = leer('marcadores-centro-2026.json');
  const sedes = async () => (await pedir(ctx, 'admin', 'GET', '/venues')).json.items;
  const teatro = (await sedes()).find((s) => s.name === 'Teatro Bolívar');
  // Movido a mano antes de la carga: se respeta.
  await pedir(ctx, 'admin', 'PUT', `/panel/venues/${teatro.id}`, { marker: { illustrationId: ILUSTRACION.id, x: 0.1, y: 0.1 } });

  // Plaza San Francisco no viene en el CSV: se crea solo con su nombre, y una segunda vez no se duplica.
  await asegurarSedes(ctx.services, ADMIN, ILUSTRACION.circuit);
  await asegurarSedes(ctx.services, ADMIN, ILUSTRACION.circuit);
  assert.equal((await sedes()).filter((s) => s.name === 'Plaza San Francisco').length, 1);
  assert.deepEqual(Object.keys(POSICIONES), [...ILUSTRACION.circuit]);

  const colocados = await colocarMarcadoresDemo(ctx.services, ADMIN, POSICIONES);
  // Los nombres se comparan sin mayúsculas ni tildes, como en la carga.
  const claves = new Set(Object.keys(POSICIONES).map(normalizar));
  const conNombre = (await sedes()).filter((s) => claves.has(normalizar(s.name)));
  assert.equal(colocados, conNombre.length - 1);
  const plaza = conNombre.find((s) => s.name === 'Plaza San Sebastián');
  assert.deepEqual(plaza.marker, { illustrationId: ILUSTRACION.id, ...POSICIONES['Plaza San Sebastián'] });
  assert.deepEqual(conNombre.find((s) => s.name === 'Teatro Bolívar').marker, { illustrationId: ILUSTRACION.id, x: 0.1, y: 0.1 });
  // Una segunda vez no coloca nada, y sobre una ilustración provisional tampoco.
  assert.equal(await colocarMarcadoresDemo(ctx.services, ADMIN, POSICIONES), 0);
  assert.equal(await colocarMarcadoresDemo(ctx.services, ADMIN, POSICIONES, { ...ILUSTRACION, id: 'otra', provisional: true }), 0);
});
