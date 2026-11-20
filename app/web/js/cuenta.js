// Pantallas del spec 001 (identidad, sesión, verificación, recuperación, retorno, buzón, roles e historial)
// conservadas e integradas al sistema visual de VIVART.
import { h, aviso, campo, formulario } from './dom.js';
import { apiIdentidad } from './api.js';
import { formatoFechaHoraIso } from './format.js';

function parametro(nombre) {
  return new URLSearchParams(location.search).get(nombre) ?? '';
}

export function requiereSesion() {
  return h(
    'section',
    { class: 'tarjeta-centrada' },
    h('h1', {}, 'Necesitas identificarte'),
    h('p', {}, 'Ingresa con tu cuenta para continuar.'),
    h('a', { class: 'boton', href: '/ingresar', 'data-enlace': true }, 'Ingresar'),
  );
}

export function registro({ navegar }) {
  const correo = campo({ id: 'email', etiqueta: 'Correo electrónico', tipo: 'email', autocompletar: 'email' });
  const clave = campo({
    id: 'password',
    etiqueta: 'Contraseña',
    tipo: 'password',
    autocompletar: 'new-password',
    ayuda: 'Al menos 15 caracteres. Puedes usar espacios y pegar desde tu gestor de contraseñas.',
  });
  return h(
    'section',
    { class: 'tarjeta-centrada' },
    h('h1', {}, 'Crear cuenta'),
    h('p', { class: 'ayuda' }, 'Solo pedimos tu correo y una contraseña.'),
    formulario({
      campos: [correo, clave],
      boton: 'Crear cuenta',
      alEnviar: async (v) => {
        const r = await apiIdentidad('POST', '/auth/register', v);
        if (r.ok) {
          aviso(r.datos.message + ' Después de verificar tu correo podrás pagar y reclamar sellos.', 'ok');
          navegar('/demo/buzon');
        }
        return r;
      },
    }),
    h('p', {}, '¿Ya tienes cuenta? ', h('a', { href: '/ingresar', 'data-enlace': true }, 'Ingresa')),
  );
}

export function ingresar({ navegar, establecerPersona }) {
  const correo = campo({ id: 'email', etiqueta: 'Correo electrónico', tipo: 'email', autocompletar: 'email' });
  const clave = campo({ id: 'password', etiqueta: 'Contraseña', tipo: 'password', autocompletar: 'current-password' });
  return h(
    'section',
    { class: 'tarjeta-centrada' },
    h('h1', {}, 'Ingresar'),
    formulario({
      campos: [correo, clave],
      boton: 'Ingresar',
      alEnviar: async (v) => {
        const r = await apiIdentidad('POST', '/auth/login', v);
        if (r.ok) {
          establecerPersona(r.datos);
          const retorno = await apiIdentidad('GET', '/auth/resume');
          if (retorno.ok && retorno.datos.found) {
            navegar('/retorno');
          } else if (r.datos.roles?.some((rol) => ['editor', 'publicador', 'administrador'].includes(rol))) {
            navegar('/panel/actividades');
          } else {
            navegar('/perfil');
          }
        }
        return r;
      },
    }),
    h('p', {}, h('a', { href: '/recuperar', 'data-enlace': true }, '¿Olvidaste tu contraseña?')),
    h('p', {}, '¿Aún no tienes cuenta? ', h('a', { href: '/registro', 'data-enlace': true }, 'Crear cuenta')),
  );
}

