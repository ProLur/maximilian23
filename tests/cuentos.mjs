import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const {CUENTOS,Cuentacuentos}=await import(url(fs.readFileSync(new URL('lives/js/cuentos.js',root),'utf8')));
const {valido,CUENTO_IDS}=await import(url(fs.readFileSync(new URL('lives/js/protocolo.js',root),'utf8')));
assert.equal(CUENTOS.length,5);assert.deepEqual(CUENTOS.map(c=>c.id),CUENTO_IDS);
for(const cuento of CUENTOS){
 assert.equal(cuento.escenas.length,5);
 assert(cuento.escenas.every(e=>e.texto.length<220));
 const seen=[],gestos=[];let rest=0;
 const max={reposo:()=>rest++,mirarAlFrente(){},wave:()=>gestos.push('saludar'),wink:()=>gestos.push('guino'),attention:()=>gestos.push('atencion')};
 const voz={detener(){},decir:async(text,options)=>{options.onInicio();seen.push(text);}};
 let finish=false;
 const narrator=new Cuentacuentos({max,voz,onFin:()=>{finish=true;}});
 await narrator.contar(cuento.id);
 assert.deepEqual(seen,[cuento.titulo,...cuento.escenas.map(e=>e.texto)]);assert(finish);assert(rest>=2);assert(gestos.length>0);
 const now=Date.now();assert(valido({id:'-1234567890123456789',tipo:'cuento',cuento:cuento.id,creado:now,expira:now+20000},now));
}
let release;let scenes=[];let finished=false;
const max={reposo(){},mirarAlFrente(){},wave(){},wink(){},attention(){}};
const voice={detener(){release?.();},decir:()=>new Promise(resolve=>{release=resolve;})};
const narrator=new Cuentacuentos({max,voz:voice,onEscena:(c,e,i)=>scenes.push(i),onFin:()=>{finished=true;}});
const pending=narrator.contar('estrella');narrator.detener();await pending;
assert.deepEqual(scenes,[]);assert(!finished);assert(!narrator.visible);
const before=scenes.length;await narrator.contar('desconocido');assert.equal(scenes.length,before);
console.log('OK: cinco cuentos, 25 escenas, gestos coordinados, orden, fin y cancelacion sin escenas pendientes.');
const {Voz}=await import(url(fs.readFileSync(new URL('lives/js/voz.js',root),'utf8')));
globalThis.window={speechSynthesis:{cancel(){},speak(u){u.onstart?.();}}};
globalThis.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
const audio=new Voz({attention(){},setExpression(){},startTalking(){},stopTalking(){},wordPulse(){}});
audio.activa=true;
let began=false;
const speech=audio.decir('Una historia que se puede detener.',{sinAtencion:true,onInicio:()=>{began=true;}});
assert(began);audio.detener();
await Promise.race([speech,new Promise((_,reject)=>setTimeout(()=>reject(Error('La narracion no se cancelo')),100))]);
assert(!audio.ocupado);assert.equal(audio.vivas.size,0);
console.log('OK: detener resuelve tambien una voz cuyo navegador no emite el evento final.');

// Pause can hold the title-to-first-page boundary, and stopping releases that wait.
let liberar;const leidas=[];
const pvoz={detener(){liberar?.();},pausar(){},continuar(){},decir:(t)=>{leidas.push(t);return new Promise(r=>{liberar=r;});}};
const pausas=[];const n=new Cuentacuentos({max,voz:pvoz,onEscena:(c,e,i)=>pausas.push(i)});
const tarea=n.contar('estrella');assert.equal(leidas[0],CUENTOS[0].titulo);n.pausar();liberar();await new Promise(r=>setTimeout(r,0));assert.deepEqual(pausas,[]);assert(n.pausado);
n.continuar();await new Promise(r=>setTimeout(r,0));assert.deepEqual(pausas,[0]);n.pausar();n.detener();await tarea;assert(!n.enCurso);assert(!n.pausado);
console.log('OK: título antes del texto, pausa sin saltos y detención mientras está pausado.');
