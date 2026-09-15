import{initializeApp}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import{getFirestore,collection,getDocs}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import{firebaseConfig,isFirebaseConfigured}from'./firebase-config.js?v=1';
const $=selector=>document.querySelector(selector),format=new Intl.NumberFormat('es-ES');
$('#refreshBtn').addEventListener('click',load);
async function load(){
  $('#loading').classList.remove('hidden');$('#empty').classList.add('hidden');$('#ranking').innerHTML='';
  if(!isFirebaseConfigured){$('#loading').textContent='El panel está en preparación.';return;}
  try{const db=getFirestore(initializeApp(firebaseConfig));const snap=await getDocs(collection(db,'pageStats'));const pages=snap.docs.map(item=>item.data()).sort((a,b)=>(b.total||0)-(a.total||0));render(pages);}
  catch(error){console.error(error);$('#loading').textContent='No se han podido cargar las estadísticas.';}
}
function render(pages){
  $('#loading').classList.add('hidden');if(!pages.length){$('#empty').classList.remove('hidden');return;}
  const today=localDay(new Date()),total=pages.reduce((sum,p)=>sum+(p.total||0),0),todayTotal=pages.reduce((sum,p)=>sum+(p.days?.[today]||0),0),latest=pages.map(p=>p.lastVisit?.toDate?.()).filter(Boolean).sort((a,b)=>b-a)[0];
  $('#totalViews').textContent=format.format(total);$('#todayViews').textContent=format.format(todayTotal);$('#activePages').textContent=format.format(pages.length);$('#lastVisit').textContent=latest?new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(latest):'—';
  const max=pages[0].total||1;$('#ranking').innerHTML=pages.map((p,i)=>`<div class="rank-row"><span class="rank-number">${i+1}</span><div><span class="rank-title">${esc(p.title||p.path)}</span><span class="rank-path">${esc(p.path)}</span></div><div class="bar-track"><div class="bar" style="width:${Math.max(2,(p.total||0)/max*100)}%"></div></div><span class="rank-value">${format.format(p.total||0)}</span></div>`).join('');
  const devices=['desktop','mobile','tablet'].map(key=>({key,value:pages.reduce((sum,p)=>sum+(p.devices?.[key]||0),0)})),labels={desktop:'Ordenador',mobile:'Móvil',tablet:'Tableta'};$('#devices').innerHTML=devices.map(d=>`<div class="device-row"><div><span>${labels[d.key]}</span><strong>${format.format(d.value)}</strong></div><div class="bar-track"><div class="bar" style="width:${total?d.value/total*100:0}%"></div></div></div>`).join('');
  const days=Array.from({length:7},(_,offset)=>{const date=new Date();date.setDate(date.getDate()-(6-offset));const key=localDay(date);return{key,date,value:pages.reduce((sum,p)=>sum+(p.days?.[key]||0),0)}}),dayMax=Math.max(1,...days.map(d=>d.value));$('#weekChart').innerHTML=days.map(d=>`<div class="day"><strong>${d.value}</strong><div class="day-bar" style="height:${Math.max(2,d.value/dayMax*125)}px"></div><span>${new Intl.DateTimeFormat('es-ES',{weekday:'short'}).format(d.date).replace('.','')}</span></div>`).join('');
}
function localDay(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function esc(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
load();
