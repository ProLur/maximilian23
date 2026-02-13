const VF = Vex.Flow;
const div = document.getElementById("pentagrama");
const renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);
const container = document.getElementById("pentagrama-container");
const tempoDisplay = document.getElementById("tempo-display");

let MAX_LINE_WIDTH = Math.max(280, container.clientWidth - 40);
const FIRST_STAVE_WIDTH = 350;
const minStaveWidth = 100;
const lineHeight = 100;
const noteWidthFactors = { w: 50, h: 50, q: 55, '8': 80 };

let width = Math.max(280, container.clientWidth);
let currentHeight = 240;
renderer.resize(width, currentHeight);
const context = renderer.getContext();

let clave = "treble";
let compas = "";
let bpm = 0;
let lines = [[]];
let currentLine = 0;
let figuraActiva = null;
let showNoteLabels = false;
let isPlaying = false;
let metronomeOn = false;
let modoLigar = false;
let primeraNotaParaLigar = null;
let metronomeLoop = null;
let synth = null;

const noteMap = {
  treble: ["g/3", "a/3", "b/3", "c/4", "d/4", "e/4", "f/4", "g/4", "a/4", "b/4", "c/5", "d/5", "e/5", "f/5", "g/5", "a/5", "b/5"],
  bass: ["b/1", "c/2", "d/2", "e/2", "f/2", "g/2", "a/2", "b/2", "c/3", "d/3", "e/3", "f/3", "g/3", "a/3", "b/3", "c/4", "d/4"]
};

const noteNameMap = { c: "Do", d: "Re", e: "Mi", f: "Fa", g: "Sol", a: "La", b: "Si" };
const duracionBeats = { w: 4, h: 2, q: 1, '8': 0.5 };
const duracionTiempo = { w: "1n", h: "2n", q: "4n", '8': "8n" };
const tempoNames = {
  80: "Andante (80 BPM)",
  90: "Moderado (90 BPM)",
  120: "Allegro (120 BPM)",
  160: "Presto (160 BPM)"
};

function getNoteName(note) {
  const [letter, octave] = note.split("/");
  return `${noteNameMap[letter]} ${octave}`;
}

function initSynth() {
  if (!synth) synth = new Tone.Synth().toDestination();
}

function init() {
  const claveSelect = document.getElementById("clave");
  const compasSelect = document.getElementById("compas");
  const velocidadSelect = document.getElementById("velocidad");

  compasSelect.value = "";
  velocidadSelect.value = "";

  clave = claveSelect.value || "treble";
  compas = compasSelect.value || "";
  bpm = +velocidadSelect.value || 0;

  if (bpm) {
    tempoDisplay.textContent = tempoNames[bpm];
    tempoDisplay.style.display = "block";
  }

  window.addEventListener('resize', () => {
    width = Math.max(280, container.clientWidth);
    MAX_LINE_WIDTH = width - 40;
    renderer.resize(width, currentHeight);
    reflowLines();
    redibujarPentagrama();
  });

  claveSelect.onchange = e => { clave = e.target.value; resetPartitura(); };
  compasSelect.onchange = e => {
    compas = e.target.value;
    resetPartitura();
    document.getElementById("play-stop").disabled = !compas;
  };
  velocidadSelect.onchange = e => {
    bpm = +e.target.value;
    if (bpm) {
      tempoDisplay.textContent = tempoNames[bpm];
      tempoDisplay.style.display = "block";
    } else {
      tempoDisplay.style.display = "none";
    }
    if (Tone.Transport.state === "started") Tone.Transport.bpm.value = bpm;
    redibujarPentagrama();
  };

  initFiguras();
  initControles();
  resetPartitura();
}

function resetPartitura() {
  lines = [[]];
  currentLine = 0;
  if (compas) {
    lines[0].push({ notas: [], beats: 0, closed: false, staveWidth: FIRST_STAVE_WIDTH, ligaduras: [] });
  }
  figuraActiva = null;
  document.querySelectorAll(".figura").forEach(el => el.classList.remove("activa"));
  redibujarPentagrama();
}

