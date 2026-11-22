import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir } from '../helpers.js';
import { DATOS_RUTA_DEFECTO, prepararFuncionesConPasaporte } from '../rutas-ayuda.js';
import { reclamar } from '../pasaporte-ayuda.js';

test('SC-004, FR-017: usuario alcanza meta y se desbloquea insignia con aviso en el canje', async () => {
  const ctx = await crearApp();
  const fids = ['f-obra', 'f-danza'];
  const refs = await prepararFuncionesConPasaporte(ctx, fids);

  // Crear ruta con meta 2
  const rRuta = await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    title: 'Ruta Insignia Test',
    badgeTitle: 'Gran Espectador',
    functionIds: fids,
    goal: 2,
    publish: true,
  });
  assert.equal(rRuta.status, 201);
  const idRuta = rRuta.json.id;

  // 1. Canje del primer sello: no completa la meta => badgeUnlocked es null
  const c1 = await reclamar(ctx, 'usuaria', refs.get('f-obra'));
  assert.equal(c1.status, 201);
  assert.equal(c1.json.badgeUnlocked, null);

  // Consulta de insignias del usuario: vacía
  const resBadges0 = await pedir(ctx, 'usuaria', 'GET', '/passport/badges');
  assert.equal(resBadges0.status, 200);
  assert.equal(resBadges0.json.items.length, 0);

  // 2. Canje del segundo sello: completa la meta (2 de 2) => badgeUnlocked presente
  const c2 = await reclamar(ctx, 'usuaria', refs.get('f-danza'));
  assert.equal(c2.status, 201);
  assert.ok(c2.json.badgeUnlocked, 'El canje debió retornar badgeUnlocked');
  assert.equal(c2.json.badgeUnlocked.routeId, idRuta);
  assert.equal(c2.json.badgeUnlocked.title, 'Gran Espectador');
  assert.equal(c2.json.badgeUnlocked.icon, DATOS_RUTA_DEFECTO.badgeIcon);
  assert.equal(c2.json.badgeUnlocked.color, DATOS_RUTA_DEFECTO.badgeColor);

  // Consulta de insignias del usuario: 1 insignia
  const resBadges1 = await pedir(ctx, 'usuaria', 'GET', '/passport/badges');
  assert.equal(resBadges1.status, 200);
  assert.equal(resBadges1.json.items.length, 1);
  assert.equal(resBadges1.json.items[0].routeId, idRuta);
  assert.equal(resBadges1.json.items[0].title, 'Gran Espectador');
  assert.equal(resBadges1.json.items[0].stampCountAtUnlock, 2);

  // En la ruta: progress.unlockedBadge es true
  const resRuta = await pedir(ctx, 'usuaria', 'GET', `/passport/routes/${idRuta}`);
  assert.equal(resRuta.json.progress.completed, true);
  assert.equal(resRuta.json.progress.unlockedBadge, true);
});

test('SC-004, RC-05, RNF-06: 10 peticiones concurrentes otorgan exactamente 1 fila en user_badges', async () => {
  const ctx = await crearApp();
  const fids = ['f-obra', 'f-danza'];
  const refs = await prepararFuncionesConPasaporte(ctx, fids);

  const rRuta = await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    title: 'Ruta Concurrencia',
    badgeTitle: 'Insignia Robusta',
    functionIds: fids,
    goal: 1, // Con 1 sello ya alcanza la meta
    publish: true,
  });
  const idRuta = rRuta.json.id;

  // Lanzar 10 canjes simultáneos de f-obra para la misma usuaria
  const promesas = Array.from({ length: 10 }, () => reclamar(ctx, 'usuaria', refs.get('f-obra')));
  const resultados = await Promise.all(promesas);

  // Exactamente 1 debió ser creado (201) y los otros 9 debieron ser idempotentes (200)
  const creados = resultados.filter((r) => r.status === 201);
  assert.equal(creados.length, 1);

  // Verificar directamente en PostgreSQL que en user_badges haya exactamente 1 fila
  const filas = await ctx.services.db.query(
    'SELECT * FROM user_badges WHERE user_id = $1 AND route_id = $2',
    ['u-usuaria', idRuta],
  );
  assert.equal(filas.length, 1, 'Debe haber exactamente 1 fila en user_badges');

  // En el historial (history) debe haberse registrado exactamente 1 evento badge.unlocked
  const eventos = await ctx.services.db.query(
    "SELECT * FROM history WHERE entity_type = 'badge' AND action = 'badge.unlocked'",
  );
  assert.equal(eventos.length, 1, 'Debe haber exactamente 1 registro badge.unlocked en history');
});

test('SC-005: editar la ruta posteriormente retira 0 insignias', async () => {
  const ctx = await crearApp();
  const fids = ['f-obra', 'f-danza', 'f-sin-fin'];
  const refs = await prepararFuncionesConPasaporte(ctx, fids);

  // Crear ruta con meta 2 y fids: f-obra, f-danza
  const rRuta = await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    title: 'Ruta Editable',
    badgeTitle: 'Insignia Permanente',
    functionIds: ['f-obra', 'f-danza'],
    goal: 2,
    publish: true,
  });
  const idRuta = rRuta.json.id;

  // Usuaria completa la ruta
  await reclamar(ctx, 'usuaria', refs.get('f-obra'));
  const canjeFinal = await reclamar(ctx, 'usuaria', refs.get('f-danza'));
  assert.ok(canjeFinal.json.badgeUnlocked);

  // El administrador edita la ruta: sube la meta a 3 y cambia funciones
  const rEdit = await pedir(ctx, 'admin', 'PUT', `/panel/routes/${idRuta}`, {
    title: 'Ruta Editable Modificada',
    goal: 3,
    functionIds: ['f-obra', 'f-danza', 'f-sin-fin'],
  });
  assert.equal(rEdit.status, 200);

  // La usuaria aún conserva su insignia (SC-005)
  const resBadges = await pedir(ctx, 'usuaria', 'GET', '/passport/badges');
  assert.equal(resBadges.json.items.length, 1);
  assert.equal(resBadges.json.items[0].routeId, idRuta);

  // En la consulta de la ruta: su insignia ganada permanece visible
  const resRuta = await pedir(ctx, 'usuaria', 'GET', `/passport/routes/${idRuta}`);
  assert.equal(resRuta.json.progress.unlockedBadge, true);
});

test('SC-009: aislamiento de insignias entre usuarios', async () => {
  const ctx = await crearApp();
  const fids = ['f-obra'];
  const refs = await prepararFuncionesConPasaporte(ctx, fids);

  const rRuta = await pedir(ctx, 'admin', 'POST', '/panel/routes', {
    ...DATOS_RUTA_DEFECTO,
    functionIds: fids,
    goal: 1,
    publish: true,
  });
  const idRuta = rRuta.json.id;

  // Usuaria desbloquea la insignia
  await reclamar(ctx, 'usuaria', refs.get('f-obra'));

  // Usuaria ve su insignia
  const b1 = await pedir(ctx, 'usuaria', 'GET', '/passport/badges');
  assert.equal(b1.json.items.length, 1);

  // Usuario2 no tiene insignias
  const b2 = await pedir(ctx, 'usuario2', 'GET', '/passport/badges');
  assert.equal(b2.json.items.length, 0);

  // Visitante sin autenticación no puede consultar insignias
  const bVisitante = await pedir(ctx, null, 'GET', '/passport/badges');
  assert.equal(bVisitante.status, 401);
});
