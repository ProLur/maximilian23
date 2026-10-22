// Maximilian 23 - voz sintetizada (Web Speech API) y sincronizacion con la boca.
//
// - Prefiere una voz de Espana; si no hay ninguna, usa otra en espanol o la del sistema.
// - Los mensajes se encolan y se dicen uno detras de otro.
// - Cada mensaje se trocea en frases: la boca se cierra entre frases y se evita el corte
//   de Chrome en textos largos (~15 s).
// - Los navegadores no dejan hablar hasta que el usuario toca la pagina: activar() debe
//   llamarse desde un clic. Lo que llegue antes queda en cola.

const ESPERA_ATENCION = 0.6;      // s entre el gesto de atencion y el inicio del habla

const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

/** Puntua una voz: mayor = mejor. */
function puntuar(v) {
  const lang = (v.lang || '').toLowerCase().replace('_', '-');
  if (!lang.startsWith('es')) return -1;
  let p = lang === 'es-es' ? 100 : 50;
  if (/natural|online|neural/i.test(v.name)) p += 30;   // voces neuronales de Edge
  if (/google/i.test(v.name)) p += 20;
  if (v.localService) p += 5;                            // funcionan sin internet
  return p;
}

/** Divide el texto en frases de como mucho ~180 caracteres. */
export function trocear(texto) {
  const frases = texto.replace(/\s+/g, ' ').trim().match(/[^.!?;:\n]+[.!?;:]*/g) ?? [];
  const out = [];
  for (let f of frases.map((s) => s.trim()).filter(Boolean)) {
    while (f.length > 180) {
      let cut = f.lastIndexOf(',', 180);
      if (cut < 60) cut = f.lastIndexOf(' ', 180);
      if (cut < 60) cut = 180;
      out.push(f.slice(0, cut + 1).trim());
      f = f.slice(cut + 1).trim();
    }
    if (f) out.push(f);
  }
  return out;
}

function duracionEstimada(frase, velocidad) {
  const palabras = frase.split(/\s+/).filter(Boolean).length;
  return (0.38 * palabras + 0.3) / velocidad;
}

/** En silencio el texto se lee en subtitulos: se deja algo mas de tiempo. */
function duracionLectura(frase, velocidad) {
  return Math.max(duracionEstimada(frase, velocidad), (0.06 * frase.length + 0.6) / velocidad);
}

export class Voz {
  /**
   * @param {import('./maximilian.js').Maximilian} max
   * @param {{onTexto?: (t: string|null) => void, onEstado?: (e: string) => void}} cb
   */
  constructor(max, { onTexto = () => {}, onEstado = () => {}, silencio = false } = {}) {
    this.max = max;
    this.onTexto = onTexto;
    this.onEstado = onEstado;
    this.config = { velocidad: 1, tono: 1.1, volumen: 1, voz: null };
    // En silencio no se usa la sintesis: boca y subtitulos solamente (no hace falta activar)
    this.silencio = silencio;
    this.sintesis = !silencio && 'speechSynthesis' in window ? window.speechSynthesis : null;
    this.voces = [];
    this.voz = null;
    this.activa = silencio;
    this.cola = [];
    this.ocupado = false;
    this.generacion = 0;           // cambia al detener: invalida lo que estuviera en curso
    this.vivas = new Set();        // Chrome pierde los eventos si la utterance se recolecta
  }

  get disponible() {
    return Boolean(this.sintesis);
  }

  async init() {
    if (!this.sintesis) {
      this.onEstado(this.silencio ? 'silencio' : 'sin-voz');
      return;
    }
    this.voces = this.sintesis.getVoices();
    if (!this.voces.length) {
      // las voces se cargan de forma asincrona; algunos navegadores nunca avisan
      await new Promise((resolve) => {
        const t = setTimeout(resolve, 2500);
        this.sintesis.addEventListener('voiceschanged', () => { clearTimeout(t); resolve(); }, { once: true });
      });
      this.voces = this.sintesis.getVoices();
    }
    this.sintesis.addEventListener?.('voiceschanged', () => {
      this.voces = this.sintesis.getVoices();
      this.elegirVoz();
    });
    this.elegirVoz();
  }

  /** Elige la voz configurada por nombre o, si no, la mejor en espanol. */
  elegirVoz() {
    const porNombre = this.config.voz && this.voces.find((v) => v.name === this.config.voz);
    const ordenadas = this.voces.filter((v) => puntuar(v) >= 0).sort((a, b) => puntuar(b) - puntuar(a));
    this.voz = porNombre || ordenadas[0] || null;
    this.onEstado(this.voz ? 'voz-lista' : 'sin-voz-espanola');
    return this.voz;
  }

  vocesEspanol() {
    return this.voces.filter((v) => puntuar(v) >= 0).sort((a, b) => puntuar(b) - puntuar(a));
  }

  configurar({ velocidad, tono, volumen, voz } = {}) {
    if (velocidad != null) this.config.velocidad = Math.min(Math.max(+velocidad, 0.5), 2);
    if (tono != null) this.config.tono = Math.min(Math.max(+tono, 0), 2);
    if (volumen != null) this.config.volumen = Math.min(Math.max(+volumen, 0), 1);
    if (voz !== undefined) {
      this.config.voz = voz;
      this.elegirVoz();
    }
  }

