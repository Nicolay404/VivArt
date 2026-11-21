import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir, catalogos, relojMovible } from '../helpers.js';
import { ILUSTRACION } from '../../src/domain/mapa.js';
import { png, jpeg, SECRETO } from '../imagenes-prueba.js';

// Spec 003, historia 6: el administrador mantiene las sedes sin revisión editorial, con historial y sin aviso público.
// Datos FICTICIOS; reloj fijado el 2026-11-21 en Loja. Las imágenes son bytes mínimos generados aquí.

const PNG = png();
const JPEG = jpeg();
const DESTINO = { lat: -3.5, lng: -78.25, source: 'Revisión en sitio', verifiedOn: '2026-11-10' };
const FOTO = { dataBase64: PNG.toString('base64'), alt: 'Fachada de la sede', credit: 'Foto propia del equipo' };

async function preparar() {
  const ctx = await crearApp({ reloj: relojMovible() });
  const c = await catalogos(ctx);
  return { ctx, c };
}

/** Las siete operaciones del panel de sedes sobre una sede. */
const operaciones = (id) => [
  ['GET', `/panel/venues/${id}`],
  ['PUT', `/panel/venues/${id}/destination`, DESTINO],
  ['DELETE', `/panel/venues/${id}/destination`],
  ['PUT', `/panel/venues/${id}/accessibility/step_free`, { status: 'confirmed', source: 'Revisión', verifiedOn: '2026-11-10' }],
  ['PUT', `/panel/venues/${id}/photo`, FOTO],
  ['DELETE', `/panel/venues/${id}/photo`],
  ['GET', `/panel/venues/${id}/history`],
];

test('FR-021: solo el administrador mantiene las sedes, también con solicitudes directas; sin sesión, 401', async () => {
  const { ctx, c } = await preparar();
  for (const [metodo, url, cuerpo] of operaciones(c.museo.id)) {
    for (const quien of ['editor', 'publicador', 'usuario', 'acceso']) {
      const r = await pedir(ctx, quien, metodo, url, cuerpo);
      assert.equal(r.status, 403, `${quien} ${metodo} ${url}`);
      assert.equal(r.json.missingRole, 'administrador');
    }
    assert.equal((await pedir(ctx, null, metodo, url, cuerpo)).status, 401, `${metodo} ${url}`);
  }
  const marcador = await pedir(ctx, 'editor', 'PUT', `/panel/venues/${c.museo.id}`, { marker: { illustrationId: ILUSTRACION.id, x: 0.1, y: 0.1 } });
  assert.equal(marcador.status, 403);
  // Nada cambió.
  const sede = (await pedir(ctx, null, 'GET', `/map/venues/${c.museo.id}`)).json;
  assert.deepEqual([sede.marker, sede.directionsUrl, sede.photo, sede.accessibility.stepFree.status], [null, null, null, 'unconfirmed']);
});

test('fallo cerrado: si identidad no responde, el panel de sedes no cambia nada y el mapa público sigue', async () => {
  const { ctx, c } = await preparar();
  ctx.identidad.estado.caida = true;
  const r = await pedir(ctx, 'admin', 'PUT', `/panel/venues/${c.museo.id}/destination`, DESTINO);
  assert.deepEqual([r.status, r.json.error], [503, 'identity_unavailable']);
  const publico = await pedir(ctx, null, 'GET', `/map/venues/${c.museo.id}`);
  assert.deepEqual([publico.status, publico.json.directionsUrl], [200, null]);
});