function reflowLines() {
  let i = 0;
  while (i < lines.length) {
    let sum = lines[i].reduce((s, c) => s + (c.staveWidth || minStaveWidth), 0);
    if (sum > MAX_LINE_WIDTH && lines[i].length > 1) {
      const last = lines[i].pop();
      if (i + 1 < lines.length) lines[i + 1].unshift(last);
      else lines.push([last]);
    } else i++;
  }
  for (let li = lines.length - 1; li >= 0; li--) {
    if (lines[li].some(c => !c.closed)) {
      currentLine = li;
      break;
    }
  }
}

function calculateStaveWidth(c, li, ci) {
  const voice = new VF.Voice({ num_beats: +compas.split("/")[0], beat_value: 4 });
  voice.setStrict(false);
  if (c.notas.length) voice.addTickables(c.notas.map(n => n.vf));
  const formatter = new VF.Formatter();
  if (c.notas.length) formatter.joinVoices([voice]);
  let w = c.staveWidth || minStaveWidth;
  if (c.notas.length) {
    let noteWidth = c.notas.reduce((sum, n) => sum + (noteWidthFactors[n.duracion.replace('.', '')] || 50), 0);
    w = Math.max(w, formatter.preCalculateMinTotalWidth([voice]) + noteWidth + 50);
  }
  if (li === 0 && ci === 0) w = Math.max(w, FIRST_STAVE_WIDTH);
  return w;
}

function redibujarPentagrama() {
  if (!isPlaying) document.querySelectorAll(".nota, .note-label").forEach(el => el.remove());
  context.clear();
  let y = 40;

  lines = lines.filter(line => line.length > 0);
  if (lines.length === 0) {
    lines = [[{ notas: [], beats: 0, closed: false, staveWidth: FIRST_STAVE_WIDTH, ligaduras: [] }]];
    currentLine = 0;
  }

  if (compas) {
    lines.forEach((line, li) => {
      let x = 10;
      line.forEach((c, ci) => {
        if (c.notas.length === 0 && ci !== line.length - 1 && !c.closed) return;

        const voice = new VF.Voice({ num_beats: +compas.split("/")[0], beat_value: 4 });
        voice.setStrict(false);
        if (c.notas.length) voice.addTickables(c.notas.map(n => n.vf));
        const formatter = new VF.Formatter();
        if (c.notas.length) formatter.joinVoices([voice]);

        let staveWidth = calculateStaveWidth(c, li, ci);
        c.staveWidth = staveWidth;

        const stave = new VF.Stave(x, y, staveWidth);
        if (li === 0 && ci === 0) stave.addClef(clave).addTimeSignature(compas);
        else if (c.closed) stave.addModifier(new VF.Barline(VF.Barline.type.SINGLE));

        stave.setContext(context).draw();
        c.stave = stave;

        if (c.notas.length) {
          formatter.format([voice], staveWidth - 30);
          voice.draw(context, stave);
        }

        if (c.ligaduras && c.notas.length > 0) {
          c.ligaduras.forEach(lig => {
            try {
              const tie = new VF.Tie({ from: { line: lig.from, voice: 0 }, to: { line: lig.to, voice: 0 } });
              tie.setContext(context).draw();
            } catch (err) {
              console.warn("Error dibujando ligadura:", err);
            }
          });
        }

        x += staveWidth;
      });
      y += lineHeight;
    });
  }

  currentHeight = Math.max(240, y + 60);
  renderer.resize(width, currentHeight);
  container.style.height = `${currentHeight}px`;

  if (!isPlaying) updateDraggableNotes();

  const curr = lines[currentLine]?.[lines[currentLine].length - 1];
  document.getElementById("cerrar-compas").disabled = !curr || curr.closed || curr.beats !== +compas.split("/")[0];

  if (curr?.stave && !isPlaying) {
    setTimeout(() => {
      div.scrollTop = Math.max(0, curr.stave.getYForLine(0) - 60);
    }, 100);
  }
}

