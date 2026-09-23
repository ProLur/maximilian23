import{initializeApp}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import{getFirestore,collection,getDocs,query,where}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import{firebaseConfig,isFirebaseConfigured}from'./firebase-config.js?v=1';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let posts=[],activeTag=new URLSearchParams(location.search).get('tag')||'',searchTerm='';
const toDate=v=>v?.toDate?v.toDate():new Date(v||Date.now());
const dateText=v=>new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'long',year:'numeric'}).format(toDate(v));
const tagUrl=t=>`?tag=${encodeURIComponent(t)}`;
function render(){
  let visible=posts.filter(p=>!activeTag||(p.tags||[]).some(t=>t.toLocaleLowerCase('es')===activeTag.toLocaleLowerCase('es')));
  if(searchTerm)visible=visible.filter(p=>`${p.title} ${p.summary} ${(p.tags||[]).join(' ')}`.toLocaleLowerCase('es').includes(searchTerm));
  $('#viewTitle').textContent=activeTag?`Etiqueta: ${activeTag}`:searchTerm?'Resultados de búsqueda':'Últimas entradas';$('#resultCount').textContent=`${visible.length} ${visible.length===1?'entrada':'entradas'}`;
  $('#loading').classList.add('hidden');$('#posts').classList.toggle('hidden',!visible.length);$('#empty').classList.toggle('hidden',!!visible.length);
  $('#posts').innerHTML=visible.map(p=>{const cover=(p.imageDataUrls||[])[0]||p.imageDataUrl||'';return `<article class="post-card">${cover?`<a href="post.html?id=${encodeURIComponent(p.id)}"><img src="${esc(cover)}" alt="${esc(p.title)}"></a>`:''}<div class="post-copy"><h3><a href="post.html?id=${encodeURIComponent(p.id)}">${esc(p.title)}</a></h3><div class="meta">${dateText(p.eventDate||p.publishedAt)} · Creado por ${esc(p.author)}</div><p>${esc(p.summary)}</p><div class="post-tags">${(p.tags||[]).map(t=>`<a href="${tagUrl(t)}">#${esc(t)}</a>`).join('')}</div><a class="read-more" href="post.html?id=${encodeURIComponent(p.id)}">Leer la entrada →</a></div></article>`}).join('');
}
function renderWidgets(){const counts=new Map();posts.forEach(p=>(p.tags||[]).forEach(t=>counts.set(t,(counts.get(t)||0)+1)));$('#tags').innerHTML=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([t,n])=>`<a href="${tagUrl(t)}" class="${t.toLocaleLowerCase('es')===activeTag.toLocaleLowerCase('es')?'active':''}"><span>${esc(t)}</span><strong>${n}</strong></a>`).join('')||'<span class="muted">Aún no hay etiquetas.</span>';const months=new Map();posts.forEach(p=>{const d=toDate(p.eventDate||p.publishedAt),k=new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric'}).format(d);months.set(k,(months.get(k)||0)+1)});$('#archive').innerHTML=[...months].map(([m,n])=>`<div><span>${esc(m)}</span><strong>${n} ${n===1?'entrada':'entradas'}</strong></div>`).join('')}
$('#searchForm').addEventListener('submit',e=>{e.preventDefault();searchTerm=$('#searchInput').value.trim().toLocaleLowerCase('es');activeTag='';render()});
async function load(){if(!isFirebaseConfigured)return;try{const db=getFirestore(initializeApp(firebaseConfig,'cite-public'));const snap=await getDocs(query(collection(db,'citePosts'),where('status','==','published')));posts=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>toDate(b.eventDate||b.publishedAt)-toDate(a.eventDate||a.publishedAt));renderWidgets();render()}catch(e){console.error(e);$('#loading').textContent='No se ha podido abrir el blog. Inténtalo de nuevo en unos segundos.'}}load();
