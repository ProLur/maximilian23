import { cargarFirebase, desfaseServidor } from './firebase.js';
import { valido } from './protocolo.js?v=sesiones1';
import { rutaSesion } from './sesiones.js?v=sesiones1';
export async function conectarRemoto({ codigo, onMensaje, onEstado = () => {} }) {
  let cerrar = () => {};
  try {
    const raiz=rutaSesion(codigo);
    const fb=await cargarFirebase({conAuth:true,visor:true});
    if(!fb) throw Error('Control sin configurar.');
    const {db,D,auth,A}=fb;
    await A.setPersistence(auth,A.inMemoryPersistence);
    const {user}=await A.signInAnonymously(auth);
    const desfase=await desfaseServidor(db,D);
    const meta=(await D.get(D.ref(db,raiz+'/meta'))).val();
    if(!meta || meta.expira<=Date.now()+desfase) throw Error('El código no existe o ha caducado.');
    const base=raiz+'/canales/'+meta.nonce;
    await D.set(D.ref(db,base+'/miembros/'+user.uid),meta.nonce);
    const inicio=Date.now()+desfase, vistos=new Set(), parar=[];
    let reloj, caducidad, cerrado=false;
    const presencia=D.push(D.ref(db,base+'/presencia/'+user.uid));
    cerrar=()=>{
      if(cerrado)return; cerrado=true;
      parar.forEach(fn=>fn()); clearInterval(reloj);clearTimeout(caducidad);
      D.remove(presencia).catch(()=>{});
      window.removeEventListener('pagehide',cerrar);
    };
    const terminar=estado=>{cerrar();onEstado(estado);};
    const fallo=()=>terminar('error');
    caducidad=setTimeout(()=>terminar('caducada'),Math.max(0,meta.expira-Date.now()-desfase));
    parar.push(D.onValue(D.ref(db,raiz+'/meta'),s=>{
      const actual=s.val();
      if(!actual || actual.nonce!==meta.nonce || actual.expira<=Date.now()+desfase) terminar('caducada');
    },fallo));
    parar.push(D.onValue(D.ref(db,base+'/comando'),snap=>{
      if(cerrado)return;
      const m=snap.val();
      if(!valido(m,Date.now()+desfase) || m.creado<inicio || vistos.has(m.id))return;
      vistos.add(m.id);if(vistos.size>200)vistos.delete(vistos.values().next().value);
      try { onMensaje(m); } catch(err) { console.error('No se pudo ejecutar la orden',err);onEstado('error-ejecucion'); }
    },fallo));
    parar.push(D.onValue(D.ref(db,'.info/connected'),async s=>{
      clearInterval(reloj);
      if(cerrado)return;
      if(!s.val()){onEstado('desconectado');return;}
      try {
        await D.onDisconnect(presencia).remove();
        if(cerrado)return;
        await D.set(presencia,D.serverTimestamp());
        if(cerrado)return;
        reloj=setInterval(()=>D.set(presencia,D.serverTimestamp()).catch(fallo),30000);
        onEstado('conectado');
      } catch {fallo();}
    }));
    fb.cerrar=cerrar;
    window.addEventListener('pagehide',cerrar,{once:true});
    return fb;
  } catch(err) { cerrar();onEstado('error');throw err; }
}