function initFiguras() {
  document.querySelectorAll(".figura").forEach(f => {
    f.addEventListener('click', () => {
      document.querySelectorAll(".figura").forEach(el => el.classList.remove("activa"));
      f.classList.add("activa");

      figuraActiva = {
        tipo: f.dataset.tipo,
        duracion: f.dataset.duracion || null
      };
    });
  });
}

function initControles() {
  document.getElementById("notas").onclick = () => {
    showNoteLabels = !showNoteLabels;
    document.getElementById("notas").classList.toggle("activa", showNoteLabels);
  };

  document.getElementById("metronomo").onclick = () => {
    metronomeOn = !metronomeOn;
    document.getElementById("metronomo").classList.toggle("activa", metronomeOn);
  };

  document.getElementById("play-stop").onclick = playStop;
  document.getElementById("cerrar-compas").onclick = cerrarCompas;
  document.getElementById("borrar-ultimo").onclick = borrarUltimo;

  document.getElementById("limpiar").onclick = () => {
    if (confirm("¿Limpiar toda la partitura? No se puede deshacer.")) resetPartitura();
  };

  document.getElementById("guardar").onclick = guardar;
  document.getElementById("abrir").onclick = () => document.getElementById("file-input").click();
  document.getElementById("file-input").onchange = abrir;

  document.getElementById("ligar").onclick = () => {
    modoLigar = !modoLigar;
    primeraNotaParaLigar = null;
    document.getElementById("ligar").classList.toggle("activa", modoLigar);
    if (modoLigar) {
      alert("Modo ligadura: clic en primera nota → clic en siguiente (misma altura, mismo compás)");
    } else {
      document.querySelectorAll(".nota").forEach(n => n.style.outline = "");
    }
  };
}

div.addEventListener('click', e => {
  if (isPlaying) return;
  initSynth();

  if (!compas) return alert("¡Selecciona un compás primero!");
  if (!figuraActiva) return;

  const rect = div.getBoundingClientRect();
  const clickX = e.clientX - rect.left + div.scrollLeft;
  const clickY = e.clientY - rect.top + div.scrollTop;

  const targetLineIdx = Math.floor((clickY - 40) / lineHeight);
  if (targetLineIdx < 0 || targetLineIdx >= lines.length) return;

  let targetLine = targetLineIdx;
  let targetCompasIdx = lines[targetLine].length - 1;
  let currentCompas = lines[targetLine][targetCompasIdx];

  if (currentCompas.closed) {
    const newCompas = { notas: [], beats: 0, closed: false, staveWidth: minStaveWidth, ligaduras: [] };
    const lineSum = lines[targetLine].reduce((sum, c) => sum + (c.staveWidth || minStaveWidth), 0) + minStaveWidth;
    if (lineSum > MAX_LINE_WIDTH) {
      lines.push([newCompas]);
      targetLine = lines.length - 1;
      targetCompasIdx = 0;
    } else {
      lines[targetLine].push(newCompas);
      targetCompasIdx = lines[targetLine].length - 1;
    }
    currentCompas = lines[targetLine][targetCompasIdx];
  }

  const noteName = getNoteFromY(clickY, targetLine);
  if (!noteName) return;

  currentLine = targetLine;

  if (figuraActiva.tipo === "puntillo") return;

  addNota(figuraActiva.tipo, figuraActiva.duracion, noteName, targetCompasIdx);
});

function getNoteFromY(y, lineIndex) {
  const lineY = lineIndex * lineHeight + 40;
  const relY = y - lineY;
  const noteHeight = 140;
  const numNotes = noteMap[clave].length;
  const step = noteHeight / (numNotes - 1);
  const normalizedY = Math.max(0, Math.min(noteHeight, noteHeight - relY));
  const idx = Math.round(normalizedY / step);
  return noteMap[clave][Math.max(0, Math.min(numNotes - 1, idx))];
}

