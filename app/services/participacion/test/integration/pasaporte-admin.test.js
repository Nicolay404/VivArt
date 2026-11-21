import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir } from '../helpers.js';
import { qrActivo, reclamar, refDe, VENTANA } from '../pasaporte-ayuda.js';
import { png, jpeg, SECRETO } from '../imagenes-prueba.js';

// Spec 006, historias 4 y 5: el administrador gestiona el QR, la ventana y el contenido del sello. Datos FICTICIOS.

const panel = (ctx, quien, metodo, ruta, cuerpo) => pedir(ctx, quien, metodo, `/panel/functions/f-obra/passport${ruta}`, cuerpo);
const IMAGEN = { dataBase64: png().toString('base64'), alt: 'Ilustración del sello', credit: 'Dibujo propio del equipo' };

test('M-10, SC-014: generar, no activar sin ventana, fijarla y activar; un solo QR vigente', async () => {
  const ctx = await crearApp();
  const generado = await panel(ctx, 'admin', 'POST', '/qr');
  assert.equal(generado.status, 201);
  assert.equal(generado.json.qr.status, 'inactive');
  assert.match(generado.json.qr.url, /^http:\/\/localhost:8080\/pasaporte\/canje\/[A-Za-z0-9_-]{22}$/);
  assert.match(generado.json.qr.svg, /^<svg/);
  assert.equal(refDe(generado.json).includes('f-obra'), false, 'el ref no es el id de la función');
  assert.deepEqual([(await panel(ctx, 'admin', 'POST', '/qr')).status, (await panel(ctx, 'admin', 'POST', '/qr')).json.error], [409, 'qr_exists']);

  const sinVentana = await panel(ctx, 'admin', 'POST', '/activate');
  assert.deepEqual([sinVentana.status, sinVentana.json.error], [422, 'window_required']);
  const mal = await panel(ctx, 'admin', 'PUT', '/window', { start: '2026-11-21 20:00', end: '2026-11-21 19:00' });
  assert.deepEqual([mal.status, Object.keys(mal.json.fields)], [422, ['end']]);
  assert.equal((await panel(ctx, 'admin', 'PUT', '/window', VENTANA)).json.qr.window.start, VENTANA.start);
  const activo = await panel(ctx, 'admin', 'POST', '/activate');
  assert.equal(activo.json.qr.status, 'active');

  // Reemplazar: el nuevo tiene otro enlace, conserva la ventana y queda desactivado; solo hay uno vigente.
  const nuevo = await panel(ctx, 'admin', 'POST', '/qr/replace');
  assert.notEqual(nuevo.json.qr.url, activo.json.qr.url);
  assert.deepEqual([nuevo.json.qr.status, nuevo.json.qr.window.start], ['inactive', VENTANA.start]);
  const vigentes = await ctx.services.db.query("SELECT COUNT(*)::int AS n FROM passport_qrs WHERE function_id = 'f-obra' AND status <> 'replaced'");
  assert.equal(vigentes[0].n, 1);
});

test('SC-008: solo una función publicada con fecha y hora puede tener QR', async () => {
  const ctx = await crearApp();
  const r = await pedir(ctx, 'admin', 'POST', '/panel/functions/franja-de-ejemplo/passport/qr');
  assert.equal(r.status, 404);
});

test('SC-009: solo el administrador gestiona el Pasaporte, también con solicitudes directas; fallo cerrado', async () => {
  const ctx = await crearApp();
  const rutas = [
    ['GET', ''],
    ['POST', '/qr'],
    ['POST', '/qr/replace'],
    ['PUT', '/window', VENTANA],
    ['POST', '/activate'],
    ['POST', '/deactivate'],
    ['PUT', '/content', { text: 'Hola' }],
  ];
  for (const [metodo, ruta, cuerpo] of rutas) {
    for (const quien of ['editor', 'publicador', 'acceso', 'usuaria']) {
      const r = await panel(ctx, quien, metodo, ruta, cuerpo);
      assert.equal(r.status, 403, `${quien} ${metodo} ${ruta}`);
      assert.equal(r.json.missingRole, 'administrador');
    }
    assert.equal((await panel(ctx, null, metodo, ruta, cuerpo)).status, 401);
  }
  assert.equal((await pedir(ctx, 'publicador', 'GET', '/panel/passport?functionIds=f-obra')).status, 403);
  assert.equal((await ctx.services.db.query('SELECT COUNT(*)::int AS n FROM passport_qrs'))[0].n, 0);
  ctx.identidad.estado.caida = true;
  assert.deepEqual([(await panel(ctx, 'admin', 'POST', '/qr')).status], [503]);
});

