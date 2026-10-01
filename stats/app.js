import{initializeApp}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import{getFirestore,collection,getDocs}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import{firebaseConfig,isFirebaseConfigured}from'./firebase-config.js?v=1';
localStorage.setItem('m23-stats-owner','1');
const $=selector=>document.querySelector(selector),format=new Intl.NumberFormat('es-ES');
const ranges={day:{label:'Último día',days:1},last24:{label:'Últimas 24 horas',hours:24},week:{label:'Última semana',days:7},month:{label:'Último mes',days:30},all:{label:'Todo el histórico'}};
const rangeKey='m23-stats-range',savedRange=localStorage.getItem(rangeKey);
let sourcePages=[],activeRange=ranges[savedRange]?savedRange:'day';
$('#refreshBtn').addEventListener('click',load);
document.querySelectorAll('.range-tab').forEach(button=>{button.classList.toggle('active',button.dataset.range===activeRange);button.addEventListener('click',()=>{activeRange=button.dataset.range;localStorage.setItem(rangeKey,activeRange);document.querySelectorAll('.range-tab').forEach(item=>item.classList.toggle('active',item===button));render(sourcePages);});});
async function load(){
  $('#loading').classList.remove('hidden');$('#empty').classList.add('hidden');$('#ranking').innerHTML='';
  if(!isFirebaseConfigured){$('#loading').textContent='El panel está en preparación.';return;}
  try{const db=getFirestore(initializeApp(firebaseConfig));const snap=await getDocs(collection(db,'pageStats'));sourcePages=snap.docs.map(item=>item.data());render(sourcePages);}
  catch(error){console.error(error);$('#loading').textContent='No se han podido cargar las estadísticas.';}
}
function render(pages){
  $('#loading').classList.add('hidden');if(!pages.length){$('#empty').classList.remove('hidden');return;}
  const range=ranges[activeRange],dayRange=range.days?dayKeys(range.days):null,hourRange=range.hours?hourKeys(range.hours):null;
  const rangedPages=pages.map(page=>({...page,rangeTotal:hourRange?hourRange.reduce((sum,key)=>sum+(page.hours?.[key]||0),0):dayRange?dayRange.reduce((sum,key)=>sum+(page.days?.[key]||0),0):(page.total||0)}));
  const searchEvents=rangedPages.filter(page=>/^evento:buscador(?:-(?:edu|nor))?\//.test(String(page.path||''))).sort((a,b)=>b.rangeTotal-a.rangeTotal);
  const contentPages=rangedPages.filter(page=>!String(page.path||'').startsWith('evento:'));
  const viewPages=contentPages.filter(page=>page.rangeTotal>0).sort((a,b)=>b.rangeTotal-a.rangeTotal);
  const today=localDay(new Date()),total=viewPages.reduce((sum,p)=>sum+p.rangeTotal,0),todayTotal=contentPages.reduce((sum,p)=>sum+(p.days?.[today]||0),0),latest=contentPages.map(p=>p.lastVisit?.toDate?.()).filter(Boolean).sort((a,b)=>b-a)[0];
  $('#totalLabel').textContent=activeRange==='all'?'Visitas totales':'Visitas en el periodo';$('#totalViews').textContent=format.format(total);$('#todayViews').textContent=format.format(todayTotal);$('#activePages').textContent=format.format(viewPages.length);$('#lastVisit').textContent=latest?new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(latest):'—';$('#rangeLabel').textContent=range.label;
  $('#empty').classList.toggle('hidden',viewPages.length>0);
  const max=viewPages[0]?.rangeTotal||1;$('#ranking').innerHTML=viewPages.map((p,i)=>`<div class="rank-row"><span class="rank-number">${i+1}</span><div><span class="rank-title">${esc(p.title||p.path)}</span><span class="rank-path">${esc(p.path)}</span></div><div class="bar-track"><div class="bar" style="width:${Math.max(2,p.rangeTotal/max*100)}%"></div></div><span class="rank-value">${format.format(p.rangeTotal)}</span></div>`).join('');
  const historicalTotal=contentPages.reduce((sum,p)=>sum+(p.total||0),0),devices=['desktop','mobile','tablet'].map(key=>({key,value:contentPages.reduce((sum,p)=>sum+(p.devices?.[key]||0),0)})),labels={desktop:'Ordenador',mobile:'Móvil',tablet:'Tableta'};$('#devices').innerHTML=devices.map(d=>`<div class="device-row"><div><span>${labels[d.key]}</span><strong>${format.format(d.value)}</strong></div><div class="bar-track"><div class="bar" style="width:${historicalTotal?d.value/historicalTotal*100:0}%"></div></div></div>`).join('');
  const searchEdu=searchEvents.filter(item=>String(item.path).startsWith('evento:buscador-edu/')).reduce((sum,item)=>sum+item.rangeTotal,0),searchNor=searchEvents.filter(item=>String(item.path).startsWith('evento:buscador-nor/')).reduce((sum,item)=>sum+item.rangeTotal,0);$('#searchEdu').textContent=format.format(searchEdu);$('#searchNor').textContent=format.format(searchNor);$('#searchPeriod').textContent=`${range.label} · clasificación desde hoy`;const actionTotals=new Map();searchEvents.forEach(item=>{const action=String(item.path).split('/').pop(),current=actionTotals.get(action)||{title:item.title,total:0};current.total+=item.rangeTotal;actionTotals.set(action,current)});$('#searchActions').innerHTML=[...actionTotals.values()].filter(item=>item.total>0).sort((a,b)=>b.total-a.total).map(item=>`<div><span>${esc(item.title)}</span><strong>${format.format(item.total)}</strong></div>`).join('')||'<p class="search-empty">Aún no hay actividad en este periodo.</p>';
  const hourly=Boolean(range.hours),chartDays=range.days===30?30:7,chartItems=hourly?makeHours(contentPages,24):makeDays(contentPages,chartDays),chartMax=Math.max(1,...chartItems.map(d=>d.value));$('#chartLabel').textContent=hourly?'ÚLTIMAS 24 HORAS':chartDays===30?'ÚLTIMOS 30 DÍAS':'ÚLTIMOS 7 DÍAS';$('#weekChart').classList.toggle('month-chart',hourly||chartDays===30);$('#weekChart').innerHTML=chartItems.map((d,index)=>`<div class="day" title="${hourly?longDateTime(d.date):longDate(d.date)}: ${format.format(d.value)} visitas"><strong>${d.value}</strong><div class="day-bar" style="height:${Math.max(2,d.value/chartMax*125)}px"></div><span>${hourly?(index%3===0?`${String(d.date.getHours()).padStart(2,'0')}h`:''):chartDays===30?(index%5===0?d.date.getDate():''):new Intl.DateTimeFormat('es-ES',{weekday:'short'}).format(d.date).replace('.','')}</span></div>`).join('');
}
function dayKeys(length){return Array.from({length},(_,offset)=>{const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()-offset);return localDay(date);});}
function hourKeys(length){const end=new Date();end.setMinutes(0,0,0);return Array.from({length},(_,offset)=>{const date=new Date(end);date.setHours(date.getHours()-offset);return `${localDay(date)}T${String(date.getHours()).padStart(2,'0')}`;});}
function makeDays(pages,length){return Array.from({length},(_,offset)=>{const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()-(length-1-offset));const key=localDay(date);return{key,date,value:pages.reduce((sum,p)=>sum+(p.days?.[key]||0),0)}});}
function makeHours(pages,length){const end=new Date();end.setMinutes(0,0,0);return Array.from({length},(_,offset)=>{const date=new Date(end);date.setHours(date.getHours()-(length-1-offset));const key=`${localDay(date)}T${String(date.getHours()).padStart(2,'0')}`;return{key,date,value:pages.reduce((sum,p)=>sum+(p.hours?.[key]||0),0)}});}
function longDate(date){return new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'long'}).format(date);}
function longDateTime(date){return new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(date);}
function localDay(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function esc(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
load();