  /** Debe llamarse desde un clic o toque: desbloquea el audio del navegador. */
  activar(saludo = '¡Hola! Soy Maximilian 23. ¿En qué puedo ayudarte?') {
    if (this.silencio) return;
    this.activa = true;
    this.onEstado('activa');
    if (this.sintesis) {
      // una utterance vacia dentro del clic basta para desbloquear la sintesis
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      this.sintesis.speak(u);
    }
    if (saludo) this.cola.unshift({ texto: saludo, opciones: { emocion: 'alegria', sinAtencion: true }, resolver: () => {} });
    this.procesar();
  }

  /**
   * Encola un mensaje. Devuelve una promesa que se resuelve al terminar de decirlo.
   * opciones: { emocion, velocidad, tono }
   */
  decir(texto, opciones = {}) {
    texto = String(texto ?? '').trim();
    if (!texto) return Promise.resolve();
    return new Promise((resolver) => {
      this.cola.push({ texto, opciones, resolver });
      if (!this.activa) this.onEstado('esperando-activacion');
      this.procesar();
    });
  }

  /** Calla de inmediato y vacia la cola. */
  detener() {
    this.generacion += 1;
    for (const m of this.cola) m.resolver();
    this.cola = [];
    this.sintesis?.cancel();
    this.max.stopTalking();
    this.max.setExpression('reposo');
    this.onTexto(null);
  }

  async procesar() {
    if (this.ocupado || !this.activa || !this.cola.length) return;
    this.ocupado = true;
    const msg = this.cola.shift();
    const gen = this.generacion;
    const { emocion, sinAtencion } = msg.opciones;
    const velocidad = msg.opciones.velocidad ?? this.config.velocidad;
    const tono = msg.opciones.tono ?? this.config.tono;
    try {
      if (!sinAtencion) {
        this.max.attention();
        await wait(ESPERA_ATENCION);
      }
      if (emocion && gen === this.generacion) this.max.setExpression(emocion);
      this.onTexto(msg.texto);
      for (const frase of trocear(msg.texto)) {
        if (gen !== this.generacion) break;
        await this.hablarFrase(frase, velocidad, tono, gen);
      }
      if (gen === this.generacion) {
        await wait(emocion ? 1.2 : 0.4);    // mantiene un momento la emocion al acabar
        if (gen === this.generacion) this.max.setExpression('reposo');
      }
    } catch (err) {
      console.error('Error al hablar:', err);
    } finally {
      if (gen === this.generacion) this.onTexto(null);
      this.ocupado = false;
      msg.resolver();
      this.procesar();
    }
  }

  hablarFrase(frase, velocidad, tono, gen) {
    this.max.talkRate = velocidad;
    const estimada = duracionEstimada(frase, velocidad);

    // Sin sintesis: Maximilian mueve la boca en silencio el tiempo estimado (con subtitulos)
    if (!this.sintesis) {
      this.max.startTalking();
      const fin = this.silencio ? duracionLectura(frase, velocidad) : estimada;
      return new Promise((resolve) => {
        const paso = () => {
          // comprueba cada poco si se ha pulsado Detener
          if (gen !== this.generacion || performance.now() >= limite) {
            this.max.stopTalking();
            resolve();
          } else setTimeout(paso, 100);
        };
        const limite = performance.now() + fin * 1000;
        paso();
      });
    }

    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(frase);
      u.lang = this.voz?.lang ?? 'es-ES';
      if (this.voz) u.voice = this.voz;
      u.rate = velocidad;
      u.pitch = tono;
      u.volume = this.config.volumen;

      let hecho = false;
      let arrancado = false;
      const fin = () => {
        if (hecho) return;
        hecho = true;
        clearTimeout(vigilante);
        clearTimeout(sinInicio);
        this.vivas.delete(u);
        this.max.stopTalking();
        resolve();
      };
      u.onstart = () => {
        arrancado = true;
        if (gen === this.generacion) this.max.startTalking();
      };
      u.onboundary = (e) => {
        if (e.name === 'word' || !e.name) this.max.wordPulse();
      };
      u.onend = fin;
      u.onerror = (e) => {
        if (e.error === 'not-allowed') {
          // el navegador ha bloqueado el audio: hay que volver a activar con un toque
          this.activa = false;
          this.onEstado('bloqueada');
        } else if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.warn('Sintesis de voz:', e.error);
          this.onEstado('error');
        }
        fin();
      };

      this.vivas.add(u);
      this.sintesis.speak(u);
      // Si el motor no arranca (sin voces, servicio caido), la boca se mueve igualmente
      const sinInicio = setTimeout(() => {
        if (!arrancado && !hecho && gen === this.generacion) {
          this.onEstado('sin-audio');
          this.max.startTalking();
          setTimeout(fin, estimada * 1000);
        }
      }, 1500);
      // Chrome a veces no emite 'end': se continua igualmente
      const vigilante = setTimeout(fin, (estimada * 2 + 4) * 1000);
    });
  }
}