test('FR-023, SC-011: el destino exige coordenadas en rango, fuente y fecha no futura; un recorrido no tiene destino', async () => {
  const { ctx, c } = await preparar();
  const destino = (sede, cuerpo) => pedir(ctx, 'admin', 'PUT', `/panel/venues/${sede.id}/destination`, cuerpo);
  const sinFuente = await destino(c.museo, { ...DESTINO, source: '' });
  assert.deepEqual([sinFuente.status, Object.keys(sinFuente.json.fields)], [422, ['source']]);
  assert.deepEqual(Object.keys((await destino(c.museo, { ...DESTINO, verifiedOn: undefined })).json.fields), ['verifiedOn']);
  assert.deepEqual(Object.keys((await destino(c.museo, { ...DESTINO, verifiedOn: '2026-11-22' })).json.fields), ['verifiedOn']);
  assert.deepEqual(Object.keys((await destino(c.museo, { ...DESTINO, lat: -91, lng: 200 })).json.fields).sort(), ['lat', 'lng']);
  const recorrido = await destino(c.desfile, DESTINO);
  assert.deepEqual([recorrido.status, Object.keys(recorrido.json.fields)], [422, ['kind']]);
  assert.equal((await destino({ id: 'no-existe' }, DESTINO)).status, 404);

  const ok = await destino(c.museo, DESTINO);
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.json.destination, DESTINO);
  // Una sede con destino no pasa a recorrido hasta quitarlo.
  const aRecorrido = await pedir(ctx, 'admin', 'PUT', `/panel/venues/${c.museo.id}`, { kind: 'route' });
  assert.deepEqual([aRecorrido.status, aRecorrido.json.error], [409, 'has_destination']);
  const quitado = await pedir(ctx, 'admin', 'DELETE', `/panel/venues/${c.museo.id}/destination`);
  assert.deepEqual([quitado.json.destination, quitado.json.directionsUrl], [null, null]);
  assert.equal((await pedir(ctx, 'admin', 'PUT', `/panel/venues/${c.museo.id}`, { kind: 'route' })).status, 200);
});

