import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const dataURL = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const protocol = fs.readFileSync(path.join(root,'lives/js/protocolo.js'),'utf8');
const {valido} = await import(dataURL(protocol));
const now = Date.now();
const msg = {id:'-1234567890123456789',tipo:'decir',texto:'Hola',velocidad:1,tono:1,creado:now,expira:now+20000};
assert(valido(msg,now));
for (const bad of [{...msg,expira:now-1},{...msg,creado:now+5000},{...msg,texto:' '},{...msg,texto:'a'.repeat(1001)},{...msg,velocidad:Infinity},{...msg,tono:-1},{...msg,emocion:'inventada'},{...msg,tipo:'script'},{...msg,tipo:'gesto',gesto:'inventado'}]) assert(!valido(bad,now));
const listeners = new Map();
const writes = [];
const removed = [];
globalThis.window = {addEventListener(){},removeEventListener(){}};
globalThis.__fb = {
 db:{},auth:{},A:{inMemoryPersistence:'memory',setPersistence:async()=>{},signInAnonymously:async()=>({user:{uid:'visor-test'}})},
 D:{get:async()=>({val:()=>({nonce:'a'.repeat(32),expira:Date.now()+60000})}),ref:(_,p)=>p,push:p=>p+'/conexion-test',onValue:(p,cb)=>{listeners.set(p,cb);return()=>listeners.delete(p);},onDisconnect:()=>({remove:async()=>{}}),set:async(p,v)=>writes.push([p,v]),remove:async p=>removed.push(p),serverTimestamp:()=>now}
};
let source=fs.readFileSync(path.join(root,'lives/js/remoto.js'),'utf8')
 .replace("import { cargarFirebase, desfaseServidor } from './firebase.js';", "const cargarFirebase = async () => globalThis.__fb; const desfaseServidor = async () => 0; const RUTA='maximilian';")
 .replace("import { rutaSesion } from './sesiones.js?v=sesiones1';", "const rutaSesion = codigo => 'maximilian/sesiones/'+codigo;")
 .replace(/'\.\/protocolo\.js(?:\?[^']*)?'/, JSON.stringify(dataURL(protocol)));
const {conectarRemoto}=await import(dataURL(source));
const received=[];const states=[];
const connection=await conectarRemoto({codigo:'58458',onMensaje:m=>received.push(m),onEstado:s=>states.push(s)});
const send=v=>listeners.get('maximilian/sesiones/58458/canales/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/comando')({val:()=>v});
const fresh={...msg,creado:Date.now()+1,expira:Date.now()+20000};
send({...fresh,creado:now-60000}); send({...fresh,expira:now-1}); send(null);
send(fresh);send(fresh);
assert.equal(received.length,1,'Solo se ejecuta una vez el comando nuevo');
await listeners.get('.info/connected')({val:()=>true});
assert.equal(states.at(-1),'conectado');assert.equal(writes.length,2);
await listeners.get('.info/connected')({val:()=>false});
assert.equal(states.at(-1),'desconectado');
await listeners.get('.info/connected')({val:()=>true});
assert.equal(writes.length,3);
connection.cerrar();assert.equal(listeners.size,0);assert.equal(removed.length,1);
// Five independent receiver instances: a command on one path never reaches another.
const connections=[];const counts=[0,0,0,0,0];
for(let i=0;i<5;i++)connections.push(await conectarRemoto({codigo:String(11000+i),onMensaje:()=>counts[i]++}));
for(let i=0;i<5;i++){
  const cb=listeners.get('maximilian/sesiones/'+(11000+i)+'/canales/'+'a'.repeat(32)+'/comando');
  cb({val:()=>({...fresh,id:'orden'+i,creado:Date.now()+1,expira:Date.now()+20000})});
  assert.equal(counts[i],1);assert.equal(counts.reduce((a,b)=>a+b,0),i+1);
}
connections.forEach(c=>c.cerrar());
console.log('OK: cinco receptores aislados; validacion, caducidad, duplicados, arranque, presencia, reconexion y cierre. Firebase simulado; no verifica reglas en servidor.');
