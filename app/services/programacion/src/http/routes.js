import { createHash, timingSafeEqual } from 'node:crypto';
import { AppError } from './errors.js';
import { createSession } from './session.js';

// Rutas del servicio de programación (contrato: specs/002-programacion-y-publicacion/contracts/programacion.openapi.yaml).
// Públicas sin sesión; /panel/* con sesión y permiso verificado en el servidor; /internal/* con credencial de servicio.

const cuerpo = (request) => (request.body && typeof request.body === 'object' && !Array.isArray(request.body) ? request.body : {});
const huella = (texto) => createHash('sha256').update(String(texto)).digest();
const ACCESOS = new Set(['free', 'paid', 'unconfirmed']);
const textoParam = (v, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

export function registerRoutes(app, servicios, config) {
  const { agenda, catalogs, editorial, changes, imports, permisos } = servicios;
  const sesion = createSession(servicios.identidad);

  // ---------- Público (FR-001 a FR-007) ----------
  app.get('/agenda', async (request) => {
    const q = request.query ?? {};
    return agenda.agenda({
      q: textoParam(q.q),
      date: textoParam(q.date, 10),
      categoryId: textoParam(q.categoryId, 100),
      venueId: textoParam(q.venueId, 100),
      access: ACCESOS.has(q.access) ? q.access : undefined,
      editionId: textoParam(q.editionId, 100),
    });
  });
  app.get('/now', async () => agenda.ahora());
  app.get('/activities/:id', async (request) => agenda.ficha(request.params.id));
  app.get('/categories', async () => ({ items: await catalogs.list('categories') }));
  app.get('/venues', async () => ({ items: await catalogs.list('venues') }));
  app.get('/editions', async () => ({ items: await catalogs.list('editions') }));

  // ---------- Panel editorial ----------
  app.get('/panel/activities', async (request) => {
    const q = request.query ?? {};
    return editorial.bandeja(await sesion(request), { state: textoParam(q.state, 20), mine: q.mine === 'true' });
  });
  app.post('/panel/activities', async (request, reply) => reply.code(201).send(await editorial.crear(await sesion(request), cuerpo(request))));
  app.get('/panel/activities/:id', async (request) => editorial.ver(await sesion(request), request.params.id));
  app.delete('/panel/activities/:id', async (request, reply) => {
    await editorial.borrar(await sesion(request), request.params.id);
    return reply.code(204).send();
  });
  app.put('/panel/activities/:id/draft', async (request) => editorial.guardar(await sesion(request), request.params.id, cuerpo(request)));
  app.get('/panel/activities/:id/preview', async (request) => editorial.vistaPrevia(await sesion(request), request.params.id));
  app.post('/panel/activities/:id/submit', async (request) => editorial.enviar(await sesion(request), request.params.id, cuerpo(request)));
  app.post('/panel/activities/:id/return', async (request) => editorial.devolver(await sesion(request), request.params.id, cuerpo(request)));
  app.post('/panel/activities/:id/publish', async (request) => editorial.publicar(await sesion(request), request.params.id, cuerpo(request)));
  app.post('/panel/activities/:id/discard-revision', async (request) =>
    editorial.descartarRevision(await sesion(request), request.params.id, cuerpo(request)),
  );
  app.post('/panel/activities/:id/reassign', async (request) => editorial.reasignar(await sesion(request), request.params.id, cuerpo(request)));
  app.post('/panel/activities/:id/archive', async (request) => editorial.archivar(await sesion(request), request.params.id));
  app.get('/panel/activities/:id/history', async (request) => editorial.historial(await sesion(request), request.params.id));

  // ---------- Cambios con aviso (FR-015 a FR-019) ----------
  app.get('/panel/functions/:id/impact', async (request) => changes.impacto(await sesion(request), request.params.id));
  app.post('/panel/functions/:id/reschedule', async (request) => changes.reprogramar(await sesion(request), request.params.id, cuerpo(request)));
  app.post('/panel/functions/:id/cancel', async (request) => changes.cancelar(await sesion(request), request.params.id, cuerpo(request)));

  // ---------- Catálogos (FR-025) ----------
  for (const [ruta, tabla] of [['categories', 'categories'], ['venues', 'venues'], ['editions', 'editions']]) {
    app.post(`/panel/${ruta}`, async (request, reply) => {
      const s = await sesion(request);
      await permisos.permitir(s, 'catalog.manage');
      return reply.code(201).send(await catalogs.create(s.userId, tabla, cuerpo(request)));
    });
    app.put(`/panel/${ruta}/:id`, async (request) => {
      const s = await sesion(request);
      await permisos.permitir(s, 'catalog.manage');
      return catalogs.update(s.userId, tabla, request.params.id, cuerpo(request));
    });
  }

  // ---------- Carga (FR-020 a FR-024, FR-031, FR-033) ----------
  app.post('/panel/imports', async (request, reply) => reply.code(201).send(await imports.vistaPrevia(await sesion(request), cuerpo(request))));
  app.get('/panel/imports/:id', async (request) => imports.ver(await sesion(request), request.params.id));
  app.post('/panel/imports/:id/accept', async (request) => imports.aceptar(await sesion(request), request.params.id, cuerpo(request)));
  app.post('/panel/publish-batch', async (request) => imports.publicarLote(await sesion(request), cuerpo(request)));

  // ---------- Interno: para el servicio de participación ----------
  function servicioAutenticado(request) {
    const recibida = request.headers['x-service-key'];
    if (typeof recibida === 'string' && recibida.length > 0) {
      for (const [clave, nombre] of config.serviceKeys) if (timingSafeEqual(huella(recibida), huella(clave))) return nombre;
    }
    throw new AppError(401, 'invalid_service_key', 'Credencial de servicio inválida.');
  }
  app.get('/internal/functions', async (request) => {
    servicioAutenticado(request);
    const ids = String(request.query?.ids ?? '').split(',').map((s) => s.trim()).filter((s) => s && s.length <= 100);
    return changes.funcionesInternas(ids);
  });
  app.get('/internal/functions/:id', async (request) => {
    servicioAutenticado(request);
    return changes.funcionInterna(request.params.id);
  });
}
