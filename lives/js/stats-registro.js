import {FUNCIONES} from './stats-datos.js?v=panel-rutinas1';
// Telemetría de uso aproximada: nunca guarda texto de mensajes ni contraseñas.
export function crearRegistroStats({db,D},{onError=()=>{},ahora=()=>performance.now(),visible=()=>document.visibilityState==='visible'}={}){
 let uidActual=null;
 const claveGrupo=uid=>'maximilian:stats:grupo:v2:'+uid,claveVisita=uid=>'maximilian:stats:visita:v2:'+uid;
 const leer=(storage,key)=>{try{return JSON.parse(storage?.getItem(key));}catch{return null;}};
 const guardarCache=(storage,key,v)=>{try{storage?.setItem(key,JSON.stringify(v));}catch{}};
 const latidoCache=()=>{if(uidActual&&visita)guardarCache(globalThis.localStorage,claveGrupo(uidActual),{grupo:visita.grupo,ultima:Date.now()});};
 let visita=null,conexion=false,ultimo=ahora(),actividad=ahora(),timer=null,parar=null,serial=Promise.resolve(),estabaVisible=visible();
 const contar=()=>{const t=ahora(),anterior=ultimo,delta=Math.max(0,Math.min(65,(t-anterior)/1000));ultimo=t;const eraVisible=estabaVisible;estabaVisible=visible();if(!visita||!conexion)return;visita.segundos+=delta;if(eraVisible)visita.activos+=Math.max(0,Math.min(delta,(Math.min(t,actividad+120000)-anterior)/1000));};
 const guardar=()=>{contar();latidoCache();const v=visita;if(!v||!conexion||!v.inicializada)return Promise.resolve();const datos={actualizado:D.serverTimestamp(),segundos:Math.floor(v.segundos),activos:Math.floor(v.activos),uso:{...v.uso}};serial=serial.catch(()=>{}).then(()=>D.update(v.ref,datos)).catch(()=>onError('No se ha podido actualizar el registro de uso.'));return serial;};
 async function terminar(){contar();const v=visita;visita=null;conexion=false;parar?.();parar=null;clearInterval(timer);timer=null;if(!v||!v.inicializada)return;await serial.catch(()=>{});try{await D.update(v.ref,{actualizado:D.serverTimestamp(),fin:D.serverTimestamp(),segundos:Math.floor(v.segundos),activos:Math.floor(v.activos),uso:{...v.uso}});await v.desconexion?.cancel();}catch{onError('El registro de uso se cerrará al detectar la desconexión.');}}
 async function iniciar(user){await terminar();if(!user)return;uidActual=user.uid;
  let grupo=leer(globalThis.localStorage,claveGrupo(user.uid));if(!grupo||Date.now()-grupo.ultima>1800000)grupo={grupo:crypto.randomUUID().replaceAll('-',''),ultima:Date.now()};guardarCache(globalThis.localStorage,claveGrupo(user.uid),grupo);
  const ref=D.push(D.ref(db,'maximilian/estadisticas/'+user.uid));
  const v={ref,grupo:grupo.grupo,segundos:0,activos:0,uso:{},inicializada:false};visita=v;ultimo=actividad=ahora();latidoCache();
  parar=D.onValue(D.ref(db,'.info/connected'),async snap=>{contar();conexion=snap.val()===true;ultimo=ahora();if(!conexion||visita!==v)return;
   try{if(!v.inicializada){await D.set(ref,{email:user.email.toLowerCase(),grupo:v.grupo,inicio:D.serverTimestamp(),actualizado:D.serverTimestamp(),segundos:0,activos:0});v.inicializada=true;}else await D.update(ref,{fin:null,actualizado:D.serverTimestamp()});if(visita!==v){await D.update(ref,{fin:D.serverTimestamp(),actualizado:D.serverTimestamp()});return;}v.desconexion=D.onDisconnect(ref);await v.desconexion.update({fin:D.serverTimestamp(),actualizado:D.serverTimestamp()});if(visita!==v)await v.desconexion.cancel();}catch{onError('No se ha podido iniciar el registro de uso.');}
  });timer=setInterval(guardar,60000);
 }
 function registrar(tipo){if(!visita||!FUNCIONES[tipo])return;contar();visita.uso[tipo]=Math.min(100000,(visita.uso[tipo]||0)+1);}
 const actividadUsuario=()=>{contar();actividad=ahora();};
 const alVisibilidad=()=>{contar();if(visible())actividad=ahora();guardar();};
 for(const e of ['pointerdown','keydown'])document.addEventListener(e,actividadUsuario,{passive:true});
 document.addEventListener('visibilitychange',alVisibilidad);window.addEventListener('pagehide',()=>{guardar();});
 const salir=async()=>{const uid=uidActual;await terminar();try{globalThis.localStorage?.removeItem(claveGrupo(uid));globalThis.sessionStorage?.removeItem(claveVisita(uid));}catch{}};
 return{iniciar,terminar,salir,registrar,guardar};
}
