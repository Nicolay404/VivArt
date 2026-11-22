import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Una llave sin cerrar en styles.css hace que el navegador descarte todo lo que viene después, sin ningún error visible.
// Pasó al fusionar dos ramas que añadían estilos al final del archivo; esta prueba lo detecta.
test('styles.css tiene las llaves equilibradas y ningún marcador de conflicto', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.ok(!/^(<{7}|={7}|>{7})/m.test(css), 'quedó un marcador de conflicto de Git');
  const sinComentarios = css.replaceAll(/\/\*[\s\S]*?\*\//g, '');
  let profundidad = 0;
  let linea = 1;
  for (const c of sinComentarios) {
    if (c === '\n') linea += 1;
    if (c === '{') profundidad += 1;
    if (c === '}') profundidad -= 1;
    assert.ok(profundidad >= 0, `llave de cierre sobrante cerca de la línea ${linea}`);
  }
  assert.equal(profundidad, 0, 'falta cerrar alguna llave');
});
