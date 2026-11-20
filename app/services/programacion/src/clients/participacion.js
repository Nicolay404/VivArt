/**
 * Cliente del servicio de participación (spec 05), dueño de entradas y pedidos.
 * FR-017: antes de reprogramar o cancelar se muestra cuántas entradas vendidas y pedidos pendientes hay.
 * Mientras ese servicio no exista o no responda, se informa que el dato NO está disponible: nunca se inventan
 * ceros (RNF-08). La operación no se bloquea, pero la respuesta lo dice para que la persona lo sepa.
 */
export function createParticipacionClient({ url, serviceKey, timeoutMs = 3000, fetchImpl = fetch }) {
  const noDisponible = (message) => ({ available: false, soldTickets: null, pendingOrders: null, issuedTickets: null, message });

  return {
    async impact(functionId) {
      if (!url) return noDisponible('El servicio de entradas todavía no está disponible: no se puede saber cuántas entradas o pedidos hay.');
      try {
        const r = await fetchImpl(`${url}/internal/functions/${encodeURIComponent(functionId)}/impact`, {
          headers: { 'x-service-key': serviceKey },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!r.ok) return noDisponible('No se pudo consultar el servicio de entradas.');
        const datos = await r.json();
        return {
          available: true,
          soldTickets: Number(datos.soldTickets ?? 0),
          pendingOrders: Number(datos.pendingOrders ?? 0),
          issuedTickets: Number(datos.issuedTickets ?? datos.soldTickets ?? 0),
          message: 'Datos del servicio de entradas.',
        };
      } catch {
        return noDisponible('No se pudo consultar el servicio de entradas.');
      }
    },
  };
}
