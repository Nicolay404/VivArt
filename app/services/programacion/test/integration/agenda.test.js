import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir, catalogos, contenido, publicada, relojMovible } from '../helpers.js';

// Historia 1: Agenda y fichas (FR-001 a FR-004; SC-001 a SC-003, SC-013).

test('SC-001: solo aparecen las publicadas; nunca borradores, propuestas, devueltas ni archivadas', async () => {
  const ctx = await crearApp({ reloj: relojMovible('2026-11-20T09:00:00-05:00') });
  const c = await catalogos(ctx);
  const visible = await publicada(ctx, c, { title: 'Publicada' });
  await pedir(ctx, 'editor', 'POST', '/panel/activities', { content: contenido(c, { title: 'Borrador' }) });
  const enRevision = (await pedir(ctx, 'editor', 'POST', '/panel/activities', { content: contenido(c, { title: 'En revisión' }) })).json;
  await pedir(ctx, 'editor', 'POST', `/panel/activities/${enRevision.id}/submit`, { version: enRevision.version });
  const archivar = await publicada(ctx, c, { title: 'Archivada', functions: [{ date: '2026-11-19', startTime: '10:00', venueId: c.museo.id }] });
  assert.equal((await pedir(ctx, 'admin', 'POST', `/panel/activities/${archivar.id}/archive`)).status, 200);

  const agenda = await pedir(ctx, null, 'GET', '/agenda');
  assert.equal(agenda.status, 200);
  assert.deepEqual(agenda.json.items.map((i) => i.title), ['Publicada']);
  assert.equal(agenda.json.reference.timeZone, 'America/Guayaquil');
  assert.equal((await pedir(ctx, null, 'GET', `/activities/${visible.id}`)).status, 200);
  assert.equal((await pedir(ctx, null, 'GET', `/activities/${enRevision.id}`)).status, 404);
  assert.equal((await pedir(ctx, null, 'GET', `/activities/${archivar.id}`)).status, 404);
});

test('FR-001, SC-002: busca por título, artista u organización sin distinguir tildes ni mayúsculas', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  await publicada(ctx, c, { title: 'Canción del Río', artists: ['Elenco Ñandú'] });
  await publicada(ctx, c, { title: 'Otra obra', artists: ['Grupo Sur'] });
  const ids = async (q) => (await pedir(ctx, null, 'GET', `/agenda?q=${encodeURIComponent(q)}`)).json.items.map((i) => i.title);
  assert.deepEqual(await ids('cancion'), ['Canción del Río']);
  assert.deepEqual(await ids('ÑANDÚ'), ['Canción del Río']);
  assert.deepEqual(await ids('grupo sur'), ['Otra obra']);
  assert.deepEqual(await ids('nada que coincida'), []);
});

test('FR-002, SC-002: los cuatro filtros se combinan (fecha, categoría, sede y modalidad de acceso)', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  await publicada(ctx, c, { title: 'A', categoryId: c.teatro.id, access: { mode: 'free' }, functions: [{ date: '2026-11-21', startTime: '19:00', venueId: c.museo.id }] });
  await publicada(ctx, c, { title: 'B', categoryId: c.danza.id, access: { mode: 'free' }, functions: [{ date: '2026-11-21', startTime: '19:00', venueId: c.museo.id }] });
  await publicada(ctx, c, { title: 'C', categoryId: c.teatro.id, access: { mode: 'paid', priceUsd: 3 }, functions: [{ date: '2026-11-21', startTime: '19:00', venueId: c.museo.id }] });
  await publicada(ctx, c, { title: 'D', categoryId: c.teatro.id, access: { mode: 'free' }, functions: [{ date: '2026-11-22', startTime: '19:00', venueId: c.museo.id }] });
  await publicada(ctx, c, { title: 'E', categoryId: c.teatro.id, access: { mode: 'free' }, functions: [{ date: '2026-11-21', startTime: '19:00', venueId: c.plaza.id }] });
  // Franja de una exposición que abre ese día en el museo
  await publicada(ctx, c, { title: 'F', categoryId: c.teatro.id, access: { mode: 'free' }, functions: [], slots: [{ venueId: c.museo.id, from: '2026-11-20', to: '2026-11-23', opens: '10:00', closes: '18:00' }] });

  const q = `/agenda?date=2026-11-21&categoryId=${c.teatro.id}&venueId=${c.museo.id}&access=free`;
  assert.deepEqual((await pedir(ctx, null, 'GET', q)).json.items.map((i) => i.title).sort(), ['A', 'F']);
  assert.deepEqual((await pedir(ctx, null, 'GET', `/agenda?access=paid`)).json.items.map((i) => i.title), ['C']);
  assert.deepEqual((await pedir(ctx, null, 'GET', `/agenda?venueId=${c.plaza.id}`)).json.items.map((i) => i.title), ['E']);
});

test('FR-003, FR-004, SC-003: la ficha muestra lo confirmado y marca como pendiente lo que falta, sin deducirlo', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const completa = await publicada(ctx, c, { durationMinutes: 60, access: { mode: 'paid', priceUsd: 5 } });
  const ficha = (await pedir(ctx, null, 'GET', `/activities/${completa.id}`)).json;
  assert.equal(ficha.shareUrl, `/actividad/${completa.id}`);
  assert.equal(ficha.organization, 'Colectivo de Prueba');
  assert.equal(ficha.category.name, 'Teatro');
  assert.equal(ficha.functions[0].venue.name, 'Museo de Ejemplo');
  assert.equal(ficha.access.label, 'De pago: USD 5,00');
  assert.deepEqual(ficha.pending, []);
  assert.equal(ficha.subjectToChange, true);

  const incompleta = await publicada(ctx, c, { title: 'Incompleta', description: null, organization: null, access: { mode: 'unconfirmed' } });
  const f2 = (await pedir(ctx, null, 'GET', `/activities/${incompleta.id}`)).json;
  assert.equal(f2.description, null);
  assert.equal(f2.durationMinutes, null);
  assert.equal(f2.functions[0].endTime, null);
  assert.equal(f2.access.priceUsd, null);
  assert.equal(f2.access.label, 'Acceso por confirmar');
  assert.deepEqual(f2.pending.sort(), ['access', 'description', 'duration', 'organization']);
});

test('SC-013: una función sin precio queda sin precio y sin marca de gratuita', async () => {
  const ctx = await crearApp();
  const c = await catalogos(ctx);
  const a = await publicada(ctx, c, { access: { mode: 'paid' } });
  const ficha = (await pedir(ctx, null, 'GET', `/activities/${a.id}`)).json;
  assert.deepEqual([ficha.access.mode, ficha.access.priceUsd], ['paid', null]);
  assert.ok(ficha.pending.includes('price'));
  assert.equal((await pedir(ctx, null, 'GET', '/agenda?access=free')).json.items.length, 0);
});

test('la Agenda vacía responde sin errores y la consulta pública no pide sesión ni llama a identidad', async () => {
  const ctx = await crearApp();
  const antes = ctx.identidad.estado.llamadas;
  const r = await pedir(ctx, null, 'GET', '/agenda');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.items, []);
  assert.equal((await pedir(ctx, null, 'GET', '/now')).status, 200);
  assert.equal(ctx.identidad.estado.llamadas, antes);
});
