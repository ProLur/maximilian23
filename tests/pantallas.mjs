import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../lives/js/pantallas.js',import.meta.url),'utf8');
const {contarPantallas,exigirPantalla}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const now=Date.now();
assert.equal(contarPantallas(null,now),0);assert.equal(contarPantallas({a:{x:now-91000,y:'mal'}},now),0);assert.equal(contarPantallas({a:{x:now},b:{x:now-1000}},now),2);
let datos=null,conectado=true;const lecturas=[],escrituras=[];
const D={ref:(_,p)=>p,get:async p=>{lecturas.push(p);return{val:()=>p==='.info/connected'?conectado:datos};},push:()=>({key:'-1234567890123456789'}),serverTimestamp:()=>now,update:async(_,v)=>escrituras.push(v)};
const base='maximilian/sesiones/12345/canales/nonce';
await assert.rejects(exigirPantalla({db:{},D,base,ahora:()=>now}),/No hay ninguna pantalla/);
assert(lecturas.includes(base+'/presencia'));assert(!lecturas.includes('maximilian/presencia'));
datos={visor:{conexion:now}};await exigirPantalla({db:{},D,base,ahora:()=>now});
conectado=false;await assert.rejects(exigirPantalla({db:{},D,base,ahora:()=>now}),/Sin conexión/);conectado=true;
const admin=fs.readFileSync(new URL('../lives/js/admin.js',import.meta.url),'utf8');
const start=admin.indexOf('  async function enviar('),end=admin.indexOf("\n  form.addEventListener('submit'",start);
assert(start>0&&end>start);
const codigo=admin.slice(start,end);
const errores=[];const contexto={form:{texto:{value:'Conservar este mensaje'}},error:(_,t)=>errores.push(t),aviso:{hidden:true},usuario:{uid:'docente'},sesion:{expira:now+60000},base,desfase:0,D,db:{},exigirPantalla,console:{error(){}}};
const enviar=new Function('contexto','const {form,error,aviso,usuario,sesion,base,desfase,D,db,exigirPantalla,console}=contexto;'+codigo+'; return enviar;')(contexto);
for(const tipo of ['decir','cuento']){
 datos=null;assert.equal(await enviar({tipo,texto:'Hola',cuento:'estrella'}),false);assert.equal(escrituras.length,0);assert(!contexto.aviso.hidden);assert.match(errores.at(-1),/No hay ninguna pantalla/);
}
assert.equal(contexto.form.texto.value,'Conservar este mensaje');
datos={visor:{conexion:now}};assert.equal(await enviar({tipo:'decir',texto:'Hola'}),true);assert.equal(escrituras.length,1);
console.log('OK: sin visor o sin servidor no se escribe ninguna orden; error visible y texto conservado; con visor se permite enviar.');
