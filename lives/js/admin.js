import { prepararMenu } from './menu-admin.js?v=panel-biblioteca1';
import { contarPantallas, exigirPantalla } from './pantallas.js?v=ilustrados1';
import { prepararAcordeones } from './acordeones.js?v=ilustrados1';
// Maximilian 23 - panel de control remoto.
// Inicia sesion con Firebase Auth y escribe mensajes en la Realtime Database.
// Las reglas (firebase/database.rules.json) solo dejan escribir a las cuentas de maximilian/admins.

import { cargarFirebase, configurado, desfaseServidor, RUTA } from './firebase.js';
import { crearSesion, rutaSesion } from './sesiones.js?v=ilustrados1';

const $ = (sel) => document.querySelector(sel);
const aviso = $('#aviso');
const login = $('#login');
const panel = $('#panel');
const form = $('#mensaje');
const salir = $('#salir');
const pantallas = $('#pantallas');
const acordeones = prepararAcordeones(panel);
const menu = prepararMenu(panel);
let sesionPlegada = false;

const EMOCIONES = [
  ['alegria', 'Alegría'], ['sorpresa', 'Sorpresa'], ['tristeza', 'Tristeza'], ['serio', 'Serio'],
];
const GESTOS = [
  ['saludar', 'Saludar'], ['guino', 'Guiñar el ojo'], ['atencion', 'Atención'], ['parpadeo', 'Parpadeo'], ['reposo', 'Reposo'],
];

const ERRORES_AUTH = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/user-disabled': 'Esta cuenta está desactivada.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
  'auth/network-request-failed': 'Sin conexión a internet.',
};

function mostrar(estado, texto = '') {
  aviso.hidden = !texto;
  aviso.textContent = texto;
  login.hidden = estado !== 'login';
  panel.hidden = estado !== 'panel';
  salir.hidden = estado !== 'panel' && estado !== 'sin-permiso';
}

function error(el, msg) {
  el.querySelector('.error').textContent = msg || '';
}

