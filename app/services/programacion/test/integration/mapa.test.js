import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir, catalogos, publicada, relojMovible, contenido } from '../helpers.js';
import { ILUSTRACION } from '../../src/domain/mapa.js';
import { png } from '../imagenes-prueba.js';

// Spec 003: API pública del mapa de sedes. Datos FICTICIOS; reloj fijado el 2026-11-21 a las 18:00 en Loja.

const PNG = png();
const nombres = (r) => r.json.items.map((s) => s.name).sort();

/** Sedes y funciones de ejemplo que cubren los casos del spec. */
async function escenario() {
  const ctx = await crearApp({ reloj: relojMovible() });
  const c = await catalogos(ctx);
  const sede = async (cuerpo) => (await pedir(ctx, 'admin', 'POST', '/panel/venues', cuerpo)).json;
  c.teatro2 = await sede({ name: 'Teatro Bolívar de Prueba', kind: 'place', address: 'Calle Ficticia 9' });
  c.galeria = await sede({ name: 'Galería sin funciones', kind: 'place' });

  // Hoy a las 19:00 (aún no empieza) y ayer en el museo; mañana en la plaza.
  const obra = await publicada(ctx, c, {
    title: 'Obra del día',
    functions: [
      { date: '2026-11-21', startTime: '19:00', venueId: c.museo.id },
      { date: '2026-11-20', startTime: '19:00', venueId: c.museo.id },
      { date: '2026-11-22', startTime: '20:00', venueId: c.plaza.id },
    ],
  });
  // Solo franjas de apertura en el teatro: no cuentan para «Funciones del día» (M-06).
  await publicada(ctx, c, {
    title: 'Exposición de ejemplo',
    access: { mode: 'free' },
    functions: [],
    slots: [{ venueId: c.teatro2.id, from: '2026-11-20', to: '2026-11-23', opens: '10:00', closes: '18:00' }],
  });
  // La única función del recorrido hoy se cancela.
  const desfile = await publicada(ctx, c, { title: 'Desfile de ejemplo', functions: [{ date: '2026-11-21', startTime: '17:00', venueId: c.desfile.id }] });
  const fid = desfile.publishedContent.functions[0].id;
  const cancelada = await pedir(ctx, 'admin', 'POST', `/panel/functions/${fid}/cancel`, { reason: 'Lluvia', notice: 'Desfile cancelado.' });
  assert.equal(cancelada.status, 200);
  // Un borrador nunca cuenta.
  await pedir(ctx, 'editor', 'POST', '/panel/activities', {
    content: contenido(c, { title: 'Borrador', functions: [{ date: '2026-11-21', startTime: '20:00', venueId: c.galeria.id }] }),
  });
  return { ctx, c, obra };
}

test('SC-001, SC-002, SC-012: el mapa es público y lista TODAS las sedes registradas, con o sin marcador', async () => {
  const { ctx, c } = await escenario();
  const datos = await pedir(ctx, null, 'GET', '/map');
  assert.equal(datos.status, 200);
  assert.deepEqual(datos.json.illustration, { ...ILUSTRACION });
  assert.equal(datos.json.illustration.provisional, true);
  // Días con funciones programadas y visibles: sin la cancelada ni el borrador.
  assert.deepEqual(datos.json.days, ['2026-11-20', '2026-11-21', '2026-11-22']);

  await pedir(ctx, 'admin', 'PUT', `/panel/venues/${c.museo.id}`, { marker: { illustrationId: ILUSTRACION.id, x: 0.3, y: 0.4 } });
  // Marcador de otra ilustración guardado antes: se trata como sin marcador.
  await ctx.services.db.run('UPDATE venues SET marker = $1 WHERE id = $2', [JSON.stringify({ illustrationId: 'otra', x: 0.5, y: 0.5 }), c.plaza.id]);

  const sedes = await pedir(ctx, null, 'GET', '/map/venues');
  assert.equal(sedes.status, 200);
  assert.deepEqual(nombres(sedes), ['Galería sin funciones', 'Museo de Ejemplo', 'Plaza de Ejemplo', 'Recorrido de Ejemplo', 'Teatro Bolívar de Prueba']);
  const por = Object.fromEntries(sedes.json.items.map((s) => [s.id, s]));
  assert.deepEqual(por[c.museo.id].marker, { illustrationId: ILUSTRACION.id, x: 0.3, y: 0.4 });
  assert.equal(por[c.plaza.id].marker, null);
  assert.equal(por[c.desfile.id].kind, 'route');
  assert.equal(por[c.galeria.id].dayFunctionCount, null);
  assert.deepEqual(por[c.galeria.id].accessibility, { stepFree: { status: 'unconfirmed', note: null }, accessibleToilet: { status: 'unconfirmed', note: null } });
});

