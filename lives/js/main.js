// Maximilian 23 - pagina publica: escena 3D, carga del modelo y controles minimos.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Maximilian } from './maximilian.js?v=cuentos1';
import { Voz } from './voz.js?v=cuentos1';
import { conectarRemoto } from './remoto.js?v=cuentos1';
import { Cuentacuentos } from './cuentos.js?v=cuentos1';

window.__maxArrancado = true;           // desactiva el aviso de index.html

const params = new URLSearchParams(location.search);
// Calidad: ?calidad=alta|baja la fija; si no, se mide la fluidez y se baja sola si hace falta.
const CALIDAD = params.get('calidad');
const USE_BLOOM = params.get('brillo') !== '0' && CALIDAD !== 'baja';
const FILL = 0.9;                        // fraccion de pantalla que ocupa el modelo (cuerpo entero)
const BG = new THREE.Color('#0b161c');

const canvas = document.getElementById('escena');
const loading = document.getElementById('carga');

function fail(msg, err) {
  console.error(msg, err);
  loading.textContent = msg;
  loading.classList.add('error');
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  fail('Este navegador no puede mostrar gráficos 3D (WebGL).', err);
  throw err;
}
renderer.setPixelRatio(CALIDAD === 'baja' ? 1 : Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.NeutralToneMapping;   // respeta los tonos originales
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = BG;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

// Luces con la misma disposicion que en Blender: principal, relleno y contraluz
const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(-3.5, 3.5, 4);
const fill = new THREE.DirectionalLight(0xdfefff, 0.9);
fill.position.set(4, 0.5, 3);
const rim = new THREE.DirectionalLight(0xffffff, 1.8);
rim.position.set(1.5, 3.5, -4.5);
scene.add(key, fill, rim, new THREE.HemisphereLight(0x9fd8e0, 0x0b161c, 0.35));

const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

// Encuadres: 0 = cabeza, 1 = cabeza y busto (al cargar), 2 = cuerpo entero.
// La rueda del raton, el pellizco o las teclas + / - pasan de uno a otro con suavidad.
const ZOOM_INICIAL = 1;
let framings = [{ center: new THREE.Vector3(), size: new THREE.Vector3(2.4, 2.2, 2) }];
const zoom = { actual: ZOOM_INICIAL, objetivo: ZOOM_INICIAL };

let composer = null;
if (USE_BLOOM) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.4, 0.85));
  composer.addPass(new OutputPass());
}

/** Encuadre interpolado para un zoom continuo entre 0 y framings.length - 1. */
function framingAt(z) {
  const i = Math.min(Math.floor(z), framings.length - 2);
  if (i < 0) return framings[0];
  const t = z - i;
  const a = framings[i], b = framings[i + 1];
  return { center: a.center.clone().lerp(b.center, t), size: a.size.clone().lerp(b.size, t) };
}

function placeCamera() {
  const { center, size } = framingAt(zoom.actual);
  // distancia para que el encuadre ocupe FILL de la dimension mas restrictiva
  const vfov = camera.fov * THREE.MathUtils.DEG2RAD;
  const fitH = (size.y / FILL) / (2 * Math.tan(vfov / 2));
  const fitW = (size.x / FILL) / (2 * Math.tan(vfov / 2) * camera.aspect);
  const dist = Math.max(fitH, fitW) + size.z / 2;
  camera.position.set(center.x, center.y + dist * 0.06, center.z + dist);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

function resize() {
  const {width, height} = canvas.getBoundingClientRect();
  const w = Math.max(1,width), h = Math.max(1,height);
  renderer.setSize(w, h, false);
  composer?.setSize(w, h);
  camera.aspect = w / h;
  placeCamera();
}
window.addEventListener('resize', resize);

function zoomBy(delta) {
  zoom.objetivo = THREE.MathUtils.clamp(zoom.objetivo + delta, 0, framings.length - 1);
}

// rueda del raton (y pellizco del panel tactil, que llega como rueda con Ctrl)
window.addEventListener('wheel', (e) => {
  e.preventDefault();
  const pasos = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
  zoomBy(pasos * (e.ctrlKey ? 0.01 : 0.002));
}, { passive: false });

// pellizco con dos dedos en pantallas tactiles
const dedos = new Map();
let distanciaDedos = 0;
canvas.addEventListener('pointerdown', (e) => dedos.set(e.pointerId, e));
canvas.addEventListener('pointermove', (e) => {
  if (!dedos.has(e.pointerId)) return;
  dedos.set(e.pointerId, e);
  if (dedos.size !== 2) return;
  const [a, b] = [...dedos.values()];
  const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  if (distanciaDedos) zoomBy(-Math.log(d / distanciaDedos) * 1.5);
  distanciaDedos = d;
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
  canvas.addEventListener(ev, (e) => {
    dedos.delete(e.pointerId);
    distanciaDedos = 0;
  });
}

/** Sombra suave bajo los pies: un degradado radial (mas barato que sombras en tiempo real). */
function groundShadow(box) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const size = new THREE.Vector3();
  box.getSize(size);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size.x * 1.1, size.z * 1.6),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((box.min.x + box.max.x) / 2, box.min.y + 0.005, (box.min.z + box.max.z) / 2);
  return mesh;
}