function addNota(tipo, dur, noteName, compasIndex) {
  const beats = +compas.split("/")[0];
  const currentCompas = lines[currentLine][compasIndex];

  if (currentCompas.beats + duracionBeats[dur] > beats) {
    return alert("¡No hay espacio en el compás!");
  }

  let vf;
  if (tipo === "nota") {
    const list = noteMap[clave];
    const bIdx = clave === "treble" ? list.indexOf("b/4") : list.indexOf("b/2");
    const idx = list.indexOf(noteName);
    vf = new VF.StaveNote({
      clef: clave,
      keys: [noteName],
      duration: dur,
      stem_direction: idx >= bIdx ? VF.Stem.DOWN : VF.Stem.UP
    });
  } else {
    const rest = clave === "treble" ? "b/4" : "d/3";
    vf = new VF.StaveNote({ clef: clave, keys: [rest], duration: dur + "r" });
  }

  currentCompas.notas.push({ tipo, duracion: dur, noteName: tipo === "nota" ? noteName : null, vf });
  currentCompas.beats = +(currentCompas.beats + duracionBeats[dur]).toFixed(2);

  const tempVoice = new VF.Voice({ num_beats: +compas.split("/")[0], beat_value: 4 });
  tempVoice.setStrict(false);
  if (currentCompas.notas.length) tempVoice.addTickables(currentCompas.notas.map(n => n.vf));
  const formatter = new VF.Formatter();
  if (currentCompas.notas.length) formatter.joinVoices([tempVoice]);
  let noteWidth = currentCompas.notas.reduce((sum, n) => sum + (noteWidthFactors[n.duracion.replace('.', '')] || 50), 0);
  currentCompas.staveWidth = Math.max(minStaveWidth, formatter.preCalculateMinTotalWidth([tempVoice]) + noteWidth + 50);

  const lineSum = lines[currentLine].reduce((sum, c) => sum + (c.staveWidth || minStaveWidth), 0);
  if (lineSum > MAX_LINE_WIDTH && lines[currentLine].length > 1) {
    const lastCompas = lines[currentLine].pop();
    lines.push([lastCompas]);
    currentLine = lines.length - 1;
  }

  redibujarPentagrama();

  if (tipo === "nota") {
    initSynth();
    synth.triggerAttackRelease(
      noteName.split("/")[0].toUpperCase() + noteName.split("/")[1],
      duracionTiempo[dur]
    );
  }
}