test('SC-003, SC-004, M-06: «Funciones del día» solo cuenta funciones programadas de ese día; franjas, canceladas y borradores no', async () => {
  const { ctx, c } = await escenario();
  const hoy = await pedir(ctx, null, 'GET', '/map/venues?day=2026-11-21');
  assert.deepEqual(nombres(hoy), ['Museo de Ejemplo']);
  assert.equal(hoy.json.items[0].dayFunctionCount, 1);
  assert.equal(hoy.json.dayHasFunctions, true);

  const manana = await pedir(ctx, null, 'GET', '/map/venues?day=2026-11-22');
  assert.deepEqual(manana.json.items.map((s) => s.id), [c.plaza.id]);

  // Hoy fuera de la edición o un día sin funciones: lista vacía y se indica.
  const vacio = await pedir(ctx, null, 'GET', '/map/venues?day=2026-12-25');
  assert.deepEqual([vacio.json.items.length, vacio.json.dayHasFunctions], [0, false]);

  assert.equal((await pedir(ctx, null, 'GET', '/map/venues?day=21-11-2026')).status, 422);
});

test('FR-011, M-08: la ficha de la sede muestra funciones desde hoy, o solo las del día; las canceladas, marcadas', async () => {
  const { ctx, c, obra } = await escenario();
  const museo = await pedir(ctx, null, 'GET', `/map/venues/${c.museo.id}`);
  assert.equal(museo.status, 200);
  assert.deepEqual(
    museo.json.functions.map((f) => [f.date, f.startTime, f.title, f.status, f.timeStatus, f.activityId]),
    [['2026-11-21', '19:00', 'Obra del día', 'scheduled', 'upcoming', obra.id]],
  );
  const ayer = await pedir(ctx, null, 'GET', `/map/venues/${c.museo.id}?day=2026-11-20`);
  assert.deepEqual(ayer.json.functions.map((f) => f.date), ['2026-11-20']);

  const recorrido = await pedir(ctx, null, 'GET', `/map/venues/${c.desfile.id}`);
  assert.deepEqual(recorrido.json.functions.map((f) => [f.status, f.timeStatus]), [['cancelled', 'cancelled']]);
  assert.equal(recorrido.json.directionsUrl, null);
  assert.equal(recorrido.json.routeDescription, 'Desde la plaza A hasta la plaza B');

  const sinFunciones = await pedir(ctx, null, 'GET', `/map/venues/${c.galeria.id}`);
  assert.deepEqual([sinFunciones.status, sinFunciones.json.functions.length, sinFunciones.json.photo], [200, 0, null]);
  assert.equal((await pedir(ctx, null, 'GET', '/map/venues/no-existe')).status, 404);
});

test('SC-005, SC-014: «Buscar sede» encuentra sedes sin distinguir mayúsculas ni tildes y nunca busca funciones', async () => {
  const { ctx } = await escenario();
  for (const q of ['bolivar', 'TEATRO BOLÍVAR', 'Bolív']) {
    assert.deepEqual(nombres(await pedir(ctx, null, 'GET', `/map/venues?q=${encodeURIComponent(q)}`)), ['Teatro Bolívar de Prueba'], q);
  }
  assert.deepEqual(nombres(await pedir(ctx, null, 'GET', '/map/venues?q=galeria')), ['Galería sin funciones']);
  // El título de una función no devuelve sedes por esa razón.
  assert.deepEqual(nombres(await pedir(ctx, null, 'GET', `/map/venues?q=${encodeURIComponent('Obra del día')}`)), []);
  assert.deepEqual(nombres(await pedir(ctx, null, 'GET', '/map/venues?q=%25')), []);
});

