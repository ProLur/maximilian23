window.addEventListener("load", () => {
  const VF = Vex.Flow;

  // Función para crear pentagrama visible
  function crearPentagrama(id) {
    const div = document.getElementById(id);
    const renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);

    const width = window.innerWidth * 0.9; // más fiable que clientWidth
    const height = 160;

    renderer.resize(width, height);
    const context = renderer.getContext();
    context.setStrokeStyle("#00ff99"); // líneas verde brillante
    context.setFillStyle("#e6edf3");
    context.setLineWidth(2);

    const stave = new VF.Stave(10, 40, width - 20);
    stave.addClef("treble").setContext(context).draw();

    // Dibujamos una línea de prueba (debug visual)
    context.beginPath();
    context.moveTo(20, height - 20);
    context.lineTo(width - 20, height - 20);
    context.stroke();

    return { renderer, context, stave, notes: [] };
  }

  const p1 = crearPentagrama("pentagrama1");
  const p2 = crearPentagrama("pentagrama2");

  // Reproducción de sonido
  function playNote(noteName) {
    const synth = new Tone.Synth().toDestination();
    synth.triggerAttackRelease(noteName, "8n");
  }

  // Añadir nota al pentagrama
  function addNote(pentagrama, noteName, duracion) {
    const note = new VF.StaveNote({
      clef: "treble",
      keys: [noteName.toLowerCase()],
      duration: duracion
    });

    pentagrama.notes.push(note);

    pentagrama.context.clear();
    pentagrama.context.setStrokeStyle("#00ff99");
    pentagrama.context.setFillStyle("#e6edf3");
    pentagrama.context.setLineWidth(2);

    pentagrama.stave.setContext(pentagrama.context).draw();

    const voice = new VF.Voice({ num_beats: 4, beat_value: 4 });
    voice.addTickables(pentagrama.notes);
    new VF.Formatter().joinVoices([voice]).format([voice], pentagrama.stave.width - 60);
    voice.draw(pentagrama.context, pentagrama.stave);
  }

  // --- Drag & Drop ---
  let draggedNote = null;

  document.querySelectorAll(".figura").forEach(figura => {
    figura.addEventListener("dragstart", () => {
      draggedNote = {
        note: figura.dataset.note,
        duracion: figura.dataset.duracion
      };
    });
  });

  document.querySelectorAll(".pentagrama").forEach(p => {
    p.addEventListener("dragover", e => e.preventDefault());
    p.addEventListener("drop", e => {
      e.preventDefault();
      const noteName = draggedNote.note;
      const duracion = draggedNote.duracion;
      const target = p.id === "pentagrama1" ? p1 : p2;

      addNote(target, noteName.replace(/\d/, "/4"), duracion);
      playNote(noteName);
    });
  });
});
