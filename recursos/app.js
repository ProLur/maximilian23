const search=document.querySelector('#search'),sections=[...document.querySelectorAll('.collection')],filters=[...document.querySelectorAll('[data-filter]')],cards=[...document.querySelectorAll('.resource')];
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
let category='all';
function filter(){
 const words=normalize(search.value.trim()).split(/\s+/).filter(Boolean);let count=0;
 for(const section of sections){let shown=0;for(const card of section.querySelectorAll('.resource')){const match=(category==='all'||category===section.dataset.group)&&words.every(w=>normalize(card.dataset.search).includes(w));card.hidden=!match;if(match){shown++;count++}}
 section.hidden=!shown;section.querySelector('.section-count').textContent=String(shown).padStart(2,'0');}
 document.querySelector('#results').textContent=`${count} ${count===1?'recurso disponible':'recursos disponibles'}`;document.querySelector('#empty').hidden=count!==0;
}
search.addEventListener('input',filter);for(const button of filters)button.addEventListener('click',()=>{category=button.dataset.filter;for(const b of filters)b.setAttribute('aria-pressed',String(b===button));filter()});
document.querySelector('#background').addEventListener('change',e=>document.body.dataset.bg=e.target.value);
const dialog=document.querySelector('#viewer'),viewerImage=document.querySelector('#viewerImage'),viewerTitle=document.querySelector('#viewerTitle'),viewerDownload=document.querySelector('#viewerDownload');
for(const button of document.querySelectorAll('[data-preview]'))button.addEventListener('click',()=>{viewerTitle.textContent=button.dataset.title;viewerImage.alt=button.dataset.title;viewerImage.src=button.dataset.preview;viewerDownload.href=button.dataset.preview;viewerDownload.download=button.closest('.resource').querySelector('.download').download;dialog.showModal()});
document.querySelector('#closeViewer').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});dialog.addEventListener('close',()=>viewerImage.removeAttribute('src'));
let toastTimeout;function toast(text){const el=document.querySelector('#toast');clearTimeout(toastTimeout);el.textContent=text;el.classList.add('visible');toastTimeout=setTimeout(()=>el.classList.remove('visible'),3500)}
for(const button of document.querySelectorAll('[data-copy]'))button.addEventListener('click',async()=>{const url=new URL(button.dataset.copy,location.origin).href;try{await navigator.clipboard.writeText(url);toast('Enlace copiado')}catch{toast('No se pudo copiar el enlace. Puedes abrir la imagen y copiar su dirección.')}});