function updateDraggableNotes() {
  document.querySelectorAll(".nota").forEach(n => n.remove());
  let gi = 0;

  lines.forEach((line, li) => {
    line.forEach((c, ci) => {
      c.notas.forEach((n, ni) => {
        if (n.tipo === "silencio") { gi++; return; }

        const g = context.svg.querySelectorAll('g.vf-stavenote')[gi];
        if (!g) return;
        const bbox = g.getBBox();

        const d = document.createElement("div");
        d.className = "nota";
        d.style.left = `${bbox.x}px`;
        d.style.top = `${bbox.y}px`;
        d.style.width = `${bbox.width}px`;
        d.style.height = `${bbox.height}px`;
        d.dataset.li = li;
        d.dataset.ci = ci;
        d.dataset.ni = ni;

        const plus = document.createElement("div");
        plus.textContent = "+";
        plus.className = "plus";
        const minus = document.createElement("div");
        minus.textContent = "−";
        minus.className = "minus";

        plus.onclick = e => { e.stopPropagation(); changePitch(d, 1); };
        minus.onclick = e => { e.stopPropagation(); changePitch(d, -1); };

        d.appendChild(plus);
        d.appendChild(minus);
        div.appendChild(d);

        d.onclick = e => {
          e.stopPropagation();
          const li_ = +d.dataset.li, ci_ = +d.dataset.ci, ni_ = +d.dataset.ni;
          const compas_ = lines[li_][ci_];
          const nota = compas_.notas[ni_];

          if (figuraActiva?.tipo === "puntillo") {
            if (nota.tipo === "silencio") return alert("No puntillo en silencios");
            const baseDur = nota.duracion.replace('.', '');
            if (!["q","8","h","w"].includes(baseDur)) {
              return alert("Solo puntillo en redonda, blanca, negra, corchea");
            }

            nota.duracion = nota.duracion.includes('.') ? baseDur : baseDur + '.';

            const list = noteMap[clave];
            const idx = list.indexOf(nota.noteName);
            const bIdx = clave === "treble" ? list.indexOf("b/4") : list.indexOf("b/2");

            nota.vf = new VF.StaveNote({
              clef: clave,
              keys: [nota.noteName],
              duration: nota.duracion,
              stem_direction: idx >= bIdx ? VF.Stem.DOWN : VF.Stem.UP
            });

            compas_.beats = 0;
            compas_.notas.forEach(n2 => {
              let base = duracionBeats[n2.duracion.replace('.', '')] || 0;
              compas_.beats += n2.duracion.includes('.') ? base * 1.5 : base;
            });

            redibujarPentagrama();
            return;
          }

          if (modoLigar) {
            if (nota.tipo === "silencio") return alert("No se liga silencio");
            if (!primeraNotaParaLigar) {
              primeraNotaParaLigar = { li: li_, ci: ci_, ni: ni_, noteName: nota.noteName };
              d.style.outline = "4px solid #ff4081";
            } else {
              document.querySelectorAll(".nota").forEach(n => n.style.outline = "");
              if (nota.noteName !== primeraNotaParaLigar.noteName) {
                alert("Deben ser misma nota");
                primeraNotaParaLigar = null;
                return;
              }
              if (li_ !== primeraNotaParaLigar.li || ci_ !== primeraNotaParaLigar.ci || ni_ !== primeraNotaParaLigar.ni + 1) {
                alert("Solo consecutivas en mismo compás");
                primeraNotaParaLigar = null;
                return;
              }

              compas_.ligaduras = compas_.ligaduras || [];
              compas_.ligaduras.push({ from: primeraNotaParaLigar.ni, to: ni_ });

              primeraNotaParaLigar = null;
              modoLigar = false;
              document.getElementById("ligar").classList.remove("activa");
              redibujarPentagrama();
            }
          }
        };

        gi++;
      });
    });
  });
}

// Funciones pendientes de completar según tu versión anterior

function changePitch(div, dir) {
  initSynth();
  const li = +div.dataset.li, ci = +div.dataset.ci, ni = +div.dataset.ni;
  const nota = lines[li][ci].notas[ni];
  const list = noteMap[clave];
  const idx = list.indexOf(nota.noteName) + dir;
  if (idx < 0 || idx >= list.length) return;
  nota.noteName = list[idx];
  const bIdx = clave === "treble" ? list.indexOf("b/4") : list.indexOf("b/2");
  nota.vf = new VF.StaveNote({
    clef: clave,
    keys: [nota.noteName],
    duration: nota.duracion,
    stem_direction: idx >= bIdx ? VF.Stem.DOWN : VF.Stem.UP
  });
  redibujarPentagrama();
  if (synth) {
    Tone.start().then(() => {
      synth.triggerAttackRelease(
        nota.noteName.split("/")[0].toUpperCase() + nota.noteName.split("/")[1],
        duracionTiempo[nota.duracion.replace('.', '')]
      );
    });
  }
}

// playStop, stopPlayback, cerrarCompas, borrarUltimo, guardar, abrir
// ... pon aquí tu implementación actual si difiere de la que tenías antes

function cerrarCompas() {
  const curr = lines[currentLine][lines[currentLine].length - 1];
  if (!curr || curr.closed || curr.beats !== +compas.split("/")[0]) return;
  curr.closed = true;
  const newCompas = { notas: [], beats: 0, closed: false, staveWidth: minStaveWidth, ligaduras: [] };
  const lineSum = lines[currentLine].reduce((sum, c) => sum + (c.staveWidth || minStaveWidth), 0) + minStaveWidth;
  if (lineSum > MAX_LINE_WIDTH) {
    lines.push([newCompas]);
    currentLine = lines.length - 1;
  } else {
    lines[currentLine].push(newCompas);
  }
  redibujarPentagrama();
}

// Iniciar
init();
