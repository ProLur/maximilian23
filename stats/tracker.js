import{initializeApp,getApps}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import{getFirestore,doc,setDoc,increment,serverTimestamp}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import{firebaseConfig,isFirebaseConfigured}from'./firebase-config.js?v=1';
let statsDb;
if(isFirebaseConfigured&&!location.pathname.startsWith('/stats')){
  track().catch(()=>{});
  installActionTracking();
}
async function track(){
  const path=normalizePath(location.pathname),day=localDay(new Date()),sessionKey=`m23-view:${day}:${path}`;
  if(sessionStorage.getItem(sessionKey))return;sessionStorage.setItem(sessionKey,'1');
  const db=getStatsDb();
  const device=innerWidth<600?'mobile':innerWidth<1024?'tablet':'desktop';
  const id=path==='/'?'inicio':path.replace(/^\//,'').replace(/\/$/,'').replace(/[^a-z0-9]+/gi,'-').toLowerCase();
  await setDoc(doc(db,'pageStats',id),{path,title:cleanTitle(document.title),total:increment(1),lastVisit:serverTimestamp(),devices:{[device]:increment(1)},days:{[day]:increment(1)}},{merge:true});
}
async function trackAction(action,label){
  const db=getStatsDb(),day=localDay(new Date()),device=innerWidth<600?'mobile':innerWidth<1024?'tablet':'desktop';
  const safeAction=String(action||'accion').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase().slice(0,50)||'accion';
  await setDoc(doc(db,'pageStats',`buscador-accion-${safeAction}`),{path:`evento:buscador/${safeAction}`,title:String(label||action||'Acción del buscador').slice(0,100),total:increment(1),lastVisit:serverTimestamp(),devices:{[device]:increment(1)},days:{[day]:increment(1)}},{merge:true});
}
function installActionTracking(){
  document.addEventListener('submit',event=>{
    const form=event.target.closest?.('form[data-stat-action]');if(!form||form.dataset.statSent==='1')return;
    event.preventDefault();form.dataset.statSent='1';
    Promise.race([trackAction(form.dataset.statAction,form.dataset.statLabel),new Promise(resolve=>setTimeout(resolve,1200))]).finally(()=>form.submit());
  });
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[data-stat-action]');if(!link)return;
    const sameTab=!link.target||link.target==='_self';
    if(!sameTab){trackAction(link.dataset.statAction,link.dataset.statLabel).catch(()=>{});return;}
    event.preventDefault();
    Promise.race([trackAction(link.dataset.statAction,link.dataset.statLabel),new Promise(resolve=>setTimeout(resolve,1200))]).finally(()=>location.href=link.href);
  });
}
function getStatsDb(){
  if(statsDb)return statsDb;
  const app=getApps().find(item=>item.name==='maximilian-stats')||initializeApp(firebaseConfig,'maximilian-stats');
  return statsDb=getFirestore(app);
}
function normalizePath(value){let path=value.replace(/\/index\.html$/i,'/');if(!path.endsWith('/')&&!/\.[a-z0-9]+$/i.test(path))path+='/';return path||'/';}
function localDay(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function cleanTitle(value){return String(value||'Página sin título').replace(/\s*[·|–-]\s*Maximilian\s*23.*$/i,'').slice(0,100);}
