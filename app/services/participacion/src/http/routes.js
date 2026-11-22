import { createHash, timingSafeEqual } from 'node:crypto';
import { AppError, notFound } from './errors.js';
import { createSession } from './session.js';

// Rutas del servicio de participación (contrato: specs/005-compra-y-entradas/contracts/participacion.openapi.yaml).
// Públicas sin sesión; de la persona con sesión; del panel con permiso verificado en identidad; internas con credencial.

const cuerpo = (request) => (request.body && typeof request.body === 'object' && !Array.isArray(request.body) ? request.body : {});
const huella = (texto) => createHash('sha256').update(String(texto)).digest();

export function registerRoutes(app, servicios, config) {
  const { cart, orders, tickets, access, admin, pasaporte, pasaporteAdmin, routes } = servicios;
  const sesion = createSession(servicios.identidad);

  // ---------- Público (FR-001 a FR-006, FR-041) ----------
  app.post('/cart/quote', async (request) => cart.cotizar(cuerpo(request)));
  app.get('/sale-status', async (request) => {
    const ids = String(request.query?.functionIds ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return cart.estados(ids);
  });

  // ---------- Persona (FR-007 a FR-018, FR-036, FR-040) ----------
  app.post('/orders', async (request, reply) => reply.code(201).send(await orders.crear(await sesion.verificada(request), cuerpo(request))));
  app.get('/orders', async (request) => orders.mios(await sesion(request)));
  app.get('/orders/:id', async (request) => orders.ver(await sesion(request), request.params.id));
  app.post('/orders/:id/simulate-payment', async (request) => {
    if (!config.paymentSimulator) throw notFound();
    return orders.simularPago(await sesion.verificada(request), request.params.id, cuerpo(request));
  });
  app.get('/tickets', async (request) => tickets.mias(await sesion(request)));

  // ---------- Panel del administrador (FR-012, FR-019 a FR-022, FR-037, FR-039) ----------
  app.get('/panel/settings', async (request) => admin.ajustes(await sesion(request)));
  app.put('/panel/settings', async (request) => admin.guardarAjustes(await sesion(request), cuerpo(request)));
  app.get('/panel/functions/:id/sale', async (request) => admin.resumen(await sesion(request), request.params.id));
  app.put('/panel/functions/:id/sale', async (request) => admin.configurar(await sesion(request), request.params.id, cuerpo(request)));
  app.post('/panel/tickets/:id/invalidate', async (request) => admin.invalidar(await sesion(request), request.params.id, cuerpo(request)));
  app.get('/panel/incidents', async (request) => admin.incidencias(await sesion(request)));
  app.post('/panel/incidents/:id/resolve', async (request) => admin.resolver(await sesion(request), request.params.id, cuerpo(request)));

  // ---------- Control de acceso (FR-023 a FR-028) ----------
  app.get('/access/functions', async (request) => access.asignadas(await sesion(request)));
  app.post('/access/functions/:id/open', async (request) => access.abrir(await sesion(request), request.params.id));
  app.post('/access/functions/:id/close', async (request) => access.cerrar(await sesion(request), request.params.id));
  app.post('/access/functions/:id/validate', async (request) => {
    const s = await sesion(request);
    const codigo = cuerpo(request).code;
    return access.validar(s, request.params.id, typeof codigo === 'string' ? codigo.slice(0, 500) : '');
  });

  // ---------- Pasaporte Vivo (spec 006) ----------
  // Reclamar: el ref se comprueba antes que la sesión, así un enlace inválido no pide identificarse.
  app.post('/passport/claims', async (request, reply) => {
    const ref = cuerpo(request).ref;
    const r = await pasaporte.reclamar(typeof ref === 'string' ? ref.slice(0, 200) : '', () => sesion(request));
    return reply.code(r.created ? 201 : 200).send(r);
  });
  app.get('/passport', async (request) => pasaporte.coleccion(await sesion(request)));
  app.get('/passport/stamps/:id', async (request) => pasaporte.sello(await sesion(request), request.params.id));
  app.get('/passport/images/:id', async (request, reply) => {
    const img = await pasaporte.imagen(request.params.id);
    return reply.type(img.mime).send(img.bytes);
  });

  app.get('/panel/passport', async (request) => {
    const ids = String(request.query?.functionIds ?? '').split(',').map((s) => s.trim()).filter((s) => s && s.length <= 100);
    return pasaporteAdmin.estados(await sesion(request), ids);
  });
  app.get('/panel/functions/:id/passport', async (request) => pasaporteAdmin.ver(await sesion(request), request.params.id));
  app.post('/panel/functions/:id/passport/qr', async (request, reply) =>
    reply.code(201).send(await pasaporteAdmin.generar(await sesion(request), request.params.id)),
  );
  app.post('/panel/functions/:id/passport/qr/replace', async (request) => pasaporteAdmin.reemplazar(await sesion(request), request.params.id));
  app.put('/panel/functions/:id/passport/window', async (request) =>
    pasaporteAdmin.ventana(await sesion(request), request.params.id, cuerpo(request)),
  );
  app.post('/panel/functions/:id/passport/activate', async (request) => pasaporteAdmin.activar(await sesion(request), request.params.id));
  app.post('/panel/functions/:id/passport/deactivate', async (request) => pasaporteAdmin.desactivar(await sesion(request), request.params.id));
  // Solo esta ruta recibe imágenes (hasta 1 MB, ~1,4 MB en base64): el resto del servicio sigue limitado a 64 KB.
  app.put('/panel/functions/:id/passport/content', { bodyLimit: 2 * 1024 * 1024 }, async (request) =>
    pasaporteAdmin.contenido(await sesion(request), request.params.id, cuerpo(request)),
  );

  // ---------- Rutas culturales e insignias (spec 007) ----------
  app.get('/passport/routes', async (request) => routes.listarPublicas(await sesion.opcional(request)));
  app.get('/passport/routes/:id', async (request) => routes.verPublica(await sesion.opcional(request), request.params.id));
  app.get('/passport/badges', async (request) => routes.misInsignias(await sesion(request)));
  app.get('/panel/routes', async (request) => routes.listarAdmin(await sesion(request)));
  app.post('/panel/routes', async (request, reply) =>
    reply.code(201).send(await routes.crear(await sesion(request), cuerpo(request))),
  );
  app.get('/panel/routes/:id', async (request) => routes.verAdmin(await sesion(request), request.params.id));
  app.put('/panel/routes/:id', async (request) => routes.editar(await sesion(request), request.params.id, cuerpo(request)));

  // ---------- Interno: para el servicio de programación (FR-042) ----------
  function servicioAutenticado(request) {
    const recibida = request.headers['x-service-key'];
    if (typeof recibida === 'string' && recibida.length > 0) {
      for (const [clave, nombre] of config.serviceKeys) if (timingSafeEqual(huella(recibida), huella(clave))) return nombre;
    }
    throw new AppError(401, 'invalid_service_key', 'Credencial de servicio inválida.');
  }
  app.get('/internal/functions/:id/impact', async (request) => {
    servicioAutenticado(request);
    return admin.impacto(request.params.id);
  });
}
