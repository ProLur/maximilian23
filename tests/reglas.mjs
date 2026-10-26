import * as database from 'firebase/database';
import { exigirPantalla } from '../lives/js/pantallas.js';
// Solo emulador demo. Nunca usa datos de producción.
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {ref,get,set,update,remove,push,serverTimestamp,runTransaction} from 'firebase/database';
import {readFile} from 'node:fs/promises';
if(!process.env.FIREBASE_DATABASE_EMULATOR_HOST)throw Error('Solo emulador local.');
const [host,port]=process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
if(!['127.0.0.1','localhost','::1'].includes(host))throw Error('Solo emulador local.');
const env=await initializeTestEnvironment({projectId:'demo-maximilian-seguridad',database:{host,port:Number(port),rules:await readFile(new URL('../firebase/database.rules.json',import.meta.url),'utf8')}});
try {
  await env.clearDatabase();
  const admin=env.authenticatedContext('docente').database(),otroAdmin=env.authenticatedContext('docente2').database();
  const intruso=env.authenticatedContext('otro').database(),publico=env.unauthenticatedContext().database();
  const visor=env.authenticatedContext('visor',{firebase:{sign_in_provider:'anonymous'}}).database();
  const visor2=env.authenticatedContext('visor2',{firebase:{sign_in_provider:'anonymous'}}).database();
  await env.withSecurityRulesDisabled(async c=>set(ref(c.database(),'maximilian/admins'),{docente:true,docente2:true}));
  const ruta=c=>'maximilian/sesiones/'+c;
  const meta=(uid='docente',nonce='a'.repeat(32))=>({propietario:uid,creado:Date.now(),expira:Date.now()+14400000,nonce});
  for(let i=0;i<5;i++)await assertSucceeds(runTransaction(ref(admin,ruta(11000+i)+'/meta'),actual=>actual||meta(),{applyLocally:false}));
  await assertFails(set(ref(intruso,ruta(22000)+'/meta'),meta('otro')));
  await assertFails(set(ref(admin,ruta('mal')+'/meta'),meta()));
  await assertFails(set(ref(admin,ruta(22000)+'/meta'),{...meta(),extra:true}));
  await assertFails(set(ref(admin,ruta(22000)+'/meta'),{...meta(),expira:Date.now()+20000000}));
  await assertFails(set(ref(otroAdmin,ruta(11000)+'/meta'),meta('docente2')));
  await assertFails(get(ref(admin,'maximilian/sesiones')));
  await assertFails(get(ref(visor,'maximilian/sesiones')));
  await assertFails(get(ref(publico,ruta(11000)+'/meta')));
  await assertSucceeds(get(ref(visor,ruta(11000)+'/meta')));
  await assertFails(set(ref(visor,ruta(11000)+'/canales/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/miembros/visor'),'incorrecto'));
  await assertSucceeds(set(ref(visor,ruta(11000)+'/canales/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/miembros/visor'),'a'.repeat(32)));
  await assertFails(set(ref(visor,ruta(11000)+'/canales/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/miembros/visor2'),'a'.repeat(32)));
  const comando=(db,overrides={})=>({id:push(ref(db,'ids')).key,tipo:'decir',texto:'Hola',velocidad:1,tono:1,creado:serverTimestamp(),expira:Date.now()+20000,autor:'docente',...overrides});
  const enviar=(db,c,m)=>update(ref(db),{[ruta(c)+'/canales/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/comando']:m,[ruta(c)+'/canales/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/mensajes/'+m.id]:m});
  for(let i=0;i<5;i++)await assertSucceeds(enviar(admin,11000+i,comando(admin)));
  await assertSucceeds(get(ref(visor,ruta(11000)+'/canales/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/comando')));
  await assertFails(get(ref(visor,ruta(11001)+'/canales/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/comando')));
  await assertFails(get(ref(visor2,ruta(11000)+'/canales/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/comando')));
  await assertFails(get(ref(publico,ruta(11000)+'/canales/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/comando')));
  await assertFails(get(ref(visor,ruta(11000)+'/canales/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/mensajes')));
  await assertFails(get(ref(otroAdmin,ruta(11000)+'/canales/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/mensajes')));
  await assertFails(enviar(visor,11000,comando(visor,{autor:'visor'})));
  await assertFails(enviar(otroAdmin,11000,comando(otroAdmin,{autor:'docente2'})));
  for(const invalid of [{autor:'otro'},{texto:'a'.repeat(1001)},{texto:null},{extra:true},{tipo:'script'},{expira:Date.now()-1000},{expira:Date.now()+60000},{velocidad:3},{tono:-1},{tipo:'detener'}])await assertFails(enviar(admin,11000,comando(admin,invalid)));
  const bueno=comando(admin);await assertSucceeds(enviar(admin,11000,bueno));
  await assertFails(update(ref(admin,ruta(11000)+'/canales/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/mensajes/'+bueno.id),{texto:'Modificar'}));
  for(const cuento of ['estrella','tortuga','nube','zorro','semilla']){
    const m=comando(admin,{tipo:'cuento',cuento});delete m.texto;delete m.velocidad;delete m.tono;
    await assertSucceeds(enviar(admin,11000,m));
    await assertFails(enviar(admin,11000,{...m,texto:'Incompatible'}));
  }
  const gesture=comando(admin,{tipo:'gesto',gesto:'saludar'});delete gesture.texto;delete gesture.velocidad;delete gesture.tono;
  await assertSucceeds(enviar(admin,11000,gesture));
  await assertFails(enviar(admin,11000,{...gesture,gesto:'inventado'}));
  for(const accion of ['pausar','continuar']){
    const m=comando(admin,{tipo:'reproduccion',accion});delete m.texto;delete m.velocidad;delete m.tono;
    await assertSucceeds(enviar(admin,11000,m));
    await assertFails(enviar(admin,11000,{...m,texto:'No permitido'}));
    await assertFails(enviar(admin,11000,{...m,accion:'otra'}));
  }
  await assertFails(enviar(admin,11000,comando(admin,{accion:'pausar'})));
  const {default:assert}=await import('node:assert/strict');
  const basePantallas=ruta(11000)+'/canales/'+'a'.repeat(32);
  await assert.rejects(exigirPantalla({db:admin,D:database,base:basePantallas,ahora:()=>Date.now()}),/No hay ninguna pantalla/);
  const p=ruta(11000)+'/canales/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/presencia/visor/'+push(ref(visor,'ids')).key;
  await assertSucceeds(set(ref(visor,p),serverTimestamp()));
  await exigirPantalla({db:admin,D:database,base:basePantallas,ahora:()=>Date.now()});
  await assertFails(set(ref(visor2,p),serverTimestamp()));
  await assertSucceeds(remove(ref(visor,p)));
  await assertFails(set(ref(visor,ruta(11001)+'/canales/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/presencia/visor/'+push(ref(visor,'ids')).key),serverTimestamp()));
  // Close one session; others remain usable. Reuse rotates nonce and excludes old members.
  await assertSucceeds(update(ref(admin,ruta(11000)+'/meta'),{expira:serverTimestamp()}));
  await assertFails(enviar(admin,11000,comando(admin)));
  await assertFails(get(ref(visor,ruta(11000)+'/canales/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/comando')));
  await assertSucceeds(enviar(admin,11001,comando(admin)));
  await assertSucceeds(set(ref(admin,ruta(11000)+'/meta'),meta('docente','b'.repeat(32))));
  await assertFails(get(ref(visor,ruta(11000)+'/canales/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/comando')));
  await assertSucceeds(set(ref(visor,ruta(11000)+'/canales/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/miembros/visor'),'b'.repeat(32)));
  await assertSucceeds(get(ref(visor,ruta(11000)+'/canales/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/comando')));
  await assertFails(get(ref(admin,ruta(11000)+'/canales/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/mensajes')));
  await assertFails(set(ref(admin,'maximilian/comando'),comando(admin)));
  await env.withSecurityRulesDisabled(async c=>remove(ref(c.database(),'maximilian/admins/docente')));
  await assertFails(enviar(admin,11001,comando(admin)));
  console.log('OK: cinco sesiones, aislamiento, permisos, caducidad, colisiones, renovación y revocación.');
}finally{await env.cleanup();}
