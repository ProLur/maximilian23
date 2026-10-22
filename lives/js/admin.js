// Maximilian 23 - panel de control remoto.
// Inicia sesion con Firebase Auth y escribe mensajes en la Realtime Database.
// Las reglas (firebase/database.rules.json) solo dejan escribir a las cuentas de maximilian/admins.

import { cargarFirebase, configurado, desfaseServidor, RUTA } from './firebase.js';

const $ = (sel) => document.querySelector(sel);
const aviso = $('#aviso');
const login = $('#login');
const panel = $('#panel');
const form = $('#mensaje');
const salir = $('#salir');
const pantallas = $('#pantallas');

const GESTOS = [
  ['alegria', 'Alegría'], ['sorpresa', 'Sorpresa'], ['tristeza', 'Tristeza'], ['serio', 'Serio'],
  ['guino', 'Guiño'], ['saludar', 'Saludar'], ['atencion', 'Atención'], ['parpadeo', 'Parpadeo'], ['reposo', 'Reposo'],
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
  const desfase = await desfaseServidor(db, D);
  let usuario = null;
  let parar = [];                        // suscripciones activas del panel

  // ---------------------------------------------------------------- sesion
  login.addEventListener('submit', async (e) => {
    e.preventDefault();
    error(login, '');
    const boton = login.querySelector('[type=submit]');
    boton.disabled = true;
    try {
      await A.signInWithEmailAndPassword(auth, login.email.value.trim(), login.password.value);
      login.password.value = '';
    } catch (err) {
      error(login, ERRORES_AUTH[err.code] ?? `No se ha podido entrar (${err.code}).`);
    } finally {
      boton.disabled = false;
    }
  });

  login.elements.olvido.addEventListener('click', async () => {
    const email = login.email.value.trim();
    if (!email) {
      error(login, 'Escribe tu correo y vuelve a pulsar.');
      return;
    }
    try {
      await A.sendPasswordResetEmail(auth, email);
      error(login, 'Si el correo está registrado, recibirás un enlace para cambiar la contraseña.');
    } catch (err) {
      error(login, ERRORES_AUTH[err.code] ?? `Error: ${err.code}`);
    }
  });

  salir.addEventListener('click', () => A.signOut(auth));

  A.onAuthStateChanged(auth, async (user) => {
    parar.forEach((fn) => fn());
    parar = [];
    usuario = user;
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
    mostrar('panel');
    escucharPantallas();
    escucharHistorial();
  });

  // ---------------------------------------------------------------- envio
  async function enviar(datos) {
    error(form, '');
    try {
      await D.push(D.ref(db, `${RUTA}/mensajes`), {
        ...datos,
        creado: D.serverTimestamp(),
        autor: usuario.uid,
      });
      return true;
    } catch (err) {
      console.error(err);
      error(form, err.code === 'PERMISSION_DENIED'
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

  for (const [id, nombre] of GESTOS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'secundario';
    b.textContent = nombre;
    b.addEventListener('click', () => enviar({ tipo: 'gesto', gesto: id }));
    $('#gestos').appendChild(b);
  }

  // ---------------------------------------------------------------- estado
  function escucharPantallas() {
    let datos = {};
    const pintar = () => {
      const ahora = Date.now() + desfase;
      const n = Object.values(datos).filter((t) => ahora - t < 90_000).length;
      pantallas.hidden = false;
      pantallas.classList.toggle('activa', n > 0);
      pantallas.querySelector('.texto').textContent =
        n === 0 ? 'Ninguna pantalla conectada' : n === 1 ? '1 pantalla conectada' : `${n} pantallas conectadas`;
    };
    parar.push(D.onValue(D.ref(db, `${RUTA}/presencia`), (s) => { datos = s.val() ?? {}; pintar(); }));
    const reloj = setInterval(pintar, 15_000);
    parar.push(() => clearInterval(reloj));
  }

  function escucharHistorial() {
    const q = D.query(D.ref(db, `${RUTA}/mensajes`), D.orderByChild('creado'), D.limitToLast(30));
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
