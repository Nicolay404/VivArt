// Maqueta 3D del centro de Loja (spec 003) con Three.js, servido desde /vendor (la CSP no permite CDN).
// Solo se carga al abrir el Mapa y solo si hay WebGL y la persona no pidió reducir el movimiento; si algo falla,
// mapa.js vuelve a la ilustración isométrica. Los lugares son <button> reales sobre el lienzo: se pueden recorrer
// con el teclado y los lee un lector de pantalla (el lienzo en sí queda oculto para ellos).
import * as THREE from '../vendor/three/three.module.min.js';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { ESCENA } from './mapa-escena.js';
import { h, icono } from './dom.js';

const E = 0.1; // unidades del mapa oficial → unidades de la escena
const ALTURA = 0.12; // píxeles de altura de la maqueta isométrica → unidades de la escena
const CU = ESCENA.limites.u / 2;
const CV = ESCENA.limites.v / 2;
const DISTANCIA = { min: 16, max: 95 };

const enMundo = (u, v, y = 0) => new THREE.Vector3((u - CU) * E, y, (v - CV) * E);

/** Convierte un marcador (fracciones sobre la ilustración isométrica de respaldo) a coordenadas del suelo. */
export function sueloDeMarcador({ x, y }, p = ESCENA.proyeccion) {
  const du = (x * p.ancho - p.ox) / p.a;
  const dv = (y * p.alto - p.oy) / p.b;
  return { u: (du + dv) / 2, v: (dv - du) / 2 };
}

function texturaTexto(texto, { color = '#3b1d5e', halo = '#ffffff', tam = 56 } = {}) {
  const lienzo = document.createElement('canvas');
  const ctx = lienzo.getContext('2d');
  const fuente = `800 ${tam}px Figtree, "Segoe UI", Arial, sans-serif`;
  ctx.font = fuente;
  lienzo.width = Math.ceil(ctx.measureText(texto).width + tam * 0.8);
  lienzo.height = Math.ceil(tam * 1.5);
  ctx.font = fuente;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = tam * 0.22;
  ctx.strokeStyle = halo;
  ctx.fillStyle = color;
  ctx.strokeText(texto, tam * 0.4, lienzo.height / 2);
  ctx.fillText(texto, tam * 0.4, lienzo.height / 2);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  return { textura, proporcion: lienzo.width / lienzo.height };
}

/** Rótulo pintado sobre el suelo. `angulo` gira el texto alrededor del eje vertical. */
function rotulo(texto, posicion, alto, angulo, opciones) {
  const { textura, proporcion } = texturaTexto(texto, opciones);
  const malla = new THREE.Mesh(
    new THREE.PlaneGeometry(alto * proporcion, alto),
    // Como en un mapa impreso, los nombres se leen siempre: se dibujan encima de los edificios.
    new THREE.MeshBasicMaterial({ map: textura, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }),
  );
  // Orden XYZ: primero se gira el texto en su plano y luego se tumba sobre el suelo.
  malla.rotation.set(-Math.PI / 2, 0, angulo);
  malla.position.copy(posicion);
  malla.renderOrder = 3;
  return malla;
}

function texturaDesfile() {
  const lienzo = document.createElement('canvas');
  lienzo.width = 1024;
  lienzo.height = 32;
  const ctx = lienzo.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, lienzo.width, 0);
  g.addColorStop(0, '#f59e2d');
  g.addColorStop(1, '#c2185b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  const t = new THREE.CanvasTexture(lienzo);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function texturaFlechas() {
  const lienzo = document.createElement('canvas');
  lienzo.width = 64;
  lienzo.height = 32;
  const ctx = lienzo.getContext('2d');
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(24, 8);
  ctx.lineTo(36, 16);
  ctx.lineTo(24, 24);
  ctx.stroke();
  const t = new THREE.CanvasTexture(lienzo);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function texturaHaz() {
  const lienzo = document.createElement('canvas');
  lienzo.width = 4;
  lienzo.height = 128;
  const ctx = lienzo.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, lienzo.height);
  g.addColorStop(0, 'rgba(255,214,140,0)');
  g.addColorStop(1, 'rgba(255,190,90,0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  return new THREE.CanvasTexture(lienzo);
}

function cajasInstanciadas(lista, material, { sombra = true } = {}) {
  const malla = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), material, lista.length);
  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  lista.forEach((c, i) => {
    m.compose(enMundo((c.u0 + c.u1) / 2, (c.v0 + c.v1) / 2, c.y), new THREE.Quaternion(), new THREE.Vector3((c.u1 - c.u0) * E, c.alto, (c.v1 - c.v0) * E));
    malla.setMatrixAt(i, m);
    malla.setColorAt(i, color.set(c.color));
  });
  malla.castShadow = sombra;
  malla.receiveShadow = true;
  return malla;
}

