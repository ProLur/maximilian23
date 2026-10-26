import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../lives/js/sesiones.js',import.meta.url),'utf8')).replace("import { RUTA } from './firebase.js';","const RUTA='maximilian';");
const {crearSesion,codigoValido,rutaSesion}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert(!codigoValido('1234'));assert(!codigoValido('../x'));assert(codigoValido('58458'));assert.throws(()=>rutaSesion('x'));
let attempts=0;
const fb={db:{},D:{ref:(_,p)=>p,runTransaction:async(p,fn)=>{
 attempts++;if(attempts===1){assert.equal(fn({expira:Date.now()+60000}),undefined);return {committed:false};}
 const data=fn(null);assert.equal(data.propietario,'docente');assert.equal(data.nonce.length,32);return {committed:true};
}}};
const sesion=await crearSesion(fb,'docente');assert.equal(attempts,2);assert(codigoValido(sesion.codigo));
const main=await readFile(new URL('../lives/js/main.js',import.meta.url),'utf8');
const html=await readFile(new URL('../lives/index.html',import.meta.url),'utf8');
assert(!html.includes('id="gestos"'));assert(!html.includes('id="prueba-voz"'));assert(!main.includes('const KEYS'));assert(html.includes('id="vincular"'));
console.log('OK: códigos, reintento de colisión, sesión temporal y visor sin controles públicos.');
