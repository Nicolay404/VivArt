import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp, pedir, habilitar } from '../helpers.js';

// Integridad ante solicitudes simultáneas (RC-05, RNF-06; SC-002). La validación simultánea está en access.test.js.

test('veinte pedidos simultáneos por el último cupo: exactamente uno lo retiene (SC-002)', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra', 1);
  const items = [{ functionId: 'f-obra', quantity: 1 }];
  const quienes = ['usuaria', 'usuario2'];
  const resultados = await Promise.all(
    Array.from({ length: 20 }, (_, i) => pedir(ctx, quienes[i % 2], 'POST', '/orders', { items, acceptedTotalCents: 500 })),
  );
  assert.equal(resultados.filter((r) => r.status === 201).length, 1);
  assert.ok(resultados.filter((r) => r.status !== 201).every((r) => r.status === 409 && r.json.error === 'sold_out'));
});

test('pedidos simultáneos que cruzan dos funciones en distinto orden no se bloquean entre sí', async () => {
  const ctx = await crearApp();
  await habilitar(ctx, 'f-obra', 3);
  await habilitar(ctx, 'f-danza', 3);
  const a = [{ functionId: 'f-obra', quantity: 1 }, { functionId: 'f-danza', quantity: 1 }];
  const b = [{ functionId: 'f-danza', quantity: 1 }, { functionId: 'f-obra', quantity: 1 }];
  const resultados = await Promise.all(
    Array.from({ length: 6 }, (_, i) => pedir(ctx, 'usuaria', 'POST', '/orders', { items: i % 2 ? a : b, acceptedTotalCents: 1250 })),
  );
  assert.equal(resultados.filter((r) => r.status === 201).length, 3);
});
