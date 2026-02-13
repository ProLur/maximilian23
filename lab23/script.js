const VF = Vex.Flow;

const pentagramaDiv = document.getElementById("pentagrama");
const renderer = new VF.Renderer(pentagramaDiv, VF.Renderer.Backends.SVG);
const container = document.getElementById("pentagrama-container");
const tempoDisplay = document.getElementById("tempo-display");

let MAX_LINE_WIDTH = Math.max(280, container.clientWidth - 40);
const FIRST_STAVE_WIDTH = 350;
const minStaveWidth = 100;
const lineHeight = 120;

let width = Math.max(280, container.clientWidth);
let currentHeight = 300;
renderer.resize(width, currentHeight);
const context = renderer.getContext();

let clave = "treble";
let compas = "";
let bpm = 0;
let lines = [];
let currentLine = 0;
let figuraActiva = null;
let isPlaying = false;
let synth = null;

const duracionBeats = { w: 4, h: 2, q: 1, '8': 0.5 };
const duracionTiempo = { w: "1n", h: "2n", q: "4n", '8': "8n" };
const tempoNames = {
  80: "Andante (80 BPM)",
  90: "Moderado (90 BPM)",
  120: "Allegro (120 BPM)",
  160: "Presto (160 BPM)"
};

const noteMap = {
  treble: ["c/4", "d/4", "e/4", "f/4", "g/4", "a/4", "b/4", "c/5", "d/5", "e/5"],
  bass: ["c/2", "d/2", "e/2", "f/2", "g/2", "a/2", "b/2", "c/3", "d/3", "e/3"]
};

function initSynth() {
  if (!synth) synth = new Tone.Synth().toDestination();
}

function init() {
  const claveSelect = document.getElementById("clave");
  const compasSelect = document.getElementById("compas");
  const velocidadSelect = document.getElementById("velocidad");

  claveSelect.onchange = () => {
    clave = claveSelect.value;
    resetPartitura();
  };

  compasSelect.onchange = () => {
    compas = compasSelect.value;
    resetPartitura();
    document.getElementById("play-stop").disabled = !compas;
  };

  velocidadSelect.onchange = () => {
    bpm = +velocidadSelect.value || 0;
    tempoDisplay.textContent = bpm ? tempoNames[bpm] : "";
    tempoDisplay.style.display = bpm ? "block" : "none";
    redibujar();
  };

  document.querySelectorAll(".figura").forEach(fig => {
    fig.onclick = () => {
      document.querySelectorAll(".figura").forEach(f => f.classList.remove("activa"));
      fig.classList.add("activa");
      figuraActiva = {
        tipo: fig.dataset.tipo,
        duracion: fig.dataset.duracion || null
      };
    };
  });

  resetPartitura();
}

function resetPartitura() {
  lines = [];
  currentLine = 0;
  figuraActiva = null;
  document.querySelectorAll(".figura").forEach(f => f.classList.remove("activa"));

  if (compas) {
    lines.push([{ notas: [], beats: 0, closed: false, staveWidth: FIRST_STAVE_WIDTH }]);
  }

  redibujar();
}

function redibujar() {
  context.clear();
  let y = 40;

  lines.forEach((line, li) => {
    let x = 10;
    line.forEach((compasData, ci) => {
      const stave = new VF.Stave(x, y, compasData.staveWidth || 300);
      if (li === 0 && ci === 0 && compas) {
        stave.addClef(clave).addTimeSignature(compas);
      }
      stave.setContext(context).draw();

      if (compasData.notas && compasData.notas.length > 0) {
        const voice = new VF.Voice({ num_beats: 4, beat_value: 4 });
        voice.addTickables(compasData.notas.map(n => n.vf));
        new VF.Formatter().joinVoices([voice]).format([voice], stave.getWidth() - 50);
        voice.draw(context, stave);
      }

      x += stave.getWidth();
    });
    y += lineHeight;
  });

  renderer.resize(width, Math.max(300, y + 60));
  container.style.height = `${Math.max(300, y + 60)}px`;
}

pentagramaDiv.addEventListener("click", e => {
  if (!figuraActiva || !compas) return;

  const rect = pentagramaDiv.getBoundingClientRect();
  const clickX = e.clientX - rect.left + pentagramaDiv.scrollLeft;
  const clickY = e.clientY - rect.top + pentagramaDiv.scrollTop;

  const lineIdx = Math.floor((clickY - 40) / lineHeight);
  if (lineIdx < 0 || lineIdx >= lines.length) return;

  const compasIdx = lines[lineIdx].length - 1;
  const currentCompas = lines[lineIdx][compasIdx];

  // Posición aproximada de la nota (simplificado)
  const noteIdx = Math.round((clickY - (lineIdx * lineHeight + 80)) / 12);
  const noteName = noteMap[clave][Math.max(0, Math.min(noteMap[clave].length - 1, noteIdx))];

  let vfNote;
  if (figuraActiva.tipo === "nota") {
    vfNote = new VF.StaveNote({
      clef: clave,
      keys: [noteName],
      duration: figuraActiva.duracion
    });
  } else if (figuraActiva.tipo === "silencio") {
    vfNote = new VF.StaveNote({
      clef: clave,
      keys: ["b/4"],
      duration: figuraActiva.duracion + "r"
    });
  }

  if (vfNote) {
    currentCompas.notas = currentCompas.notas || [];
    currentCompas.notas.push({ vf: vfNote });
    redibujar();

    if (figuraActiva.tipo === "nota") {
      initSynth();
      synth.triggerAttackRelease(noteName.replace("/", ""), figuraActiva.duracion);
    }
  }
});

init();
