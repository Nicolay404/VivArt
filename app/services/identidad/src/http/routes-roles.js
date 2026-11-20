// Gestión de roles y funciones. Solo el administrador (acción roles.manage), verificado en el servidor.
export function registerRoleRoutes(app, { roles, guards }) {
  app.get('/users', async (request, reply) => {
    guards.requireAction(request, 'roles.manage');
    return reply.code(200).send({ users: roles.search(request.query?.email) });
  });

  app.get('/users/:id', async (request, reply) => {
    guards.requireAction(request, 'roles.manage');
    return reply.code(200).send(roles.get(request.params.id));
  });

  app.put('/users/:id/roles/:role', async (request, reply) => {
    const admin = guards.requireAction(request, 'roles.manage');
    roles.assignRole(admin.userId, request.params.id, request.params.role);
    return reply.code(204).send();
  });

  app.delete('/users/:id/roles/:role', async (request, reply) => {
    const admin = guards.requireAction(request, 'roles.manage');
    roles.revokeRole(admin.userId, request.params.id, request.params.role);
    return reply.code(204).send();
  });

  app.put('/users/:id/functions/:functionId', async (request, reply) => {
    const admin = guards.requireAction(request, 'roles.manage');
    roles.assignFunction(admin.userId, request.params.id, request.params.functionId);
    return reply.code(204).send();
  });

  app.delete('/users/:id/functions/:functionId', async (request, reply) => {
    const admin = guards.requireAction(request, 'roles.manage');
    roles.revokeFunction(admin.userId, request.params.id, request.params.functionId);
    return reply.code(204).send();
  });
}