// ------------------------------------------------------------------ carga
let max = null;
async function load() {
  const [gltf, expresiones] = await Promise.all([
    new GLTFLoader().loadAsync('models/maximilian23.glb'),
    fetch('data/expresiones.json').then((r) => {
      if (!r.ok) throw new Error(`expresiones.json: ${r.status}`);
      return r.json();
    }),
  ]);
  const root = gltf.scene.getObjectByName('Maximilian23') ?? gltf.scene;
  scene.add(gltf.scene);

  const box = new THREE.Box3().setFromObject(root);
  const encuadre = (b) => ({ center: b.getCenter(new THREE.Vector3()), size: b.getSize(new THREE.Vector3()) });
  const cabeza = root.getObjectByName('Cabeza');
  const tronco = root.getObjectByName('Pivote_Cuerpo');
  if (cabeza && tronco) {
    // busto: de la cintura hacia arriba; cuerpo entero: todo el modelo
    const cintura = tronco.getWorldPosition(new THREE.Vector3()).y - 0.15;
    const busto = new THREE.Box3(new THREE.Vector3(box.min.x, cintura, box.min.z), box.max);
    framings = [encuadre(new THREE.Box3().setFromObject(cabeza)), encuadre(busto), encuadre(box)];
  } else {
    framings = [encuadre(box)];
    zoom.actual = zoom.objetivo = 0;
  }
  if (root.getObjectByName('Cadera_L')) scene.add(groundShadow(box));
  resize();

  max = new Maximilian(root, expresiones);
  window.maximilian = max;               // para probar desde la consola
  loading.classList.add('oculto');
  await setupVoz(max);
  conectarRemoto({
    onMensaje: ejecutarMensaje,
    onEstado: (e) => {
      console.info(`Control remoto: ${e}`);
      document.body.dataset.remoto = e;
    },
  });
  document.dispatchEvent(new CustomEvent('maximilian:listo', { detail: max }));
}

// ------------------------------------------------------------------ mensajes remotos
const GESTOS = {
  atencion: () => max.attention(),
  guino: () => max.wink(),
  saludar: () => max.wave(),
  parpadeo: () => max.blink(),
  reposo: () => max.reposo(),
};

/** Ejecuta un mensaje del panel: { tipo: 'decir' | 'gesto' | 'detener', ... } */
function ejecutarMensaje(m) {
  if (m.tipo === 'cuento') {
    voz.detener();
    narrador?.contar(m.cuento);
    return;
  }
  if (narrador?.visible) narrador.detener();
  if (m.tipo === 'decir') {
    voz.decir(m.texto, { emocion: m.emocion || undefined, velocidad: m.velocidad, tono: m.tono });
  } else if (m.tipo === 'gesto') {
    if (GESTOS[m.gesto]) GESTOS[m.gesto]();
    else if (max.expresiones[m.gesto]) max.setExpression(m.gesto, { duracion: 4 });
  } else if (m.tipo === 'detener') {
    voz.detener();
  }
}
window.maxMensaje = ejecutarMensaje;     // para probar sin Firebase desde la consola

// ------------------------------------------------------------------ voz
// Los navegadores no dejan sonar audio hasta que alguien toca la pagina: el primer
// toque, clic o tecla activa la voz (y Maximilian saluda). Lo que llegue antes espera en cola.
// La voz sintetizada esta desactivada por ahora: ?voz=1 la vuelve a encender.
const CON_VOZ = params.get('voz') === '1';
const SUBTITULOS = !CON_VOZ || params.get('subtitulos') !== '0';
const activarBtn = document.getElementById('activar');
const subtitulo = document.getElementById('subtitulo');
let voz = null;
let vozCuentos = null;
let narrador = null;

