import { normalizar } from './text.js';
import { fechaValida, diaDeLaSemana } from '../clock.js';

// Intérprete de Alforjita (spec 008, D-04): reglas simples, sin IA generativa.
// Convierte un texto libre acotado en criterios de búsqueda o en una intención. Es puro: no lee la base ni el reloj;
// recibe «hoy» (en hora de Loja) y los nombres del catálogo publicado. Nunca guarda ni devuelve el texto recibido.

export const TEXTO_MAX = 200;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const NUMEROS = { una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };
const PALABRAS_VACIAS = new Set(['para', 'como', 'esta', 'este', 'esto', 'estos', 'estas', 'sobre', 'entre', 'desde', 'hasta', 'donde', 'cual', 'cuales', 'quien']);

/** Quita caracteres de control y espacios repetidos. Devuelve el texto limpio (puede quedar vacío) o null si no es texto. */
export function limpiarTexto(valor) {
  if (typeof valor !== 'string') return null;
  return valor
    .replaceAll(/[\u0000-\u001f\u007f]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

const dos = (n) => String(n).padStart(2, '0');
const hhmm = (h, m = 0) => `${dos(h)}:${dos(m)}`;

/** Suma días a una fecha AAAA-MM-DD. */
export function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Texto preparado para buscar frases completas: sin tildes, sin signos y con un espacio a cada lado. */
function preparar(texto) {
  let t = normalizar(texto)
    .replaceAll(/\S+@\S+/g, ' ') // correos: datos personales, no se usan
    .replaceAll(/\d(?:[ -]?\d){6,}/g, (m) => (/^\d{4}-\d{2}-\d{2}$/.test(m) ? m : ' ')) // teléfonos, cédulas: no se usan
    .replaceAll(/(\d)\s?([ap])\.?\s?m\b\.?/g, '$1 $2m ')
    .replaceAll(/(\d)h\b/g, '$1');
  t = t.replaceAll(/[¿?¡!,;"'()«»“”]/g, ' ').replaceAll(/\.(?!\d)/g, ' ');
  return ` ${t.replaceAll(/\s+/g, ' ').trim()} `;
}

/** Busca una expresión regular en el texto; si la encuentra, la borra del texto y devuelve la coincidencia. */
function extraer(estado, re) {
  const m = estado.t.match(re);
  if (!m) return null;
  estado.t = `${estado.t.slice(0, m.index)} ${estado.t.slice(m.index + m[0].length)}`;
  return m;
}

const contiene = (t, re) => re.test(t);
/** Expresión que encuentra cualquiera de las frases, como palabras completas dentro del texto preparado. */
const alguna = (frases) => new RegExp(` (?:${frases.join('|')}) `);
const escapar = (s) => s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

// ---------- Horas (M-14) ----------

// Con cifras el artículo es opcional («después de 6»); con palabras es obligatorio («a la una»), para no leer «a una función».
const NUM = String.raw`(?:las |la )?(\d{1,2})(?:(?::|h|\.)(\d{2}))?|(?:las |la )(${Object.keys(NUMEROS).join('|')})(?: y (media|cuarto))?`;
const SUF = `(?: (am|pm|de la manana|de la madrugada|de la tarde|de la noche|horas|hrs|hr|h))?`;
const RE_HORA = new RegExp(` (despues de|desde|a partir de|luego de|antes de|hasta|a) (?:${NUM})${SUF}(?= )`);
const SUFIJOS_MANANA = new Set(['am', 'de la manana', 'de la madrugada']);
const MINUTOS_PALABRA = { media: 30, cuarto: 15 };

/** Hora y minutos tal como se escribieron (en cifras o en palabras). */
function numeroDeHora(m) {
  if (m[2] === undefined && m[4] !== undefined) return { h: NUMEROS[m[4]], min: MINUTOS_PALABRA[m[5]] ?? 0 };
  return { h: Number(m[2]), min: m[3] ? Number(m[3]) : 0 };
}

/** Convierte la hora leída a 24 h: de 1 a 11 sin «de la mañana» ni «am» es de tarde o noche. */
export function horaDe(m) {
  const { h, min } = numeroDeHora(m);
  if (h > 23 || min > 59) return null;
  if (SUFIJOS_MANANA.has(m[6])) return h > 12 ? null : hhmm(h % 12, min);
  return hhmm(h >= 1 && h <= 11 ? h + 12 : h, min);
}

function leerHoras(estado, criterios) {
  for (let i = 0; i < 2; i += 1) {
    const m = extraer(estado, RE_HORA);
    if (!m) break;
    const hora = horaDe(m);
    if (!hora) continue;
    const tipo = m[1];
    if (tipo === 'antes de' || tipo === 'hasta') criterios.until = hora;
    else if (tipo === 'a') {
      criterios.from = hora;
      criterios.until = hhmm(Number(hora.slice(0, 2)) + 1);
    } else criterios.from = hora;
  }
  if (extraer(estado, / (al )?mediodia /)) {
    criterios.from ??= '12:00';
  }
}

const PARTES = [
  { re: / (?:en|por|de) la (?:manana|madrugada) /, from: null, until: '12:00' },
  { re: / (?:en|por|de) la tarde /, from: '12:00', until: '18:00' },
  { re: / (?:en|por|de) la noche /, from: '18:00', until: null },
];

function leerPartesDelDia(estado, criterios) {
  const esta = extraer(estado, / esta (manana|tarde|noche) /);
  if (esta) {
    criterios.date ??= estado.hoy;
    estado.diaExplicito = true;
    const parte = { manana: PARTES[0], tarde: PARTES[1], noche: PARTES[2] }[esta[1]];
    criterios.from ??= parte.from;
    criterios.until ??= parte.until;
  }
  for (const parte of PARTES) {
    if (extraer(estado, parte.re)) {
      criterios.from ??= parte.from;
      criterios.until ??= parte.until;
    }
  }
}

// ---------- Días (M-14) ----------

function leerDias(estado, criterios) {
  const fijar = (fecha) => {
    if (criterios.date) return;
    criterios.date = fecha;
    estado.diaExplicito = true;
  };
  const iso = extraer(estado, / (\d{4}-\d{2}-\d{2}) /);
  if (iso) {
    if (fechaValida(iso[1])) fijar(iso[1]);
    else estado.fechaInvalida = true;
  }
  if (extraer(estado, / pasado manana /)) fijar(sumarDias(estado.hoy, 2));
  if (extraer(estado, / hoy /)) fijar(estado.hoy);
  if (extraer(estado, / manana /)) fijar(sumarDias(estado.hoy, 1));

  // «sábado 21», «el 21», «21 de noviembre», «el día 22», «sábado»
  const reFecha = new RegExp(String.raw` (?:(${DIAS.join('|')}) )?(?:el )?(?:dia )?(\d{1,2})(?: de (${MESES.join('|')}))?(?= )`);
  const conNumero = [...estado.t.matchAll(new RegExp(reFecha.source, 'g'))].find((m) => m[1] || m[3] || / (el|dia) \d/.test(m[0]));
  if (conNumero) {
    estado.t = `${estado.t.slice(0, conNumero.index)} ${estado.t.slice(conNumero.index + conNumero[0].length)}`;
    const [anio, mesHoy] = estado.hoy.split('-').map(Number);
    const mes = conNumero[3] ? MESES.indexOf(conNumero[3]) + 1 : mesHoy;
    const fecha = `${anio}-${dos(mes)}-${dos(Number(conNumero[2]))}`;
    if (fechaValida(fecha)) fijar(fecha);
    else estado.fechaInvalida = true;
    return;
  }
  const dia = extraer(estado, new RegExp(` (${DIAS.join('|')}) `));
  if (dia) {
    const buscado = DIAS.indexOf(dia[1]) + 1;
    const actual = diaDeLaSemana(estado.hoy);
    fijar(sumarDias(estado.hoy, (buscado - actual + 7) % 7));
  }
}

// ---------- Acceso ----------

function leerAcceso(estado, criterios) {
  if (extraer(estado, / (gratis|gratuit[ao]s?|libres?|sin costo|entrada libre|no se paga) /)) criterios.access = 'free';
  else if (extraer(estado, / (de pago|pagad[ao]s?|con costo|que se pagan?) /)) criterios.access = 'paid';
}

// ---------- Nombres del catálogo ----------

const palabrasDistintivas = (nombre) => nombre.split(' ').filter((p) => p.length >= 4 && !PALABRAS_VACIAS.has(p));

/**
 * Reconoce categorías, sedes y títulos por su nombre normalizado. Gana el nombre más largo que aparece completo;
 * después, una sede por su primera palabra distintiva (si es única) y un título si están todas sus palabras distintivas.
 */
function leerNombres(estado, { categorias, sedes, actividades }) {
  const encontrados = nombresCompletos(estado, { categorias, sedes, actividades });
  if (encontrados.sede.length === 0) encontrados.sede = sedePorPrimeraPalabra(estado, sedes);
  if (encontrados.actividad.length === 0) encontrados.actividad = titulosPorPalabras(estado, actividades);
  if (encontrados.actividad.length === 0) encontrados.actividad = titulosAMedias(estado, actividades);
  return encontrados;
}

/** Nombres que aparecen completos; gana el más largo y se borra del texto para no contarlo dos veces. */
function nombresCompletos(estado, { categorias, sedes, actividades }) {
  const candidatos = [];
  for (const c of categorias) {
    const n = normalizar(c.name);
    for (const forma of new Set([n, `${n}s`, `${n}es`])) candidatos.push({ tipo: 'categoria', id: c.id, forma });
  }
  for (const s of sedes) candidatos.push({ tipo: 'sede', id: s.id, forma: normalizar(s.name) });
  for (const a of actividades) candidatos.push({ tipo: 'actividad', id: a.id, forma: normalizar(a.title) });
  candidatos.sort((x, y) => y.forma.length - x.forma.length);

  const encontrados = { categoria: [], sede: [], actividad: [] };
  for (const c of candidatos.filter((x) => x.forma)) {
    if (estado.t.includes(` ${c.forma} `)) {
      encontrados[c.tipo].push(c.id);
      extraer(estado, new RegExp(` ${escapar(c.forma)} `));
    }
  }
  return encontrados;
}

/** Una sede por su primera palabra distintiva, si ninguna otra sede empieza igual («el museo»). */
function sedePorPrimeraPalabra(estado, sedes) {
  const porPrimera = new Map();
  for (const s of sedes) {
    const primera = palabrasDistintivas(normalizar(s.name))[0];
    if (primera) porPrimera.set(primera, porPrimera.has(primera) ? null : s.id);
  }
  const elegida = [...porPrimera].find(([palabra, id]) => id && estado.t.includes(` ${palabra} `));
  if (!elegida) return [];
  extraer(estado, new RegExp(` ${escapar(elegida[0])} `));
  return [elegida[1]];
}

/** Títulos con todas sus palabras distintivas en el texto, en cualquier orden. */
function titulosPorPalabras(estado, actividades) {
  return actividades
    .filter((a) => {
      const palabras = palabrasDistintivas(normalizar(a.title));
      return palabras.length >= 2 && palabras.every((p) => estado.t.includes(` ${p} `));
    })
    .map((a) => a.id);
}

/**
 * Título a medias («cantos de luna»): al menos dos palabras distintivas que salen en títulos, y los títulos que las
 * tienen todas. Si hay varios, se pide elegir.
 */
function titulosAMedias(estado, actividades) {
  const enTitulos = new Set(actividades.flatMap((a) => palabrasDistintivas(normalizar(a.title))));
  const pistas = [...new Set(palabrasDistintivas(estado.t.trim()))].filter((p) => enTitulos.has(p));
  if (pistas.length < 2) return [];
  return actividades.filter((a) => pistas.every((p) => palabrasDistintivas(normalizar(a.title)).includes(p))).map((a) => a.id);
}

// ---------- Intenciones ----------

// Las frases se escriben como listas y se convierten en expresiones con `alguna`: así cada lista se lee y se amplía fácil.
const PARIENTES = ['amig\\w*', 'herman\\w*', 'mama', 'papa', 'novi\\w*', 'espos\\w*', 'hij\\w*', 'compan\\w*', 'pareja', 'famil\\w*'];
const FUERA = [
  ['others_data', alguna([`(?:de )?(?:mi|mis|tu|su) (?:${PARIENTES.join('|')})`, 'de otra persona', 'de otro usuario', 'de otra cuenta'])],
  ['tickets', alguna(['(?:mis|mi) (?:entradas?|boletos?|pedidos?|compras?|tickets?)'])],
  ['redeem', alguna(['canje\\w*', 'reclam\\w*', 'escane\\w*'])],
  ['passport_personal', alguna(['mis sellos?', 'mi sello', 'mi pasaporte', 'mi progreso', 'mis rutas', 'mi ruta', 'mis insignias?', 'mi insignia', 'cuantos sellos tengo'])],
  ['buy', alguna(['compr\\w*', 'pagar', 'reserv\\w*', 'carrito', 'adquir\\w*'])],
  [
    'modify',
    alguna([
      ...['cambiar', 'modificar', 'editar', 'borrar', 'eliminar', 'publicar', 'agregar', 'anadir', 'cancelar', 'mover', 'reprogramar', 'subir'],
      ...['borrador\\w*', 'propuestas?', 'sin publicar', 'no publicad\\w*'],
    ]),
  ],
];
const RE_PASAPORTE = alguna(['pasaportes?', 'sellos?', 'rutas?', 'insignias?']);
const RE_PRECIO = alguna(['cuanto cuesta\\w*', 'cuanto vale\\w*', 'cuanto cobran', 'cuanto sale', 'precios?', 'costos?', 'tarifas?', 'valor de la entrada']);
const RE_FIN = alguna([
  'a que hora (?:termina|acaba|finaliza|sale)',
  'cuando (?:termina|acaba|finaliza)',
  'hora de (?:fin|salida|termino)',
  'cuanto dura',
  'duracion',
  'dura',
]);
const ESCALONES = ['sin escalones', 'escalon\\w*', 'silla de ruedas', 'rampas?', 'movilidad reducida'];
const RE_ESCALONES = alguna(ESCALONES);
const RE_BANO = alguna(['banos?']);
const RE_ACCESIBLE = alguna(['accesib\\w*', ...ESCALONES, 'banos?(?: accesibles?)?', 'discapacidad']);
const RE_CAMBIOS = alguna(['cambios?', 'cancelad\\w*', 'cancelaron', 'cancelo', 'reprogramad\\w*', 'reprogramaron', 'reprogramo', 'suspendid\\w*', 'avisos?']);
const RE_GENERICO = alguna([
  'que hay',
  'que puedo ver',
  'funcion\\w*',
  'eventos?',
  'actividad\\w*',
  'programacion',
  'agenda',
  'planes?',
  'obras?',
  'espectaculos?',
  'presentacion\\w*',
  'show\\w*',
]);

/** Intenciones que no son una búsqueda (fuera de alcance, precio, fin, accesibilidad, Pasaporte, cambios), o null. */
function intencionDirecta(estado, nombres) {
  const resto = estado.t;
  const fuera = FUERA.find(([, re]) => contiene(resto, re));
  if (fuera) return { intent: 'out_of_scope', topic: fuera[0], activityIds: nombres.actividad };
  if (contiene(resto, RE_PRECIO) && !/ sin costo /.test(resto)) return { intent: 'price', activityIds: nombres.actividad };
  if (contiene(resto, RE_FIN)) {
    const criterios = { date: null, from: null, until: null };
    leerHoras(estado, criterios);
    leerPartesDelDia(estado, criterios);
    leerDias(estado, criterios);
    return { intent: 'end', activityIds: nombres.actividad, date: criterios.date };
  }
  if (contiene(resto, RE_ACCESIBLE)) {
    const features = [];
    if (contiene(resto, RE_ESCALONES)) features.push('step_free');
    if (contiene(resto, RE_BANO)) features.push('accessible_toilet');
    return { intent: 'accessibility', venueIds: nombres.sede, features: features.length ? features : ['step_free', 'accessible_toilet'] };
  }
  if (contiene(resto, RE_PASAPORTE)) return { intent: 'passport_routes' };
  if (contiene(resto, RE_CAMBIOS) && nombres.actividad.length === 0) return { intent: 'changes' };
  return null;
}

/**
 * @param texto texto ya limpio (1–200 caracteres)
 * @param ctx { hoy: 'AAAA-MM-DD', categorias: [{id,name}], sedes: [{id,name}], actividades: [{id,title}] }
 * @returns { intent, criteria?, assumedDay?, activityIds?, venueIds?, features?, topic?, invalidDate? }
 */
export function interpretar(texto, { hoy, categorias = [], sedes = [], actividades = [] }) {
  const estado = { t: preparar(texto), hoy, diaExplicito: false, fechaInvalida: false };
  const criterios = { date: null, from: null, until: null, categoryId: null, venueId: null, access: null, activityId: null };

  const nombres = leerNombres(estado, { categorias, sedes, actividades });
  const directa = intencionDirecta(estado, nombres);
  if (directa) return directa;

  leerHoras(estado, criterios);
  leerPartesDelDia(estado, criterios);
  leerDias(estado, criterios);
  leerAcceso(estado, criterios);
  criterios.categoryId = nombres.categoria[0] ?? null;
  criterios.venueId = nombres.sede[0] ?? null;
  if (nombres.actividad.length === 1) criterios.activityId = nombres.actividad[0];

  const reconocido = [
    estado.diaExplicito,
    criterios.from,
    criterios.until,
    criterios.categoryId,
    criterios.venueId,
    criterios.access,
    nombres.actividad.length > 0,
    contiene(estado.t, RE_GENERICO),
  ].some(Boolean);
  if (!reconocido) return { intent: 'not_understood', invalidDate: estado.fechaInvalida };

  // Sin día: hoy en hora de Loja (FR-007), salvo si se pregunta por una actividad concreta: entonces se buscan
  // sus funciones desde hoy, porque «¿cuándo es…?» no se responde bien mirando solo hoy.
  let assumedDay = false;
  if (!criterios.date && nombres.actividad.length === 0) {
    criterios.date = hoy;
    assumedDay = true;
  }
  return { intent: 'search', criteria: criterios, assumedDay, activityIds: nombres.actividad, invalidDate: estado.fechaInvalida };
}
