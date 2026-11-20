// Historial de operaciones sensibles de permisos: solo lo consulta un administrador (FR-025).
export function registerAuditRoutes(app, { repos, guards }) {
  app.get('/audit', async (request, reply) => {
    guards.requireAction(request, 'audit.view');
    return reply.code(200).send({ entries: repos.audit.list(request.query?.limit) });
  });
}
