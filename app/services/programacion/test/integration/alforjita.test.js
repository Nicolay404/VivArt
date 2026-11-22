import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { crearApp, pedir, catalogos, publicada, contenido, relojMovible } from '../helpers.js';

// Spec 008: Alforjita sobre el catálogo publicado. El reloj de las pruebas es el sábado 2026-11-21 a las 18:00 en Loja.
// Datos FICTICIOS.

const preguntar = (ctx, cuerpo) => pedir(ctx, null, 'POST', '/assistant/answers', cuerpo);
const texto = (ctx, t) => preguntar(ctx, { text: t });
const titulos = (r) => r.json.items.map((i) => i.title);

/** Programación de prueba: danza y teatro, gratuitas y de pago, hoy y mañana. */
async function festival() {
  const reloj = relojMovible('2026-11-21T18:00:00-05:00');
  const ctx = await crearApp({ reloj });
  const c = await catalogos(ctx);
  const danza = (titulo, extra) => publicada(ctx, c, { title: titulo, categoryId: c.danza.id, ...extra });
  const hoy = (hora, sede = c.museo.id) => [{ date: '2026-11-21', startTime: hora, venueId: sede }];
  const a = {
    temprano: await danza('Danza que ya empezó', { access: { mode: 'free', priceUsd: null }, functions: hoy('17:00') }),
    gratis: await danza('Danza gratuita de la noche', { access: { mode: 'free', priceUsd: null }, functions: hoy('19:00') }),
    pago: await danza('Danza de pago', { access: { mode: 'paid', priceUsd: 5 }, functions: hoy('20:00') }),
    sinPrecio: await danza('Danza sin precio', { access: { mode: 'paid', priceUsd: null }, functions: hoy('18:30') }),
    porConfirmar: await danza('Danza por confirmar', { access: { mode: 'unconfirmed', priceUsd: null }, functions: hoy('21:30') }),
    teatro: await publicada(ctx, c, { title: 'Teatro gratuito', access: { mode: 'free', priceUsd: null }, functions: hoy('21:00', c.plaza.id) }),
    domingo: await danza('Danza del domingo', {
      access: { mode: 'free', priceUsd: null },
      durationMinutes: 60,
      functions: [{ date: '2026-11-22', startTime: '19:00', venueId: c.plaza.id }],
    }),
    expo: await publicada(ctx, c, {
      title: 'Exposición abierta',
      access: { mode: 'free', priceUsd: null },
      functions: [],
      slots: [{ venueId: c.museo.id, from: '2026-11-20', to: '2026-11-30', opens: '10:00', closes: '19:30' }],
    }),
  };
  return { ctx, c, a, reloj };
}

test('SC-011, SC-003, SC-004: el ejemplo de la danza asume hoy, da solo gratuitas confirmadas que aún no empiezan y lo dice', async () => {
  const { ctx } = await festival();
  const r = await texto(ctx, '¿Qué funciones gratuitas de danza hay después de las seis?');
  assert.equal(r.status, 200);
  assert.equal(r.json.kind, 'matches');
  assert.equal(r.json.assumedDay, true);
  assert.match(r.json.message, /^Asumí hoy, sábado 21 de noviembre \(hora de Loja\)/);
  assert.deepEqual(titulos(r), ['Danza gratuita de la noche']);
  const [item] = r.json.items;
  assert.deepEqual(
    [item.type, item.date, item.startTime, item.venue.name, item.access.label, item.href],
    ['function', '2026-11-21', '19:00', 'Museo de Ejemplo', 'Gratuita', `/actividad/${item.activityId}`],
  );
  assert.equal(item.endTime, null, 'sin hora de fin ni duración no se inventa');
  assert.deepEqual(r.json.criteriaLabels, ['hoy, sábado 21 de noviembre', 'desde las 18:00', 'Danza', 'gratuitas']);
  // «Gratis» nunca devuelve de pago, sin precio ni por confirmar.
  const gratis = await texto(ctx, 'danza gratis');
  assert.ok(gratis.json.items.every((i) => i.access.mode === 'free'));
});

