import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crearApp, pedir } from '../helpers.js';

// Historia 6: cargar la programación desde el archivo estructurado (FR-020 a FR-024, FR-031, FR-033;
// SC-008, SC-009, SC-010, SC-014). El lote de ejemplo usa datos FICTICIOS con la forma de los casos del PDF.

const LOTE = JSON.parse(readFileSync(new URL('../../ejemplos/lote-ejemplo.json', import.meta.url), 'utf8'));
const copia = () => structuredClone(LOTE);

async function catalogosDelEjemplo(ctx) {
  for (const name of ['Exposición', 'Teatro', 'Música', 'Danza', 'Calle']) await pedir(ctx, 'admin', 'POST', '/panel/categories', { name });
  for (const name of ['Museo de Ejemplo', 'Galería de Ejemplo', 'Teatro de Ejemplo', 'Plaza de Ejemplo']) {
    await pedir(ctx, 'admin', 'POST', '/panel/venues', { name, kind: 'place' });
  }
  await pedir(ctx, 'admin', 'POST', '/panel/venues', { name: 'Recorrido de Ejemplo', kind: 'route', routeDescription: 'Tramo ficticio' });
  await pedir(ctx, 'admin', 'POST', '/panel/editions', { name: 'Edición de ejemplo', year: 2026 });
}

test('FR-020, SC-014: la vista previa muestra origen, duplicados y errores antes de crear nada', async () => {
  const ctx = await crearApp();
  await catalogosDelEjemplo(ctx);
  const lote = copia();
  lote.registros.push({ ...lote.registros[3], clave: 'ejemplo-duplicado' }); // misma obra, fecha y sede
  lote.registros.push({ clave: 'ejemplo-con-errores', origen: {}, titulo: 'Con errores', categoria: 'Inexistente', funciones: [{ fecha: '21/11/2026', hora: '7pm', sede: 'Sala que no existe' }] });

  const r = await pedir(ctx, 'admin', 'POST', '/panel/imports', { filename: 'lote.json', file: lote });
  assert.equal(r.status, 201, r.body);
  assert.equal(r.json.status, 'preview');
  assert.equal(r.json.records.length, 9);
  assert.ok(r.json.records.every((x) => 'source' in x && 'errors' in x && x.outcome === 'pending'));
  assert.equal(r.json.records[0].source.page, 1);
  assert.equal(r.json.records[7].duplicateOf, 'registro:4');
  const errores = r.json.records[8].errors.join(' | ');
  for (const texto of ['origen.pagina', 'Inexistente', 'fecha', 'hora', 'Sala que no existe']) assert.ok(errores.includes(texto), texto);
  // la vista previa no crea actividades
  assert.equal((await ctx.services.db.query('SELECT COUNT(*) AS n FROM activities'))[0].n, '0');
});

test('FR-021, FR-033, SC-008: aceptar crea borradores sin publicar; los registros con errores no se cargan', async () => {
  const ctx = await crearApp();
  await catalogosDelEjemplo(ctx);
  const lote = copia();
  lote.registros.push({ clave: 'ejemplo-roto', origen: { pagina: 9 }, titulo: 'Roto', categoria: 'Nada' });
  const previa = (await pedir(ctx, 'admin', 'POST', '/panel/imports', { file: lote })).json;
  const r = await pedir(ctx, 'admin', 'POST', `/panel/imports/${previa.id}/accept`, { positions: [0, 1, 2, 3, 4, 5, 6, 7] });
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(r.json.records.map((x) => x.outcome), ['loaded', 'loaded', 'loaded', 'loaded', 'loaded', 'loaded', 'loaded', 'skipped_error']);
  // Nada se publicó (SC-008)
  assert.deepEqual((await pedir(ctx, null, 'GET', '/agenda')).json.items, []);
  const bandeja = (await pedir(ctx, 'admin', 'GET', '/panel/activities')).json.items;
  assert.equal(bandeja.length, 7);
  assert.ok(bandeja.every((a) => a.editorialState === 'draft' && !a.published));
  // SC-009: cada actividad importada conserva su página de origen
  const paginas = bandeja.map((a) => a.source.page).sort();
  assert.deepEqual(paginas, [1, 2, 3, 4, 5, 6, 7]);
});