export async function verificar({ cargarPersona, obtenerPersona }) {
  const token = parametro('token');
  const r = await apiIdentidad('POST', '/auth/verify-email', { token });
  if (r.ok) {
    await cargarPersona();
    const persona = obtenerPersona();
    return h(
      'section',
      { class: 'tarjeta-centrada' },
      h('h1', {}, 'Correo verificado'),
      h('p', { class: 'ok' }, 'Listo: tu correo quedó verificado.'),
      h('a', { class: 'boton', href: persona ? '/perfil' : '/ingresar', 'data-enlace': true }, persona ? 'Ir a mi cuenta' : 'Ingresar'),
    );
  }
  const correo = campo({ id: 'email', etiqueta: 'Correo para recibir un enlace nuevo', tipo: 'email', autocompletar: 'email' });
  return h(
    'section',
    { class: 'tarjeta-centrada' },
    h('h1', {}, 'No pudimos verificar el correo'),
    h('p', { class: 'error' }, r.datos?.message ?? 'El enlace no es válido.'),
    formulario({
      campos: [correo],
      boton: 'Enviar enlace nuevo',
      alEnviar: async (v) => {
        const x = await apiIdentidad('POST', '/auth/resend-verification', v);
        if (x.ok) aviso(x.datos.message, 'ok');
        return x;
      },
    }),
  );
}

export function recuperar() {
  const correo = campo({ id: 'email', etiqueta: 'Correo electrónico', tipo: 'email', autocompletar: 'email' });
  return h(
    'section',
    { class: 'tarjeta-centrada' },
    h('h1', {}, 'Recuperar el acceso'),
    h('p', { class: 'ayuda' }, 'Te enviaremos un enlace de un solo uso para elegir una contraseña nueva.'),
    formulario({
      campos: [correo],
      boton: 'Enviar enlace',
      alEnviar: async (v) => {
        const r = await apiIdentidad('POST', '/auth/password-reset/request', v);
        if (r.ok) aviso(r.datos.message, 'ok');
        return r;
      },
    }),
  );
}

function conToken(titulo, ruta, boton, mensajeOk, destino, { navegar }) {
  const clave = campo({
    id: 'password',
    etiqueta: 'Contraseña nueva',
    tipo: 'password',
    autocompletar: 'new-password',
    ayuda: 'Al menos 15 caracteres. Puedes usar espacios y pegar desde tu gestor de contraseñas.',
  });
  return h(
    'section',
    { class: 'tarjeta-centrada' },
    h('h1', {}, titulo),
    formulario({
      campos: [clave],
      boton,
      alEnviar: async (v) => {
        const r = await apiIdentidad('POST', ruta, { token: parametro('token'), password: v.password });
        if (r.ok) {
          aviso(mensajeOk, 'ok');
          navegar(destino);
        }
        return r;
      },
    }),
  );
}

export const restablecer = (ctx) =>
  conToken('Elige una contraseña nueva', '/auth/password-reset/confirm', 'Guardar contraseña', 'Contraseña actualizada. Ingresa con la nueva.', '/ingresar', ctx);

export const activar = (ctx) =>
  conToken('Activa tu cuenta de administrador', '/auth/activate', 'Activar cuenta', 'Cuenta activada. Ya puedes ingresar.', '/ingresar', ctx);

export function perfil({ persona }) {
  if (!persona) return requiereSesion();
  const reenviar = h(
    'button',
    {
      type: 'button',
      class: 'secundario',
      onclick: async () => {
        const r = await apiIdentidad('POST', '/auth/resend-verification', { email: persona.email });
        aviso(r.datos?.message ?? 'Listo.', 'ok');
      },
    },
    'Reenviar enlace de verificación',
  );
  const tienePanel = persona.roles.some((rol) => ['editor', 'publicador', 'administrador'].includes(rol));

  return h(
    'section',
    { class: 'tarjeta-centrada' },
    h('h1', {}, 'Mi cuenta'),
    h(
      'div',
      { class: 'tarjeta' },
      h('p', {}, h('strong', {}, 'Correo: '), persona.email),
      h(
        'p',
        {},
        h('strong', {}, 'Correo verificado: '),
        persona.emailVerified ? 'Sí' : 'No, verifícalo para poder pagar o reclamar sellos',
      ),
      h(
        'p',
        {},
        h('strong', {}, 'Roles: '),
        persona.roles.map((r) => h('span', { class: 'etiqueta' }, r.replaceAll('_', ' '))),
      ),
      persona.functionIds?.length ? h('p', {}, h('strong', {}, 'Funciones asignadas: '), persona.functionIds.join(', ')) : null,
      h(
        'div',
        { class: 'fila-acciones' },
        !persona.emailVerified ? reenviar : null,
        h('a', { href: '/mis-entradas', 'data-enlace': true, class: 'boton secundario' }, 'Mis entradas'),
        persona.roles.includes('personal_acceso') ? h('a', { href: '/acceso', 'data-enlace': true, class: 'boton secundario' }, 'Control de acceso') : null,
        tienePanel ? h('a', { href: '/panel/actividades', 'data-enlace': true, class: 'boton' }, 'Ir al panel editorial') : null,
      ),
    ),
  );
}

