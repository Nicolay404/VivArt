// Gestión de roles y funciones. Solo el administrador (acción roles.manage), verificado en el servidor.
export function registerRoleRoutes(app, { roles, guards }) {
  app.get('/users', async (request, reply) => {
    await guards.requireAction(request, 'roles.manage');
    return reply.code(200).send({ users: await roles.search(request.query?.email) });
  });

  app.get('/users/:id', async (request, reply) => {
    await guards.requireAction(request, 'roles.manage');
    return reply.code(200).send(await roles.get(request.params.id));
  });

  app.put('/users/:id/roles/:role', async (request, reply) => {
    const admin = await guards.requireAction(request, 'roles.manage');
    await roles.assignRole(admin.userId, request.params.id, request.params.role);
    return reply.code(204).send();
  });

  app.delete('/users/:id/roles/:role', async (request, reply) => {
    const admin = await guards.requireAction(request, 'roles.manage');
    await roles.revokeRole(admin.userId, request.params.id, request.params.role);
    return reply.code(204).send();
  });

  app.put('/users/:id/functions/:functionId', async (request, reply) => {
    const admin = await guards.requireAction(request, 'roles.manage');
    await roles.assignFunction(admin.userId, request.params.id, request.params.functionId);
    return reply.code(204).send();
  });

  app.delete('/users/:id/functions/:functionId', async (request, reply) => {
    const admin = await guards.requireAction(request, 'roles.manage');
    await roles.revokeFunction(admin.userId, request.params.id, request.params.functionId);
    return reply.code(204).send();
  });
}
