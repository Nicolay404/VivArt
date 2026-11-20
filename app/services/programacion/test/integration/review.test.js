import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir, catalogos, contenido, publicada } from '../helpers.js';

// Historia 4: revisar, devolver y publicar (FR-010 a FR-014, FR-032; SC-005, SC-006, SC-015).

test('FR-032, SC-015: devolver deja «Devuelta» con observaciones en el panel; el editor corrige y reenvía; sin correos', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const a = (await pedir(ctx, 'editor', 'POST', '/panel/activities', { content: contenido(c) })).json;
  const enviada = (await pedir(ctx, 'editor', 'POST', `/panel/activities/${a.id}/submit`, { version: a.version })).json;

  // El publicador ve las propuestas de todos los editores (FR-012)
  const bandeja = await pedir(ctx, 'publicador', 'GET', '/panel/activities?state=in_review');
  assert.deepEqual(bandeja.json.items.map((x) => x.id), [a.id]);

  assert.equal((await pedir(ctx, 'publicador', 'POST', `/panel/activities/${a.id}/return`, { version: enviada.version, notes: '' })).status, 422);
  const devuelta = await pedir(ctx, 'publicador', 'POST', `/panel/activities/${a.id}/return`, { version: enviada.version, notes: 'Falta confirmar la sede.' });
  assert.equal(devuelta.status, 200);
  assert.equal(devuelta.json.editorialState, 'returned');

  const vista = await pedir(ctx, 'editor', 'GET', `/panel/activities/${a.id}`);
  assert.equal(vista.json.reviewNotes, 'Falta confirmar la sede.');
  const corregida = await pedir(ctx, 'editor', 'PUT', `/panel/activities/${a.id}/draft`, { version: vista.json.version, content: contenido(c, { title: 'Corregida' }) });
  assert.equal(corregida.status, 200);
  assert.equal(corregida.json.editorialState, 'returned');
  const reenviada = await pedir(ctx, 'editor', 'POST', `/panel/activities/${a.id}/submit`, { version: corregida.json.version });
  assert.equal(reenviada.json.editorialState, 'in_review');
  // Este servicio no tiene ningún transporte de correo: no hay avisos editoriales por correo
  assert.ok(!('mailer' in ctx.services));
});

test('FR-012, FR-014: el publicador publica, también lo que él mismo preparó; publicar no activa ventas', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const propia = (await pedir(ctx, 'publicador', 'POST', '/panel/activities', { content: contenido(c, { title: 'Propia' }) })).json;
  const r = await pedir(ctx, 'publicador', 'POST', `/panel/activities/${propia.id}/publish`, { version: propia.version });
  assert.equal(r.status, 200);
  assert.equal(r.json.published, true);
  assert.equal(r.json.editorialState, 'none');
  const ficha = await pedir(ctx, null, 'GET', `/activities/${propia.id}`);
  assert.equal(ficha.status, 200);
  assert.ok(!/sale|venta|cart|carrito/i.test(JSON.stringify(Object.keys(ficha.json))));
  // tampoco hay ninguna ruta de venta en este servicio
  for (const ruta of ['/panel/functions/x/sales', '/sales', '/panel/activities/x/sales']) {
    assert.equal((await pedir(ctx, 'admin', 'POST', ruta, {})).status, 404);
  }
});

test('FR-011, SC-006: editar una ficha publicada crea una versión pendiente; el público sigue viendo lo publicado', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const a = await publicada(ctx, c, { title: 'Versión publicada' });
  const editada = await pedir(ctx, 'editor', 'PUT', `/panel/activities/${a.id}/draft`, { version: a.version, content: contenido(c, { title: 'Versión nueva' }) });
  assert.equal(editada.status, 200);
  assert.equal(editada.json.editorialState, 'draft');
  await pedir(ctx, 'editor', 'POST', `/panel/activities/${a.id}/submit`, { version: editada.json.version });

  assert.equal((await pedir(ctx, null, 'GET', `/activities/${a.id}`)).json.title, 'Versión publicada');
  assert.deepEqual((await pedir(ctx, null, 'GET', '/agenda?q=nueva')).json.items, []);
  assert.equal((await pedir(ctx, null, 'GET', '/agenda?q=publicada')).json.items.length, 1);

  // descartar la revisión pendiente deja lo publicado
  const actual = (await pedir(ctx, 'publicador', 'GET', `/panel/activities/${a.id}`)).json;
  const descartada = await pedir(ctx, 'publicador', 'POST', `/panel/activities/${a.id}/discard-revision`, { version: actual.version });
  assert.equal(descartada.status, 200);
  assert.equal(descartada.json.working, null);
  assert.equal((await pedir(ctx, null, 'GET', `/activities/${a.id}`)).json.title, 'Versión publicada');
});

