import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir } from '../helpers.js';
import { qrActivo } from '../pasaporte-ayuda.js';
import { DATOS_RUTA_DEFECTO, prepararFuncionesConPasaporte } from '../rutas-ayuda.js';

test('US4: el administrador crea una ruta en borrador y la publica', async () => {
  const ctx = await crearApp();
  await prepararFuncionesConPasaporte(ctx, ['f-obra', 'f-danza', 'f-sin-fin']);

  // 1. Crear en borrador
  const r1 = await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    functionIds: ['f-obra', 'f-danza', 'f-sin-fin'],
    goal: 2,
    publish: false,
  });
  assert.equal(r1.status, 201);
  assert.equal(r1.json.status, 'draft');
  assert.equal(r1.json.title, DATOS_RUTA_DEFECTO.title);
  assert.equal(r1.json.goal, 2);
  assert.equal(r1.json.functionIds.length, 3);
  assert.equal(r1.json.inReview, false);

  const routeId = r1.json.id;

  // 2. Listar rutas en el panel administrativo
  const lista = await pedir(ctx, 'admin', 'GET', '/panel/routes');
  assert.equal(lista.status, 200);
  const encontrada = lista.json.items.find((item) => item.id === routeId);
  assert.ok(encontrada);
  assert.equal(encontrada.status, 'draft');
  assert.equal(encontrada.functionsCount, 3);

  // 3. Editar ruta para publicarla y cambiar la meta a 3
  const r2 = await pedir(ctx, 'admin', 'PUT', `/panel/routes/${routeId}`, {
    goal: 3,
    status: 'published',
  });
  assert.equal(r2.status, 200);
  assert.equal(r2.json.status, 'published');
  assert.equal(r2.json.goal, 3);

  // 4. Verificar detalle administrativo
  const r3 = await pedir(ctx, 'admin', 'GET', `/panel/routes/${routeId}`);
  assert.equal(r3.status, 200);
  assert.equal(r3.json.status, 'published');
  assert.equal(r3.json.badgeTitle, DATOS_RUTA_DEFECTO.badgeTitle);
  assert.equal(r3.json.badgeIcon, DATOS_RUTA_DEFECTO.badgeIcon);
  assert.equal(r3.json.badgeColor, DATOS_RUTA_DEFECTO.badgeColor);
});

test('SC-007, FR-003: rechaza una meta mayor al número de funciones elegibles', async () => {
  const ctx = await crearApp();
  await prepararFuncionesConPasaporte(ctx, ['f-obra', 'f-danza']);

  // Intento con 2 funciones y meta 3
  const r = await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    functionIds: ['f-obra', 'f-danza'],
    goal: 3,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error, 'unreachable_goal');
  assert.match(r.json.message, /no puede ser mayor/);
});

test('SC-006, FR-002: rechaza funciones sin pasaporte habilitado o inexistentes', async () => {
  const ctx = await crearApp();
  // f-obra tiene QR activo, pero f-danza NO tiene QR generado
  await qrActivo(ctx, 'f-obra');

  const rSinPasaporte = await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    functionIds: ['f-obra', 'f-danza'],
    goal: 1,
  });
  assert.equal(rSinPasaporte.status, 422);
  assert.equal(rSinPasaporte.json.error, 'ineligible_function');
  assert.match(rSinPasaporte.json.message, /no tiene el Pasaporte habilitado/);

  const rInexistente = await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    functionIds: ['f-obra', 'f-fantasma-no-existe'],
    goal: 1,
  });
  assert.equal(rInexistente.status, 422);
  assert.equal(rInexistente.json.error, 'ineligible_function');
  assert.match(rInexistente.json.message, /no existe/);
});

test('SC-008, FR-005: solo el administrador gestiona rutas; otros roles reciben 403 y sin sesión 401', async () => {
  const ctx = await crearApp();
  await prepararFuncionesConPasaporte(ctx, ['f-obra']);

  // Sin sesión: 401
  const rAnon = await pedir(ctx, null, 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    functionIds: ['f-obra'],
    goal: 1,
  });
  assert.equal(rAnon.status, 401);

  // Otros roles internos o registrados: 403
  for (const rol of ['usuaria', 'editor', 'publicador', 'acceso']) {
    const rPost = await pedir(ctx, rol, 'POST', '/panel/routes', {
      ...DATOS_RUTA_DEFECTO,
      functionIds: ['f-obra'],
      goal: 1,
    });
    assert.equal(rPost.status, 403, `Rol ${rol} debe recibir 403 en POST`);

    const rGet = await pedir(ctx, rol, 'GET', '/panel/routes');
    assert.equal(rGet.status, 403, `Rol ${rol} debe recibir 403 en GET`);
  }
});

test('SC-010, FR-007: los cambios sobre rutas quedan registrados en el historial de solo anexar', async () => {
  const ctx = await crearApp();
  await prepararFuncionesConPasaporte(ctx, ['f-obra', 'f-danza']);

  // 1. Crear ruta
  const creada = await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    functionIds: ['f-obra', 'f-danza'],
    goal: 2,
    publish: true,
  });
  assert.equal(creada.status, 201);
  const routeId = creada.json.id;

  // 2. Editar ruta
  const editada = await pedir(ctx, 'admin', 'PUT', `/panel/routes/${routeId}`, {
    title: 'Ruta Modificada de Loja',
  });
  assert.equal(editada.status, 200);

  // 3. Consultar historial
  const filasHistorial = await ctx.services.db.query(
    "SELECT action, entity_type, entity_id, actor_id FROM history WHERE entity_type = 'route' AND entity_id = $1 ORDER BY id ASC",
    [routeId],
  );
  assert.equal(filasHistorial.length, 2);
  assert.equal(filasHistorial[0].action, 'route.created');
  assert.equal(filasHistorial[0].actor_id, 'u-admin');
  assert.equal(filasHistorial[1].action, 'route.updated');
  assert.equal(filasHistorial[1].actor_id, 'u-admin');
});

test('SC-013, FR-021: plantillas visuales con catálogo cerrado de iconos y colores sin subir archivos', async () => {
  const ctx = await crearApp();
  await prepararFuncionesConPasaporte(ctx, ['f-obra']);

  // Icono inválido
  const rIconoInvalido = await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    badgeIcon: 'alien',
    functionIds: ['f-obra'],
    goal: 1,
  });
  assert.equal(rIconoInvalido.status, 400);

  // Color inválido
  const rColorInvalido = await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    badgeColor: 'rosado-neon',
    functionIds: ['f-obra'],
    goal: 1,
  });
  assert.equal(rColorInvalido.status, 400);
});
