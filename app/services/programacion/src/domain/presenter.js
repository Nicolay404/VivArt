import { estadoTemporal, finConocido } from './now.js';

// Forma pública de una actividad (ficha, Agenda y vista previa). Lo que no está confirmado llega como null
// y se lista en `pending` para mostrarlo como pendiente (FR-004, SC-003). Nada se deduce.

const formatoUsd = (n) => n.toFixed(2).replace('.', ',');

export function etiquetaAcceso(access) {
  if (access.mode === 'free') return 'Gratuita';
  if (access.mode === 'paid') return access.priceUsd === null ? 'De pago: precio por confirmar' : `De pago: USD ${formatoUsd(access.priceUsd)}`;
  return 'Acceso por confirmar';
}

export function pendientes(contenido, funciones) {
  const p = [];
  if (!contenido.description) p.push('description');
  if (!contenido.organization) p.push('organization');
  if (!contenido.categoryId) p.push('category');
  const algunaSinFin = funciones.length > 0 && funciones.some((f) => !finConocido(f, contenido.durationMinutes));
  if (!contenido.durationMinutes && (funciones.length === 0 || algunaSinFin)) p.push('duration');
  if (contenido.access.mode === 'unconfirmed') p.push('access');
  if (contenido.access.mode === 'paid' && contenido.access.priceUsd === null) p.push('price');
  return p;
}

/**
 * @param a { id, content, functions, slots, notices }
 * @param cat { venues: Map, categories: Map }
 */
export function fichaPublica(a, cat, ahora) {
  const c = a.content;
  const sede = (id) => cat.venues.get(id) ?? null;
  const funciones = a.functions.map((f) => ({
    id: f.id,
    date: f.date,
    startTime: f.startTime,
    endTime: f.endTime ?? null,
    durationMinutes: f.durationMinutes ?? null,
    venue: sede(f.venueId),
    status: f.status ?? 'scheduled',
    timeStatus: f.date && f.startTime ? estadoTemporal({ ...f, status: f.status ?? 'scheduled' }, ahora, c.durationMinutes) : null,
  }));
  return {
    id: a.id,
    shareUrl: `/actividad/${a.id}`,
    title: c.title,
    artists: c.artists,
    organization: c.organization,
    description: c.description,
    category: c.categoryId ? (cat.categories.get(c.categoryId) ?? null) : null,
    durationMinutes: c.durationMinutes,
    access: { mode: c.access.mode, priceUsd: c.access.priceUsd, label: etiquetaAcceso(c.access) },
    functions: funciones,
    slots: a.slots.map((s) => ({
      id: s.id,
      venue: sede(s.venueId),
      dates: s.dates ?? null,
      from: s.from ?? null,
      to: s.to ?? null,
      weekdays: s.weekdays ?? null,
      opens: s.opens,
      closes: s.closes,
    })),
    notices: (a.notices ?? []).map((n) => ({ kind: n.kind, text: n.text, at: n.at, functionId: n.functionId ?? null })),
    pending: pendientes(c, a.functions),
    // «Programación sujeta a cambios» (PDF, pág. 3): toda ficha puede cambiar.
    subjectToChange: true,
  };
}
