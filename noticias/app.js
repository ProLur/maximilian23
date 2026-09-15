import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getFirestore, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js?v=1';

const loading = document.querySelector('#loading');
const empty = document.querySelector('#empty');
const paper = document.querySelector('#paper');
const lead = document.querySelector('#lead');
const latest = document.querySelector('#latest');
const mostRead = document.querySelector('#mostRead');
let articles = [];

document.querySelector('#today').textContent = new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
document.querySelectorAll('.section').forEach(button => button.addEventListener('click',()=>{
  document.querySelectorAll('.section').forEach(item=>item.classList.remove('active'));
  button.classList.add('active');
  render(button.dataset.category);
}));

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const dateText = value => {
  const date = value?.toDate ? value.toDate() : new Date(value || Date.now());
  return new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'long',year:'numeric'}).format(date);
};
const articleUrl = article => `article.html?id=${encodeURIComponent(article.id)}`;
const image = (article, cls='') => (article.imageDataUrl || article.imageUrl)
  ? `<img class="${cls}" src="${escapeHtml(article.imageDataUrl || article.imageUrl)}" alt="${escapeHtml(article.imageAlt || article.title)}">`
  : `<div class="${cls === 'lead-image' ? 'lead-placeholder' : 'card-placeholder'}">Crónica Escolar</div>`;

function render(category='Todas'){
  const visible = category === 'Todas' ? articles : articles.filter(item=>item.category===category);
  loading.classList.add('hidden');
  if(!visible.length){paper.classList.add('hidden');empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');paper.classList.remove('hidden');
  const first=visible[0];
  lead.innerHTML=`<a class="story-link" href="${articleUrl(first)}">${image(first,'lead-image')}<span class="category">${escapeHtml(first.category)}</span><h1>${escapeHtml(first.title)}</h1><p class="summary">${escapeHtml(first.summary)}</p><span class="byline">Por ${escapeHtml(first.author)} · ${dateText(first.publishedAt)}</span></a>`;
  const rest=visible.slice(1);
  latest.innerHTML=rest.map(item=>`<article class="card"><a class="story-link" href="${articleUrl(item)}">${image(item)}<span class="category">${escapeHtml(item.category)}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.summary)}</p><span class="byline">${escapeHtml(item.author)} · ${dateText(item.publishedAt)}</span></a></article>`).join('');
  const ranked=[...articles].sort((a,b)=>(b.views||0)-(a.views||0)).slice(0,5);
  mostRead.innerHTML=ranked.map(item=>`<li><a href="${articleUrl(item)}">${escapeHtml(item.title)}</a></li>`).join('');
}

async function load(){
  if(!isFirebaseConfigured){loading.classList.add('hidden');empty.classList.remove('hidden');return;}
  try{
    const app=initializeApp(firebaseConfig);const db=getFirestore(app);
    const snapshot=await getDocs(query(collection(db,'articles'),where('status','==','published')));
    articles=snapshot.docs.map(doc=>({id:doc.id,...doc.data()})).sort((a,b)=>(b.publishedAt?.seconds||0)-(a.publishedAt?.seconds||0));
    render();
  }catch(error){console.error(error);loading.textContent='No se ha podido abrir la edición. Inténtalo de nuevo en unos segundos.';}
}
load();