test('SC-001, FR-002, FR-024: cada pregunta rápida responde sin sesión con fichas enlazadas', async () => {
  const { ctx, c } = await festival();
  const hoy = await preguntar(ctx, { quick: 'today' });
  assert.equal(hoy.status, 200);
  assert.deepEqual(titulos(hoy), [
    'Exposición abierta',
    'Danza sin precio',
    'Danza gratuita de la noche',
    'Danza de pago',
    'Teatro gratuito',
    'Danza por confirmar',
  ]);
  assert.ok(!titulos(hoy).includes('Danza que ya empezó'), 'para hoy, solo lo que aún no empieza (FR-007)');
  assert.deepEqual(titulos(await preguntar(ctx, { quick: 'free_today' })), ['Exposición abierta', 'Danza gratuita de la noche', 'Teatro gratuito']);
  assert.deepEqual(titulos(await preguntar(ctx, { quick: 'tonight' })), [
    'Exposición abierta',
    'Danza sin precio',
    'Danza gratuita de la noche',
    'Danza de pago',
    'Teatro gratuito',
    'Danza por confirmar',
  ]);

  const elegir = await preguntar(ctx, { quick: 'venue' });
  assert.equal(elegir.json.kind, 'choose');
  assert.deepEqual(elegir.json.options.map((o) => o.name), ['Museo de Ejemplo', 'Plaza de Ejemplo', 'Recorrido de Ejemplo']);
  const plaza = await preguntar(ctx, elegir.json.options[1].request);
  assert.deepEqual(titulos(plaza), ['Teatro gratuito', 'Danza del domingo'], 'la sede, de hoy en adelante');
  assert.equal((await preguntar(ctx, { quick: 'venue', venueId: 'no-existe' })).status, 422);

  const info = await preguntar(ctx, { quick: 'passport_routes' });
  assert.equal(info.json.kind, 'info');
  assert.deepEqual(info.json.links.map((l) => l.href), ['/pasaporte']);
  assert.equal((await preguntar(ctx, { quick: 'borradores' })).status, 422);
  assert.ok(c.desfile);
});

test('FR-024, SC-009: «¿Hubo cambios?» muestra cancelaciones y reprogramaciones publicadas, la más reciente primero', async () => {
  const { ctx, a, reloj } = await festival();
  const sinCambios = await preguntar(ctx, { quick: 'changes' });
  assert.equal(sinCambios.json.kind, 'no_matches');

  const fPago = a.pago.publishedContent.functions[0].id;
  const fTeatro = a.teatro.publishedContent.functions[0].id;
  await pedir(ctx, 'publicador', 'POST', `/panel/functions/${fPago}/cancel`, { reason: 'Motivo interno', notice: 'Se cancela por lluvia.' });
  reloj.fijar('2026-11-21T18:05:00-05:00');
  await pedir(ctx, 'publicador', 'POST', `/panel/functions/${fTeatro}/reschedule`, { startTime: '22:00', reason: 'Motivo interno', notice: 'Empieza a las 22:00.' });

  const r = await preguntar(ctx, { quick: 'changes' });
  assert.deepEqual(
    r.json.items.map((i) => [i.title, i.timeStatus, i.notice.kind, i.notice.text, i.startTime]),
    [
      ['Teatro gratuito', 'upcoming', 'rescheduled', 'Empieza a las 22:00.', '22:00'],
      ['Danza de pago', 'cancelled', 'cancelled', 'Se cancela por lluvia.', '20:00'],
    ],
  );
  assert.ok(!r.body.includes('Motivo interno'), 'el motivo interno no se publica');
  // La misma pregunta rápida cambia con la programación publicada, sin tocar Alforjita (SC-009).
  assert.ok(!titulos(await preguntar(ctx, { quick: 'today' })).includes('Danza de pago'));
});

