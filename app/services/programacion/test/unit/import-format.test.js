import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accesoDesdeEtiqueta, convertirRegistro } from '../../src/domain/imports.js';

// FR-024: etiquetas del PDF. La ausencia de precio nunca es gratuidad.

test('«Entrada Libre» y «Evento Gratuito» son gratuitas solo si el registro fue revisado', () => {
  for (const etiqueta of ['Entrada Libre', 'Evento Gratuito', 'entrada libre']) {
    assert.deepEqual(accesoDesdeEtiqueta(etiqueta, null, true).access, { mode: 'free', priceUsd: null });
    assert.deepEqual(accesoDesdeEtiqueta(etiqueta, null, false).access, { mode: 'unconfirmed', priceUsd: null });
  }
});

test('«Evento Pagado» es de pago; sin precio, el precio queda por confirmar', () => {
  assert.deepEqual(accesoDesdeEtiqueta('Evento Pagado', null, true).access, { mode: 'paid', priceUsd: null });
  assert.deepEqual(accesoDesdeEtiqueta('Evento Pagado', 3, true).access, { mode: 'paid', priceUsd: 3 });
  assert.deepEqual(accesoDesdeEtiqueta(null, null, true).access, { mode: 'unconfirmed', priceUsd: null });
  assert.ok(accesoDesdeEtiqueta('Gratis total', null, true).error);
});

test('convertir un registro: referencias por nombre sin distinguir tildes y errores claros', () => {
  const cat = { categorias: new Map([['teatro', 'c1']]), sedes: new Map([['sala uno', 's1']]) };
  const bien = convertirRegistro(
    { clave: 'k1', origen: { pagina: 4 }, titulo: 'Obra', categoria: 'TEATRO', funciones: [{ fecha: '2026-11-21', hora: '19:00', sede: 'Sala Uno' }] },
    cat,
  );
  assert.deepEqual(bien.errors, []);
  assert.equal(bien.content.categoryId, 'c1');
  assert.equal(bien.content.functions[0].venueId, 's1');
  assert.deepEqual(bien.source, { page: 4, note: null });

  const mal = convertirRegistro({ clave: 'con espacios', titulo: '', franjas: [{ sede: 'Sala Uno', abre: '10:00', cierra: '12:00' }] }, cat);
  const texto = mal.errors.join(' | ');
  for (const parte of ['clave', 'origen.pagina', 'titulo', 'Franja 1']) assert.ok(texto.includes(parte), parte);
});
