// Interfaz web de VIVART para el spec 001: cuenta, sesión, recuperación, roles e historial.
// Sin dependencias. Todo el texto dinámico se inserta como nodos de texto (nunca como HTML) para evitar inyección.
// Esta interfaz no pide ubicación y no construye carrito, pago, canje ni Pasaporte (son de otros specs).
const API = '/api/identidad';
const raiz = document.querySelector('#contenido');
const navegacion = document.querySelector('#navegacion');
const zonaAvisos = document.querySelector('#avisos');

let persona = null;

function h(etiqueta, atributos = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'onclick') el.addEventListener('click', v);
    else if (k === 'onsubmit') el.addEventListener('submit', v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const hijo of hijos.flat()) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return el;
}

async function api(metodo, ruta, cuerpo) {
  const respuesta = await fetch(API + ruta, {
    method: metodo,
    credentials: 'same-origin',
    headers: cuerpo !== undefined ? { 'content-type': 'application/json' } : {},
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  let datos = null;
  if (respuesta.status !== 204) {
    try { datos = await respuesta.json(); } catch { datos = null; }
  }
  return { ok: respuesta.ok, status: respuesta.status, datos };
}

function aviso(texto, tipo = 'info') {
  zonaAvisos.replaceChildren();
  if (!texto) return;
  const clases = { error: 'aviso error-caja', ok: 'aviso ok-caja' };
  const clase = clases[tipo] ?? 'aviso';
  zonaAvisos.append(h('p', { class: clase }, texto));
}

function campo({ id, etiqueta, tipo = 'text', autocompletar, ayuda, valor = '' }) {
  const ayudaId = ayuda ? `${id}-ayuda` : null;
  const errorId = `${id}-error`;
  const input = h('input', {
    id, name: id, type: tipo, autocomplete: autocompletar, value: valor, required: true,
    'aria-describedby': [ayudaId, errorId].filter(Boolean).join(' '),
  });
  const error = h('p', { id: errorId, class: 'error', hidden: true });
  const el = h('div', { class: 'campo' }, h('label', { for: id }, etiqueta), input, ayuda ? h('p', { id: ayudaId, class: 'ayuda' }, ayuda) : null, error);
  return {
    el, input,
    mostrarError(texto) { error.textContent = texto; error.hidden = false; input.setAttribute('aria-invalid', 'true'); },
    limpiar() { error.hidden = true; error.textContent = ''; input.removeAttribute('aria-invalid'); },
  };
}

/** Formulario con errores junto al campo (RNF-02) y foco en el primer error. */
function formulario({ campos, boton, alEnviar }) {
  const porId = Object.fromEntries(campos.map((c) => [c.input.id, c]));
  const enviar = h('button', { type: 'submit' }, boton);
  const form = h('form', { novalidate: true }, ...campos.map((c) => c.el), enviar);
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    campos.forEach((c) => c.limpiar());
    aviso('');
    enviar.disabled = true;
    try {
      const valores = Object.fromEntries(campos.map((c) => [c.input.id, c.input.value]));
      const r = await alEnviar(valores);
      if (r && !r.ok) {
        const objetivo = porId[r.datos?.field];
        if (objetivo) { objetivo.mostrarError(r.datos.message); objetivo.input.focus(); }
        else aviso(r.datos?.message ?? 'No se pudo completar la operación.', 'error');
      }
    } finally {
      enviar.disabled = false;
    }
  });
  return form;
}

function parametro(nombre) {
  return new URLSearchParams(location.search).get(nombre) ?? '';
}

async function cargarPersona() {
  const r = await api('GET', '/me');
  persona = r.ok ? r.datos : null;
}

function pintarNavegacion() {
  const actual = location.pathname;
  const enlace = (ruta, texto) => h('a', { href: ruta, 'data-enlace': true, 'aria-current': actual === ruta ? 'page' : null }, texto);
  const items = [];
  if (persona) {
    items.push(enlace('/perfil', 'Mi cuenta'));
    if (persona.roles.includes('administrador')) {
      items.push(enlace('/panel/roles', 'Roles'), enlace('/panel/historial', 'Historial'));
    }
    items.push(h('button', { type: 'button', class: 'secundario', onclick: salir }, 'Salir'));
  } else {
    items.push(enlace('/ingresar', 'Ingresar'), enlace('/registro', 'Crear cuenta'));
  }
  items.push(enlace('/demo/retorno', 'Demo: retorno a la acción'), enlace('/demo/buzon', 'Buzón de pruebas'));
  navegacion.replaceChildren(...items);
}