test('SC-002, SC-010: mismos resultados que la Agenda con los mismos filtros y el mismo reloj', async () => {
  const { ctx, c } = await festival();
  const ids = (items) => [...new Set(items.map((i) => i.activityId ?? i.id))].sort();
  // Un día futuro: iguales.
  const al = await texto(ctx, 'danza gratis el domingo');
  const ag = await pedir(ctx, null, 'GET', `/agenda?date=2026-11-22&categoryId=${c.danza.id}&access=free`);
  assert.deepEqual(ids(al.json.items), ids(ag.json.items));
  assert.equal(al.json.agendaUrl, `/agenda?date=2026-11-22&categoryId=${c.danza.id}&access=free`);
  // Hoy: la Agenda menos lo que ya empezó.
  const hoyAl = await texto(ctx, 'danza gratis hoy');
  const hoyAg = await pedir(ctx, null, 'GET', `/agenda?date=2026-11-21&categoryId=${c.danza.id}&access=free`);
  assert.deepEqual(
    ids(hoyAl.json.items),
    ids(hoyAg.json.items.filter((i) => i.title !== 'Danza que ya empezó')),
  );
  assert.deepEqual(hoyAl.json.reference, hoyAg.json.reference);
  assert.equal(hoyAl.json.reference.fixed, true);
});

test('FR-007, FR-011: sin coincidencias hoy indica los criterios, ofrece quitar uno y otro día', async () => {
  const { ctx } = await festival();
  const r = await texto(ctx, 'danza gratis en la plaza');
  assert.equal(r.json.kind, 'no_matches');
  assert.match(r.json.message, /Hoy no encontré funciones con estos criterios: hoy, sábado 21 de noviembre, Danza, Plaza de Ejemplo, gratuitas\./);
  assert.match(r.json.message, /¿Quieres consultar otro día\?/);
  const etiquetas = r.json.suggestions.map((s) => s.label);
  assert.deepEqual(etiquetas, ['Sin «Danza»', 'En cualquier sede', 'Domingo 22 de noviembre']);
  // Aplicar una sugerencia no vuelve a interpretar texto.
  const otroDia = await preguntar(ctx, { criteria: r.json.suggestions[2].criteria });
  assert.deepEqual(titulos(otroDia), ['Danza del domingo']);
  // Un día ya pasado.
  const pasado = await texto(ctx, '¿qué hubo el 20 de noviembre?');
  assert.equal(pasado.json.kind, 'past_day');
  assert.equal(pasado.json.suggestions[0].label, 'Hoy');
});

test('FR-012, SC-005: dato no confirmado — precio, acceso y hora de fin — sin completar ni deducir', async () => {
  const { ctx } = await festival();
  const sinPrecio = await texto(ctx, '¿Cuánto cuesta Danza sin precio?');
  assert.deepEqual([sinPrecio.json.kind, sinPrecio.json.missing], ['unconfirmed', ['price']]);
  assert.match(sinPrecio.json.message, /precio aún no está confirmado/);
  assert.doesNotMatch(sinPrecio.json.message, /gratu/i);
  const acceso = await texto(ctx, 'precio de Danza por confirmar');
  assert.deepEqual([acceso.json.kind, acceso.json.missing], ['unconfirmed', ['access']]);
  const pago = await texto(ctx, '¿cuánto cuesta la danza de pago?');
  assert.deepEqual([pago.json.kind, pago.json.message], ['answer', '«Danza de pago» es de pago: USD 5,00.']);
  assert.equal((await texto(ctx, 'precio de Danza gratuita de la noche')).json.message, '«Danza gratuita de la noche» es gratuita.');

  const fin = await texto(ctx, '¿a qué hora termina Danza gratuita de la noche?');
  assert.deepEqual([fin.json.kind, fin.json.missing], ['unconfirmed', ['end', 'duration']]);
  const conDuracion = await texto(ctx, '¿cuándo termina Danza del domingo?');
  assert.deepEqual([conDuracion.json.kind, conDuracion.json.items[0].endTime], ['answer', '20:00']);
  // RC-03: una función de hoy ya empezada, sin fin conocido, es «Hora de inicio pasada».
  const empezada = await texto(ctx, '¿a qué hora es Danza que ya empezó?');
  assert.deepEqual(empezada.json.items.map((i) => i.timeStatus), ['start_passed']);
  // Sin título reconocible: se pide el nombre, no se inventa.
  assert.equal((await texto(ctx, '¿cuánto cuesta?')).json.kind, 'not_understood');
});