export async function retorno({ persona, navegar }) {
  if (!persona) return requiereSesion();
  const r = await apiIdentidad('GET', '/auth/resume');
  if (!r.ok || !r.datos.found) {
    return h(
      'section',
      { class: 'tarjeta-centrada' },
      h('h1', {}, 'Sin acción pendiente'),
      h('p', {}, 'No hay una compra o un canje por retomar, o ya venció.'),
    );
  }
  const d = r.datos;
  return h(
    'section',
    { class: 'tarjeta-centrada' },
    h('h1', {}, 'Volviste a donde estabas'),
    h(
      'div',
      { class: 'tarjeta' },
      h('p', {}, h('strong', {}, 'Acción: '), d.type === 'compra' ? 'Compra' : 'Canje de un sello'),
      h('p', {}, h('strong', {}, 'Te devolvemos a: '), h('code', {}, d.destination)),
      h(
        'p',
        { class: 'ayuda' },
        'Aquí no se paga ni se canjea nada automáticamente. El servicio que corresponde volverá a comprobar si la acción sigue vigente antes de continuar.',
      ),
    ),
    d.type === 'compra' && d.canProceed
      ? h('a', { href: '/carrito', 'data-enlace': true, class: 'boton' }, 'Volver al carrito')
      : null,
    !d.canProceed
      ? h(
          'p',
          { class: 'aviso error-caja' },
          'Falta verificar tu correo para completar esta acción. Revisa tu correo o reenvía el enlace desde «Mi cuenta».',
        )
      : null,
    h(
      'button',
      {
        type: 'button',
        class: 'secundario',
        onclick: async () => {
          await apiIdentidad('DELETE', '/auth/pending-actions/current');
          aviso('Acción descartada.', 'ok');
          navegar('/perfil');
        },
      },
      'Descartar esta acción',
    ),
  );
}

export function demoRetorno({ persona, navegar }) {
  const crear = (cuerpo) => async () => {
    const r = await apiIdentidad('POST', '/auth/pending-actions', cuerpo);
    if (!r.ok) return aviso(r.datos?.message ?? 'No se pudo conservar la acción.', 'error');
    aviso('Acción conservada. Si no tienes sesión, ingresa y te devolvemos aquí.', 'ok');
    navegar(persona ? '/retorno' : '/ingresar');
  };
  return h(
    'section',
    { class: 'tarjeta-centrada' },
    h('h1', {}, 'Demostración del retorno a la acción'),
    h(
      'p',
      {},
      'Los flujos de compra y de canje los construyen otros specs. Esta demostración solo muestra cómo se conserva la acción y cómo se te devuelve tras identificarte, sin ejecutar nada.',
    ),
    h(
      'div',
      { class: 'fila-acciones' },
      h('button', { type: 'button', onclick: crear({ type: 'compra' }) }, 'Simular: intentar pagar sin sesión'),
      h('button', { type: 'button', class: 'secundario', onclick: crear({ type: 'canje', ref: 'DEMO-QR-1' }) }, 'Simular: abrir el QR de un sello'),
    ),
  );
}

