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
globalThis.window = {addEventListener(){}};
globalThis.__fb = {
 db:{},auth:{},A:{inMemoryPersistence:'memory',setPersistence:async()=>{},signInAnonymously:async()=>({user:{uid:'visor-test'}})},
 D:{ref:(_,p)=>p,push:p=>p+'/conexion-test',onValue:(p,cb)=>{listeners.set(p,cb);return()=>listeners.delete(p);},onDisconnect:()=>({remove:async()=>{}}),set:async(p,v)=>writes.push([p,v]),remove:async p=>removed.push(p),serverTimestamp:()=>now}
};
let source=fs.readFileSync(path.join(root,'lives/js/remoto.js'),'utf8')
 .replace("import { cargarFirebase, desfaseServidor, RUTA } from './firebase.js';", "const cargarFirebase = async () => globalThis.__fb; const desfaseServidor = async () => 0; const RUTA='maximilian';")
 .replace("'./protocolo.js'", JSON.stringify(dataURL(protocol)));
const {conectarRemoto}=await import(dataURL(source));
const received=[];const states=[];
const connection=await conectarRemoto({onMensaje:m=>received.push(m),onEstado:s=>states.push(s)});
const send=v=>listeners.get('maximilian/comando')({val:()=>v});
const fresh={...msg,creado:Date.now()+1,expira:Date.now()+20000};
send({...fresh,creado:now-60000}); send({...fresh,expira:now-1}); send(null);
send(fresh);send(fresh);
assert.equal(received.length,1,'Solo se ejecuta una vez el comando nuevo');
await listeners.get('.info/connected')({val:()=>true});
assert.equal(states.at(-1),'conectado');assert.equal(writes.length,1);
await listeners.get('.info/connected')({val:()=>false});
assert.equal(states.at(-1),'desconectado');
await listeners.get('.info/connected')({val:()=>true});
assert.equal(writes.length,2);
connection.cerrar();assert.equal(listeners.size,0);assert.equal(removed.length,1);
console.log('OK: validacion, caducidad, duplicados, arranque, presencia, reconexion y cierre. Firebase simulado; no verifica reglas en servidor.');