async function main() {
  if (!configurado()) {
    mostrar('nada', 'El control remoto aún no está configurado: falta rellenar js/firebase-config.js (ver firebase/GUIA-FIREBASE.md).');
    return;
  }
  let fb;
  try {
    fb = await cargarFirebase({ conAuth: true });
  } catch (err) {
    console.error(err);
    mostrar('nada', 'No se ha podido cargar Firebase. Comprueba la conexión o si la red bloquea gstatic.com.');
    return;
  }
  const { auth, A, db, D } = fb;
  await A.setPersistence(auth, A.browserSessionPersistence);
  $('#google').addEventListener('click', async () => {
    error(login, '');
    const boton = $('#google');
    boton.disabled = true;
    try {
      const proveedor = new A.GoogleAuthProvider();
      proveedor.setCustomParameters({ prompt: 'select_account', hd: 'educarex.es' });
      await A.signInWithPopup(auth, proveedor);
    } catch (err) {
      error(login, err.code === 'auth/popup-blocked'
        ? 'Permite la ventana de acceso de Google y vuelve a intentarlo.'
        : ERRORES_AUTH[err.code] ?? 'No se ha completado el acceso a Educarex. Vuelve a intentarlo.');
    } finally { boton.disabled = false; }
  });
  const desfase = await desfaseServidor(db, D);
  let usuario = null;
  let sesion = null;
  let base = '';
  let cambiando = false;
  let parar = [];                        // suscripciones activas del panel

  // ---------------------------------------------------------------- sesion
  login.addEventListener('submit', e => e.preventDefault());

  async function cerrarSesion() {
    if (sesion) await D.update(D.ref(db,rutaSesion(sesion.codigo)+'/meta'),{expira:D.serverTimestamp()});
    sesion=null; base='';
  }
  salir.addEventListener('click', async () => { try { await cerrarSesion(); await A.signOut(auth); } catch { mostrar('nada','No se ha podido cerrar la sesión. Revisa la conexión.'); } });
  async function nuevaSesion() {
    if(cambiando || !usuario) return;
    cambiando=true;
    const boton=$('#nueva-sesion'); boton.disabled=true;
    try {
      await cerrarSesion();
      parar.forEach(fn=>fn()); parar=[];
      sesion=await crearSesion(fb,usuario.uid,desfase);
      sesionPlegada=false;acordeones.abrirSesion();menu.mostrar('sesion');
      base=rutaSesion(sesion.codigo)+'/canales/'+sesion.nonce;
      $('#codigo-sesion').textContent=sesion.codigo;
      $('#caducidad-sesion').textContent='Válido hasta las '+new Date(sesion.expira).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
      mostrar('panel'); escucharPantallas(); escucharHistorial();
      parar.push(D.onValue(D.ref(db, RUTA+'/admins/'+usuario.uid), snap=>{
        if(snap.val()!==true){usuario=null;parar.forEach(fn=>fn());parar=[];mostrar('sin-permiso','Permiso de administrador revocado.');}
      }));
      const reloj=setInterval(()=>{if(sesion && Date.now()+desfase>=sesion.expira){ $('#caducidad-sesion').textContent='Sesión caducada. Pulsa Nueva sesión.'; }},1000);
      parar.push(()=>clearInterval(reloj));
    } catch(err) { console.error(err); mostrar('nada','No se ha podido crear la sesión. Recarga el panel para intentarlo de nuevo.'); }
    finally {cambiando=false;boton.disabled=false;}
  }
  $('#nueva-sesion').addEventListener('click',nuevaSesion);

  A.onAuthStateChanged(auth, async (user) => {
    parar.forEach((fn) => fn());
    parar = [];
    usuario = null;
    acordeones.usuario(null);
    pantallas.hidden = true;
    if (!user) {
      mostrar('login');
      return;
    }
    mostrar('nada', 'Comprobando permisos…');
    let esAdmin = false;
    try {
      esAdmin = (await D.get(D.ref(db, `${RUTA}/admins/${user.uid}`))).val() === true;
    } catch (err) {
      console.error(err);
    }
    if (!esAdmin) {
      mostrar('sin-permiso', `La cuenta ${user.email} no tiene permiso para controlar a Maximilian.`);
      return;
    }
    if (auth.currentUser?.uid !== user.uid) return;
    usuario = user;
    acordeones.usuario(user.uid);
    await nuevaSesion();
  });

  // ---------------------------------------------------------------- envio
  async function enviar(datos, destino = form) {
    error(destino, '');
    aviso.hidden=true;
    try {
      if (!usuario) throw new Error('Inicia sesión');
      if (!sesion || Date.now()+desfase>=sesion.expira) throw new Error('La sesión ha caducado. Pulsa Nueva sesión.');
      const destinoBase=base,autor=usuario.uid;
      if(datos.tipo==='decir'||datos.tipo==='cuento'||datos.tipo==='reproduccion'){
        await exigirPantalla({db,D,base:destinoBase,ahora:()=>Date.now()+desfase});
        if(!sesion || base!==destinoBase || usuario?.uid!==autor)throw Error('La sesión ha cambiado. Vuelve a enviar.');
      }
      const id = D.push(D.ref(db, `${destinoBase}/mensajes`)).key;
      const comando = {
        id,
        expira: Date.now() + desfase + 30000,
        ...datos,
        creado: D.serverTimestamp(),
        autor: usuario.uid,
      };
      await D.update(D.ref(db), { [`${base}/mensajes/${id}`]: comando, [`${base}/comando`]: comando });
      return true;
    } catch (err) {
      console.error(err);
      aviso.hidden=false;aviso.textContent=err.message || 'No se ha enviado la orden.';
      error(destino, err.code === 'PERMISSION_DENIED'
        ? 'Permiso denegado: revisa las reglas y que tu cuenta esté en maximilian/admins.'
        : `No se ha podido enviar (${err.message}).`);
      return false;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = form.texto.value.trim();
    if (!texto) return;
    const datos = { tipo: 'decir', texto, velocidad: +form.velocidad.value, tono: +form.tono.value };
    if (form.emocion.value) datos.emocion = form.emocion.value;
    const boton = form.querySelector('[type=submit]');
    boton.disabled = true;
    if (await enviar(datos)) {
      form.texto.value = '';
      contar();
    }
    boton.disabled = false;
    form.texto.focus();
  });

  form.texto.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) form.requestSubmit();
  });
  form.elements.detener.addEventListener('click', () => enviar({ tipo: 'detener' }));

  for (const [selector, acciones] of [['#gestos', GESTOS], ['#emociones', EMOCIONES]]) {
    for (const [id, nombre] of acciones) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'secundario';
      b.textContent = nombre;
      b.dataset.gesto = id;
      b.addEventListener('click', async () => {
        const estado = $('#estado-accion');
        b.disabled = true;
        estado.textContent = 'Enviando…';
        const enviado = await enviar({ tipo: 'gesto', gesto: id }, $('#acciones-directas'));
        estado.textContent = enviado ? `${nombre}: enviado a las pantallas conectadas.` : '';
        b.disabled = false;
      });
      $(selector).appendChild(b);
    }
  }

  // ---------------------------------------------------------------- estado
  function escucharPantallas() {
    let datos = {};
    const pintar = () => {
      const ahora = Date.now() + desfase;
      const n = contarPantallas(datos, ahora);
      if(n > 0 && !sesionPlegada){sesionPlegada=true;acordeones.plegarSesion();}
      pantallas.hidden = false;
      pantallas.classList.toggle('activa', n > 0);
      pantallas.querySelector('.texto').textContent =
        n === 0 ? 'Ninguna pantalla conectada' : n === 1 ? '1 pantalla conectada' : `${n} pantallas conectadas`;
    };
    parar.push(D.onValue(D.ref(db, `${base}/presencia`), (s) => { datos = s.val() ?? {}; pintar(); }));
    const reloj = setInterval(pintar, 15_000);
    parar.push(() => clearInterval(reloj));
  }

  function escucharHistorial() {
    const q = D.query(D.ref(db, `${base}/mensajes`), D.orderByChild('creado'), D.limitToLast(30));
    parar.push(D.onValue(q, (s) => {
      const items = [];
      s.forEach((c) => { const v = c.val(); if (v.tipo === 'decir') items.push(v); });
      const lista = $('#historial');
      lista.replaceChildren(...items.reverse().slice(0, 10).map((m) => {
        const li = document.createElement('li');
        const hora = new Date(m.creado).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const texto = document.createElement('span');
        texto.textContent = m.texto;
        const meta = document.createElement('small');
        meta.textContent = m.emocion ? `${hora} · ${m.emocion}` : hora;
        const repetir = document.createElement('button');
        repetir.type = 'button';
        repetir.className = 'secundario';
        repetir.textContent = 'Repetir';
        repetir.addEventListener('click', () => {
          const { tipo, texto: t, emocion, velocidad, tono } = m;
          enviar(Object.fromEntries(Object.entries({ tipo, texto: t, emocion, velocidad, tono })
            .filter(([, v]) => v !== undefined)));
        });
        li.append(texto, meta, repetir);
        return li;
      }));
      if (!items.length) lista.innerHTML = '<li class="vacio">Todavía no hay mensajes.</li>';
    }));
  }
}

// ---------------------------------------------------------------- formulario (sin Firebase)
function contar() {
  form.querySelector('.contador').textContent = `${form.texto.value.length} / 1000`;
}
form.texto.addEventListener('input', contar);
for (const name of ['velocidad', 'tono']) {
  const input = form.elements[name];
  input.addEventListener('input', () => { input.nextElementSibling.value = input.value; });
}
fetch('data/expresiones.json')
  .then((r) => r.json())
  .then((ex) => {
    form.emocion.replaceChildren(
      new Option('(ninguna)', ''),
      ...Object.keys(ex).filter((k) => !k.startsWith('_') && k !== 'reposo').map((k) => new Option(k, k)),
    );
  })
  .catch(() => form.emocion.replaceChildren(new Option('(ninguna)', '')));

main();
