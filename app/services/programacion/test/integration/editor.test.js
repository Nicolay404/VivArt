import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir, catalogos, contenido } from '../helpers.js';

// Historia 3: el editor prepara y envía a revisión (FR-008, FR-009, FR-030; SC-005, SC-012, SC-013).

test('FR-030, SC-012: el borrador se guarda incompleto; enviarlo exige título, categoría y una función o franja válida', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const vacio = await pedir(ctx, 'editor', 'POST', '/panel/activities', {});
  assert.equal(vacio.status, 201);
  assert.equal(vacio.json.editorialState, 'draft');
  assert.deepEqual(Object.keys(vacio.json.missingForSubmit).sort(), ['categoryId', 'functions', 'title']);

  const sinCampos = await pedir(ctx, 'editor', 'POST', `/panel/activities/${vacio.json.id}/submit`, { version: vacio.json.version });
  assert.equal(sinCampos.status, 422);
  assert.deepEqual(Object.keys(sinCampos.json.fields).sort(), ['categoryId', 'functions', 'title']);

  // Función sin hora y franja sin días: inválidas, no se envía (escenario 9)
  const guardado = await pedir(ctx, 'editor', 'PUT', `/panel/activities/${vacio.json.id}/draft`, {
    version: vacio.json.version,
    content: { title: 'Obra', categoryId: c.teatro.id, functions: [{ date: '2026-11-21', venueId: c.museo.id }], slots: [{ venueId: c.museo.id, opens: '10:00', closes: '14:00' }] },
  });
  assert.equal(guardado.status, 200);
  const invalida = await pedir(ctx, 'editor', 'POST', `/panel/activities/${vacio.json.id}/submit`, { version: guardado.json.version });
  assert.equal(invalida.status, 422);
  assert.ok(invalida.json.fields['functions[0].startTime']);
  assert.ok(invalida.json.fields['slots[0].dates']);
});

test('FR-030, SC-013: duración, descripción y precio pueden quedar pendientes; sin precio no hay gratuidad ni venta', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const a = await pedir(ctx, 'editor', 'POST', '/panel/activities', {
    content: { title: 'Sin precio', categoryId: c.teatro.id, access: { mode: 'paid' }, functions: [{ date: '2026-11-21', startTime: '19:00', venueId: c.museo.id }] },
  });
  const enviada = await pedir(ctx, 'editor', 'POST', `/panel/activities/${a.json.id}/submit`, { version: a.json.version });
  assert.equal(enviada.status, 200);
  assert.equal(enviada.json.editorialState, 'in_review');
  assert.deepEqual(enviada.json.working.access, { mode: 'paid', priceUsd: null });
  assert.ok(!('sales' in enviada.json) && !JSON.stringify(enviada.json).includes('salesEnabled'));

  const previa = await pedir(ctx, 'editor', 'GET', `/panel/activities/${a.json.id}/preview`);
  assert.equal(previa.json.access.label, 'De pago: precio por confirmar');
  assert.ok(previa.json.pending.includes('price'));
  assert.ok(previa.json.pending.includes('duration'));
  assert.ok(previa.json.pending.includes('description'));
});

test('FR-009: enviada la propuesta, el editor no la modifica hasta que se la devuelvan', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const a = (await pedir(ctx, 'editor', 'POST', '/panel/activities', { content: contenido(c) })).json;
  const enviada = (await pedir(ctx, 'editor', 'POST', `/panel/activities/${a.id}/submit`, { version: a.version })).json;
  const intento = await pedir(ctx, 'editor', 'PUT', `/panel/activities/${a.id}/draft`, { version: enviada.version, content: contenido(c, { title: 'Cambio' }) });
  assert.equal(intento.status, 409);
  assert.equal(intento.json.error, 'not_editable');
});

test('FR-008, SC-005: el editor no publica, ni con una solicitud directa, y no edita ni ve borradores ajenos', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const a = (await pedir(ctx, 'editor', 'POST', '/panel/activities', { content: contenido(c, { title: 'Secreto de otra persona' }) })).json;
  const enviada = (await pedir(ctx, 'editor', 'POST', `/panel/activities/${a.id}/submit`, { version: a.version })).json;
  const publicar = await pedir(ctx, 'editor', 'POST', `/panel/activities/${a.id}/publish`, { version: enviada.version });
  assert.equal(publicar.status, 403);
  assert.equal(publicar.json.missingRole, 'publicador');

  for (const [metodo, ruta, cuerpo] of [
    ['GET', `/panel/activities/${a.id}`],
    ['PUT', `/panel/activities/${a.id}/draft`, { version: enviada.version, content: {} }],
    ['GET', `/panel/activities/${a.id}/preview`],
  ]) {
    const r = await pedir(ctx, 'editora2', metodo, ruta, cuerpo);
    assert.equal(r.status, 403, ruta);
    assert.ok(!r.body.includes('Secreto'), 'el rechazo no revela contenido ajeno');
  }
  // un usuario sin rol interno no entra al panel
  assert.equal((await pedir(ctx, 'usuario', 'GET', '/panel/activities')).status, 403);
  assert.equal((await pedir(ctx, 'usuario', 'POST', '/panel/activities', {})).status, 403);
  // la bandeja del editor solo trae lo suyo
  await pedir(ctx, 'editora2', 'POST', '/panel/activities', { content: { title: 'De la otra editora' } });
  const bandeja = await pedir(ctx, 'editor', 'GET', '/panel/activities');
  assert.deepEqual(bandeja.json.items.map((x) => x.title), ['Secreto de otra persona']);
});

test('Historia 3: la actividad permanente registra franjas (varias por día) y una función puntual aparte', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const a = await pedir(ctx, 'editor', 'POST', '/panel/activities', {
    content: {
      title: 'Exposición permanente de ejemplo',
      categoryId: c.teatro.id,
      slots: [
        { venueId: c.museo.id, from: '2026-11-20', to: '2026-11-30', opens: '10:00', closes: '14:00' },
        { venueId: c.museo.id, from: '2026-11-20', to: '2026-11-30', opens: '15:00', closes: '19:30' },
      ],
      functions: [{ date: '2026-11-22', startTime: '11:00', venueId: c.museo.id }],
    },
  });
  assert.equal(a.json.working.slots.length, 2);
  assert.equal(a.json.working.functions.length, 1);
  assert.ok(a.json.working.slots.every((s) => s.id.startsWith('fr_')));
  const enviada = await pedir(ctx, 'editor', 'POST', `/panel/activities/${a.json.id}/submit`, { version: a.json.version });
  assert.equal(enviada.status, 200);
});

test('edición simultánea: si otra persona guardó antes, el segundo guardado no sobrescribe', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const a = (await pedir(ctx, 'editor', 'POST', '/panel/activities', { content: contenido(c) })).json;
  const primero = await pedir(ctx, 'publicador', 'PUT', `/panel/activities/${a.id}/draft`, { version: a.version, content: contenido(c, { title: 'Primero' }) });
  assert.equal(primero.status, 200);
  const segundo = await pedir(ctx, 'editor', 'PUT', `/panel/activities/${a.id}/draft`, { version: a.version, content: contenido(c, { title: 'Segundo' }) });
  assert.equal(segundo.status, 409);
  assert.equal(segundo.json.error, 'version_conflict');
  assert.equal((await pedir(ctx, 'editor', 'GET', `/panel/activities/${a.id}`)).json.working.title, 'Primero');
});
