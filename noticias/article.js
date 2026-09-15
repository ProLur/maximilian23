import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getFirestore, doc, getDoc, updateDoc, increment } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js?v=1';

const root=document.querySelector('#article');
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const dateText=value=>new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'long',year:'numeric'}).format(value?.toDate?value.toDate():new Date());
async function load(){
  const id=new URLSearchParams(location.search).get('id');
  if(!isFirebaseConfigured||!id){root.innerHTML='<div class="status">Noticia no encontrada.</div>';return;}
  try{
    const app=initializeApp(firebaseConfig);const db=getFirestore(app);const ref=doc(db,'articles',id);const snap=await getDoc(ref);
    if(!snap.exists()||snap.data().status!=='published')throw Error('missing');
    const item=snap.data();document.title=`${item.title} · Crónica Escolar`;
    const safeBody=window.DOMPurify.sanitize(item.bodyHtml||'',{USE_PROFILES:{html:true}});
    const imageSource=item.imageDataUrl||item.imageUrl||'';
    root.innerHTML=`<header><span class="category">${escapeHtml(item.category)}</span><h1>${escapeHtml(item.title)}</h1><p class="article-summary">${escapeHtml(item.summary)}</p><span class="byline">Por ${escapeHtml(item.author)} · ${dateText(item.publishedAt)}</span></header>${imageSource?`<img class="article-hero" src="${escapeHtml(imageSource)}" alt="${escapeHtml(item.imageAlt||item.title)}">`:''}<div class="article-content">${safeBody}</div>`;
    updateDoc(ref,{views:increment(1)}).catch(()=>{});
  }catch(error){root.innerHTML='<div class="status">Esta noticia no está disponible.</div>';}
}
load();
