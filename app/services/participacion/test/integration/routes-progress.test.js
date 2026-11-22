import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir } from '../helpers.js';
import { DATOS_RUTA_DEFECTO, prepararFuncionesConPasaporte } from '../rutas-ayuda.js';
import { reclamar } from '../pasaporte-ayuda.js';

test('SC-002, FR-012, FR-015: progreso por ruta muestra sellos distintos y denominador exacto «X de Y»', async () => {
  const ctx = await crearApp();
  const fids = ['f-obra', 'f-danza', 'f-sin-fin'];
  const refs = await prepararFuncionesConPasaporte(ctx, fids);

  // Crear ruta con meta 3
  const rRuta = await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    title: 'Ruta Teatral',
    functionIds: fids,
    goal: 3,
    publish: true,
  });
  assert.equal(rRuta.status, 201);
  const idRuta = rRuta.json.id;

  // 1. Antes de canjear: usuaria tiene 0 de 3
  const resInicio = await pedir(ctx, 'usuaria', 'GET', '/passport/routes');
  assert.equal(resInicio.status, 200);
  const r1 = resInicio.json.items.find((item) => item.id === idRuta);
  assert.ok(r1.progress);
  assert.equal(r1.progress.current, 0);
  assert.equal(r1.progress.goal, 3);
  assert.equal(r1.progress.formatted, '0 de 3');
  assert.equal(r1.progress.completed, false);
  assert.equal(r1.progress.unlockedBadge, false);

  // En el detalle de la ruta: todas las funciones tienen hasStamp: false
  const detInicio = await pedir(ctx, 'usuaria', 'GET', `/passport/routes/${idRuta}`);
  assert.equal(detInicio.status, 200);
  assert.equal(detInicio.json.progress.formatted, '0 de 3');
  for (const f of detInicio.json.functions) {
    assert.equal(f.hasStamp, false);
  }

  // 2. Canjear primer sello (f-obra)
  const canje1 = await reclamar(ctx, 'usuaria', refs.get('f-obra'));
  assert.equal(canje1.status, 201);

  const res1 = await pedir(ctx, 'usuaria', 'GET', '/passport/routes');
  const rProg1 = res1.json.items.find((item) => item.id === idRuta);
  assert.equal(rProg1.progress.current, 1);
  assert.equal(rProg1.progress.formatted, '1 de 3');
  assert.equal(rProg1.progress.completed, false);

  const det1 = await pedir(ctx, 'usuaria', 'GET', `/passport/routes/${idRuta}`);
  const fObra = det1.json.functions.find((f) => f.functionId === 'f-obra');
  assert.equal(fObra.hasStamp, true);
  const fDanza = det1.json.functions.find((f) => f.functionId === 'f-danza');
  assert.equal(fDanza.hasStamp, false);

  // 3. Canjear segundo sello (f-danza)
  const canje2 = await reclamar(ctx, 'usuaria', refs.get('f-danza'));
  assert.equal(canje2.status, 201);

  const res2 = await pedir(ctx, 'usuaria', 'GET', '/passport/routes');
  const rProg2 = res2.json.items.find((item) => item.id === idRuta);
  assert.equal(rProg2.progress.current, 2);
  assert.equal(rProg2.progress.formatted, '2 de 3');
  assert.equal(rProg2.progress.completed, false);

  // 4. Intentar canjear f-obra de nuevo: el canje es idempotente (200, created: false) y el progreso sigue siendo 2 de 3
  const canjeRepetido = await reclamar(ctx, 'usuaria', refs.get('f-obra'));
  assert.equal(canjeRepetido.status, 200);
  assert.equal(canjeRepetido.json.created, false);

  const resRepetido = await pedir(ctx, 'usuaria', 'GET', `/passport/routes/${idRuta}`);
  assert.equal(resRepetido.json.progress.current, 2);
  assert.equal(resRepetido.json.progress.formatted, '2 de 3');
});

