import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorize, ACTION_NAMES, INTERNAL_ROLES } from '../../src/domain/policy.js';

const persona = (roles, extra = {}) => ({ userId: 'u1', roles: ['usuario_registrado', ...roles], functionIds: [], ...extra });
const puede = (p, accion, ctx) => authorize(p, accion, ctx).allowed;

test('SC-001: sin sesión no se autoriza ninguna acción', () => {
  for (const accion of ACTION_NAMES) {
    const r = authorize(null, accion);
    assert.equal(r.allowed, false);
    assert.equal(r.reason, 'no_session');
  }
});

test('SC-001: un usuario registrado sin rol interno no puede nada interno', () => {
  for (const accion of ACTION_NAMES) assert.equal(puede(persona([]), accion, { ownerId: 'u1', functionId: 'f' }), false);
});

test('el editor edita solo sus borradores y nunca publica', () => {
  const editor = persona(['editor']);
  assert.equal(puede(editor, 'draft.edit_own', { ownerId: 'u1' }), true);
  assert.equal(puede(editor, 'draft.submit'), true);
  const ajeno = authorize(editor, 'draft.edit_own', { ownerId: 'otro' });
  assert.equal(ajeno.allowed, false);
  assert.equal(ajeno.reason, 'not_owner');
  assert.equal(puede(editor, 'draft.edit_any'), false);
  assert.equal(puede(editor, 'publish'), false);
});

test('SC-006: el rechazo indica el rol que falta y no trae datos de contenido', () => {
  const r = authorize(persona(['editor']), 'publish');
  assert.deepEqual(r, { allowed: false, reason: 'missing_role', missingRole: 'publicador', acceptedRoles: ['publicador', 'administrador'] });
  assert.deepEqual(Object.keys(r).sort(), ['acceptedRoles', 'allowed', 'missingRole', 'reason']);
});

test('publicador y administrador editan propuestas ajenas y publican', () => {
  for (const rol of ['publicador', 'administrador']) {
    const p = persona([rol]);
    assert.equal(puede(p, 'draft.edit_any'), true);
    assert.equal(puede(p, 'draft.review'), true);
    assert.equal(puede(p, 'publish'), true);
  }
});

test('publicar no concede activar ventas: solo el administrador', () => {
  assert.equal(puede(persona(['publicador']), 'sales.configure'), false);
  assert.equal(puede(persona(['administrador']), 'sales.configure'), true);
});

test('solo el administrador gestiona roles, historial, catálogo y reasignaciones', () => {
  for (const accion of ['roles.manage', 'audit.view', 'draft.reassign', 'event.create_publish', 'catalog.load']) {
    assert.equal(puede(persona(['publicador', 'editor']), accion), false, accion);
    assert.equal(puede(persona(['administrador']), accion), true, accion);
  }
});

test('SC-004: los permisos son la suma de los roles activos', () => {
  const ambos = persona(['editor', 'publicador']);
  assert.equal(puede(ambos, 'draft.edit_own', { ownerId: 'u1' }), true);
  assert.equal(puede(ambos, 'publish'), true);
  assert.equal(puede(ambos, 'roles.manage'), false);
  const soloPublicador = persona(['publicador']);
  assert.equal(puede(soloPublicador, 'draft.submit'), false); // perdió lo que concedía editor
  assert.equal(puede(soloPublicador, 'publish'), true);
});

test('SC-009: el personal de acceso solo valida funciones asignadas', () => {
  const staff = persona(['personal_acceso'], { functionIds: ['f1', 'f2'] });
  assert.equal(puede(staff, 'access.validate', { functionId: 'f1' }), true);
  assert.equal(puede(staff, 'access.validate', { functionId: 'f2' }), true);
  const ajena = authorize(staff, 'access.validate', { functionId: 'f3' });
  assert.equal(ajena.allowed, false);
  assert.equal(ajena.reason, 'function_not_assigned');
  assert.equal(puede(persona(['personal_acceso']), 'access.validate', { functionId: 'f1' }), false); // sin funciones
  assert.equal(puede(persona(['administrador']), 'access.validate', { functionId: 'f1' }), false);
});

test('panel.access lo concede cualquier rol interno y no el usuario registrado', () => {
  for (const rol of INTERNAL_ROLES) assert.equal(puede(persona([rol]), 'panel.access'), true, rol);
  assert.equal(puede(persona([]), 'panel.access'), false);
});

test('una acción desconocida se rechaza', () => {
  assert.equal(authorize(persona(['administrador']), 'borrar.todo').allowed, false);
});
