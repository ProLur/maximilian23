// Maximilian 23 - controlador del personaje.
// Recibe la escena del .glb y anima en tiempo real: flotacion, parpadeo, mirada,
// expresiones (expresiones.json), atencion, boca al hablar y antena con muelle.
// Las mismas reglas que blender/maximilian_demo.py, pero calculadas en vivo para no repetirse.

import * as THREE from 'three';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const EYES = ['Ojo_L', 'Ojo_R'];
const GROUPS = { ojos: EYES, ojo_l: ['Ojo_L'], ojo_r: ['Ojo_R'], boca: ['Boca'] };

// Brazos: angulos en grados (ver _info en expresiones.json). Reposo: algo separados del pecho.
const ARM_REST = { adelante: 0, fuera: 10, codo: 8, codo_lateral: 0, giro: 0 };
const WAVE_POSE = { adelante: 10, fuera: 72, codo: 0, codo_lateral: 105, giro: 90 };
const WAVE_TIME = 2.6;

// Ejes de Blender expresados en el espacio de glTF/Three (Z arriba -> Y arriba)
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 0, -1);
const AXIS_Z = new THREE.Vector3(0, 1, 0);

const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
const smoothstep = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const rand = (a, b) => a + Math.random() * (b - a);

function findMorphMesh(root, name) {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`No se encuentra "${name}" en el modelo`);
  let mesh = null;
  node.traverse((o) => { if (!mesh && o.isMesh && o.morphTargetDictionary) mesh = o; });
  if (!mesh) throw new Error(`"${name}" no tiene shape keys`);
  return mesh;
}

export class Maximilian {
  constructor(root, expresiones) {
    this.root = root;
    this.expresiones = expresiones;
    this.pivot = root.getObjectByName('Pivote_Cabeza');
    this.antenna = root.getObjectByName('Antena');
    this.antennaBase = this.antenna.quaternion.clone();
    this.baseY = root.position.y;
    this.meshes = Object.fromEntries(['Ojo_L', 'Ojo_R', 'Boca'].map((n) => [n, findMorphMesh(root, n)]));

    this.time = 0;
    this.expression = 'reposo';
    this.expressionUntil = Infinity;    // para expresiones temporales (guino)
    this.face = {};                     // pesos de la expresion, suavizados: "Ojo_L|Alegre" -> w
    this.headExpr = { asentir: 0, inclinar: 0, girar: 0 };

    this.gazeTarget = { x: 0, y: 0 };
    this.gaze = { x: 0, y: 0 };         // ojos: rapidos
    this.headGaze = { x: 0, y: 0 };     // cabeza: sigue a los ojos con retraso
    this.lastPointer = -Infinity;
    this.gazeLocked = false;
    this.nextWander = 1;

    this.blinks = [];
    this.nextBlink = rand(1.5, 3);

    this.attentionAt = -Infinity;

    this.talking = false;
    this.talkRate = 1;                  // velocidad de la voz: acorta o alarga las silabas
    this.talkLevel = 0;
    this.syllable = null;
    this.syllablesLeft = 0;

    this.antennaSpring = { ax: 0, ay: 0, vx: 0, vy: 0, prev: null };

    // Cuerpo (opcional: el modelo puede ser solo la cabeza)
    this.bodyPivot = root.getObjectByName('Pivote_Cuerpo');
    this.bodyBase = this.bodyPivot?.position.clone();
    this.bodyYaw = 0;
    this.headYaw = 0;
    this.waveAt = -Infinity;
    this.arms = {};
    for (const [s, side] of [['L', 1], ['R', -1]]) {
      const hombro = root.getObjectByName(`Hombro_${s}`);
      if (!hombro) continue;
      this.arms[s] = {
        side,
        hombro,
        codo: root.getObjectByName(`Codo_${s}`),
        muneca: root.getObjectByName(`Muneca_${s}`),
        pose: { ...ARM_REST },
        phase: side > 0 ? 0 : 1.9,      // desfase para que los brazos no se muevan a la vez
      };
    }
  }

  // ---------------------------------------------------------------- API publica
  get expressionNames() {
    return Object.keys(this.expresiones).filter((k) => !k.startsWith('_'));
  }

  setExpression(name, { duracion } = {}) {
    if (!this.expresiones[name]) {
      console.warn(`Expresion desconocida: ${name}`);
      return;
    }
    this.expression = name;
    this.expressionUntil = duracion ? this.time + duracion : Infinity;
  }

  blink() {
    this.blinks.push(this.time);
  }

