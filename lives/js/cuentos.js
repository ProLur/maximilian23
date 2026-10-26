// Cuentos originales, breves y pensados para leer en voz alta en el aula.
export const CUENTOS = [
  { id: 'estrella', titulo: 'La estrella que bajó al patio', icono: '⭐', tema: 'Amistad', color: '#ffd77b', escenas: [
    { texto: 'Una noche, una estrella pequeñita cayó en el patio del colegio. Brillaba tan poco que nadie podía verla.', emocion: 'tristeza' },
    { texto: 'Maximilian la encontró junto al columpio. «¡Hola! ¿Te has perdido?», preguntó, ofreciéndole su mano.', emocion: 'sorpresa', gesto: 'saludar' },
    { texto: '«No sé volver al cielo», dijo la estrella. Maximilian reunió a sus amigos y juntos construyeron una escalera de papel.', emocion: 'serio' },
    { texto: 'La escalera no llegaba tan alto. Pero cada abrazo y cada palabra amable hacían brillar más a la pequeña estrella.', emocion: 'alegria' },
    { texto: 'Al verla brillar, la Luna bajó a buscarla. Desde entonces, una estrella saluda al patio cada noche. ¡La amistad da luz!', emocion: 'alegria', gesto: 'guino' },
  ]},
  { id: 'tortuga', titulo: 'Tina y el camino de las flores', icono: '🐢', tema: 'Cada cual a su ritmo', color: '#a8e6b0', escenas: [
    { texto: 'Tina, la tortuga, quería llegar a la fiesta del bosque. «Voy muy despacio», suspiró al ver correr a los demás.', emocion: 'tristeza' },
    { texto: 'Maximilian caminó a su lado. «Podemos ir juntos. ¿Has visto esa flor azul?». Tina levantó la cabeza, sorprendida.', emocion: 'sorpresa', gesto: 'atencion' },
    { texto: 'En el camino encontraron una semilla seca. Tina la regó con una gotita de agua que llevaba en su cantimplora.', emocion: 'serio' },
    { texto: 'Después ayudaron a una hormiga a cruzar un charco. Cuando llegaron a la fiesta, todos los estaban esperando.', emocion: 'alegria' },
    { texto: '«¡Traéis las mejores historias!», dijeron sus amigos. Tina sonrió. Ir despacio también permite descubrir cosas maravillosas.', emocion: 'alegria', gesto: 'saludar' },
  ]},
  { id: 'nube', titulo: 'La nube que guardaba la lluvia', icono: '🌦️', tema: 'Compartir', color: '#a9d7ff', escenas: [
    { texto: 'Nuba era una nube pequeña que guardaba todas sus gotas. «Son mi tesoro», decía mientras flotaba sobre el campo.', emocion: 'alegria' },
    { texto: 'Un día vio una margarita con la cabeza agachada. «Tengo mucha sed», susurró la flor. Nuba se quedó pensando.', emocion: 'tristeza' },
    { texto: 'Maximilian miró hacia el cielo. «A veces, compartir un poquito hace crecer algo muy grande», le dijo con cariño.', emocion: 'serio', gesto: 'atencion' },
    { texto: 'Nuba dejó caer una gota. Luego otra. La margarita levantó la cabeza y, alrededor, aparecieron brotes verdes.', emocion: 'sorpresa' },
    { texto: 'Al salir el sol, nació un arcoíris. Nuba descubrió un tesoro nuevo: la alegría de compartir. Y dejó caer otra gotita.', emocion: 'alegria', gesto: 'guino' },
  ]},
  { id: 'zorro', titulo: 'Leo y la sombra del bosque', icono: '🦊', tema: 'Pedir ayuda', color: '#ffb18f', escenas: [
    { texto: 'Leo, un zorrito curioso, escuchó un ruido al volver a casa. Entre los árboles había una sombra enorme. ¡Qué susto!', emocion: 'sorpresa' },
    { texto: 'Leo se escondió detrás de una piedra. «¿Y si es un monstruo?». Sus orejas temblaban y no se atrevía a avanzar.', emocion: 'tristeza' },
    { texto: 'Maximilian lo encontró. «Puedes contarme lo que te asusta. Miraremos juntos, desde aquí», le dijo en voz tranquila.', emocion: 'serio', gesto: 'atencion' },
    { texto: 'Encendieron una linterna. La sombra era una rama y el ruido lo hacía un erizo que recogía hojas para su cama.', emocion: 'sorpresa' },
    { texto: 'Los tres volvieron juntos al camino. Leo aprendió que ser valiente también es pedir ayuda. Y aquella noche durmió feliz.', emocion: 'alegria', gesto: 'saludar' },
  ]},
  { id: 'semilla', titulo: 'Maximilian y la semilla dormilona', icono: '🌱', tema: 'Paciencia y cuidado', color: '#d0b8ff', escenas: [
    { texto: 'Maximilian plantó una semilla en una maceta amarilla. Le dio agua, la puso al sol y esperó. Pero no pasaba nada.', emocion: 'sorpresa' },
    { texto: '«¿Estarás dormida?», preguntó. Cada mañana se acercaba despacito para darle los buenos días a su pequeña semilla.', emocion: 'alegria', gesto: 'saludar' },
    { texto: 'Al tercer día se puso un poco triste. Una niña le explicó: «Por dentro ya está creciendo. Algunas cosas necesitan tiempo».', emocion: 'tristeza' },
    { texto: 'Maximilian siguió cuidándola, sin darle demasiada agua. Una mañana, una puntita verde apareció entre la tierra.', emocion: 'sorpresa', gesto: 'atencion' },
    { texto: '«¡Buenos días, pequeña!». Maximilian sonrió. Con paciencia y cariño, la semilla había despertado. ¡Ahora les tocaba crecer juntos!', emocion: 'alegria', gesto: 'guino' },
  ]},
];

export class Cuentacuentos {
  constructor({max, voz, onEscena = () => {}, onFin = () => {}, onSalir = () => {}}) {
    Object.assign(this,{max,voz,onEscena,onFin,onSalir});
    this.generacion=0; this.visible=false;
  }
  detener() {
    this.generacion++;
    this.voz.detener();
    this.max.reposo();
    this.max.mirarAlFrente(false);
    this.visible=false;
    this.onSalir();
  }
  async contar(id) {
    const cuento=CUENTOS.find(c=>c.id===id);
    if(!cuento) return;
    this.detener();
    const gen=++this.generacion;
    this.visible=true;
    this.max.mirarAlFrente(true);
    for(let i=0;i<cuento.escenas.length;i++) {
      if(gen!==this.generacion) return;
      const escena=cuento.escenas[i];
      this.onEscena(cuento,escena,i);
      await this.voz.decir(escena.texto,{
        audio:'audio/cuentos/'+cuento.id+'-'+(i+1)+'.mp3',
        emocion:escena.emocion,velocidad:0.88,tono:escena.emocion==='tristeza'?0.95:1.12,sinAtencion:true,
        onInicio:()=>{
          if(gen!==this.generacion) return;
          if(escena.gesto==='saludar')this.max.wave();
          else if(escena.gesto==='guino')this.max.wink();
          else if(escena.gesto==='atencion')this.max.attention();
        },
      });
    }
    if(gen!==this.generacion) return;
    this.max.reposo();
    this.onFin(cuento);
  }
}
