import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js?v=1';

const $=selector=>document.querySelector(selector);
const loginPanel=$('#loginPanel'),editorPanel=$('#editorPanel'),loginError=$('#loginError'),saveMessage=$('#saveMessage');
let auth,db,currentImageData='';

if(!isFirebaseConfigured){loginError.textContent='La redacción está en preparación. Falta conectar Firebase.';$('#googleLogin').disabled=true;}
else{const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);onAuthStateChanged(auth,handleSession);}

const EDITOR_EMAIL='mmartinezf001@educarex.es';
async function isEditor(user){return Boolean(user?.email&&user.email.toLowerCase()===EDITOR_EMAIL);}
async function handleSession(user){
  if(user&&await isEditor(user)){loginPanel.classList.add('hidden');editorPanel.classList.remove('hidden');$('#sessionUser').textContent=user.email;await loadDrafts();}
  else{if(user)await signOut(auth);editorPanel.classList.add('hidden');loginPanel.classList.remove('hidden');}
}
$('#googleLogin').addEventListener('click',async()=>{loginError.textContent='';try{const provider=new GoogleAuthProvider();provider.setCustomParameters({login_hint:EDITOR_EMAIL});await signInWithPopup(auth,provider);}catch(error){if(error.code!=='auth/popup-closed-by-user')loginError.textContent='No se ha podido acceder con esa cuenta.';}});
$('#logoutBtn').addEventListener('click',()=>signOut(auth));
$('#newBtn').addEventListener('click',clearForm);