  wink() {
    this.setExpression('guino', { duracion: 0.8 });
  }

  /** x, y en [-1, 1]: +x derecha del espectador, +y arriba. */
  lookAt(x, y) {
    if (this.gazeLocked) return;
    this.gazeTarget.x = clamp(x, -1, 1);
    this.gazeTarget.y = clamp(y, -1, 1);
    this.lastPointer = this.time;
  }

  /** true: mira al frente y deja de seguir el cursor y de mirar a su alrededor. */
  mirarAlFrente(activo) {
    this.gazeLocked = activo;
    if (activo) {
      this.gazeTarget.x = 0;
      this.gazeTarget.y = 0;
    }
    this.lastPointer = this.time;
  }

  /** Reaccion al recibir un mensaje: levanta la cabeza, abre los ojos y mira al frente. */
  attention() {
    this.attentionAt = this.time;
    this.gazeTarget.x = 0;
    this.gazeTarget.y = 0.1;
    this.lastPointer = this.time;
    this.blink();
  }

  /** Saluda con la mano izquierda del robot (la derecha del espectador), como en el poster. */
  wave() {
    if (!this.arms.L) return;
    this.waveAt = this.time;
    this.setExpression('alegria', { duracion: WAVE_TIME });
  }

  startTalking() {
    this.talking = true;
  }

  stopTalking() {
    this.talking = false;
  }

  /** Marca el inicio de una palabra (la voz lo llamara en cada 'boundary'). */
  wordPulse() {
    if (!this.talking) return;
    this.syllable = null;
    this.syllablesLeft = Math.round(rand(1, 3));
  }

  // ---------------------------------------------------------------- bucle
  update(dt) {
    dt = Math.min(dt, 1 / 20);            // evita saltos al volver de otra pestana
    this.time += dt;
    const t = this.time;

    if (t > this.expressionUntil) this.setExpression('reposo');
    this.updateGaze(dt);
    this.scheduleBlinks();

    const target = this.expressionWeights();
    for (const k of new Set([...Object.keys(target), ...Object.keys(this.face)])) {
      this.face[k] = damp(this.face[k] ?? 0, target[k] ?? 0, 7, dt);
    }

    const cab = this.expresiones[this.expression].cabeza ?? {};
    for (const k of ['asentir', 'inclinar', 'girar']) {
      this.headExpr[k] = damp(this.headExpr[k], cab[k] ?? 0, 3, dt);
    }

    this.talkLevel = damp(this.talkLevel, this.talking ? 1 : 0, this.talking ? 10 : 6, dt);
    this.applyFace(dt);
    this.applyHead(dt);
    this.applyBody(dt);
  }

  // ---------------------------------------------------------------- partes
  expressionWeights() {
    const out = {};
    const state = this.expresiones[this.expression];
    for (const [group, meshes] of Object.entries(GROUPS)) {
      for (const [key, w] of Object.entries(state[group] ?? {})) {
        for (const m of meshes) out[`${m}|${key}`] = (out[`${m}|${key}`] ?? 0) + w;
      }
    }
    return out;
  }

  updateGaze(dt) {
    const t = this.time;
    // sin raton/dedo durante un rato: mira a su alrededor, casi siempre hacia el publico
    if (!this.gazeLocked && t - this.lastPointer > 4 && t > this.nextWander) {
      const center = Math.random() < 0.55;
      this.gazeTarget.x = center ? rand(-0.15, 0.15) : rand(-0.9, 0.9);
      this.gazeTarget.y = center ? rand(-0.1, 0.15) : rand(-0.5, 0.6);
      this.nextWander = t + rand(1.4, 4);
      if (Math.random() < 0.35) this.blink();
    }
    this.gaze.x = damp(this.gaze.x, this.gazeTarget.x, 18, dt);
    this.gaze.y = damp(this.gaze.y, this.gazeTarget.y, 18, dt);
    this.headGaze.x = damp(this.headGaze.x, this.gazeTarget.x, 2.5, dt);
    this.headGaze.y = damp(this.headGaze.y, this.gazeTarget.y, 2.5, dt);
  }

  scheduleBlinks() {
    if (this.time > this.nextBlink) {
      this.blink();
      if (Math.random() < 0.15) this.blinks.push(this.time + 0.32);   // doble parpadeo
      this.nextBlink = this.time + rand(2.2, 5.5);
    }
    this.blinks = this.blinks.filter((b) => this.time - b < 0.3);
  }