test('SC-010, FR-020: cada cambio queda en el historial, sin el enlace del QR', async () => {
  const ctx = await crearApp();
  const { ref } = await qrActivo(ctx, 'f-obra');
  await panel(ctx, 'admin', 'POST', '/deactivate');
  await panel(ctx, 'admin', 'POST', '/qr/replace');
  await panel(ctx, 'admin', 'PUT', '/content', { text: 'Recuerdo' });
  const filas = await ctx.services.db.query("SELECT action, actor_id, details FROM history WHERE entity_id = 'f-obra' ORDER BY id");
  assert.deepEqual(filas.map((f) => f.action), [
    'passport.qr.generated',
    'passport.qr.window_set',
    'passport.qr.activated',
    'passport.qr.deactivated',
    'passport.qr.replaced',
    'passport.content.set',
  ]);
  assert.ok(filas.every((f) => f.actor_id === 'u-admin'));
  assert.ok(!JSON.stringify(filas).includes(ref), 'el historial no guarda el enlace');
});

test('M-11, SC-012, SC-013: los sellos emitidos conservan su contenido; la imagen no se borra', async () => {
  const ctx = await crearApp();
  const { ref } = await qrActivo(ctx, 'f-obra');
  const primero = await panel(ctx, 'admin', 'PUT', '/content', { text: 'Primera versión', image: IMAGEN });
  assert.equal(primero.status, 200);
  assert.equal(primero.json.content.version, 1);
  const a = await reclamar(ctx, 'usuaria', ref);
  assert.equal(a.json.stamp.content.text, 'Primera versión');
  assert.equal(a.json.stamp.content.image.alt, 'Ilustración del sello');

  // Versión 2: texto nuevo y sin imagen. El sello anterior no cambia y su imagen se sigue sirviendo.
  const segunda = await panel(ctx, 'admin', 'PUT', '/content', { text: 'Segunda versión', image: null });
  assert.deepEqual([segunda.json.content.version, segunda.json.content.image], [2, null]);
  const b = await reclamar(ctx, 'usuario2', ref);
  assert.deepEqual([b.json.stamp.content.text, b.json.stamp.content.image], ['Segunda versión', null]);
  const deA = await pedir(ctx, 'usuaria', 'GET', `/passport/stamps/${a.json.stamp.id}`);
  assert.equal(deA.json.content.text, 'Primera versión');
  const imagen = await ctx.app.inject({ method: 'GET', url: deA.json.content.image.url.replace('/api/participacion', '') });
  assert.deepEqual([imagen.statusCode, imagen.headers['content-type']], [200, 'image/png']);

  // Versión 3 sin tocar la imagen: conserva la de la versión anterior (ninguna). Sin contenido = plantilla común.
  const tercera = await panel(ctx, 'admin', 'PUT', '/content', { text: null });
  assert.equal(tercera.json.content.version, 3);
  const c = await reclamar(ctx, 'sinVerificar', ref);
  assert.equal(c.status, 403);
  await assert.rejects(ctx.services.db.run("DELETE FROM stamp_images WHERE id = $1", [deA.json.content.image.url.split('/').pop()]));
});

