// Catálogo de imágenes de actividades del Festival Internacional de Artes Vivas de Loja (FIAVL 2026).
// Permite asociar fotografías auténticas del festival a cada evento, ya sea por título específico o por disciplina artística.

export const IMAGENES_EVENTOS = {
  // Eventos con fotografía específica dedicada
  '100% café de Especialidad': '/img/eventos/cafe-especialidad.jpg',
  'Alma en las Manos': '/img/eventos/alma-manos.jpg',
  'Árbol Familiar': '/img/eventos/arbol-familiar.jpg',
  'Banda Municipal de Cotacachi': '/img/eventos/banda-cotacachi.jpg',
  'Book Truck': '/img/eventos/book-truck.jpg',
  'Buddy Bears': '/img/eventos/buddy-bears.jpg',
  'Cadena de Voces': '/img/eventos/cadena-voces.jpg',
  'Cine Bajo las Estrellas': '/img/eventos/cine-estrellas.jpg',
  'Territorios Vivos: Formas de Habitar el Ecuador': '/img/eventos/territorios-vivos.jpg',
  'Lo que Somos': '/img/eventos/lo-que-somos.jpg',
  'FIAVL 10 Años de Historias': '/img/eventos/fiav-10-anos.jpg',
  'Loja Produce': '/img/eventos/loja-produce.jpg',
  'Manos Vivas': '/img/eventos/manos-vivas.jpg',
  'Juegos Tradicionales de Madera': '/img/eventos/juegos-madera.jpg',
  'IV Festival Internacional Danzas, Colores y Tradiciones del Mundo': '/img/eventos/danzas-mundo.jpg',
};

// Fotografía auténtica del festival por disciplina artística / familia visual
export const IMAGENES_DISCIPLINAS = {
  danza: '/img/eventos/danzas-mundo.jpg',
  musica: '/img/eventos/banda-cotacachi.jpg',
  teatro: '/img/eventos/arbol-familiar.jpg',
  circo: '/img/eventos/arbol-familiar.jpg',
  visual: '/img/eventos/territorios-vivos.jpg',
  letras: '/img/eventos/cadena-voces.jpg',
  feria: '/img/eventos/manos-vivas.jpg',
  comunidad: '/img/eventos/book-truck.jpg',
  otras: '/img/eventos/fiav-10-anos.jpg',
};

const FAMILIAS = [
  ['circo', ['circo', 'titere', 'muneco', 'clown', 'fuego', 'suspension', 'giocoleria', 'malabar']],
  ['danza', ['danza', 'baile']],
  ['musica', ['music', 'conciert', 'batucada', 'opera', 'banda', 'orquesta', 'cant']],
  ['teatro', ['teatr', 'monologo', 'comedia', 'performance', 'escen', 'obra de', 'microteatro', 'detective']],
  ['visual', ['expos', 'instalacion', 'visual', 'plastic', 'pintura', 'escultur', 'mural', 'body paint', 'audiovisual', 'pelicula', 'arcilla', 'arte']],
  ['letras', ['literatur', 'escritura', 'conversatorio', 'lanzamiento', 'libro', 'lectura', 'poes']],
  ['feria', ['feria', 'emprend', 'artesan', 'cafe', 'gastronom']],
  ['comunidad', ['recreativ', 'comunitari', 'educativ', 'taller', 'demostracion', 'muestra', 'actividad cultural', 'juego']],
];

function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const INDICE_NORMALIZADO = new Map();
for (const [titulo, ruta] of Object.entries(IMAGENES_EVENTOS)) {
  INDICE_NORMALIZADO.set(normalizar(titulo), ruta);
}

function deducirFamilia(categoriaNombre) {
  const n = String(categoriaNombre ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  let mejor = { familia: 'otras', posicion: Infinity };
  for (const [familia, claves] of FAMILIAS) {
    for (const clave of claves) {
      const i = n.indexOf(clave);
      if (i !== -1 && i < mejor.posicion) mejor = { familia, posicion: i };
    }
  }
  return mejor.familia;
}

/**
 * Busca la ruta de la imagen correspondiente a un evento.
 * 1. Coincidencia exacta o normalizada por título.
 * 2. Detección temática por palabras clave del título.
 * 3. Disciplina artística / categoría del evento.
 *
 * @param {string} titulo Título de la actividad o clave.
 * @param {string} [categoria] Nombre de la categoría.
 * @param {string} [familia] Familia de la categoría (si ya fue calculada).
 * @returns {string} Ruta relativa de la imagen.
 */
export function buscarImagenEvento(titulo, categoria = '', familia = '') {
  if (!titulo && !categoria && !familia) return null;

  // 1. Título exacto o normalizado
  if (titulo) {
    if (IMAGENES_EVENTOS[titulo]) return IMAGENES_EVENTOS[titulo];
    const buscado = normalizar(titulo);
    if (INDICE_NORMALIZADO.has(buscado)) return INDICE_NORMALIZADO.get(buscado);
    for (const [clave, ruta] of INDICE_NORMALIZADO.entries()) {
      if (buscado.includes(clave) || clave.includes(buscado)) {
        return ruta;
      }
    }

    // 2. Palabras clave específicas en el título
    const t = String(titulo).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (t.includes('cafe')) return '/img/eventos/cafe-especialidad.jpg';
    if (t.includes('mural')) return '/img/eventos/lo-que-somos.jpg';
    if (t.includes('juego') || t.includes('calamar')) return '/img/eventos/juegos-madera.jpg';
    if (t.includes('cine') || t.includes('pelicula') || t.includes('estrella')) return '/img/eventos/cine-estrellas.jpg';
    if (t.includes('danza') || t.includes('baile') || t.includes('ballet') || t.includes('folclor')) return '/img/eventos/danzas-mundo.jpg';
    if (t.includes('banda') || t.includes('musica') || t.includes('orquesta') || t.includes('concierto') || t.includes('cotacachi')) return '/img/eventos/banda-cotacachi.jpg';
    if (t.includes('artesan') || t.includes('manos') || t.includes('ceramica') || t.includes('barro')) return '/img/eventos/manos-vivas.jpg';
    if (t.includes('produce') || t.includes('emprend')) return '/img/eventos/loja-produce.jpg';
    if (t.includes('bear') || t.includes('oso')) return '/img/eventos/buddy-bears.jpg';
    if (t.includes('10 ano') || t.includes('retrospectiva') || t.includes('historia')) return '/img/eventos/fiav-10-anos.jpg';
    if (t.includes('territorio') || t.includes('habitar')) return '/img/eventos/territorios-vivos.jpg';
    if (t.includes('libro') || t.includes('lectura') || t.includes('poes') || t.includes('escribe') || t.includes('voces')) return '/img/eventos/cadena-voces.jpg';
    if (t.includes('teatro') || t.includes('titere') || t.includes('monologo') || t.includes('comedia') || t.includes('clown')) return '/img/eventos/arbol-familiar.jpg';
  }

  // 3. Disciplina / Familia visual
  const fam = familia || deducirFamilia(categoria);
  return IMAGENES_DISCIPLINAS[fam] || '/img/eventos/fiav-10-anos.jpg';
}
