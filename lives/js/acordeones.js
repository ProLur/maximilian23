// Preferencias visuales por cuenta, guardadas solo en este navegador.
export function prepararAcordeones(panel, storage) {
  if (storage === undefined) try { storage = globalThis.localStorage; } catch { storage = null; }
  const tarjetas = new Map();
  let uid = null;
  let preferencias = {};
  const guardar = () => {
    if (!uid) return;
    try { storage?.setItem('maximilian:panel:acordeones:v1:' + uid, JSON.stringify(preferencias)); } catch {}
  };
  for (const [i, tarjeta] of [...panel.children].entries()) {
    if (!tarjeta.classList.contains('tarjeta')) continue;
    const titulo = tarjeta.querySelector('h2');
    if (!titulo) continue;
    const id = tarjeta.classList.contains('sesion-admin') ? 'sesion' : tarjeta.id || 'historial';
    const contenido = document.createElement('div');
    contenido.className = 'acordeon-contenido';
    contenido.id = 'contenido-tarjeta-' + i;
    const cabecera = document.createElement('h2');
    cabecera.className = 'acordeon-cabecera';
    const boton = document.createElement('button');
    boton.type = 'button'; boton.className = 'acordeon-boton';
    boton.setAttribute('aria-controls', contenido.id);
    const etiqueta = document.createElement('span');
    etiqueta.textContent = id === 'acciones-directas' ? 'Gestos y emociones' : titulo.textContent;
    const signo = document.createElement('span');
    signo.className = 'acordeon-signo'; signo.setAttribute('aria-hidden', 'true');
    boton.append(etiqueta, signo); cabecera.append(boton);
    for (const nodo of [...tarjeta.childNodes]) if (nodo !== titulo) contenido.append(nodo);
    titulo.remove(); tarjeta.append(cabecera, contenido);
    tarjeta.classList.add('acordeon');
    const cambiar = (abierta, recordar = false) => {
      contenido.hidden = !abierta;
      boton.setAttribute('aria-expanded', String(abierta));
      signo.textContent = abierta ? '−' : '+';
      if (recordar && id !== 'sesion') { preferencias[id] = abierta; guardar(); }
    };
    cambiar(true);
    boton.addEventListener('click', () => cambiar(contenido.hidden, true));
    tarjetas.set(id, {cambiar});
  }
  return {
    usuario(nuevoUid) {
      uid = nuevoUid; preferencias = {};
      if (uid) try {
        const datos = JSON.parse(storage?.getItem('maximilian:panel:acordeones:v1:' + uid) || '{}');
        if (datos && typeof datos === 'object' && !Array.isArray(datos)) {
          for (const id of tarjetas.keys()) if (id !== 'sesion' && typeof datos[id] === 'boolean') preferencias[id] = datos[id];
        }
      } catch {}
      for (const [id, t] of tarjetas) t.cambiar(id === 'sesion' ? true : preferencias[id] ?? true);
    },
    abrirSesion() { tarjetas.get('sesion')?.cambiar(true); },
    plegarSesion() { tarjetas.get('sesion')?.cambiar(false); },
  };
}
