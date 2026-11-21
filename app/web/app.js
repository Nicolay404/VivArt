// Enrutador principal de VIVART (specs 001, 002, 003 y 005).
// Módulos ES sin dependencias ni compilación. Sin inserción de HTML dinámico ni geolocalización.
import { h, icono, aviso } from './js/dom.js';
import { apiIdentidad } from './js/api.js';
import { pantallaAgenda, pantallaFicha, pantallaProximamente } from './js/publico.js';
import {
  registro,
  ingresar,
  verificar,
  recuperar,
  restablecer,
  activar,
  perfil,
  retorno,
  demoRetorno,
  buzon,
  panelRoles,
  historialPermisos,
} from './js/cuenta.js';
import { pantallaBandeja, tieneRolPanel, barraPanel } from './js/panel-bandeja.js';
import { pantallaEditor } from './js/panel-editor.js';
import { pantallaCatalogos } from './js/panel-catalogos.js';
import { pantallaCarga } from './js/panel-carga.js';
import { pantallaCarrito, pantallaPedido, unidadesEnCarrito } from './js/carrito.js';
import { pantallaEntradas } from './js/entradas.js';
import { pantallaAcceso } from './js/acceso.js';
import { pantallaVentas, pantallaVentasActividad } from './js/panel-ventas.js';

const raiz = document.querySelector('#contenido');
const navegacion = document.querySelector('#navegacion');
const barraMovil = document.querySelector('#barra-movil');
const botonMenu = document.querySelector('#boton-menu');

let persona = null;

async function cargarPersona() {
  const r = await apiIdentidad('GET', '/me');
  persona = r.ok ? r.datos : null;
}

function establecerPersona(nueva) {
  persona = nueva;
}

function abrirMenu(abierto) {
  botonMenu.setAttribute('aria-expanded', String(abierto));
  document.body.classList.toggle('menu-abierto', abierto);
}

botonMenu.addEventListener('click', () => abrirMenu(botonMenu.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape' && botonMenu.getAttribute('aria-expanded') === 'true') {
    abrirMenu(false);
    botonMenu.focus();
  }
});

async function salir() {
  await apiIdentidad('POST', '/auth/logout');
  persona = null;
  aviso('Cerraste la sesión.', 'ok');
  navegar('/', true, false);
}

function pintarNavegacion() {
  const actual = location.pathname;
  const esAgenda = actual === '/' || actual === '/agenda' || actual.startsWith('/actividad/');
  const esPanel = actual.startsWith('/panel');

  const enlace = (ruta, texto, activo = actual === ruta) =>
    h('a', { href: ruta, 'data-enlace': true, 'aria-current': activo ? 'page' : null }, texto);

  const principales = [
    enlace('/mapa', 'Mapa', actual === '/mapa'),
    enlace('/', 'Agenda', esAgenda),
    enlace('/recorrido', 'Mi recorrido', actual === '/recorrido'),
    enlace('/pasaporte', 'Pasaporte', actual === '/pasaporte'),
  ];

  const cuentaItems = [];
  const enCarrito = unidadesEnCarrito();
  cuentaItems.push(enlace('/carrito', enCarrito ? `Carrito (${enCarrito})` : 'Carrito'));
  if (persona) {
    if (tieneRolPanel(persona)) {
      cuentaItems.push(enlace('/panel/actividades', 'Panel editorial', esPanel));
    }
    cuentaItems.push(enlace('/perfil', 'Mi cuenta'));
    cuentaItems.push(h('button', { type: 'button', class: 'secundario boton-nav-salir', onclick: salir }, 'Salir'));
  } else {
    cuentaItems.push(enlace('/ingresar', 'Ingresar'), enlace('/registro', 'Crear cuenta'));
  }

  const demo = h(
    'div',
    { class: 'nav-demo', role: 'group', 'aria-label': 'Herramientas de demostración' },
    enlace('/demo/buzon', 'Buzón de pruebas'),
    enlace('/demo/retorno', 'Demo retorno'),
  );

  navegacion.replaceChildren(
    h('div', { class: 'nav-grupo nav-publica' }, principales),
    h('div', { class: 'nav-grupo nav-cuenta' }, cuentaItems),
    demo,
  );

  // Barra inferior móvil (navegacion.md: Mapa · Agenda · Pasaporte)
  const tabMovil = (ruta, nombreIcono, texto, activo) =>
    h(
      'a',
      { href: ruta, 'data-enlace': true, class: `tab-movil ${activo ? 'activa' : ''}`, 'aria-current': activo ? 'page' : null },
      icono(nombreIcono, 'icono-tab'),
      h('span', {}, texto),
    );

  barraMovil.replaceChildren(
    tabMovil('/mapa', 'sede', 'Mapa', actual === '/mapa'),
    tabMovil('/', 'calendario', 'Agenda', esAgenda),
    tabMovil('/pasaporte', 'pasaporte', 'Pasaporte', actual === '/pasaporte'),
  );
}

