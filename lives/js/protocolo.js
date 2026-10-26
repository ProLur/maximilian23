export const GESTOS = ['alegria','sorpresa','tristeza','serio','guino','saludar','atencion','parpadeo','reposo'];
export const CUENTO_IDS = ['estrella','tortuga','nube','zorro','semilla'];
export function valido(m, ahora) {
  if (!m || typeof m !== 'object' || typeof m.id !== 'string' || !Number.isFinite(m.creado) || !Number.isFinite(m.expira) || m.creado > ahora + 1000 || m.expira <= ahora || m.expira > m.creado + 30000) return false;
  if (m.tipo === 'reproduccion') return ['pausar','continuar'].includes(m.accion);
  if (m.tipo === 'detener') return true;
  if (m.tipo === 'cuento') return CUENTO_IDS.includes(m.cuento);
  if (m.tipo === 'gesto') return GESTOS.includes(m.gesto);
  return m.tipo === 'decir' && typeof m.texto === 'string' && m.texto.trim().length > 0 && m.texto.length <= 1000 && Number.isFinite(m.velocidad) && m.velocidad >= .5 && m.velocidad <= 2 && Number.isFinite(m.tono) && m.tono >= 0 && m.tono <= 2 && (m.emocion === undefined || GESTOS.slice(0,5).includes(m.emocion));
}
