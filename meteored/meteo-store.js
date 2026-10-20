import{initializeApp,getApps}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import{getFirestore,collection,getDocs}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import{firebaseConfig}from'../stats/firebase-config.js?v=1';

const PREFIX='evento:meteo-2627/';
const app=getApps().find(item=>item.name==='maximilian-meteo')||initializeApp(firebaseConfig,'maximilian-meteo');
const db=getFirestore(app);
const ENDPOINT='https://aula-del-futuro-reservas.mmartinezf001.workers.dev/meteo';
const ACCESS_KEY='meteo_admin_password_v2';
let credential=sessionStorage.getItem(ACCESS_KEY)||'';
async function request(body){
  const response=await fetch(ENDPOINT,{method:body?'POST':'GET',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'No se pudo conectar con la estación. Inténtalo de nuevo.');
  return data;
}
let legacyPromise;
async function legacy(){
  if(!legacyPromise)legacyPromise=getDocs(collection(db,'pageStats')).then(snapshot=>snapshot.docs.map(item=>item.data()).filter(item=>String(item.path||'').startsWith(PREFIX)).map(item=>{
    try{return JSON.parse(item.title||'{}');}catch{return null;}
  }).filter(item=>item&&item.fecha)).catch(error=>{console.warn('No se pudo leer el archivo anterior de Meteored.',error);return[];});
  return legacyPromise;
}

window.meteoStore={
  hasSession(){return Boolean(credential);},
  async login(password){await request({action:'login',password});credential=password;sessionStorage.setItem(ACCESS_KEY,password);},
  logout(){credential='';sessionStorage.removeItem(ACCESS_KEY);},
  async list(){
    const [data,old]=await Promise.all([request(),legacy()]);
    if(!Array.isArray(data.meteo))throw new Error('El servidor de Meteored todavía no tiene instalada la actualización.');
    const byDate=new Map(old.map(d=>[d.fecha,d]));
    data.meteo.forEach(d=>byDate.set(d.fecha,d));
    return [...byDate.values()].sort((a,b)=>a.fecha.localeCompare(b.fecha));
  },
  async save(entry){
    if(!credential)throw new Error('Inicia sesión de nuevo para guardar los datos.');
    await request({action:'save',password:credential,entry});
  }
};

window.dispatchEvent(new Event('meteo-store-ready'));