async function setupVoz(max) {
  voz = new Voz(max, {
    silencio: !CON_VOZ,
    onTexto: (t) => {
      if (!SUBTITULOS) return;
      if (t) subtitulo.textContent = t;
      subtitulo.classList.toggle('visible', Boolean(t));
    },
    onEstado: (e) => {
      if (e === 'activa') activarBtn.hidden = true;
      if (e === 'bloqueada' || e === 'esperando-activacion') activarBtn.hidden = false;
      if (e === 'sin-voz' || e === 'sin-voz-espanola' || e === 'sin-audio') {
        console.warn(`Voz: ${e}. Maximilian movera la boca y mostrara el texto.`);
      }
    },
  });
  window.maxVoz = voz;                   // para el panel remoto (fase 5) y la consola
  await voz.init();
  vozCuentos = new Voz(max, {
    silencio: true, // La voz definitiva se elegirá tras escuchar muestras.
    onEstado: (estado) => {
      if (estado === 'activa') activarBtn.hidden = true;
      if (estado === 'bloqueada' || estado === 'esperando-activacion') activarBtn.hidden = false;
      if (estado === 'sin-voz' || estado === 'sin-audio') {
        document.getElementById('cuento-aviso').textContent = 'No hay audio disponible. El cuento continúa para leerlo juntos.';
      }
    },
  });
  await vozCuentos.init();
  if (!vozCuentos.disponible) vozCuentos.activa = true;
  const libro = document.getElementById('cuento');
  let zoomAnterior = zoom.objetivo;
  narrador = new Cuentacuentos({max,voz:vozCuentos,
    onEscena: (cuento, escena, i) => {
      if (!document.body.classList.contains('modo-cuento')) zoomAnterior = zoom.objetivo;
      document.body.classList.add('modo-cuento');
      document.body.classList.remove('inactivo');
      libro.hidden = false;
      libro.style.setProperty('--cuento-color', cuento.color);
      document.getElementById('cuento-icono').textContent = cuento.icono;
      document.getElementById('cuento-titulo').textContent = cuento.titulo;
      const texto = document.getElementById('cuento-texto');
      texto.textContent = escena.texto;
      texto.animate?.([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:450,easing:'ease-out'});
      document.getElementById('cuento-pagina').textContent = `${i+1} de ${cuento.escenas.length}`;
      document.getElementById('cuento-progreso').style.width = `${100*(i+1)/cuento.escenas.length}%`;
      document.getElementById('cuento-aviso').textContent = !vozCuentos.disponible
        ? 'Voz definitiva pendiente de elegir. Podemos leer el cuento juntos.'
        : vozCuentos.activa ? '' : 'Toca «Activar voz» en esta pantalla para escucharlo.';
      zoom.actual = zoom.objetivo = framings.length-1;
      resize();
    },
    onFin: () => { document.getElementById('cuento-pagina').textContent = 'Fin · ¡Gracias por escuchar!'; },
    onSalir: () => {
      if (!document.body.classList.contains('modo-cuento')) return;
      document.body.classList.remove('modo-cuento');
      libro.hidden = true;
      zoom.actual = zoom.objetivo = zoomAnterior;
      resize();
    },
  });
  document.getElementById('cerrar-cuento').addEventListener('click', () => narrador.detener());
  activarBtn.hidden = !vozCuentos.disponible && voz.activa;
  document.addEventListener('maximilian:decir', (e) => voz.decir(e.detail.texto, e.detail));
  if (params.has('prueba')) montarPruebaVoz(voz, max);
}

function activarVoz() {
  if (voz && !voz.activa) voz.activar();
  if (vozCuentos && !vozCuentos.activa) vozCuentos.activar(null);
}
activarBtn.addEventListener('click', activarVoz);
window.addEventListener('pointerdown', activarVoz);
window.addEventListener('keydown', activarVoz);

function montarPruebaVoz(voz, max) {
  const form = document.getElementById('prueba-voz');
  form.hidden = false;
  const selVoz = form.elements.voz;
  const pintarVoces = () => {
    selVoz.replaceChildren(...voz.vocesEspanol().map((v) => new Option(`${v.name} (${v.lang})`, v.name)));
    if (!selVoz.options.length) selVoz.append(new Option('(voz del sistema)', ''));
    if (voz.voz) selVoz.value = voz.voz.name;
  };
  pintarVoces();
  speechSynthesis?.addEventListener?.('voiceschanged', pintarVoces);
  selVoz.addEventListener('change', () => voz.configurar({ voz: selVoz.value || null }));

  form.elements.emocion.replaceChildren(
    new Option('(ninguna)', ''),
    ...max.expressionNames.map((n) => new Option(n, n)),
  );
  for (const name of ['velocidad', 'tono']) {
    const input = form.elements[name];
    input.addEventListener('input', () => { input.nextElementSibling.value = input.value; });
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    voz.decir(form.elements.texto.value, {
      emocion: form.elements.emocion.value || undefined,
      velocidad: +form.elements.velocidad.value,
      tono: +form.elements.tono.value,
    });
  });
  form.elements.detener.addEventListener('click', () => voz.detener());
}

load().catch((err) => fail('No se ha podido cargar a Maximilian.', err));

