import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir } from '../helpers.js';
import { DATOS_RUTA_DEFECTO, prepararFuncionesConPasaporte } from '../rutas-ayuda.js';

test('SC-001, FR-008, FR-010: visitante sin cuenta consulta rutas publicadas y 0 borradores son visibles', async () => {
  const ctx = await crearApp();
  await prepararFuncionesConPasaporte(ctx, ['f-obra', 'f-danza', 'f-sin-fin']);

  // Crear ruta 1: Publicada
  const rPub = await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    title: 'Ruta Publicada de Ejemplo',
    functionIds: ['f-obra', 'f-danza'],
    goal: 2,
    publish: true,
  });
  assert.equal(rPub.status, 201);
  const idPub = rPub.json.id;

  // Crear ruta 2: Borrador
  const rBorrador = await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    title: 'Ruta Borrador Secreta',
    functionIds: ['f-sin-fin'],
    goal: 1,
    publish: false,
  });
  assert.equal(rBorrador.status, 201);
  const idBorrador = rBorrador.json.id;

  // Visitante sin sesión consulta catálogo público
  const resPublica = await pedir(ctx, null, 'GET', '/passport/routes');
  assert.equal(resPublica.status, 200);
  assert.equal(resPublica.json.items.length, 1);
  assert.equal(resPublica.json.items[0].id, idPub);
  assert.equal(resPublica.json.items[0].title, 'Ruta Publicada de Ejemplo');
  assert.equal(resPublica.json.items[0].goal, 2);
  assert.equal(resPublica.json.items[0].badge.title, DATOS_RUTA_DEFECTO.badgeTitle);
  assert.equal(resPublica.json.items[0].badge.icon, 'teatro');
  assert.equal(resPublica.json.items[0].progress, null); // Sin sesión no hay progreso

  // Detalle público de la ruta publicada
  const detallePub = await pedir(ctx, null, 'GET', `/passport/routes/${idPub}`);
  assert.equal(detallePub.status, 200);
  assert.equal(detallePub.json.title, 'Ruta Publicada de Ejemplo');
  assert.equal(detallePub.json.functions.length, 2);
  assert.equal(detallePub.json.functions[0].functionId, 'f-obra');
  assert.equal(detallePub.json.functions[0].hasStamp, null); // Sin sesión

  // Consulta directa de ruta en borrador: 404 (FR-010)
  const detalleBorrador = await pedir(ctx, null, 'GET', `/passport/routes/${idBorrador}`);
  assert.equal(detalleBorrador.status, 404);
});

test('SC-011, FR-011, FR-020: función cancelada se etiqueta y ruta pasa a «en revisión» si activas < meta', async () => {
  const ctx = await crearApp();
  await prepararFuncionesConPasaporte(ctx, ['f-obra', 'f-cancelable']);

  // Crear ruta con meta 2 y 2 funciones (f-obra y f-cancelable)
  const r = await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    title: 'Ruta con función cancelable',
    functionIds: ['f-obra', 'f-cancelable'],
    goal: 2,
    publish: true,
  });
  assert.equal(r.status, 201);
  const idRuta = r.json.id;

  // Al inicio: f-cancelable está programada (scheduled) => inReview: false
  const res1 = await pedir(ctx, null, 'GET', `/passport/routes/${idRuta}`);
  assert.equal(res1.status, 200);
  assert.equal(res1.json.inReview, false);
  const funcCancelable1 = res1.json.functions.find((f) => f.functionId === 'f-cancelable');
  assert.equal(funcCancelable1.status, 'active');

  // Cancelar la función f-cancelable en programación simulada
  const fProg = ctx.programacion.funciones.get('f-cancelable');
  fProg.status = 'cancelled';

  // Al consultar ahora: 1 activa < 2 de meta => inReview: true («Ruta en revisión»)
  const res2 = await pedir(ctx, null, 'GET', `/passport/routes/${idRuta}`);
  assert.equal(res2.status, 200);
  assert.equal(res2.json.inReview, true);
  assert.equal(res2.json.goal, 2, 'La meta no se reduce automáticamente');
  const funcCancelable2 = res2.json.functions.find((f) => f.functionId === 'f-cancelable');
  assert.equal(funcCancelable2.status, 'cancelled');

  // También en la lista general aparece inReview: true
  const lista = await pedir(ctx, null, 'GET', '/passport/routes');
  assert.equal(lista.status, 200);
  const rEnLista = lista.json.items.find((item) => item.id === idRuta);
  assert.equal(rEnLista.inReview, true);
});

test('FR-020: si la cancelación no impide la meta, la ruta permanece activa (inReview: false)', async () => {
  const ctx = await crearApp();
  await prepararFuncionesConPasaporte(ctx, ['f-obra', 'f-danza', 'f-cancelable']);

  // Crear ruta con 3 funciones y meta 2
  const r = await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    title: 'Ruta con margen de cancelación',
    functionIds: ['f-obra', 'f-danza', 'f-cancelable'],
    goal: 2,
    publish: true,
  });
  assert.equal(r.status, 201);
  const idRuta = r.json.id;

  // Cancelar f-cancelable
  ctx.programacion.funciones.get('f-cancelable').status = 'cancelled';

  // Quedan 2 funciones activas (f-obra y f-danza) y meta es 2 (2 >= 2) => inReview: false
  const res = await pedir(ctx, null, 'GET', `/passport/routes/${idRuta}`);
  assert.equal(res.status, 200);
  assert.equal(res.json.inReview, false);
  const funcCancelada = res.json.functions.find((f) => f.functionId === 'f-cancelable');
  assert.equal(funcCancelada.status, 'cancelled');
});