  blinkWeight() {
    let w = 0;
    for (const b of this.blinks) {
      const x = this.time - b;
      if (x < 0) continue;
      if (x < 0.07) w = Math.max(w, smoothstep(x / 0.07));
      else if (x < 0.11) w = 1;
      else if (x < 0.25) w = Math.max(w, 1 - smoothstep((x - 0.11) / 0.14));
    }
    return w;
  }

  /** Silabas de duracion y forma variables, con pausas entre palabras. */
  visemes() {
    const t = this.time;
    if (this.talking && (!this.syllable || t > this.syllable.start + this.syllable.dur)) {
      let start = t;
      if (this.syllablesLeft <= 0) {
        start += rand(0.08, 0.25);
        this.syllablesLeft = Math.round(rand(2, 5));
      }
      const r = Math.random();
      const shape = r < 0.45 ? 'Habla_A' : r < 0.8 ? 'Habla_E' : 'Habla_O';
      this.syllable = { start, dur: rand(0.11, 0.2) / this.talkRate, shape, amp: rand(0.55, 1) };
      this.syllablesLeft -= 1;
    }
    const out = {};
    const s = this.syllable;
    if (s) {
      const u = (t - s.start) / s.dur;
      if (u >= 0 && u <= 1) out[s.shape] = s.amp * Math.sin(Math.PI * u) * this.talkLevel;
    }
    return out;
  }

  applyFace() {
    const w = {};
    // al hablar, la boca de la expresion se atenua para dejar sitio a las silabas
    const mouthScale = 1 - 0.5 * this.talkLevel;
    for (const [k, v] of Object.entries(this.face)) {
      w[k] = k.startsWith('Boca|') ? v * mouthScale : v;
    }
    const add = (k, v) => { w[k] = (w[k] ?? 0) + v; };

    const gx = this.gaze.x, gy = this.gaze.y;
    for (const eye of EYES) {
      add(`${eye}|Mirar_Derecha`, Math.max(gx, 0));
      add(`${eye}|Mirar_Izquierda`, Math.max(-gx, 0));
      add(`${eye}|Mirar_Arriba`, Math.max(gy, 0));
      add(`${eye}|Mirar_Abajo`, Math.max(-gy, 0));
    }

    const a = this.time - this.attentionAt;
    if (a >= 0 && a < 1.5) {
      const env = smoothstep(a / 0.1) * (1 - smoothstep((a - 0.5) / 0.6));
      for (const eye of EYES) add(`${eye}|Sorpresa`, 0.5 * env);
    }

    for (const [shape, v] of Object.entries(this.visemes())) add(`Boca|${shape}`, v);

    const bw = this.blinkWeight();
    for (const eye of EYES) w[`${eye}|Parpadeo`] = Math.max(w[`${eye}|Parpadeo`] ?? 0, bw);

    for (const [name, mesh] of Object.entries(this.meshes)) {
      const inf = mesh.morphTargetInfluences;
      for (const [key, idx] of Object.entries(mesh.morphTargetDictionary)) {
        inf[idx] = clamp(w[`${name}|${key}`] ?? 0, 0, 1);
      }
    }
  }

  applyHead(dt) {
    const t = this.time;
    // flotacion y balanceo con periodos no multiplos: nunca se repite igual
    let pitch = 1.2 * Math.sin(TAU * t / 5.3) + 0.5 * Math.sin(TAU * t / 2.9 + 1.0);
    let roll = 1.4 * Math.sin(TAU * t / 6.7 + 0.5);
    let yaw = 2.2 * Math.sin(TAU * t / 8.1) + 0.6 * Math.sin(TAU * t / 3.3 + 2.0);
    let lift = 0.025 * Math.sin(TAU * t / 3.7) + 0.008 * Math.sin(TAU * t / 1.9 + 0.7);

    pitch += this.headExpr.asentir - 6 * this.headGaze.y;
    roll += this.headExpr.inclinar;
    yaw += this.headExpr.girar + 10 * this.headGaze.x;

    const k = this.talkLevel;
    yaw += k * (3 * Math.sin(TAU * t / 2.3) + 1.2 * Math.sin(TAU * t / 1.3 + 1));
    pitch += k * (1.2 * Math.sin(TAU * t / 0.9) + 0.6 * Math.sin(TAU * t / 1.7 + 2));

    // atencion: sube y levanta la mirada con un pequeno rebote amortiguado
    const a = t - this.attentionAt;
    if (a >= 0 && a < 3) {
      const hold = smoothstep(a / 0.15) * (1 - smoothstep((a - 0.6) / 0.8));
      pitch -= 7 * Math.exp(-3.2 * a) * Math.sin(9 * a) + 4 * hold;
      lift += 0.05 * smoothstep(a / 0.15) * (1 - smoothstep((a - 0.4) / 0.9));
    }

    // Blender -> glTF: asentir = X, inclinar = -Z, girar = Y
    this.pivot.rotation.set(pitch * DEG, yaw * DEG, -roll * DEG);
    this.headYaw = yaw;
    this.root.position.y = this.baseY + lift;
    this.updateAntenna(pitch, roll, dt);
  }