// ------------------------------------------------------------------ bucle
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  max?.update(dt);
  if (Math.abs(zoom.actual - zoom.objetivo) > 1e-4) {
    zoom.actual += (zoom.objetivo - zoom.actual) * (1 - Math.exp(-6 * Math.min(dt, 0.05)));
    placeCamera();
  }
  if (composer) composer.render(dt);
  else renderer.render(scene, camera);
  if (max && !CALIDAD) vigilarFluidez(dt);
});

// En ordenadores lentos (pizarras, equipos antiguos) se quita el brillo y se reduce
// la resolucion por pasos, midiendo la media de fotogramas cada 3 segundos.
const fluidez = { tiempo: 0, frames: 0, nivel: 0 };
function vigilarFluidez(dt) {
  // los primeros segundos no cuentan: compilar sombreadores provoca tirones puntuales
  if (document.hidden || fluidez.nivel >= 2 || max.time < 2) return;
  fluidez.tiempo += dt;
  fluidez.frames += 1;
  if (fluidez.tiempo < 3) return;
  const fps = fluidez.frames / fluidez.tiempo;
  fluidez.tiempo = fluidez.frames = 0;
  if (fps >= 40) return;
  fluidez.nivel += 1;
  if (fluidez.nivel === 1 && composer) {
    composer = null;
  } else {
    fluidez.nivel = 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1) * (fps < 20 ? 0.75 : 1));
  }
  resize();
  console.info(`Fluidez ${fps.toFixed(0)} fps: calidad reducida (nivel ${fluidez.nivel})`);
}
resize();

// ------------------------------------------------------------------ mirada
// Sigue al raton o al dedo; sin ellos, Maximilian mira a su alrededor por su cuenta.
window.addEventListener('pointermove', (e) => {
  if (!max) return;
  if (e.target.closest?.('#gestos')) {   // sobre el cuadro de gestos: mira al frente
    if (!max.gazeLocked) max.mirarAlFrente(true);
    return;
  }
  const x = (e.clientX / window.innerWidth) * 2 - 1;
  const y = -((e.clientY / window.innerHeight) * 2 - 1);
  max.lookAt(x * 1.3, y * 1.3);
});

// ------------------------------------------------------------------ pantalla completa
const fsButton = document.getElementById('pantalla-completa');
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
fsButton.addEventListener('click', toggleFullscreen);
if (!document.documentElement.requestFullscreen) fsButton.hidden = true;
document.addEventListener('fullscreenchange', () => {
  fsButton.setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
});

// el cursor y el boton se ocultan tras unos segundos sin actividad
let idleTimer;
function wake() {
  document.body.classList.remove('inactivo');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add('inactivo'), 3000);
}
['pointermove', 'pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, wake));
wake();

// ------------------------------------------------------------------ gestos
// Cuadro de botones a la derecha (?botones=0 lo oculta). Con el raton encima,
// Maximilian mira al frente para que los gestos se vean de cara.
// Teclas: 1-5 expresiones, G guino, S saludar, B parpadeo, A atencion, H hablar, F pantalla completa.
const ACTIONS = {
  reposo: ['Reposo', () => max.setExpression('reposo')],
  alegria: ['Alegría', () => max.setExpression('alegria')],
  sorpresa: ['Sorpresa', () => max.setExpression('sorpresa')],
  tristeza: ['Tristeza', () => max.setExpression('tristeza')],
  serio: ['Serio', () => max.setExpression('serio')],
  guino: ['Guiño', () => max.wink()],
  saludar: ['Saludar', () => max.wave()],
  parpadeo: ['Parpadeo', () => max.blink()],
  atencion: ['Atención', () => max.attention()],
  hablar: ['Hablar', () => (max.talking ? max.stopTalking() : max.startTalking())],
};
const KEYS = { 1: 'reposo', 2: 'alegria', 3: 'sorpresa', 4: 'tristeza', 5: 'serio',
  g: 'guino', s: 'saludar', b: 'parpadeo', a: 'atencion', h: 'hablar' };

window.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea')) return;
  const k = e.key.toLowerCase();
  if (k === 'f') toggleFullscreen();
  else if (k === '+' || k === '=') zoomBy(-0.5);
  else if (k === '-') zoomBy(0.5);
  else if (max && KEYS[k]) ACTIONS[KEYS[k]][1]();
});

if (params.get('botones') !== '0') {
  const panel = document.getElementById('gestos');
  panel.hidden = false;
  for (const [name, [label, accion]] of Object.entries(ACTIONS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.dataset.accion = name;
    b.addEventListener('click', () => max && accion());
    panel.appendChild(b);
  }
  panel.addEventListener('pointerenter', () => max?.mirarAlFrente(true));
  panel.addEventListener('pointerleave', () => max?.mirarAlFrente(false));
}
