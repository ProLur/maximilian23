import assert from 'node:assert/strict';
import fs from 'node:fs';
const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const root=new URL('../',import.meta.url);
const source=fs.readFileSync(new URL('lives/js/voz-grabada.js',root),'utf8').replace(/'\.\/voz\.js[^']*'/,JSON.stringify(data(fs.readFileSync(new URL('lives/js/voz.js',root),'utf8'))));
let bloqueado=false;
globalThis.Audio=class{
 pause(){};
 play(){if(bloqueado){const e=Error('Activar audio');e.name='NotAllowedError';return Promise.reject(e);}this.onplaying?.();return Promise.resolve();}
};
const {VozGrabada}=await import(data(source));
let hablando=false,inicios=0;
const max={startTalking(){hablando=true;},stopTalking(){hablando=false;},setExpression(){}};
const voz=new VozGrabada(max);await voz.init();voz.activar();
const options={audio:'audio/cuentos/estrella-1.mp3',emocion:'alegria',onInicio(){inicios++;}};
let p=voz.decir('Hola',options);assert(hablando);assert.equal(inicios,1);voz.audio.onended();await p;assert(!hablando);
p=voz.decir('Detener',options);voz.detener();await p;assert(!hablando);assert(!voz.ocupado);
bloqueado=true;p=voz.decir('Reintentar',options);await new Promise(r=>setTimeout(r,0));assert(!voz.activa);assert.equal(voz.cola.length,1);
bloqueado=false;voz.activar();assert(hablando);voz.audio.onended();await p;assert(!hablando);
const manifest=JSON.parse(fs.readFileSync(new URL('lives/audio/cuentos/manifest.json',root),'utf8'));
assert.equal(Object.keys(manifest).length,30);
for(const item of Object.values(manifest)){const b=fs.readFileSync(new URL('lives/audio/cuentos/'+item.archivo,root));assert(b.length>1000);assert.equal(b.length,item.bytes);}
console.log('OK: reproducción, gestos al empezar, fin, cancelación, bloqueo y reactivación; 30 audios presentes.');

let comienzos=0;const audioPausa=new VozGrabada(max);await audioPausa.init();audioPausa.activar();const t=audioPausa.decir('Título',{audio:'audio/cuentos/estrella-titulo.mp3',onInicio(){comienzos++;}});audioPausa.audio.currentTime=1.25;audioPausa.pausar();assert(audioPausa.pausada);assert(!hablando);audioPausa.continuar();assert.equal(audioPausa.audio.currentTime,1.25);assert.equal(comienzos,1);assert(hablando);audioPausa.audio.onended();await t;
console.log('OK: pausa conserva el punto de audio y continuar no reinicia el gesto.');