test('FR-015, FR-019: publicar una revisión que mueve o quita funciones exige motivo y aviso; corregir el texto no', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const a = await publicada(ctx, c);
  const funcion = a.publishedContent.functions[0];

  // corrección de texto y categoría: sin aviso
  let v = (await pedir(ctx, 'publicador', 'PUT', `/panel/activities/${a.id}/draft`, { version: a.version, content: { ...a.publishedContent, title: 'Título corregido', categoryId: c.danza.id } })).json.version;
  let r = await pedir(ctx, 'publicador', 'POST', `/panel/activities/${a.id}/publish`, { version: v });
  assert.equal(r.status, 200);
  assert.equal(r.json.notices?.length ?? 0, 0);

  // cambiar la hora de una función publicada: exige aviso
  const movida = { ...r.json.publishedContent, functions: [{ ...funcion, startTime: '20:30' }] };
  v = (await pedir(ctx, 'publicador', 'PUT', `/panel/activities/${a.id}/draft`, { version: r.json.version, content: movida })).json.version;
  r = await pedir(ctx, 'publicador', 'POST', `/panel/activities/${a.id}/publish`, { version: v });
  assert.equal(r.status, 422);
  assert.equal(r.json.error, 'notice_required');
  r = await pedir(ctx, 'publicador', 'POST', `/panel/activities/${a.id}/publish`, { version: v, reason: 'Cambio de la compañía', notice: 'La función empieza a las 20:30.' });
  assert.equal(r.status, 200);
  const ficha = (await pedir(ctx, null, 'GET', `/activities/${a.id}`)).json;
  assert.equal(ficha.functions[0].startTime, '20:30');
  assert.equal(ficha.notices[0].text, 'La función empieza a las 20:30.');
  assert.ok(!JSON.stringify(ficha).includes('Cambio de la compañía'), 'el motivo interno no es público');

  // quitar la función publicada la cancela, no la borra (FR-027)
  v = (await pedir(ctx, 'publicador', 'PUT', `/panel/activities/${a.id}/draft`, { version: r.json.version, content: { ...r.json.publishedContent, functions: [{ date: '2026-11-25', startTime: '18:00', venueId: c.plaza.id }] } })).json.version;
  r = await pedir(ctx, 'publicador', 'POST', `/panel/activities/${a.id}/publish`, { version: v, reason: 'Sin sala', notice: 'Se cancela la función del 21; hay una nueva el 25.' });
  assert.equal(r.status, 200);
  const estados = (await pedir(ctx, null, 'GET', `/activities/${a.id}`)).json.functions.map((f) => [f.id === funcion.id, f.status]);
  assert.deepEqual(estados.sort(), [[false, 'scheduled'], [true, 'cancelled']]);
});

test('FR-010: solo el administrador reasigna; la nueva persona continúa y queda en el historial', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const a = (await pedir(ctx, 'editor', 'POST', '/panel/activities', { content: contenido(c) })).json;
  assert.equal((await pedir(ctx, 'publicador', 'POST', `/panel/activities/${a.id}/reassign`, { ownerId: 'u-editora2' })).status, 403);
  const r = await pedir(ctx, 'admin', 'POST', `/panel/activities/${a.id}/reassign`, { ownerId: 'u-editora2' });
  assert.equal(r.json.ownerId, 'u-editora2');
  assert.equal((await pedir(ctx, 'editora2', 'PUT', `/panel/activities/${a.id}/draft`, { version: r.json.version, content: contenido(c) })).status, 200);
  assert.equal((await pedir(ctx, 'editor', 'GET', `/panel/activities/${a.id}`)).status, 403);
  const historial = (await pedir(ctx, 'admin', 'GET', `/panel/activities/${a.id}/history`)).json.entries.map((e) => e.action);
  assert.ok(historial.includes('activity.reassigned'));
});

test('FR-013, SC-005: cada cambio queda en el historial y ningún rol sin permiso publica', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const a = await publicada(ctx, c);
  const historial = (await pedir(ctx, 'editor', 'GET', `/panel/activities/${a.id}/history`)).json.entries;
  assert.deepEqual(historial.map((e) => e.action).reverse(), ['activity.created', 'draft.submitted', 'activity.published']);
  assert.ok(historial.every((e) => e.actorId && e.at));
  for (const quien of ['editor', 'usuario', 'acceso', null]) {
    const r = await pedir(ctx, quien, 'POST', `/panel/activities/${a.id}/publish`, { version: a.version });
    assert.ok([401, 403].includes(r.status), String(quien));
  }
  await assert.rejects(() => ctx.services.db.run("UPDATE history SET action = 'x'"), /solo anexar/);
});