function construirMaqueta(escena) {
  const base = new THREE.Shape(ESCENA.contorno.map(([u, v]) => new THREE.Vector2((u - CU) * E, (v - CV) * E)));
  const losa = new THREE.Mesh(new THREE.ExtrudeGeometry(base, { depth: 1.6, bevelEnabled: false }), [
    new THREE.MeshStandardMaterial({ color: '#e4d6f3', roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ color: '#7a4fb0', roughness: 0.8 }),
  ]);
  losa.rotation.x = Math.PI / 2;
  losa.receiveShadow = true;
  escena.add(losa);

  const plano = (u0, u1, v0, v1, y, alto, color) => ({ u0, u1, v0, v1, y, alto, color });
  escena.add(cajasInstanciadas(ESCENA.manzanas.map(([u0, u1, v0, v1]) => plano(u0, u1, v0, v1, 0, 0.18, '#fbf8fe')), new THREE.MeshStandardMaterial({ roughness: 0.9 }), { sombra: false }));
  escena.add(cajasInstanciadas(ESCENA.parques.map(([u0, u1, v0, v1]) => plano(u0, u1, v0, v1, 0.18, 0.08, '#a9d98f')), new THREE.MeshStandardMaterial({ roughness: 1 }), { sombra: false }));
  const [eu0, eu1, ev0, ev1] = ESCENA.estadio;
  escena.add(cajasInstanciadas([plano(eu0, eu1, ev0, ev1, 0, 0.2, '#8fce78')], new THREE.MeshStandardMaterial({ roughness: 1 }), { sombra: false }));

  // Edificios: paredes y un techo algo más ancho (teja, blanco o lila según la maqueta).
  const paredes = ESCENA.edificios.map(([u0, u1, v0, v1, h, , pared]) => plano(u0, u1, v0, v1, 0.18, Math.max(0.3, h * ALTURA), pared));
  const techos = ESCENA.edificios.map(([u0, u1, v0, v1, h, techo]) => plano(u0 - 0.4, u1 + 0.4, v0 - 0.4, v1 + 0.4, 0.18 + Math.max(0.3, h * ALTURA), 0.22, techo));
  escena.add(cajasInstanciadas(paredes, new THREE.MeshStandardMaterial({ roughness: 0.85 })));
  escena.add(cajasInstanciadas(techos, new THREE.MeshStandardMaterial({ roughness: 0.6 })));

  // Árboles: tronco y copa.
  const troncos = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.11, 1, 6).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#8a6a4f' }), ESCENA.arboles.length);
  const copas = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#5fae5a', roughness: 0.8, flatShading: true }), ESCENA.arboles.length);
  const m = new THREE.Matrix4();
  ESCENA.arboles.forEach(([u, v, r], i) => {
    const t = r * E;
    m.compose(enMundo(u, v, 0.2), new THREE.Quaternion(), new THREE.Vector3(1, t * 1.6, 1));
    troncos.setMatrixAt(i, m);
    m.compose(enMundo(u, v, 0.2 + t * 1.9), new THREE.Quaternion(), new THREE.Vector3(t, t * 1.05, t));
    copas.setMatrixAt(i, m);
  });
  copas.castShadow = true;
  troncos.castShadow = true;
  escena.add(troncos, copas);
}

/** Nombres de calles en el mismo sitio que en el mapa oficial del Circuito Cultural. */
function construirCalles(escena) {
  for (const [nombre, v, ancho, centro] of ESCENA.callesNS) {
    escena.add(rotulo(nombre.toUpperCase(), enMundo(centro, v, 0.03), Math.min(1.9, ancho * E * 1.15), 0, { tam: 52 }));
  }
  for (const [nombre, u, centro] of ESCENA.callesEO) {
    escena.add(rotulo(nombre.toUpperCase(), enMundo(u, centro, 0.03), 1.6, Math.PI / 2, { tam: 52 }));
  }
}