async function salir() {
  await api('POST', '/auth/logout');
  persona = null;
  aviso('Cerraste la sesión.', 'ok');
  navegar('/', true, false);
}

/* ---------- Pantallas ---------- */

function inicio() {
  return [
    h('h1', {}, 'VIVART'),
    h('p', {}, 'Festival Internacional de Artes Vivas de Loja. Puedes consultar sin cuenta; te pediremos identificarte solo cuando lo necesites, por ejemplo al pagar o reclamar un sello.'),
    persona
      ? h('p', {}, 'Sesión iniciada como ', h('strong', {}, persona.email), '.')
      : h('p', { class: 'fila' }, h('a', { class: 'boton', href: '/registro', 'data-enlace': true }, 'Crear cuenta'), h('a', { class: 'boton secundario', href: '/ingresar', 'data-enlace': true }, 'Ingresar')),
  ];
}

function registro() {
  const correo = campo({ id: 'email', etiqueta: 'Correo electrónico', tipo: 'email', autocompletar: 'email' });
  const clave = campo({
    id: 'password', etiqueta: 'Contraseña', tipo: 'password', autocompletar: 'new-password',
    ayuda: 'Al menos 15 caracteres. Puedes usar espacios y pegar desde tu gestor de contraseñas.',
  });
  return [
    h('h1', {}, 'Crear cuenta'),
    h('p', {}, 'Solo pedimos tu correo y una contraseña.'),
    formulario({
      campos: [correo, clave], boton: 'Crear cuenta',
      alEnviar: async (v) => {
        const r = await api('POST', '/auth/register', v);
        if (r.ok) {
          aviso(r.datos.message + ' Después de verificar tu correo podrás pagar y reclamar sellos.', 'ok');
          navegar('/demo/buzon');
        }
        return r;
      },
    }),
    h('p', {}, '¿Ya tienes cuenta? ', h('a', { href: '/ingresar', 'data-enlace': true }, 'Ingresa')),
  ];
}

function ingresar() {
  const correo = campo({ id: 'email', etiqueta: 'Correo electrónico', tipo: 'email', autocompletar: 'email' });
  const clave = campo({ id: 'password', etiqueta: 'Contraseña', tipo: 'password', autocompletar: 'current-password' });
  return [
    h('h1', {}, 'Ingresar'),
    formulario({
      campos: [correo, clave], boton: 'Ingresar',
      alEnviar: async (v) => {
        const r = await api('POST', '/auth/login', v);
        if (r.ok) {
          persona = r.datos;
          const retorno = await api('GET', '/auth/resume');
          navegar(retorno.ok && retorno.datos.found ? '/retorno' : '/perfil');
        }
        return r;
      },
    }),
    h('p', {}, h('a', { href: '/recuperar', 'data-enlace': true }, '¿Olvidaste tu contraseña?')),
  ];
}

async function verificar() {
  const token = parametro('token');
  const r = await api('POST', '/auth/verify-email', { token });
  if (r.ok) {
    await cargarPersona();
    return [h('h1', {}, 'Correo verificado'), h('p', { class: 'ok' }, 'Listo: tu correo quedó verificado.'), h('a', { class: 'boton', href: persona ? '/perfil' : '/ingresar', 'data-enlace': true }, persona ? 'Ir a mi cuenta' : 'Ingresar')];
  }
  const correo = campo({ id: 'email', etiqueta: 'Correo para recibir un enlace nuevo', tipo: 'email', autocompletar: 'email' });
  return [
    h('h1', {}, 'No pudimos verificar el correo'),
    h('p', { class: 'error' }, r.datos?.message ?? 'El enlace no es válido.'),
    formulario({
      campos: [correo], boton: 'Enviar enlace nuevo',
      alEnviar: async (v) => {
        const x = await api('POST', '/auth/resend-verification', v);
        if (x.ok) aviso(x.datos.message, 'ok');
        return x;
      },
    }),
  ];
}

function recuperar() {
  const correo = campo({ id: 'email', etiqueta: 'Correo electrónico', tipo: 'email', autocompletar: 'email' });
  return [
    h('h1', {}, 'Recuperar el acceso'),
    h('p', {}, 'Te enviaremos un enlace de un solo uso para elegir una contraseña nueva.'),
    formulario({
      campos: [correo], boton: 'Enviar enlace',
      alEnviar: async (v) => {
        const r = await api('POST', '/auth/password-reset/request', v);
        if (r.ok) aviso(r.datos.message, 'ok');
        return r;
      },
    }),
  ];
}