test('Sellos de funciones no elegibles / ajenas no suman a la ruta', async () => {
  const ctx = await crearApp();
  const fidsRuta = ['f-obra', 'f-danza'];
  const refs = await prepararFuncionesConPasaporte(ctx, ['f-obra', 'f-danza', 'f-teatro2']);

  // Crear ruta con solo f-obra y f-danza (meta 2)
  const rRuta = await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    title: 'Ruta 2 Funciones',
    functionIds: fidsRuta,
    goal: 2,
    publish: true,
  });
  const idRuta = rRuta.json.id;

  // Canjear f-teatro2 que no pertenece a la ruta
  const canjeAjeno = await reclamar(ctx, 'usuaria', refs.get('f-teatro2'));
  assert.equal(canjeAjeno.status, 201);

  // El progreso de la ruta debe seguir en 0 de 2
  const res = await pedir(ctx, 'usuaria', 'GET', `/passport/routes/${idRuta}`);
  assert.equal(res.json.progress.current, 0);
  assert.equal(res.json.progress.formatted, '0 de 2');
});

test('SC-012, FR-021: sellos de funciones canceladas se conservan y siguen sumando al progreso', async () => {
  const ctx = await crearApp();
  const fids = ['f-obra', 'f-cancelable'];
  const refs = await prepararFuncionesConPasaporte(ctx, fids);

  // Crear ruta con meta 2
  const rRuta = await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    title: 'Ruta con función que se cancelará',
    functionIds: fids,
    goal: 2,
    publish: true,
  });
  const idRuta = rRuta.json.id;

  // Usuaria canjea f-cancelable mientras estaba activa
  const canje = await reclamar(ctx, 'usuaria', refs.get('f-cancelable'));
  assert.equal(canje.status, 201);

  // Se cancela f-cancelable en programación
  ctx.programacion.funciones.get('f-cancelable').status = 'cancelled';

  // Al consultar la ruta:
  // - Está en revisión (1 activa < 2 de meta)
  // - La función cancelable se etiqueta como cancelled pero hasStamp es true
  // - El progreso se conserva: 1 de 2
  const res = await pedir(ctx, 'usuaria', 'GET', `/passport/routes/${idRuta}`);
  assert.equal(res.status, 200);
  assert.equal(res.json.inReview, true);
  assert.equal(res.json.progress.current, 1);
  assert.equal(res.json.progress.formatted, '1 de 2');

  const fCanc = res.json.functions.find((f) => f.functionId === 'f-cancelable');
  assert.equal(fCanc.status, 'cancelled');
  assert.equal(fCanc.hasStamp, true);
});

test('SC-009: aislamiento de progreso entre usuarios', async () => {
  const ctx = await crearApp();
  const fids = ['f-obra', 'f-danza'];
  const refs = await prepararFuncionesConPasaporte(ctx, fids);

  const rRuta = await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    functionIds: fids,
    goal: 2,
    publish: true,
  });
  const idRuta = rRuta.json.id;

  // Usuaria canjea f-obra
  await reclamar(ctx, 'usuaria', refs.get('f-obra'));

  // Usuaria ve 1 de 2
  const resUsuaria = await pedir(ctx, 'usuaria', 'GET', `/passport/routes/${idRuta}`);
  assert.equal(resUsuaria.json.progress.current, 1);
  assert.equal(resUsuaria.json.progress.formatted, '1 de 2');

  // Usuario2 no ha canjeado nada: ve 0 de 2
  const resUsuario2 = await pedir(ctx, 'usuario2', 'GET', `/passport/routes/${idRuta}`);
  assert.equal(resUsuario2.json.progress.current, 0);
  assert.equal(resUsuario2.json.progress.formatted, '0 de 2');

  // Visitante sin autenticación: progress es null
  const resVisitante = await pedir(ctx, null, 'GET', `/passport/routes/${idRuta}`);
  assert.equal(resVisitante.json.progress, null);
});

test('SC-003, M-01: denominador propio «X de Y» sin proyectarlo a la meta global del pasaporte', async () => {
  const ctx = await crearApp();
  const fids = ['f-obra', 'f-danza'];
  const refs = await prepararFuncionesConPasaporte(ctx, fids);

  await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    title: 'Ruta Denominador Propio',
    functionIds: fids,
    goal: 2,
    publish: true,
  });

  await reclamar(ctx, 'usuaria', refs.get('f-obra'));

  // Consulta global de pasaporte (M-01)
  const resPasaporte = await pedir(ctx, 'usuaria', 'GET', '/passport');
  assert.equal(resPasaporte.status, 200);
  assert.equal(resPasaporte.json.total, 1);
  assert.equal(resPasaporte.json.goal, undefined, 'Mi pasaporte no tiene meta global');
  assert.equal(resPasaporte.json.progress, undefined, 'Mi pasaporte no proyecta progreso global');
});
