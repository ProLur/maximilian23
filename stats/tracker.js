import{initializeApp,getApps}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import{getFirestore,doc,setDoc,increment,serverTimestamp}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import{firebaseConfig,isFirebaseConfigured}from'./firebase-config.js?v=1';
if(isFirebaseConfigured&&!location.pathname.startsWith('/stats'))track().catch(()=>{});
async function track(){
  const path=normalizePath(location.pathname),day=localDay(new Date()),sessionKey=`m23-view:${day}:${path}`;
  if(sessionStorage.getItem(sessionKey))return;sessionStorage.setItem(sessionKey,'1');
  const app=getApps().find(item=>item.name==='maximilian-stats')||initializeApp(firebaseConfig,'maximilian-stats'),db=getFirestore(app);
  const device=innerWidth<600?'mobile':innerWidth<1024?'tablet':'desktop';
  const id=path==='/'?'inicio':path.replace(/^\//,'').replace(/\/$/,'').replace(/[^a-z0-9]+/gi,'-').toLowerCase();
  await setDoc(doc(db,'pageStats',id),{path,title:cleanTitle(document.title),total:increment(1),lastVisit:serverTimestamp(),devices:{[device]:increment(1)},days:{[day]:increment(1)}},{merge:true});
}
function normalizePath(value){let path=value.replace(/\/index\.html$/i,'/');if(!path.endsWith('/')&&!/\.[a-z0-9]+$/i.test(path))path+='/';return path||'/';}
function localDay(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function cleanTitle(value){return String(value||'Página sin título').replace(/\s*[·|–-]\s*Maximilian\s*23.*$/i,'').slice(0,100);}
