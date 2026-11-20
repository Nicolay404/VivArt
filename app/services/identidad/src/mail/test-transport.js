// Buzón de pruebas en memoria: para la demo y las pruebas. No envía ningún correo real (FR-030).
export function createTestTransport() {
  const mensajes = [];
  return {
    name: 'test',
    async send(mensaje) {
      mensajes.push({ ...mensaje, at: new Date().toISOString() });
    },
    list: () => mensajes.map((m) => ({ ...m })),
    last: (to, kind) => [...mensajes].reverse().find((m) => m.to === to && (!kind || m.kind === kind)),
    count: (to, kind) => mensajes.filter((m) => (!to || m.to === to) && (!kind || m.kind === kind)).length,
    clear: () => { mensajes.length = 0; },
  };
}