test('FR-012, SC-005: accesibilidad confirmada, no disponible o por confirmar, nunca dada por disponible', async () => {
  const { ctx, c } = await festival();
  await pedir(ctx, 'admin', 'PUT', `/panel/venues/${c.museo.id}/accessibility/step_free`, { status: 'confirmed', source: 'Visita del equipo', verifiedOn: '2026-11-10' });
  await pedir(ctx, 'admin', 'PUT', `/panel/venues/${c.museo.id}/accessibility/accessible_toilet`, { status: 'unavailable', source: 'Responsable', verifiedOn: '2026-11-12' });
  const museo = await texto(ctx, '¿el museo es accesible?');
  assert.equal(museo.json.kind, 'answer');
  assert.deepEqual(museo.json.accessibility.map((x) => [x.feature, x.status]), [['step_free', 'confirmed'], ['accessible_toilet', 'unavailable']]);
  const plaza = await texto(ctx, '¿la plaza tiene baño accesible?');
  assert.deepEqual([plaza.json.kind, plaza.json.missing], ['unconfirmed', ['accessible_toilet']]);
  assert.match(plaza.json.message, /por confirmar: no lo doy por disponible/);
  const elegir = await texto(ctx, '¿hay rampa?');
  assert.equal(elegir.json.kind, 'choose');
  assert.equal((await preguntar(ctx, elegir.json.options[0].request)).json.kind, 'answer');
});

test('FR-013, FR-016, FR-017: fuera de alcance con la pantalla a la que acudir; Pasaporte y rutas se explican', async () => {
  const { ctx, a } = await festival();
  const casos = [
    ['Quiero comprar una entrada para Danza de pago', 'buy', ['/actividad/' + a.pago.id, '/carrito']],
    ['canjear un sello', 'redeem', ['/pasaporte']],
    ['¿Cuáles son mis entradas?', 'tickets', ['/mis-entradas']],
    ['¿cuántos sellos tengo?', 'passport_personal', ['/pasaporte']],
    ['¿cuál es mi progreso?', 'passport_personal', ['/pasaporte']],
    ['cambiar la hora de Danza de pago', 'modify', ['/agenda']],
    ['¿qué entradas compró mi amigo?', 'others_data', ['/agenda']],
  ];
  for (const [t, topic, enlaces] of casos) {
    const r = await texto(ctx, t);
    assert.deepEqual([r.json.kind, r.json.topic, r.json.links.map((l) => l.href)], ['out_of_scope', topic, enlaces], t);
  }
  const info = await texto(ctx, '¿Cómo funcionan las rutas?');
  assert.equal(info.json.kind, 'info');
  const nada = await texto(ctx, 'asdf qwer');
  assert.deepEqual([nada.json.kind, nada.json.links[0].href], ['not_understood', '/agenda']);
});

