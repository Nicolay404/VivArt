// Reloj común en hora de Loja (RC-07). Loja usa UTC−5 todo el año (sin horario de verano).

/** Instante de inicio de una función a partir de su fecha y hora locales de Loja. */
export const inicioFuncion = (f) => new Date(`${f.date}T${f.startTime}:00-05:00`);

/** Instante de fin si se conoce (hora de fin o duración); si no, null: nunca se supone una duración (RC-02). */
export function finFuncion(f) {
  const inicio = inicioFuncion(f);
  if (f.endTime) {
    const fin = new Date(`${f.date}T${f.endTime}:00-05:00`);
    return fin > inicio ? fin : null;
  }
  if (Number.isInteger(f.durationMinutes) && f.durationMinutes > 0) return new Date(inicio.getTime() + f.durationMinutes * 60000);
  return null;
}
