import { Voz } from './voz.js?v=piper1';
// Audios locales de los cuentos, generados con Piper. No se llama a ninguna API.
export class VozGrabada {
  constructor(max,{onEstado=()=>{}}={}) {
    this.max=max;this.onEstado=onEstado;this.audio=new Audio();this.audio.preload='auto';
    this.fallback=new Voz(max,{silencio:true});this.cola=[];this.generacion=0;this.activa=false;this.ocupado=false;
  }
  get disponible(){return true;}
  async init(){await this.fallback.init();}
  activar(){this.activa=true;this.onEstado('activa');this.procesar();}
  decir(texto,opciones={}) {
    return new Promise(resolver=>{
      this.cola.push({texto,opciones,resolver});
      if(!this.activa)this.onEstado('esperando-activacion');
      this.procesar();
    });
  }
  detener(){
    this.generacion++;this.cancelar?.();this.audio.pause();
    for(const m of this.cola)m.resolver();this.cola=[];
    this.fallback.detener();this.max.stopTalking();this.max.setExpression('reposo');
  }
  async procesar(){
    if(this.ocupado||!this.activa||!this.cola.length)return;
    this.ocupado=true;const m=this.cola.shift(),gen=this.generacion;let bloqueada=false;
    try {
      await new Promise((resolve,reject)=>{
        let hecho=false,arrancado=false;
        const fin=err=>{if(hecho)return;hecho=true;clearTimeout(reloj);this.cancelar=null;this.audio.onplaying=this.audio.onended=this.audio.onerror=null;err?reject(err):resolve();};
        const reloj=setTimeout(()=>fin(Error('El audio no ha terminado.')),120000);
        this.cancelar=()=>fin();
        this.audio.onended=()=>fin();this.audio.onerror=()=>fin(Error('Audio no disponible.'));
        this.audio.onplaying=()=>{
          if(gen!==this.generacion||arrancado)return;arrancado=true;
          if(m.opciones.emocion)this.max.setExpression(m.opciones.emocion);
          this.max.startTalking();m.opciones.onInicio?.();
        };
        if(!/^audio[/]cuentos[/](estrella|tortuga|nube|zorro|semilla)-[1-5]\.mp3$/.test(m.opciones.audio||'')){fin(Error('Audio desconocido.'));return;}
        this.audio.src=m.opciones.audio;
        this.audio.play().catch(fin);
      });
    } catch(err) {
      if(gen===this.generacion){
        this.audio.pause();this.max.stopTalking();
        if(err.name==='NotAllowedError'){
          bloqueada=true;this.activa=false;this.cola.unshift(m);this.onEstado('bloqueada');
        } else {
          this.onEstado('sin-audio');await this.fallback.decir(m.texto,m.opciones);
        }
      }
    } finally {
      if(gen===this.generacion){this.max.stopTalking();this.max.setExpression('reposo');}
      if(!bloqueada)m.resolver();this.ocupado=false;this.procesar();
    }
  }
}