async function resolverRuta(ruta) {
  const ctx = {
    persona,
    navegar,
    cargarPersona,
    establecerPersona,
    obtenerPersona: () => persona,
    barraPanel: (r) => barraPanel(persona, r),
  };

  if (ruta === '/' || ruta === '/agenda') return { ancho: 'completo', contenido: await pantallaAgenda() };
  if (ruta === '/recorrido') {
    const { pantallaRecorrido } = await import('./js/recorrido.js');
    return { ancho: 'normal', contenido: await pantallaRecorrido(ctx) };
  }
  if (ruta === '/mapa') {
    // El mapa se importa solo al abrir la pestaña: la Agenda y las fichas no lo esperan (spec 003, FR-004).
    try {
      const { pantallaMapa } = await import('./js/mapa.js');
      return { ancho: 'completo', contenido: await pantallaMapa() };
    } catch {
      return {
        ancho: 'normal',
        contenido: h(
          'section',
          { class: 'estado-vacio estado-error', role: 'alert' },
          h('h1', {}, 'No pudimos cargar el mapa'),
          h('p', {}, 'La Agenda y las fichas siguen disponibles mientras tanto.'),
          h('a', { href: '/agenda', 'data-enlace': true, class: 'boton' }, 'Ir a la Agenda'),
        ),
      };
    }
  }
  if (ruta === '/pasaporte') {
    return {
      ancho: 'normal',
      contenido: pantallaProximamente(
        'Pasaporte Vivo',
        'Muy pronto podrás coleccionar sellos en las funciones, recorrer rutas culturales y desbloquear insignias del festival.',
        'Esta sección se construye en los specs 006 y 007 (Pasaporte, sellos y rutas).',
      ),
    };
  }

  const matchActividad = ruta.match(/^\/actividad\/([^/]+)$/);
  if (matchActividad) {
    return { ancho: 'ficha', contenido: await pantallaFicha(decodeURIComponent(matchActividad[1])) };
  }

  // Panel editorial y administración
  if (ruta === '/panel' || ruta === '/panel/actividades') {
    return { ancho: 'panel', contenido: await pantallaBandeja(ctx) };
  }
  const matchEditor = ruta.match(/^\/panel\/actividades\/([^/]+)$/);
  if (matchEditor) {
    return { ancho: 'panel', contenido: await pantallaEditor({ ...ctx, id: decodeURIComponent(matchEditor[1]) }) };
  }
  if (ruta === '/panel/ventas') return { ancho: 'panel', contenido: await pantallaVentas(ctx) };
  const matchVentas = ruta.match(/^\/panel\/ventas\/actividad\/([^/]+)$/);
  if (matchVentas) return { ancho: 'panel', contenido: await pantallaVentasActividad({ ...ctx, id: decodeURIComponent(matchVentas[1]) }) };

  // Compra y entradas (spec 005)
  if (ruta === '/carrito') return { ancho: 'normal', contenido: await pantallaCarrito(ctx) };
  if (ruta === '/mis-entradas') return { ancho: 'normal', contenido: await pantallaEntradas(ctx) };
  if (ruta === '/acceso') return { ancho: 'normal', contenido: await pantallaAcceso(ctx) };
  const matchPedido = ruta.match(/^\/pedido\/([^/]+)$/);
  if (matchPedido) return { ancho: 'normal', contenido: await pantallaPedido({ ...ctx, id: decodeURIComponent(matchPedido[1]) }) };

  if (ruta === '/panel/catalogos') return { ancho: 'panel', contenido: await pantallaCatalogos(ctx) };
  if (ruta === '/panel/carga') return { ancho: 'panel', contenido: await pantallaCarga(ctx) };
  if (ruta === '/panel/roles') return { ancho: 'panel', contenido: await panelRoles(ctx) };
  if (ruta === '/panel/historial') return { ancho: 'panel', contenido: await historialPermisos(ctx) };

  // Pantallas de cuenta y demo (spec 001)
  const estaticas = {
    '/registro': () => registro(ctx),
    '/ingresar': () => ingresar(ctx),
    '/verificar': () => verificar(ctx),
    '/recuperar': () => recuperar(ctx),
    '/restablecer': () => restablecer(ctx),
    '/activar': () => activar(ctx),
    '/perfil': () => perfil(ctx),
    '/retorno': () => retorno(ctx),
    '/demo/retorno': () => demoRetorno(ctx),
    '/demo/buzon': () => buzon(ctx),
  };

  if (estaticas[ruta]) return { ancho: 'normal', contenido: await estaticas[ruta]() };

  return {
    ancho: 'normal',
    contenido: h(
      'section',
      { class: 'estado-vacio' },
      h('h1', {}, 'No encontramos esta página'),
      h('p', {}, 'El enlace puede estar incompleto o haber cambiado.'),
      h('a', { href: '/', 'data-enlace': true, class: 'boton' }, 'Volver a la Agenda'),
    ),
  };
}

async function pintar() {
  const { ancho, contenido } = await resolverRuta(location.pathname);
  raiz.replaceChildren(...[contenido].flat().filter(Boolean));
  raiz.className = ancho === 'completo' ? 'main-completo' : ancho === 'panel' ? 'main-panel' : ancho === 'ficha' ? 'main-ficha' : 'main-normal';
  abrirMenu(false);
  pintarNavegacion();
  const h1 = raiz.querySelector('h1')?.textContent?.trim();
  document.title = h1 ? `${h1} · VIVART` : 'VIVART · Festival Internacional de Artes Vivas de Loja';
  raiz.focus();
}

async function irA(ruta, historia, recargarPersona) {
  if (historia) history.pushState({}, '', ruta);
  if (recargarPersona) await cargarPersona();
  await pintar();
  window.scrollTo({ top: 0 });
}

function navegar(ruta, historia = true, recargarPersona = true) {
  irA(ruta, historia, recargarPersona).catch(() => aviso('No se pudo cargar la página. Inténtalo de nuevo.', 'error'));
}

document.addEventListener('click', (evento) => {
  const enlace = evento.target.closest?.('a[data-enlace]');
  if (!enlace || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
  evento.preventDefault();
  aviso('');
  navegar(enlace.getAttribute('href'));
});

// El contador del carrito se actualiza al agregar o quitar entradas.
document.addEventListener('vivart:carrito', () => pintarNavegacion());

window.addEventListener('popstate', () => navegar(location.pathname + location.search, false));

await cargarPersona();
await pintar();