  armTarget(s) {
    const state = this.expresiones[this.expression];
    return { ...ARM_REST, ...state.brazos, ...state[`brazo_${s.toLowerCase()}`] };
  }

  applyBody(dt) {
    if (!this.bodyPivot) return;
    const t = this.time;
    const breath = Math.sin(TAU * t / 4.2);

    // respiracion y un leve giro que acompana, con retraso, a la cabeza
    this.bodyYaw = damp(this.bodyYaw, this.headYaw * 0.2, 1.5, dt);
    const k = this.talkLevel;
    const sway = k * 1.5 * Math.sin(TAU * t / 2.7 + 0.8);
    this.bodyPivot.rotation.set((0.6 * breath) * DEG, (this.bodyYaw + sway) * DEG, 0);
    this.bodyPivot.position.copy(this.bodyBase);
    this.bodyPivot.position.y += 0.008 * breath;

    const a = t - this.attentionAt;
    const attention = a >= 0 && a < 1.5 ? smoothstep(a / 0.12) * (1 - smoothstep((a - 0.3) / 0.8)) : 0;
    const w = t - this.waveAt;
    const wave = w >= 0 && w < WAVE_TIME + 0.6
      ? smoothstep(w / 0.4) * (1 - smoothstep((w - WAVE_TIME + 0.4) / 0.6)) : 0;

    for (const [s, arm] of Object.entries(this.arms)) {
      const target = this.armTarget(s);
      // gestos suaves al hablar: los antebrazos acompanan, cada brazo a su ritmo
      target.codo += k * (14 + 10 * Math.sin(TAU * t / 1.7 + arm.phase));
      target.adelante += k * (6 + 5 * Math.sin(TAU * t / 2.3 + arm.phase));
      target.fuera += 6 * attention;
      for (const key of Object.keys(ARM_REST)) arm.pose[key] = damp(arm.pose[key], target[key], 5, dt);

      // respiracion: los brazos se abren y cierran apenas
      const p = { ...arm.pose };
      p.fuera += 1.2 * breath;
      p.codo += 2 * Math.sin(TAU * t / 4.2 + 0.5);
      if (s === 'L' && wave > 0) {
        for (const key of Object.keys(ARM_REST)) p[key] += (WAVE_POSE[key] - p[key]) * wave;
        p.codo_lateral += 18 * wave * Math.sin(TAU * 2.2 * w);
      }
      this.poseArm(arm, p);
    }
  }

  poseArm(arm, p) {
    const sd = arm.side;
    // hombro: primero hacia delante y luego hacia fuera (rotaciones de Blender en ejes de glTF)
    arm.hombro.quaternion.setFromAxisAngle(AXIS_Y, -sd * p.fuera * DEG)
      .multiply(_q.setFromAxisAngle(AXIS_X, -p.adelante * DEG));
    arm.codo.quaternion.setFromAxisAngle(AXIS_Y, -sd * p.codo_lateral * DEG)
      .multiply(_q.setFromAxisAngle(AXIS_X, -p.codo * DEG));
    arm.muneca.quaternion.setFromAxisAngle(AXIS_Z, sd * p.giro * DEG);
  }

  updateAntenna(pitch, roll, dt) {
    const s = this.antennaSpring;
    const omega = 14, zeta = 0.18;
    const vel = s.prev ? [(pitch - s.prev[0]) / dt, (roll - s.prev[1]) / dt] : [0, 0];
    s.prev = [pitch, roll];
    const tx = -0.04 * vel[0], ty = -0.04 * vel[1];
    s.vx += (-omega * omega * (s.ax - tx) - 2 * zeta * omega * s.vx) * dt;
    s.vy += (-omega * omega * (s.ay - ty) - 2 * zeta * omega * s.vy) * dt;
    s.ax = clamp(s.ax + s.vx * dt, -12, 12);
    s.ay = clamp(s.ay + s.vy * dt, -12, 12);
    _q.setFromEuler(_e.set(s.ax * DEG, 0, -s.ay * DEG));
    this.antenna.quaternion.copy(_q).multiply(this.antennaBase);
  }
}

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
