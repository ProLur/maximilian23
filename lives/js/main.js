// Maximilian 23 - pagina publica: escena 3D, carga del modelo y controles minimos.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Maximilian } from './maximilian.js';
import { Voz } from './voz.js';

window.__maxArrancado = true;           // desactiva el aviso de index.html

const params = new URLSearchParams(location.search);
const USE_BLOOM = params.get('brillo') !== '0';
const FILL = 0.72;                       // fraccion de pantalla que ocupa la cabeza
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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
let target = new THREE.Vector3();
let modelSize = new THREE.Vector3(2.4, 2.2, 2);

let composer = null;
if (USE_BLOOM) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.4, 0.85));
  composer.addPass(new OutputPass());
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer?.setSize(w, h);
  camera.aspect = w / h;
  // distancia para que la cabeza ocupe FILL de la dimension mas restrictiva
  const vfov = camera.fov * THREE.MathUtils.DEG2RAD;
  const fitH = (modelSize.y / FILL) / (2 * Math.tan(vfov / 2));
  const fitW = (modelSize.x / FILL) / (2 * Math.tan(vfov / 2) * camera.aspect);
  const dist = Math.max(fitH, fitW) + modelSize.z / 2;
  camera.position.set(target.x, target.y + dist * 0.06, target.z + dist);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

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
  box.getSize(modelSize);
  box.getCenter(target);
  resize();

  max = new Maximilian(root, expresiones);
  window.maximilian = max;               // para probar desde la consola
  loading.classList.add('oculto');
  await setupVoz(max);
  document.dispatchEvent(new CustomEvent('maximilian:listo', { detail: max }));
}

// ------------------------------------------------------------------ voz
// Los navegadores no dejan sonar audio hasta que alguien toca la pagina: el primer
// toque, clic o tecla activa la voz (y Maximilian saluda). Lo que llegue antes espera en cola.
const SUBTITULOS = params.get('subtitulos') !== '0';
const activarBtn = document.getElementById('activar');
const subtitulo = document.getElementById('subtitulo');
let voz = null;

async function setupVoz(max) {
  voz = new Voz(max, {
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
  activarBtn.hidden = voz.activa;
  document.addEventListener('maximilian:decir', (e) => voz.decir(e.detail.texto, e.detail));
  if (params.has('prueba')) montarPruebaVoz(voz, max);
}

function activarVoz() {
  if (voz && !voz.activa) voz.activar();
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
  if (composer) composer.render(dt);
  else renderer.render(scene, camera);
});
resize();

// ------------------------------------------------------------------ mirada
// Sigue al raton o al dedo; sin ellos, Maximilian mira a su alrededor por su cuenta.
window.addEventListener('pointermove', (e) => {
  if (!max) return;
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

// ------------------------------------------------------------------ pruebas
// Teclas: 1-5 expresiones, G guino, B parpadeo, A atencion, H hablar, F pantalla completa.
// Con ?prueba=1 aparece ademas una barra de botones.
const ACTIONS = {
  reposo: () => max.setExpression('reposo'),
  alegria: () => max.setExpression('alegria'),
  sorpresa: () => max.setExpression('sorpresa'),
  tristeza: () => max.setExpression('tristeza'),
  serio: () => max.setExpression('serio'),
  guino: () => max.wink(),
  parpadeo: () => max.blink(),
  atencion: () => max.attention(),
  hablar: () => (max.talking ? max.stopTalking() : max.startTalking()),
};
const KEYS = { 1: 'reposo', 2: 'alegria', 3: 'sorpresa', 4: 'tristeza', 5: 'serio',
  g: 'guino', b: 'parpadeo', a: 'atencion', h: 'hablar' };

window.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea')) return;
  const k = e.key.toLowerCase();
  if (k === 'f') toggleFullscreen();
  else if (max && KEYS[k]) ACTIONS[KEYS[k]]();
});

if (params.has('prueba')) {
  const bar = document.getElementById('prueba');
  bar.hidden = false;
  for (const name of Object.keys(ACTIONS)) {
    const b = document.createElement('button');
    b.textContent = name;
    b.addEventListener('click', () => max && ACTIONS[name]());
    bar.appendChild(b);
  }
}
