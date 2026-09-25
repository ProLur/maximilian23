import{initializeApp}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import{getFirestore,collection,getDocs}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import{firebaseConfig,isFirebaseConfigured}from'./firebase-config.js?v=1';
const $=selector=>document.querySelector(selector),format=new Intl.NumberFormat('es-ES');
const ranges={day:{label:'Último día',days:1},week:{label:'Última semana',days:7},month:{label:'Último mes',days:30},all:{label:'Todo el histórico',days:null}};
let sourcePages=[],activeRange='week';
$('#refreshBtn').addEventListener('click',load);
document.querySelectorAll('.range-tab').forEach(button=>button.addEventListener('click',()=>{activeRange=button.dataset.range;document.querySelectorAll('.range-tab').forEach(item=>item.classList.toggle('active',item===button));render(sourcePages);}));
async function load(){
  $('#loading').classList.remove('hidden');$('#empty').classList.add('hidden');$('#ranking').innerHTML='';
  if(!isFirebaseConfigured){$('#loading').textContent='El panel está en preparación.';return;}
  try{const db=getFirestore(initializeApp(firebaseConfig));const snap=await getDocs(collection(db,'pageStats'));sourcePages=snap.docs.map(item=>item.data());render(sourcePages);}
  catch(error){console.error(error);$('#loading').textContent='No se han podido cargar las estadísticas.';}
}
function render(pages){
  $('#loading').classList.add('hidden');if(!pages.length){$('#empty').classList.remove('hidden');return;}
  const range=ranges[activeRange],keys=range.days?dayKeys(range.days):null;
  const viewPages=pages.map(page=>({...page,rangeTotal:keys?keys.reduce((sum,key)=>sum+(page.days?.[key]||0),0):(page.total||0)})).filter(page=>page.rangeTotal>0).sort((a,b)=>b.rangeTotal-a.rangeTotal);
  const today=localDay(new Date()),total=viewPages.reduce((sum,p)=>sum+p.rangeTotal,0),todayTotal=pages.reduce((sum,p)=>sum+(p.days?.[today]||0),0),latest=pages.map(p=>p.lastVisit?.toDate?.()).filter(Boolean).sort((a,b)=>b-a)[0];
  $('#totalLabel').textContent=activeRange==='all'?'Visitas totales':'Visitas en el periodo';$('#totalViews').textContent=format.format(total);$('#todayViews').textContent=format.format(todayTotal);$('#activePages').textContent=format.format(viewPages.length);$('#lastVisit').textContent=latest?new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(latest):'—';$('#rangeLabel').textContent=range.label;
  $('#empty').classList.toggle('hidden',viewPages.length>0);
  const max=viewPages[0]?.rangeTotal||1;$('#ranking').innerHTML=viewPages.map((p,i)=>`<div class="rank-row"><span class="rank-number">${i+1}</span><div><span class="rank-title">${esc(p.title||p.path)}</span><span class="rank-path">${esc(p.path)}</span></div><div class="bar-track"><div class="bar" style="width:${Math.max(2,p.rangeTotal/max*100)}%"></div></div><span class="rank-value">${format.format(p.rangeTotal)}</span></div>`).join('');
  const historicalTotal=pages.reduce((sum,p)=>sum+(p.total||0),0),devices=['desktop','mobile','tablet'].map(key=>({key,value:pages.reduce((sum,p)=>sum+(p.devices?.[key]||0),0)})),labels={desktop:'Ordenador',mobile:'Móvil',tablet:'Tableta'};$('#devices').innerHTML=devices.map(d=>`<div class="device-row"><div><span>${labels[d.key]}</span><strong>${format.format(d.value)}</strong></div><div class="bar-track"><div class="bar" style="width:${historicalTotal?d.value/historicalTotal*100:0}%"></div></div></div>`).join('');
  const chartDays=range.days===30?30:7,days=makeDays(pages,chartDays),dayMax=Math.max(1,...days.map(d=>d.value));$('#chartLabel').textContent=chartDays===30?'ÚLTIMOS 30 DÍAS':'ÚLTIMOS 7 DÍAS';$('#weekChart').classList.toggle('month-chart',chartDays===30);$('#weekChart').innerHTML=days.map((d,index)=>`<div class="day" title="${longDate(d.date)}: ${format.format(d.value)} visitas"><strong>${d.value}</strong><div class="day-bar" style="height:${Math.max(2,d.value/dayMax*125)}px"></div><span>${chartDays===30?(index%5===0?d.date.getDate():''):new Intl.DateTimeFormat('es-ES',{weekday:'short'}).format(d.date).replace('.','')}</span></div>`).join('');
}
function dayKeys(length){return Array.from({length},(_,offset)=>{const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()-offset);return localDay(date);});}
function makeDays(pages,length){return Array.from({length},(_,offset)=>{const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()-(length-1-offset));const key=localDay(date);return{key,date,value:pages.reduce((sum,p)=>sum+(p.days?.[key]||0),0)}});}
function longDate(date){return new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'long'}).format(date);}
function localDay(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function esc(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
load();