document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',()=>{document.execCommand(button.dataset.command,false,button.dataset.value||null);$('#bodyEditor').focus();}));
$('#linkBtn').addEventListener('click',()=>{const url=prompt('Dirección del enlace (https://…)');if(url&&/^https?:\/\//i.test(url))document.execCommand('createLink',false,url);$('#bodyEditor').focus();});
$('#image').addEventListener('change',event=>{const file=event.target.files[0];if(!file)return;const url=URL.createObjectURL(file);$('#imagePreview').style.backgroundImage=`url("${url}")`;$('#imagePreview').classList.remove('hidden');});
$('#draftBtn').addEventListener('click',()=>save('draft'));
$('#unpublishBtn').addEventListener('click',unpublishCurrent);
$('#deleteBtn').addEventListener('click',()=>deleteArticle($('#docId').value));
$('#articleForm').addEventListener('submit',event=>{event.preventDefault();save('published');});

function slugify(value){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,80);}
async function optimizeImage(file){
  const bitmap=await createImageBitmap(file);let max=1200,quality=.8;
  for(let attempt=0;attempt<5;attempt++){
    const scale=Math.min(1,max/bitmap.width);const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
    if(blob.size<620000)return new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});
    max=Math.round(max*.82);quality-=.08;
  }
  throw Error('image-too-large');
}
async function save(status){
  const title=$('#title').value.trim(),summary=$('#summary').value.trim(),author=$('#author').value.trim(),bodyHtml=$('#bodyEditor').innerHTML.trim();
  if(!title||!summary||!author||!bodyHtml||bodyHtml==='<br>'){showMessage('Completa el titular, la entradilla, la firma y el texto.',true);return;}
  const id=$('#docId').value||`${slugify(title)}-${Date.now().toString(36)}`;showMessage(status==='published'?'Publicando…':'Guardando borrador…');
  try{
    const file=$('#image').files[0];if(file)currentImageData=await optimizeImage(file);
    const refDoc=doc(db,'articles',id),previous=await getDoc(refDoc),old=previous.data()||{};
    const record={title,slug:slugify(title),summary,author,category:$('#category').value,bodyHtml,imageDataUrl:currentImageData,imageAlt:title,status,updatedAt:serverTimestamp(),createdAt:old.createdAt||serverTimestamp(),views:old.views||0};
    if(status==='published')record.publishedAt=old.publishedAt||serverTimestamp();
    await setDoc(refDoc,record,{merge:true});$('#docId').value=id;$('#deleteBtn').classList.remove('hidden');$('#unpublishBtn').classList.toggle('hidden',status!=='published');showMessage(status==='published'?'Noticia publicada correctamente.':'Borrador guardado.',false,true);await loadDrafts();
  }catch(error){console.error(error);showMessage('No se ha podido guardar. Comprueba la conexión e inténtalo de nuevo.',true);}
}
function showMessage(text,error=false,success=false){saveMessage.textContent=text;saveMessage.className=`form-message${error?' error':''}${success?' success':''}`;}
async function loadDrafts(){
  const snapshot=await getDocs(collection(db,'articles'));const items=snapshot.docs.map(item=>({id:item.id,...item.data()})).sort((a,b)=>(b.updatedAt?.seconds||0)-(a.updatedAt?.seconds||0));
  $('#draftList').innerHTML=items.length?items.map(item=>`<div class="draft-item" data-id="${item.id}"><button class="draft-main" type="button" title="Abrir noticia"><strong>${escapeHtml(item.title)}</strong><span>${item.status==='published'?'Publicada':'Borrador'} · ${escapeHtml(item.category||'')}</span></button><div class="draft-actions"><button class="draft-edit" type="button" title="Editar noticia" aria-label="Editar ${escapeHtml(item.title)}">✎</button><button class="draft-delete" type="button" title="Eliminar noticia" aria-label="Eliminar ${escapeHtml(item.title)}">×</button></div></div>`).join(''):'<p>Aún no hay noticias.</p>';
  document.querySelectorAll('.draft-item').forEach(item=>{
    item.querySelector('.draft-main').addEventListener('click',()=>loadArticle(item.dataset.id));
    item.querySelector('.draft-edit').addEventListener('click',()=>loadArticle(item.dataset.id));
    item.querySelector('.draft-delete').addEventListener('click',()=>deleteArticle(item.dataset.id));
  });
}
async function loadArticle(id){const snapshot=await getDoc(doc(db,'articles',id));if(!snapshot.exists())return;const item=snapshot.data();$('#docId').value=id;$('#title').value=item.title||'';$('#summary').value=item.summary||'';$('#author').value=item.author||'';$('#category').value=item.category||'Colegio';$('#bodyEditor').innerHTML=item.bodyHtml||'';currentImageData=item.imageDataUrl||'';$('#image').value='';if(currentImageData){$('#imagePreview').style.backgroundImage=`url("${currentImageData}")`;$('#imagePreview').classList.remove('hidden');}else $('#imagePreview').classList.add('hidden');$('#deleteBtn').classList.remove('hidden');$('#unpublishBtn').classList.toggle('hidden',item.status!=='published');showMessage('');window.scrollTo({top:0,behavior:'smooth'});}
async function unpublishCurrent(){
  const id=$('#docId').value;if(!id)return;
  try{await setDoc(doc(db,'articles',id),{status:'draft',updatedAt:serverTimestamp()},{merge:true});showMessage('La noticia se ha despublicado y permanece guardada como borrador.',false,true);$('#unpublishBtn').classList.add('hidden');await loadDrafts();}
  catch(error){console.error(error);showMessage('No se ha podido despublicar la noticia.',true);}
}
async function deleteArticle(id){
  if(!id||!confirm('¿Seguro que quieres eliminar esta noticia? Esta acción no se puede deshacer.'))return;
  try{await deleteDoc(doc(db,'articles',id));if($('#docId').value===id)clearForm();showMessage('Noticia eliminada.',false,true);await loadDrafts();}
  catch(error){console.error(error);showMessage('No se ha podido eliminar la noticia.',true);}
}
function clearForm(){$('#articleForm').reset();$('#docId').value='';$('#bodyEditor').innerHTML='';$('#imagePreview').classList.add('hidden');$('#deleteBtn').classList.add('hidden');$('#unpublishBtn').classList.add('hidden');currentImageData='';showMessage('');}
function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
