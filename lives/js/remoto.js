// Pantalla publica: escucha los mensajes que envia el panel (admin.html).
// Solo lee; no necesita iniciar sesion. Unicamente anota su presencia para que el panel
// sepa cuantas pantallas hay conectadas.

import { cargarFirebase, desfaseServidor, RUTA } from './firebase.js';

const LATIDO = 30_000;   // ms entre avisos de presencia

/**
 * @param {{onMensaje: (m: object) => void, onEstado?: (e: string) => void}} cb
 */
export async function conectarRemoto({ onMensaje, onEstado = () => {} }) {
  let fb;
  try {
    fb = await cargarFirebase();
  } catch (err) {
    console.error('No se ha podido cargar Firebase:', err);
    onEstado('error');
    return null;
  }
  if (!fb) {
    onEstado('sin-configurar');
    return null;
  }
  const { db, D } = fb;

  // Solo los mensajes enviados desde ahora: al recargar no se repiten los antiguos
  const inicio = Date.now() + (await desfaseServidor(db, D));
  const recientes = D.query(D.ref(db, `${RUTA}/mensajes`), D.orderByChild('creado'), D.startAt(inicio));
  D.onChildAdded(recientes, (snap) => onMensaje({ id: snap.key, ...snap.val() }), (err) => {
    console.error('Lectura de mensajes denegada:', err);
    onEstado('error');
  });

  const id = Math.random().toString(36).slice(2, 12);
  const presencia = D.ref(db, `${RUTA}/presencia/${id}`);
  const latir = () => D.set(presencia, D.serverTimestamp()).catch(() => {});
  D.onValue(D.ref(db, '.info/connected'), (s) => {
    if (s.val()) {
      D.onDisconnect(presencia).remove();
      latir();
      onEstado('conectado');
    } else {
      onEstado('desconectado');
    }
  });
  setInterval(latir, LATIDO);
  return fb;
}