test('SC-007: el filtro de accesibilidad solo incluye características confirmadas; los filtros se combinan con «y»', async () => {
  const { ctx, c } = await escenario();
  const acc = (sede, feature, cuerpo) => pedir(ctx, 'admin', 'PUT', `/panel/venues/${sede.id}/accessibility/${feature}`, cuerpo);
  const verificada = { source: 'Revisión directa', verifiedOn: '2026-11-15' };
  assert.equal((await acc(c.museo, 'step_free', { status: 'confirmed', ...verificada })).status, 200);
  await acc(c.plaza, 'step_free', { status: 'unavailable', ...verificada });
  await acc(c.teatro2, 'step_free', { status: 'unconfirmed', note: 'Nos dijeron que es accesible' });
  await acc(c.teatro2, 'accessible_toilet', { status: 'confirmed', ...verificada });

  assert.deepEqual(nombres(await pedir(ctx, null, 'GET', '/map/venues?stepFree=true')), ['Museo de Ejemplo']);
  assert.deepEqual(nombres(await pedir(ctx, null, 'GET', '/map/venues?accessibleToilet=true')), ['Teatro Bolívar de Prueba']);
  assert.deepEqual(nombres(await pedir(ctx, null, 'GET', '/map/venues?stepFree=true&accessibleToilet=true')), []);
  assert.deepEqual(nombres(await pedir(ctx, null, 'GET', '/map/venues?day=2026-11-21&stepFree=true')), ['Museo de Ejemplo']);
  assert.deepEqual(nombres(await pedir(ctx, null, 'GET', '/map/venues?day=2026-11-22&stepFree=true')), []);

  const teatro = await pedir(ctx, null, 'GET', `/map/venues/${c.teatro2.id}`);
  assert.deepEqual(teatro.json.accessibility, {
    stepFree: { status: 'unconfirmed', note: 'Nos dijeron que es accesible' },
    accessibleToilet: { status: 'confirmed', note: null },
  });
});

test('SC-006, SC-013: «Cómo llegar» solo con destino verificado; la foto se sirve con su tipo, texto alternativo y autoría', async () => {
  const { ctx, c } = await escenario();
  assert.equal((await pedir(ctx, null, 'GET', `/map/venues/${c.museo.id}`)).json.directionsUrl, null);
  const destino = await pedir(ctx, 'admin', 'PUT', `/panel/venues/${c.museo.id}/destination`, {
    lat: -3.5,
    lng: -78.25,
    source: 'Revisión en sitio',
    verifiedOn: '2026-11-10',
  });
  assert.equal(destino.status, 200);
  const museo = await pedir(ctx, null, 'GET', `/map/venues/${c.museo.id}`);
  assert.equal(museo.json.directionsUrl, 'https://www.google.com/maps/search/?api=1&query=-3.500000,-78.250000');

  await pedir(ctx, 'admin', 'PUT', `/panel/venues/${c.museo.id}/photo`, { dataBase64: PNG.toString('base64'), alt: 'Fachada del museo', credit: 'Foto propia del equipo' });
  const conFoto = (await pedir(ctx, null, 'GET', `/map/venues/${c.museo.id}`)).json.photo;
  assert.equal(conFoto.alt, 'Fachada del museo');
  assert.equal(conFoto.credit, 'Foto propia del equipo');
  assert.match(conFoto.url, new RegExp(`^/api/programacion/map/venues/${c.museo.id}/photo\\?v=[0-9a-f]{16}$`));

  const bytes = await ctx.app.inject({ method: 'GET', url: conFoto.url.replace('/api/programacion', '') });
  assert.equal(bytes.statusCode, 200);
  assert.equal(bytes.headers['content-type'], 'image/png');
  assert.deepEqual(bytes.rawPayload, PNG);
  assert.equal((await pedir(ctx, null, 'GET', `/map/venues/${c.plaza.id}/photo`)).status, 404);
});