function conToken(titulo, ruta, boton, mensajeOk, destino) {
  const clave = campo({
    id: 'password', etiqueta: 'Contraseña nueva', tipo: 'password', autocompletar: 'new-password',
    ayuda: 'Al menos 15 caracteres. Puedes usar espacios y pegar desde tu gestor de contraseñas.',
  });
  return [
    h('h1', {}, titulo),
    formulario({
      campos: [clave], boton,
      alEnviar: async (v) => {
        const r = await api('POST', ruta, { token: parametro('token'), password: v.password });
        if (r.ok) { aviso(mensajeOk, 'ok'); navegar(destino); }
        return r;
      },
    }),
  ];
}

const restablecer = () => conToken('Elige una contraseña nueva', '/auth/password-reset/confirm', 'Guardar contraseña', 'Contraseña actualizada. Ingresa con la nueva.', '/ingresar');
const activar = () => conToken('Activa tu cuenta de administrador', '/auth/activate', 'Activar cuenta', 'Cuenta activada. Ya puedes ingresar.', '/ingresar');

function perfil() {
  if (!persona) return requiereSesion();
  const reenviar = h('button', {
    type: 'button', class: 'secundario',
    onclick: async () => { const r = await api('POST', '/auth/resend-verification', { email: persona.email }); aviso(r.datos?.message ?? 'Listo.', 'ok'); },
  }, 'Reenviar enlace de verificación');
  return [
    h('h1', {}, 'Mi cuenta'),
    h('div', { class: 'tarjeta' },
      h('p', {}, h('strong', {}, 'Correo: '), persona.email),
      h('p', {}, h('strong', {}, 'Correo verificado: '), persona.emailVerified ? 'Sí' : 'No, verifícalo para poder pagar o reclamar sellos'),
      h('p', {}, h('strong', {}, 'Roles: '), persona.roles.map((r) => h('span', { class: 'etiqueta' }, r.replaceAll('_', ' ')))),
      persona.functionIds.length ? h('p', {}, h('strong', {}, 'Funciones asignadas: '), persona.functionIds.join(', ')) : null,
      persona.emailVerified ? null : reenviar),
  ];
}

function requiereSesion() {
  return [h('h1', {}, 'Necesitas identificarte'), h('p', {}, 'Ingresa para continuar.'), h('a', { class: 'boton', href: '/ingresar', 'data-enlace': true }, 'Ingresar')];
}

async function retorno() {
  if (!persona) return requiereSesion();
  const r = await api('GET', '/auth/resume');
  if (!r.ok || !r.datos.found) {
    return [h('h1', {}, 'Sin acción pendiente'), h('p', {}, 'No hay una compra o un canje por retomar, o ya venció.')];
  }
  const d = r.datos;
  const bloque = [
    h('h1', {}, 'Volviste a donde estabas'),
    h('div', { class: 'tarjeta' },
      h('p', {}, h('strong', {}, 'Acción: '), d.type === 'compra' ? 'Compra' : 'Canje de un sello'),
      h('p', {}, h('strong', {}, 'Te devolvemos a: '), h('code', {}, d.destination)),
      h('p', { class: 'ayuda' }, 'Aquí no se paga ni se canjea nada automáticamente. El servicio que corresponde volverá a comprobar si la acción sigue vigente antes de continuar.')),
  ];
  if (!d.canProceed) {
    bloque.push(h('p', { class: 'aviso error-caja' }, 'Falta verificar tu correo para completar esta acción. Revisa tu correo o reenvía el enlace desde "Mi cuenta".'));
  }
  bloque.push(h('button', { type: 'button', class: 'secundario', onclick: async () => { await api('DELETE', '/auth/pending-actions/current'); aviso('Acción descartada.', 'ok'); navegar('/perfil'); } }, 'Descartar esta acción'));
  return bloque;
}