export async function buzon() {
  const r = await apiIdentidad('GET', '/dev/mailbox');
  if (!r.ok) {
    return h(
      'section',
      { class: 'tarjeta-centrada' },
      h('h1', {}, 'Buzón de pruebas'),
      h('p', {}, 'El buzón de pruebas no está disponible en este entorno.'),
    );
  }
  const mensajes = [...r.datos.messages].reverse();
  return h(
    'section',
    { class: 'tarjeta-centrada' },
    h('h1', {}, 'Buzón de pruebas'),
    h('p', { class: 'ayuda' }, 'Solo para la demostración: aquí aparecen los correos que se enviarían. No se envía ningún correo real.'),
    mensajes.length === 0
      ? h('p', {}, 'Todavía no hay mensajes.')
      : mensajes.map((m) =>
          h(
            'div',
            { class: 'tarjeta' },
            h('p', {}, h('strong', {}, m.subject), ' · ', m.to),
            h('p', {}, m.text),
            m.link
              ? h('p', {}, h('a', { href: new URL(m.link).pathname + new URL(m.link).search, 'data-enlace': true, class: 'boton secundario' }, 'Abrir enlace'))
              : null,
          ),
        ),
  );
}

function tarjetaCuenta(u, recargar) {
  const internos = ['editor', 'publicador', 'administrador', 'personal_acceso'];
  const selector = h(
    'select',
    { id: `rol-${u.id}`, 'aria-label': `Rol para asignar a ${u.email}` },
    internos.map((r) => h('option', { value: r }, r.replaceAll('_', ' '))),
  );
  const tiene = u.roles.filter((r) => r !== 'usuario_registrado');

  const asignar = h(
    'button',
    {
      type: 'button',
      onclick: async () => {
        const r = await apiIdentidad('PUT', `/users/${u.id}/roles/${selector.value}`);
        aviso(r.ok ? 'Rol asignado.' : r.datos?.message ?? 'No se pudo asignar.', r.ok ? 'ok' : 'error');
        recargar();
      },
    },
    'Asignar rol',
  );

  const quitar = tiene.map((rol) => {
    const b = h('button', { type: 'button', class: 'peligro' }, `Quitar ${rol.replaceAll('_', ' ')}`);
    let confirmando = false;
    b.addEventListener('click', async () => {
      if (!confirmando) {
        confirmando = true;
        b.textContent = `Confirmar: quitar ${rol.replaceAll('_', ' ')}`;
        return;
      }
      const r = await apiIdentidad('DELETE', `/users/${u.id}/roles/${rol}`);
      aviso(r.ok ? 'Rol revocado. El trabajo de la persona se conserva.' : r.datos?.message ?? 'No se pudo revocar.', r.ok ? 'ok' : 'error');
      recargar();
    });
    return b;
  });

  let funciones = null;
  if (u.roles.includes('personal_acceso')) {
    const nueva = h('input', {
      id: `fn-${u.id}`,
      type: 'text',
      'aria-label': `Identificador de función para ${u.email}`,
      placeholder: 'ID de función',
    });
    funciones = h(
      'div',
      { class: 'pila-chica' },
      h(
        'p',
        {},
        h('strong', {}, 'Funciones asignadas: '),
        u.functionIds.length
          ? u.functionIds.map((f) =>
              h(
                'button',
                {
                  type: 'button',
                  class: 'secundario',
                  onclick: async () => {
                    await apiIdentidad('DELETE', `/users/${u.id}/functions/${encodeURIComponent(f)}`);
                    recargar();
                  },
                },
                `Quitar ${f}`,
              ),
            )
          : 'ninguna',
      ),
      h(
        'div',
        { class: 'fila' },
        nueva,
        h(
          'button',
          {
            type: 'button',
            class: 'secundario',
            onclick: async () => {
              const r = await apiIdentidad('PUT', `/users/${u.id}/functions/${encodeURIComponent(nueva.value)}`);
              aviso(r.ok ? 'Función asignada.' : r.datos?.message ?? 'No se pudo asignar.', r.ok ? 'ok' : 'error');
              recargar();
            },
          },
          'Asignar función',
        ),
      ),
    );
  }

  return h(
    'div',
    { class: 'tarjeta' },
    h('h2', {}, u.email),
    h(
      'p',
      {},
      h('strong', {}, 'Roles: '),
      u.roles.map((r) => h('span', { class: 'etiqueta' }, r.replaceAll('_', ' '))),
      u.emailVerified ? null : ' (correo sin verificar)',
    ),
    h('div', { class: 'fila' }, selector, asignar),
    quitar.length ? h('div', { class: 'fila' }, quitar) : null,
    funciones,
  );
}

