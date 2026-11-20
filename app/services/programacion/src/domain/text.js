// Normalización de texto para buscar y comparar sin distinguir mayúsculas ni tildes.
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Texto limpio o null si queda vacío. */
export function textoONulo(valor, max = 5000) {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio ? limpio.slice(0, max) : null;
}