function demoRetorno() {
  const crear = (cuerpo) => async () => {
    const r = await api('POST', '/auth/pending-actions', cuerpo);
    if (!r.ok) return aviso(r.datos?.message ?? 'No se pudo conservar la acción.', 'error');
    aviso('Acción conservada. Si no tienes sesión, ingresa y te devolvemos aquí.', 'ok');
    navegar(persona ? '/retorno' : '/ingresar');
  };
  return [
    h('h1', {}, 'Demostración del retorno a la acción'),
    h('p', {}, 'Los flujos de compra y de canje los construyen otros specs. Esta demostración solo muestra cómo se conserva la acción y cómo se te devuelve tras identificarte, sin ejecutar nada.'),
    h('p', { class: 'fila' },
      h('button', { type: 'button', onclick: crear({ type: 'compra' }) }, 'Simular: intentar pagar sin sesión'),
      h('button', { type: 'button', class: 'secundario', onclick: crear({ type: 'canje', ref: 'DEMO-QR-1' }) }, 'Simular: abrir el QR de un sello')),
  ];
}

async function buzon() {
  const r = await api('GET', '/dev/mailbox');
  if (!r.ok) return [h('h1', {}, 'Buzón de pruebas'), h('p', {}, 'El buzón de pruebas no está disponible en este entorno.')];
  const mensajes = [...r.datos.messages].reverse();
  return [
    h('h1', {}, 'Buzón de pruebas'),
    h('p', { class: 'ayuda' }, 'Solo para la demostración: aquí aparecen los correos que se enviarían. No se envía ningún correo real.'),
    mensajes.length === 0 ? h('p', {}, 'Todavía no hay mensajes.') : mensajes.map((m) =>
      h('div', { class: 'tarjeta' },
        h('p', {}, h('strong', {}, m.subject), ' · ', m.to),
        h('p', {}, m.text),
        m.link ? h('p', {}, h('a', { href: new URL(m.link).pathname + new URL(m.link).search, 'data-enlace': true }, 'Abrir enlace')) : null)),
  ];
}

async function panelRoles() {
  if (!persona) return requiereSesion();
  if (!persona.roles.includes('administrador')) {
    return [h('h1', {}, 'Roles'), h('p', { class: 'aviso error-caja' }, 'Para ver esta pantalla falta el rol de administrador.')];
  }
  const resultado = h('div');
  const busqueda = campo({ id: 'email', etiqueta: 'Buscar cuenta por correo', tipo: 'search', autocompletar: 'off' });

  async function pintar(prefijo) {
    const r = await api('GET', `/users?email=${encodeURIComponent(prefijo)}`);
    resultado.replaceChildren();
    if (!r.ok) return resultado.append(h('p', { class: 'error' }, r.datos?.message ?? 'No se pudo buscar.'));
    if (r.datos.users.length === 0) return resultado.append(h('p', {}, 'No hay cuentas con ese correo.'));
    for (const u of r.datos.users) resultado.append(tarjetaCuenta(u, () => pintar(prefijo)));
  }

  return [
    h('h1', {}, 'Roles y permisos'),
    formulario({ campos: [busqueda], boton: 'Buscar', alEnviar: async (v) => { await pintar(v.email); return { ok: true }; } }),
    resultado,
  ];
}