function construirDesfile(escena) {
  const { u0, u1, v } = ESCENA.desfile;
  const largo = (u1 - u0) * E;
  const centro = enMundo((u0 + u1) / 2, v, 0.05);
  const cinta = new THREE.Mesh(new THREE.PlaneGeometry(largo, 1.7), new THREE.MeshBasicMaterial({ map: texturaDesfile(), toneMapped: false }));
  cinta.rotation.x = -Math.PI / 2;
  cinta.position.copy(centro);
  const flechas = texturaFlechas();
  flechas.repeat.set(largo / 2.2, 1);
  const capaFlechas = new THREE.Mesh(new THREE.PlaneGeometry(largo, 1.7), new THREE.MeshBasicMaterial({ map: flechas, transparent: true, depthWrite: false }));
  capaFlechas.rotation.x = -Math.PI / 2;
  capaFlechas.position.copy(centro).setY(0.07);
  const brillo = new THREE.Mesh(
    new THREE.PlaneGeometry(largo + 1.5, 3.2),
    new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  brillo.rotation.x = -Math.PI / 2;
  brillo.position.copy(centro).setY(0.04);
  escena.add(brillo, cinta, capaFlechas);
  // El nombre del desfile va escrito sobre la cinta, como en el mapa oficial.
  const { texto, u } = ESCENA.desfileRotulo;
  escena.add(rotulo(texto, enMundo(u, v, 0.09), 1.25, 0, { color: '#ffffff', halo: '#c2185b', tam: 52 }));
  return flechas;
}

/** Faro de luz y anillo en el suelo para cada lugar del circuito. */
function construirFaros(escena, puntos) {
  const grupo = new THREE.Group();
  const haz = texturaHaz();
  const anillos = [];
  for (const p of puntos) {
    const base = enMundo(p.u, p.v, 0.2);
    const cono = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.75, 5.5, 20, 1, true),
      new THREE.MeshBasicMaterial({ map: haz, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    cono.position.copy(base).setY(base.y + 2.75);
    const anillo = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1.05, 40),
      new THREE.MeshBasicMaterial({ color: '#ffb020', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
    );
    anillo.rotation.x = -Math.PI / 2;
    anillo.position.copy(base).setY(0.22);
    anillos.push(anillo);
    grupo.add(cono, anillo);
  }
  escena.add(grupo);
  return { grupo, anillos };
}

/**
 * Monta la maqueta en `marco` y devuelve { pintar(lista, idActivo), acercar(), alejar(), centrar(), destruir() }.
 * `numeroDe(sede)` da el número del circuito (o null) y `alElegir(id)` abre la ficha de la sede.
 */
export function crearMapa3D({ marco, capa, numeroDe, alElegir }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.classList.add('mapa-3d-lienzo');
  renderer.domElement.setAttribute('aria-hidden', 'true');
  marco.prepend(renderer.domElement);

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(38, 1, 0.5, 400);

  // Luz de atardecer: cielo lila, rebote violeta y un sol cálido desde el oeste que proyecta sombras.
  escena.add(new THREE.HemisphereLight('#fff1e0', '#5b3a8a', 1.5));
  const sol = new THREE.DirectionalLight('#ffd2a1', 2.6);
  sol.position.set(-22, 46, 52);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -60, right: 60, top: 45, bottom: -45, near: 1, far: 160 });
  sol.shadow.bias = -0.0006;
  escena.add(sol);

  construirMaqueta(escena);
  construirCalles(escena);
  const flechas = construirDesfile(escena);
  let faros = null;

  const controles = new OrbitControls(camara, renderer.domElement);
  Object.assign(controles, {
    enableDamping: true,
    dampingFactor: 0.08,
    minDistance: DISTANCIA.min,
    maxDistance: DISTANCIA.max,
    minPolarAngle: 0.35,
    maxPolarAngle: 1.18,
    screenSpacePanning: false,
    keyPanSpeed: 18,
  });
  controles.listenToKeyEvents(marco);
  const { u0, u1, v } = ESCENA.desfile;
  const objetivoInicial = enMundo((u0 + u1) / 2 - 40, v - 30, 0);
  // En pantallas verticales (celular) la cámara se aleja para que entre el circuito completo.
  const centrar = () => {
    const lejos = camara.aspect < 1 ? 1.75 : 1;
    controles.target.copy(objetivoInicial);
    camara.position.copy(objetivoInicial).add(new THREE.Vector3(30, 34, 30).multiplyScalar(lejos));
    controles.update();
  };
  let tocado = false;
  controles.addEventListener('start', () => {
    tocado = true;
  });
  // El centro de la vista no sale de la maqueta.
  controles.addEventListener('change', () => {
    const t = controles.target;
    const antes = t.clone();
    t.x = THREE.MathUtils.clamp(t.x, -CU * E, CU * E);
    t.z = THREE.MathUtils.clamp(t.z, -CV * E, CV * E);
    camara.position.add(t.clone().sub(antes));
  });
  const acercarA = (factor) => {
    const desde = camara.position.clone().sub(controles.target);
    desde.setLength(THREE.MathUtils.clamp(desde.length() * factor, DISTANCIA.min, DISTANCIA.max));
    camara.position.copy(controles.target).add(desde);
    controles.update();
  };

  // Marcadores: botones HTML colocados sobre la proyección de cada lugar.
  let marcadores = [];
  const proyeccion = new THREE.Vector3();
  function colocarMarcadores() {
    const ancho = marco.clientWidth;
    const alto = marco.clientHeight;
    for (const { boton, punto } of marcadores) {
      proyeccion.copy(punto).project(camara);
      const visible = proyeccion.z < 1 && Math.abs(proyeccion.x) < 1.2 && Math.abs(proyeccion.y) < 1.2;
      boton.hidden = !visible;
      if (visible) {
        boton.style.setProperty('--x', `${((proyeccion.x + 1) / 2) * ancho}px`);
        boton.style.setProperty('--y', `${((1 - proyeccion.y) / 2) * alto}px`);
      }
    }
  }

  function pintar(lista, idActivo) {
    const conMarcador = lista.filter((s) => s.marker);
    marcadores = conMarcador.map((s) => {
      const { u, v: vv } = sueloDeMarcador(s.marker);
      const numero = numeroDe(s);
      const boton = h(
        'button',
        {
          type: 'button',
          class: `marcador-3d ${numero ? 'con-numero' : ''} ${s.id === idActivo ? 'activo' : ''}`,
          'aria-pressed': String(s.id === idActivo),
          'aria-label': numero ? `Lugar ${numero}: ${s.name}` : s.name,
          onclick: () => alElegir(s.id),
        },
        numero ? h('span', { class: 'marcador-3d-numero' }, String(numero)) : icono('sede', 'icono-sm'),
        h('span', { class: 'marcador-nombre' }, s.name),
      );
      return { boton, punto: enMundo(u, vv, 5.9), suelo: { u, v: vv } };
    });
    capa.replaceChildren(...marcadores.map((m) => m.boton));
    if (faros) escena.remove(faros.grupo);
    faros = construirFaros(
      escena,
      marcadores.map((m) => m.suelo),
    );
    colocarMarcadores();
    if (!activo) {
      activo = true;
      requestAnimationFrame(cuadro);
    }
  }

  function medir() {
    const ancho = marco.clientWidth;
    const alto = marco.clientHeight;
    if (!ancho || !alto) return;
    renderer.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
    // Mientras la persona no haya movido la maqueta, la vista inicial se adapta al tamaño del recuadro.
    if (!tocado) centrar();
  }
  const observador = new ResizeObserver(medir);
  observador.observe(marco);
  medir();

  const reloj = new THREE.Clock();
  let activo = true;
  function cuadro() {
    // Fuera de la página (vista de Lista u otra pestaña de la app) el bucle se detiene; `pintar` lo reanuda.
    if (!activo || !marco.isConnected) {
      activo = false;
      return;
    }
    const t = reloj.getElapsedTime();
    flechas.offset.x = -t * 0.35;
    if (faros) {
      const pulso = 1 + Math.sin(t * 2.4) * 0.12;
      for (const a of faros.anillos) a.scale.set(pulso, pulso, pulso);
    }
    controles.update();
    renderer.render(escena, camara);
    colocarMarcadores();
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);

  function destruir() {
    activo = false;
    observador.disconnect();
    controles.dispose();
    escena.traverse((o) => {
      o.geometry?.dispose();
      for (const mat of [o.material].flat().filter(Boolean)) {
        mat.map?.dispose();
        mat.dispose();
      }
    });
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { pintar, acercar: () => acercarA(0.75), alejar: () => acercarA(1 / 0.75), centrar, destruir };
}

