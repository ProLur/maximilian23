// Solo emulador demo: esta suite borra sus datos de prueba.
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, get, set, update, remove, push, serverTimestamp } from 'firebase/database';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
if (!process.env.FIREBASE_DATABASE_EMULATOR_HOST) throw Error('Ejecutar mediante emulators:exec; nunca contra producción.');
const [host, port] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw Error('Solo se admite emulador local.');
const env = await initializeTestEnvironment({projectId:'demo-maximilian-seguridad',database:{host,port:Number(port),rules:await readFile(new URL('../firebase/database.rules.json',import.meta.url),'utf8')}});
try {
  await env.clearDatabase();
  const admin=env.authenticatedContext('docente').database();
  const usuario=env.authenticatedContext('otro').database();
  const publico=env.unauthenticatedContext().database();
  const visor=env.authenticatedContext('visor',{firebase:{sign_in_provider:'anonymous'}}).database();
  await env.withSecurityRulesDisabled(async c => set(ref(c.database(),'maximilian/admins/docente'),true));
  const create=(db,overrides={})=>{
    const id=push(ref(db,'maximilian/mensajes')).key;
    const m={id,tipo:'decir',texto:'Hola',velocidad:1,tono:1,creado:serverTimestamp(),expira:Date.now()+20000,autor:'docente',...overrides};
    return {id,m,send:()=>update(ref(db),{['maximilian/mensajes/'+id]:m,'maximilian/comando':m})};
  };
  const ok=create(admin);await assertSucceeds(ok.send());
  await assertSucceeds(get(ref(publico,'maximilian/comando')));
  await assertFails(get(ref(publico,'maximilian/mensajes')));
  await assertFails(get(ref(usuario,'maximilian/mensajes')));
  await assertSucceeds(get(ref(admin,'maximilian/mensajes')));
  await assertFails(create(publico).send());await assertFails(create(usuario,{autor:'otro'}).send());
  for (const invalid of [
    {autor:'otro'}, {texto:'a'.repeat(1001)}, {tipo:'gesto',gesto:'ejecutar'},
    {expira:Date.now()-10000}, {expira:Date.now()+60000}, {extra:true},
    {tipo:'decir',texto:null}, {creado:1}, {velocidad:3}, {tono:-1},
    {tipo:'detener'}, // lleva texto y voz: campos incompatibles
  ]) await assertFails(create(admin,invalid).send());
  await assertFails(set(ref(usuario,'maximilian/admins/otro'),true));
  const conexion=push(ref(visor,'maximilian/presencia/visor')).key;
  await assertSucceeds(set(ref(visor,'maximilian/presencia/visor/'+conexion),serverTimestamp()));
  await assertSucceeds(remove(ref(visor,'maximilian/presencia/visor/'+conexion)));
  await assertFails(set(ref(publico,'maximilian/presencia/visor/'+conexion),serverTimestamp()));
  await assertFails(set(ref(usuario,'maximilian/presencia/visor/'+conexion),serverTimestamp()));
  await assertFails(get(ref(visor,'maximilian/presencia')));
  await assertFails(remove(ref(admin,'maximilian/mensajes/'+ok.id)));
  await assertFails(update(ref(admin,'maximilian/mensajes/'+ok.id),{texto:'Cambio'}));
  const id=push(ref(admin,'maximilian/mensajes')).key;
  const gesto={id,tipo:'gesto',gesto:'saludar',creado:serverTimestamp(),expira:Date.now()+20000,autor:'docente'};
  await assertSucceeds(set(ref(admin,'maximilian/comando'),gesto));
  await assertSucceeds(set(ref(admin,'maximilian/comando'),{id,tipo:'detener',creado:serverTimestamp(),expira:Date.now()+20000,autor:'docente'}));
  await env.withSecurityRulesDisabled(async c=>remove(ref(c.database(),'maximilian/admins/docente')));
  await assertFails(create(admin).send());
  console.log('Reglas: casos de permiso, validacion, presencia y revocacion superados.');
} finally { await env.cleanup(); }