test('FR-021: solo se publica lo que el administrador confirma explícitamente', async () => {
  const ctx = await crearApp();
  await catalogosDelEjemplo(ctx);
  const previa = (await pedir(ctx, 'admin', 'POST', '/panel/imports', { file: copia() })).json;
  const aceptado = (await pedir(ctx, 'admin', 'POST', `/panel/imports/${previa.id}/accept`, { positions: [0, 1, 2, 3, 4, 5, 6] })).json;
  const ids = aceptado.records.map((x) => x.activityId);
  const r = await pedir(ctx, 'admin', 'POST', '/panel/publish-batch', { activityIds: [ids[3], ids[4]] });
  assert.deepEqual(r.json.results.map((x) => x.published), [true, true]);
  assert.deepEqual((await pedir(ctx, null, 'GET', '/agenda')).json.items.map((i) => i.title).sort(), [
    'Concierto de ejemplo sin hora de fin',
    'Obra de ejemplo con doble función',
  ]);
  // el publicador no publica lotes; eso es del administrador
  assert.equal((await pedir(ctx, 'publicador', 'POST', '/panel/publish-batch', { activityIds: [ids[0]] })).status, 403);
  assert.equal((await pedir(ctx, 'editor', 'POST', '/panel/imports', { file: copia() })).status, 403);
});

test('FR-022, SC-008: recargar el mismo lote no sobrescribe las correcciones revisadas', async () => {
  const ctx = await crearApp();
  await catalogosDelEjemplo(ctx);
  const primera = (await pedir(ctx, 'admin', 'POST', '/panel/imports', { file: copia() })).json;
  const cargada = (await pedir(ctx, 'admin', 'POST', `/panel/imports/${primera.id}/accept`, { positions: [3] })).json;
  const id = cargada.records[3].activityId;
  const detalle = (await pedir(ctx, 'admin', 'GET', `/panel/activities/${id}`)).json;
  await pedir(ctx, 'admin', 'PUT', `/panel/activities/${id}/draft`, { version: detalle.version, content: { ...detalle.working, title: 'Título corregido a mano' } });

  const segunda = (await pedir(ctx, 'admin', 'POST', '/panel/imports', { file: copia() })).json;
  assert.equal(segunda.records[3].duplicateOf, `actividad:${id}`);
  const recarga = (await pedir(ctx, 'admin', 'POST', `/panel/imports/${segunda.id}/accept`, { positions: [3] })).json;
  assert.equal(recarga.records[3].outcome, 'skipped_existing');
  assert.equal((await pedir(ctx, 'admin', 'GET', `/panel/activities/${id}`)).json.working.title, 'Título corregido a mano');
});

test('FR-024, SC-010: etiquetas y los siete casos de referencia se representan sin inventar datos', async () => {
  const ctx = await crearApp();
  await catalogosDelEjemplo(ctx);
  const previa = (await pedir(ctx, 'admin', 'POST', '/panel/imports', { file: copia() })).json;
  const [partido, porRango, conFuncion, doble, soloInicio, sinPrecio, desfile] = previa.records.map((r) => r.content);

  assert.equal(partido.slots.length, 2, 'horario partido: dos franjas');
  assert.deepEqual(partido.access, { mode: 'free', priceUsd: null }, 'Entrada Libre revisada = gratuita confirmada');
  assert.deepEqual(porRango.slots.map((s) => [s.from, s.to, s.weekdays]), [['2026-11-20', '2026-11-24', [1, 2, 3, 4, 5]], ['2026-11-25', '2026-11-30', null]]);
  assert.deepEqual(porRango.access, { mode: 'unconfirmed', priceUsd: null }, 'Evento Gratuito sin revisar queda por confirmar');
  assert.deepEqual([conFuncion.slots.length, conFuncion.functions.length], [0, 1]);
  assert.deepEqual(doble.functions.map((f) => f.startTime), ['17:00', '20:00']);
  assert.deepEqual(doble.access, { mode: 'paid', priceUsd: 5 });
  assert.deepEqual([soloInicio.functions[0].endTime, soloInicio.functions[0].durationMinutes, soloInicio.durationMinutes], [null, null, null]);
  assert.deepEqual(sinPrecio.access, { mode: 'paid', priceUsd: null }, 'Evento Pagado sin precio: de pago, precio por confirmar');
  assert.deepEqual(conFuncion.access, { mode: 'unconfirmed', priceUsd: null }, 'sin etiqueta: por confirmar, nunca gratuita');
  const sedes = (await pedir(ctx, null, 'GET', '/venues')).json.items;
  assert.equal(sedes.find((s) => s.id === desfile.functions[0].venueId).kind, 'route');
  assert.ok(previa.records.every((r) => r.errors.length === 0));
});

test('un archivo con otro formato, vacío o de otra edición se rechaza con un mensaje claro', async () => {
  const ctx = await crearApp();
  await catalogosDelEjemplo(ctx);
  assert.equal((await pedir(ctx, 'admin', 'POST', '/panel/imports', { file: { registros: [] } })).status, 422);
  assert.equal((await pedir(ctx, 'admin', 'POST', '/panel/imports', { file: { formato: 'vivart-programacion/1', registros: [] } })).status, 422);
  const otra = await pedir(ctx, 'admin', 'POST', '/panel/imports', { file: { ...copia(), edicion: 'No existe' } });
  assert.equal(otra.status, 422);
  assert.ok(otra.json.fields.edicion);
});