test('SC-006: nunca borradores, versiones pendientes ni archivadas; la respuesta no repite el texto', async () => {
  const { ctx, c } = await festival();
  await pedir(ctx, 'editor', 'POST', '/panel/activities', { content: contenido(c, { title: 'Borrador secreto zafiro' }) });
  const editada = await publicada(ctx, c, { title: 'Versión publicada coral' });
  await pedir(ctx, 'editor', 'PUT', `/panel/activities/${editada.id}/draft`, { version: editada.version, content: contenido(c, { title: 'Versión pendiente ámbar' }) });
  const vieja = await publicada(ctx, c, { title: 'Archivada turquesa' });
  await pedir(ctx, 'admin', 'POST', `/panel/functions/${vieja.publishedContent.functions[0].id}/cancel`, { reason: 'x', notice: 'Cancelada.' });
  await pedir(ctx, 'admin', 'POST', `/panel/activities/${vieja.id}/archive`);

  for (const t of ['Borrador secreto zafiro', 'Versión pendiente ámbar', 'Archivada turquesa']) {
    const r = await texto(ctx, `¿cuánto cuesta ${t}?`);
    assert.ok(!/zafiro|ámbar|turquesa/i.test(r.body), t);
  }
  const publicadaR = await texto(ctx, 'precio de versión publicada coral');
  assert.equal(publicadaR.json.kind, 'answer');
  const unica = 'quiero saber del colibrí-azul-9 qué hay hoy';
  assert.ok(!(await texto(ctx, unica)).body.includes('colibr'));
});

test('SC-012: el texto escrito no queda en el registro de solicitudes ni en ninguna tabla', async () => {
  const lineas = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lineas.push(String(chunk));
      cb();
    },
  });
  const ctx = await crearApp({ reloj: relojMovible(), logger: { level: 'trace', stream } });
  await catalogos(ctx);
  const frase = 'Me llamo Zorzalina Pruebas, mi correo es ana@correo.test, ¿qué hay hoy gratis?';
  assert.equal((await texto(ctx, frase)).status, 200);
  assert.equal((await texto(ctx, 'x'.repeat(201) + 'Zorzalina')).status, 422);
  const registro = lineas.join('\n');
  assert.ok(registro.includes('/assistant/answers'), 'el registro sí guarda la ruta');
  assert.ok(!/Zorzalina|ana@correo|gratis/.test(registro), 'pero no el texto');
  const tablas = await ctx.services.db.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'",
    [ctx.config.dbSchema],
  );
  for (const { table_name: tabla } of tablas) {
    const filas = await ctx.services.db.query(`SELECT row_to_json(t)::text AS j FROM "${tabla}" t`);
    assert.ok(filas.every((f) => !f.j.includes('Zorzalina')), tabla);
  }
});

test('FR-014, SC-005: si el catálogo no responde, 503 «no pude consultar la programación»; validaciones con 422', async () => {
  const { ctx } = await festival();
  const original = ctx.services.agenda.publicadas;
  ctx.services.agenda.publicadas = async () => {
    throw new Error('la base no responde');
  };
  const r = await preguntar(ctx, { quick: 'today' });
  assert.deepEqual([r.status, r.json.error], [503, 'catalog_unavailable']);
  assert.match(r.json.message, /No pude consultar la programación/);
  ctx.services.agenda.publicadas = original;
  // La Agenda sigue respondiendo aunque Alforjita reciba una consulta inválida.
  assert.equal((await texto(ctx, '')).status, 422);
  assert.equal((await preguntar(ctx, { text: 'x'.repeat(201) })).status, 422);
  assert.equal((await pedir(ctx, null, 'GET', '/agenda')).status, 200);
});

test('FR-025: como máximo 10 resultados, con el total y «Ver todas en la Agenda»', async () => {
  const reloj = relojMovible('2026-11-21T08:00:00-05:00');
  const ctx = await crearApp({ reloj });
  const c = await catalogos(ctx);
  for (let i = 0; i < 12; i += 1) {
    await publicada(ctx, c, { title: `Obra ${String(i).padStart(2, '0')}`, functions: [{ date: '2026-11-21', startTime: `${String(9 + i).padStart(2, '0')}:00`, venueId: c.museo.id }] });
  }
  const r = await preguntar(ctx, { quick: 'today' });
  assert.deepEqual([r.json.items.length, r.json.total, r.json.agendaUrl], [10, 12, '/agenda?date=2026-11-21']);
  assert.match(r.json.message, /Te muestro los 10 primeros/);
});