export async function panelRoles({ persona, barraPanel }) {
  if (!persona) return requiereSesion();
  const cabecera = barraPanel ? barraPanel('/panel/roles') : null;
  if (!persona.roles.includes('administrador')) {
    return [cabecera, h('h1', {}, 'Roles y permisos'), h('p', { class: 'aviso error-caja' }, 'Para ver esta pantalla falta el rol de administrador.')];
  }
  const resultado = h('div');
  const busqueda = campo({ id: 'email', etiqueta: 'Buscar cuenta por correo', tipo: 'search', autocompletar: 'off', requerido: false });

  async function pintar(prefijo) {
    const r = await apiIdentidad('GET', `/users?email=${encodeURIComponent(prefijo)}`);
    resultado.replaceChildren();
    if (!r.ok) return resultado.append(h('p', { class: 'error' }, r.datos?.message ?? 'No se pudo buscar.'));
    if (r.datos.users.length === 0) return resultado.append(h('p', {}, 'No hay cuentas con ese correo.'));
    for (const u of r.datos.users) resultado.append(tarjetaCuenta(u, () => pintar(prefijo)));
  }

  return [
    cabecera,
    h('h1', {}, 'Roles y permisos'),
    formulario({
      campos: [busqueda],
      boton: 'Buscar',
      alEnviar: async (v) => {
        await pintar(v.email);
        return { ok: true };
      },
    }),
    resultado,
  ];
}

export async function historialPermisos({ persona, barraPanel }) {
  if (!persona) return requiereSesion();
  const cabecera = barraPanel ? barraPanel('/panel/historial') : null;
  const r = await apiIdentidad('GET', '/audit?limit=100');
  if (!r.ok) {
    return [
      cabecera,
      h('h1', {}, 'Historial de permisos'),
      h('p', { class: 'aviso error-caja' }, r.datos?.message ?? 'No se pudo cargar el historial.'),
    ];
  }
  const filas = r.datos.entries.map((e) =>
    h(
      'tr',
      {},
      h('td', { 'data-etiqueta': 'Cuándo' }, formatoFechaHoraIso(e.at)),
      h('td', { 'data-etiqueta': 'Quién' }, e.actor_id),
      h('td', { 'data-etiqueta': 'Acción' }, e.action),
      h('td', { 'data-etiqueta': 'Sobre' }, `${e.target_type} ${e.target_id}`),
      h('td', { 'data-etiqueta': 'Detalle' }, e.details ? JSON.stringify(e.details) : '—'),
    ),
  );
  const encabezados = ['Cuándo', 'Quién', 'Acción', 'Sobre', 'Detalle'].map((texto) => h('th', { scope: 'col' }, texto));
  return [
    cabecera,
    h('h1', {}, 'Historial de permisos'),
    h(
      'div',
      { class: 'tabla-scroll', tabindex: '0', role: 'region', 'aria-label': 'Historial de permisos' },
      h(
        'table',
        {},
        h('caption', { class: 'ayuda' }, 'Quién, cuándo y sobre qué registro'),
        h('thead', {}, h('tr', {}, encabezados)),
        h('tbody', {}, filas),
      ),
    ),
  ];
}
