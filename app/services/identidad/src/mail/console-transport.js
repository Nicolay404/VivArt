// Transporte de consola: imprime el mensaje para el procedimiento interno del primer administrador.
// No envía correo real. El enlace impreso es un secreto de un solo uso: no lo guardes ni lo compartas.
export function createConsoleTransport(salida = console) {
  return {
    name: 'console',
    async send({ to, subject, text, link }) {
      salida.log(`\n[correo de consola] Para: ${to}\nAsunto: ${subject}\n${text}\n${link ? `Enlace: ${link}\n` : ''}`);
    },
    list: () => [],
    last: () => undefined,
    count: () => 0,
    clear: () => {},
  };
}