test('FR-018, FR-024: accesibilidad por característica con estado, fuente y fecha; la nota no controla nada', async () => {
  const { ctx, c } = await preparar();
  const acc = (feature, cuerpo) => pedir(ctx, 'admin', 'PUT', `/panel/venues/${c.museo.id}/accessibility/${feature}`, cuerpo);
  assert.deepEqual(Object.keys((await acc('step_free', { status: 'confirmed' })).json.fields).sort(), ['source', 'verifiedOn']);
  assert.equal((await acc('step_free', { status: 'tal vez' })).status, 422);
  assert.equal((await acc('rampa', { status: 'confirmed' })).status, 404);

  const r = await acc('accessible_toilet', { status: 'unavailable', source: 'Responsable de la sede', verifiedOn: '2026-11-20', note: 'En obras' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.accessibilityDetail.accessibleToilet, {
    status: 'unavailable',
    source: 'Responsable de la sede',
    verifiedOn: '2026-11-20',
    note: 'En obras',
    updatedAt: r.json.accessibilityDetail.accessibleToilet.updatedAt,
  });
  assert.equal(r.json.accessibilityDetail.stepFree.status, 'unconfirmed');
});

test('FR-025: la foto exige JPEG, PNG o WebP de hasta 1 MB con texto alternativo y autoría; se puede reemplazar y quitar', async () => {
  const { ctx, c } = await preparar();
  const foto = (cuerpo) => pedir(ctx, 'admin', 'PUT', `/panel/venues/${c.museo.id}/photo`, cuerpo);
  assert.deepEqual(Object.keys((await foto({ ...FOTO, alt: '' })).json.fields), ['alt']);
  assert.deepEqual(Object.keys((await foto({ ...FOTO, credit: undefined })).json.fields), ['credit']);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');
  assert.deepEqual(Object.keys((await foto({ ...FOTO, dataBase64: svg })).json.fields), ['photo']);
  assert.deepEqual(Object.keys((await foto({ ...FOTO, dataBase64: Buffer.from('GIF89a').toString('base64') })).json.fields), ['photo']);

  const primera = await foto(FOTO);
  assert.equal(primera.status, 200);
  const segunda = await foto({ ...FOTO, dataBase64: JPEG.toString('base64'), alt: 'Interior de la sede' });
  assert.notEqual(segunda.json.photo.url, primera.json.photo.url);
  assert.equal(segunda.json.photo.alt, 'Interior de la sede');
  // M-09: aunque se llame directo a la API con una foto con EXIF, se guarda y se sirve sin metadatos.
  const conExif = await foto({ ...FOTO, dataBase64: jpeg({ conMetadatos: true }).toString('base64') });
  assert.equal(conExif.status, 200);
  const servida = await ctx.app.inject({ method: 'GET', url: conExif.json.photo.url.replace('/api/programacion', '') });
  assert.equal(servida.headers['content-type'], 'image/jpeg');
  assert.ok(!servida.rawPayload.includes(SECRETO), 'la foto servida no conserva metadatos');
  const quitada = await pedir(ctx, 'admin', 'DELETE', `/panel/venues/${c.museo.id}/photo`);
  assert.equal(quitada.json.photo, null);
  assert.equal((await pedir(ctx, null, 'GET', `/map/venues/${c.museo.id}/photo`)).status, 404);
});

test('FR-017, SC-009, RC-06: cada cambio queda en el historial con quién, cuándo y qué cambió, y sin aviso público', async () => {
  const { ctx, c } = await preparar();
  const id = c.museo.id;
  await pedir(ctx, 'admin', 'PUT', `/panel/venues/${id}`, { address: 'Calle Ficticia 2', marker: { illustrationId: ILUSTRACION.id, x: 0.25, y: 0.75 } });
  await pedir(ctx, 'admin', 'PUT', `/panel/venues/${id}/destination`, DESTINO);
  await pedir(ctx, 'admin', 'PUT', `/panel/venues/${id}/accessibility/step_free`, { status: 'confirmed', source: 'Revisión', verifiedOn: '2026-11-10' });
  await pedir(ctx, 'admin', 'PUT', `/panel/venues/${id}/photo`, FOTO);
  await pedir(ctx, 'admin', 'DELETE', `/panel/venues/${id}/photo`);
  await pedir(ctx, 'admin', 'DELETE', `/panel/venues/${id}/destination`);
  // Corregir solo la dirección conserva el marcador guardado.
  const solo = await pedir(ctx, 'admin', 'PUT', `/panel/venues/${id}`, { address: 'Calle Ficticia 3' });
  assert.deepEqual(solo.json.marker, { illustrationId: ILUSTRACION.id, x: 0.25, y: 0.75 });

  const h = await pedir(ctx, 'admin', 'GET', `/panel/venues/${id}/history`);
  assert.equal(h.status, 200);
  assert.deepEqual(h.json.items.map((e) => e.action).reverse(), [
    'catalog.venue.created',
    'catalog.venue.updated',
    'venue.destination.set',
    'venue.accessibility.set',
    'venue.photo.set',
    'venue.photo.removed',
    'venue.destination.removed',
    'catalog.venue.updated',
  ]);
  for (const e of h.json.items) assert.equal(e.actorId, 'u-admin');
  const porAccion = (accion) => h.json.items.find((e) => e.action === accion).details;
  assert.deepEqual(porAccion('catalog.venue.updated').changes, { address: { before: 'Calle Ficticia 2', after: 'Calle Ficticia 3' } });
  assert.deepEqual(h.json.items.at(-2).details.changes.marker, { before: null, after: { illustrationId: ILUSTRACION.id, x: 0.25, y: 0.75 } });
  assert.deepEqual(porAccion('venue.destination.set').after, DESTINO);
  assert.equal(porAccion('venue.accessibility.set').feature, 'step_free');
  const fotoSet = porAccion('venue.photo.set');
  assert.equal(fotoSet.after.alt, 'Fachada de la sede');
  assert.ok(!JSON.stringify(fotoSet).includes(PNG.toString('base64')), 'el historial no guarda los bytes de la foto');
  assert.equal((await ctx.services.db.query('SELECT COUNT(*) AS n FROM notices'))[0].n, '0');
});

test('FR-022: el marcador debe estar dentro de la ilustración vigente; una sede nueva sin marcador sigue en la lista', async () => {
  const { ctx, c } = await preparar();
  const fuera = await pedir(ctx, 'admin', 'PUT', `/panel/venues/${c.museo.id}`, { marker: { illustrationId: ILUSTRACION.id, x: 1.5, y: 0.5 } });
  assert.deepEqual([fuera.status, Object.keys(fuera.json.fields)], [422, ['marker']]);
  const otra = await pedir(ctx, 'admin', 'PUT', `/panel/venues/${c.museo.id}`, { marker: { illustrationId: 'otra', x: 0.5, y: 0.5 } });
  assert.equal(otra.status, 422);
  const nueva = await pedir(ctx, 'admin', 'POST', '/panel/venues', { name: 'Sala nueva de ejemplo', kind: 'place' });
  const lista = await pedir(ctx, null, 'GET', '/map/venues?q=sala%20nueva');
  assert.deepEqual(lista.json.items.map((s) => [s.id, s.marker]), [[nueva.json.id, null]]);
  const quitar = await pedir(ctx, 'admin', 'PUT', `/panel/venues/${c.museo.id}`, { marker: null });
  assert.equal(quitar.json.marker, null);
});
