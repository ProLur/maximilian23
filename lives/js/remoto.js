// Solo el ultimo comando es publico. No enviar datos personales.
import { cargarFirebase, desfaseServidor, RUTA } from './firebase.js';
import { valido } from './protocolo.js';
export async function conectarRemoto({ onMensaje, onEstado = () => {} }) {
  try {
    const fb = await cargarFirebase({ conAuth: true, visor: true });
    if (!fb) { onEstado('sin-configurar'); return null; }
    const { db, D, auth, A } = fb;
    await A.setPersistence(auth, A.inMemoryPersistence);
    const { user } = await A.signInAnonymously(auth);
    const desfase = await desfaseServidor(db, D);
    const inicio = Date.now() + desfase;
    const vistos = new Set();
    const parar = [];
    const fallo = () => onEstado('error');
    parar.push(D.onValue(D.ref(db, RUTA + '/comando'), snap => {
      const m = snap.val();
      if (!valido(m, Date.now() + desfase) || m.creado < inicio || vistos.has(m.id)) return;
      vistos.add(m.id);
      if (vistos.size > 200) vistos.delete(vistos.values().next().value);
      onMensaje(m);
    }, fallo));
    const presencia = D.push(D.ref(db, RUTA + '/presencia/' + user.uid));
    let reloj;
    parar.push(D.onValue(D.ref(db, '.info/connected'), async s => {
      clearInterval(reloj);
      if (!s.val()) { onEstado('desconectado'); return; }
      try {
        await D.onDisconnect(presencia).remove();
        await D.set(presencia, D.serverTimestamp());
        reloj = setInterval(() => D.set(presencia, D.serverTimestamp()).catch(fallo), 30000);
        onEstado('conectado');
      } catch { fallo(); }
    }));
    fb.cerrar = () => { parar.forEach(fn => fn()); clearInterval(reloj); D.remove(presencia).catch(() => {}); };
    window.addEventListener('pagehide', fb.cerrar, { once: true });
    return fb;
  } catch { onEstado('error'); return null; }
}