test('M-12, SC-015: imagen sin metadatos, con texto alternativo y autoría; texto plano de hasta 280', async () => {
  const ctx = await crearApp();
  await panel(ctx, 'admin', 'POST', '/qr');
  const campos = async (cuerpo) => {
    const r = await panel(ctx, 'admin', 'PUT', '/content', cuerpo);
    return r.status === 422 ? Object.keys(r.json.fields).sort() : r.status;
  };
  assert.deepEqual(await campos({ text: 'x'.repeat(281) }), ['text']);
  assert.deepEqual(await campos({ image: { ...IMAGEN, alt: '', credit: '' } }), ['alt', 'credit']);
  assert.deepEqual(await campos({ image: { ...IMAGEN, dataBase64: Buffer.from('GIF89a').toString('base64') } }), ['image']);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');
  assert.deepEqual(await campos({ image: { ...IMAGEN, dataBase64: svg } }), ['image']);
  assert.deepEqual(await campos({ image: 'no' }), ['image']);

  const conExif = await panel(ctx, 'admin', 'PUT', '/content', { text: '<b>Gracias</b>', image: { ...IMAGEN, dataBase64: jpeg({ conMetadatos: true }).toString('base64') } });
  assert.equal(conExif.status, 200);
  assert.equal(conExif.json.content.text, '<b>Gracias</b>', 'se guarda como texto literal, nunca como HTML');
  const servida = await ctx.app.inject({ method: 'GET', url: conExif.json.content.image.url.replace('/api/participacion', '') });
  assert.equal(servida.headers['content-type'], 'image/jpeg');
  assert.ok(!servida.rawPayload.includes(SECRETO), 'la imagen servida no conserva metadatos');
});

test('P-03, SC-005: un cambio de fecha, hora o sede desactiva el canje hasta confirmar una ventana nueva; los sellos siguen', async () => {
  const ctx = await crearApp();
  const { ref } = await qrActivo(ctx, 'f-obra');
  const antes = await reclamar(ctx, 'usuaria', ref);
  ctx.programacion.funciones.get('f-obra').startTime = '21:00';

  const rechazo = await reclamar(ctx, 'usuario2', ref);
  assert.deepEqual([rechazo.status, rechazo.json.error, rechazo.json.cause], [409, 'qr_inactive', 'function_changed']);
  const vista = await panel(ctx, 'admin', 'GET', '');
  assert.deepEqual([vista.json.qr.status, vista.json.qr.inactiveCause], ['inactive', 'function_changed']);
  // Activar sin confirmar ventana no basta; la ventana no se movió sola.
  assert.equal((await panel(ctx, 'admin', 'POST', '/activate')).status, 422);
  assert.equal(vista.json.qr.window.start, VENTANA.start);
  // Confirmar una ventana nueva y activar lo reactiva.
  await panel(ctx, 'admin', 'PUT', '/window', { start: '2026-11-21 17:00', end: '2026-11-22 23:30' });
  assert.equal((await panel(ctx, 'admin', 'POST', '/activate')).json.qr.status, 'active');
  assert.equal((await reclamar(ctx, 'usuario2', ref)).status, 201);
  // El sello anterior se conserva.
  assert.equal((await pedir(ctx, 'usuaria', 'GET', `/passport/stamps/${antes.json.stamp.id}`)).status, 200);
  const acciones = (await ctx.services.db.query("SELECT action, actor_id FROM history WHERE entity_id = 'f-obra' AND action = 'passport.qr.deactivated'"));
  assert.deepEqual(acciones.map((a) => a.actor_id), ['sistema']);
});

test('FR-018: una función sin QR no se ve afectada por un cambio; el panel lista el estado de varias funciones', async () => {
  const ctx = await crearApp();
  await qrActivo(ctx, 'f-obra');
  ctx.programacion.funciones.get('f-danza').date = '2026-11-25';
  const lista = await pedir(ctx, 'admin', 'GET', '/panel/passport?functionIds=f-obra,f-danza');
  assert.deepEqual(lista.json.items.map((i) => [i.functionId, i.qrStatus, i.stampsCount]), [
    ['f-obra', 'active', 0],
    ['f-danza', null, 0],
  ]);
});