function tarjetaCuenta(u, recargar) {
  const internos = ['editor', 'publicador', 'administrador', 'personal_acceso'];
  const selector = h('select', { id: `rol-${u.id}`, 'aria-label': `Rol para asignar a ${u.email}` }, internos.map((r) => h('option', { value: r }, r.replaceAll('_', ' '))));
  const tiene = u.roles.filter((r) => r !== 'usuario_registrado');

  const asignar = h('button', {
    type: 'button',
    onclick: async () => {
      const r = await api('PUT', `/users/${u.id}/roles/${selector.value}`);
      aviso(r.ok ? 'Rol asignado.' : r.datos?.message ?? 'No se pudo asignar.', r.ok ? 'ok' : 'error');
      recargar();
    },
  }, 'Asignar rol');

  const quitar = tiene.map((rol) => {
    const b = h('button', { type: 'button', class: 'peligro' }, `Quitar ${rol.replaceAll('_', ' ')}`);
    let confirmando = false;
    b.addEventListener('click', async () => {
      // Acción sensible: pide confirmación antes de revocar (RNF-02).
      if (!confirmando) { confirmando = true; b.textContent = `Confirmar: quitar ${rol.replaceAll('_', ' ')}`; return; }
      const r = await api('DELETE', `/users/${u.id}/roles/${rol}`);
      aviso(r.ok ? 'Rol revocado. El trabajo de la persona se conserva.' : r.datos?.message ?? 'No se pudo revocar.', r.ok ? 'ok' : 'error');
      recargar();
    });
    return b;
  });

  let funciones = null;
  if (u.roles.includes('personal_acceso')) {
    const nueva = h('input', { id: `fn-${u.id}`, type: 'text', 'aria-label': `Identificador de función para ${u.email}`, placeholder: 'f1' });
    funciones = h('div', {},
      h('p', {}, h('strong', {}, 'Funciones asignadas: '), u.functionIds.length ? u.functionIds.map((f) =>
        h('button', { type: 'button', class: 'secundario', onclick: async () => { await api('DELETE', `/users/${u.id}/functions/${encodeURIComponent(f)}`); recargar(); } }, `Quitar ${f}`)) : 'ninguna'),
      h('div', { class: 'fila' }, nueva,
        h('button', { type: 'button', class: 'secundario', onclick: async () => {
          const r = await api('PUT', `/users/${u.id}/functions/${encodeURIComponent(nueva.value)}`);
          aviso(r.ok ? 'Función asignada.' : r.datos?.message ?? 'No se pudo asignar.', r.ok ? 'ok' : 'error');
          recargar();
        } }, 'Asignar función')));
  }

  return h('div', { class: 'tarjeta' },
    h('h2', {}, u.email),
    h('p', {}, h('strong', {}, 'Roles: '), u.roles.map((r) => h('span', { class: 'etiqueta' }, r.replaceAll('_', ' '))), u.emailVerified ? null : ' (correo sin verificar)'),
    h('div', { class: 'fila' }, selector, asignar),
    h('div', { class: 'fila' }, quitar),
    funciones);
}

async function historial() {
  if (!persona) return requiereSesion();
  const r = await api('GET', '/audit?limit=100');
  if (!r.ok) return [h('h1', {}, 'Historial'), h('p', { class: 'aviso error-caja' }, r.datos?.message ?? 'No se pudo cargar el historial.')];
  const filas = r.datos.entries.map((e) =>
    h('tr', {},
      h('td', {}, e.at),
      h('td', {}, e.actor_id),
      h('td', {}, e.action),
      h('td', {}, `${e.target_type} ${e.target_id}`),
      h('td', {}, e.details ? JSON.stringify(e.details) : '')));
  const encabezados = ['Cuándo', 'Quién', 'Acción', 'Sobre', 'Detalle'].map((texto) => h('th', { scope: 'col' }, texto));
  return [
    h('h1', {}, 'Historial de permisos'),
    h('div', { class: 'tabla-scroll' },
      h('table', {},
        h('caption', { class: 'ayuda' }, 'Quién, cuándo y sobre qué registro'),
        h('thead', {}, h('tr', {}, encabezados)),
        h('tbody', {}, filas))),
  ];
}

/* ---------- Enrutamiento ---------- */

const RUTAS = {
  '/': inicio, '/registro': registro, '/ingresar': ingresar, '/verificar': verificar, '/recuperar': recuperar,
  '/restablecer': restablecer, '/activar': activar, '/perfil': perfil, '/retorno': retorno,
  '/demo/retorno': demoRetorno, '/demo/buzon': buzon, '/panel/roles': panelRoles, '/panel/historial': historial,
};

async function pintar() {
  const pantalla = RUTAS[location.pathname];
  const contenido = pantalla ? await pantalla() : [h('h1', {}, 'No encontramos esta página'), h('a', { href: '/', 'data-enlace': true }, 'Volver al inicio')];
  raiz.replaceChildren(...[contenido].flat());
  pintarNavegacion();
  document.title = `${raiz.querySelector('h1')?.textContent ?? 'VIVART'} · VIVART`;
  raiz.focus();
}

async function irA(ruta, historia, recargarPersona) {
  if (historia) history.pushState({}, '', ruta);
  if (recargarPersona) await cargarPersona();
  await pintar();
}

function navegar(ruta, historia = true, recargarPersona = true) {
  irA(ruta, historia, recargarPersona).catch(() => aviso('No se pudo cargar la página. Inténtalo de nuevo.', 'error'));
}

document.addEventListener('click', (evento) => {
  const enlace = evento.target.closest?.('a[data-enlace]');
  if (!enlace || evento.metaKey || evento.ctrlKey) return;
  evento.preventDefault();
  aviso('');
  navegar(enlace.getAttribute('href'));
});
window.addEventListener('popstate', () => navegar(location.pathname + location.search, false));

await cargarPersona();
await pintar();
