/* Drive: keep local recovery snapshots; never silently replace diverging edits.
   Conditional writes use the remote ETag. If Google does not expose an ETag,
   save a new revision file instead of an unsafe blind overwrite. */
let cloudEpoch=0;
const standardRenderCloud=renderCloud;
renderCloud=function(){if(DEMO_MODE){const el=$('#cloud');if(el)el.innerHTML='<span class="demo-badge">Demostración · datos separados</span>';return;}standardRenderCloud();};
const standardCloudSignIn=cloudSignIn;
cloudSignIn=function(){if(DEMO_MODE)return toast('El modo demostración guarda aparte y no se conecta a Drive');standardCloudSignIn();};
function detachCloud(){clearTimeout(cloudTimer);cloudEpoch++;cloud.fileId=null;cloud.fileName='';cloud.syncedAt='';cloud.remoteVersion=null;cloud.projectId=null;cloud.dirty=false;cloud.status='Proyecto local';cloudPersist();renderCloud();}
cloudPersist=function(){try{localStorage.setItem(CLOUD_KEY,JSON.stringify({fileId:cloud.fileId,fileName:cloud.fileName,email:cloud.user?.email||cloud.hint||'',syncedAt:cloud.syncedAt||'',projectId:cloud.projectId||null,remoteVersion:cloud.remoteVersion||null,dirty:cloud.dirty||false}));}catch{}};
async function driveMetadata(id){const response=await gapi(DRIVE+'/'+encodeURIComponent(id)+'?fields=id,name,modifiedTime,version');return {...await response.json(),etag:response.headers?.get('ETag')};}
driveList=async function(){const q=encodeURIComponent("appProperties has { key='maxhorario' and value='1' } and trashed=false");let files=[],page;do{const data=await(await gapi(DRIVE+'?q='+q+'&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,webViewLink),nextPageToken&pageSize=100'+(page?'&pageToken='+encodeURIComponent(page):''))).json();files.push(...(data.files||[]));page=data.nextPageToken;}while(page);return files;};
driveUpdate=async function(id,name,body,meta){
  if(!meta.etag){const f=await driveCreate(name,body);return {...f,createdRevision:true};}
  const response=await gapi(UPLOAD+'/'+encodeURIComponent(id)+'?uploadType=media&fields=id,name,modifiedTime,version',{method:'PATCH',headers:{'Content-Type':'application/json','If-Match':meta.etag},body});
  const f=await response.json();
  if(name!==meta.name){const next=await driveMetadata(id);if(!next.etag)throw Error('No se puede actualizar el nombre de forma segura');await gapi(DRIVE+'/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json','If-Match':next.etag},body:JSON.stringify({name})});}
  return {...f,...await driveMetadata(id)};
};
cloudAfterLogin=async function(){try{cloud.user=await(await gapi('https://www.googleapis.com/oauth2/v3/userinfo')).json();cloud.status='Conectado';renderCloud();if(cloud.fileId&&cloud.projectId&&cloud.projectId!==state.projectId)detachCloud();const files=await driveList(),mine=files.find(f=>f.id===cloud.fileId);if(mine){if(!cloud.syncedAt||mine.modifiedTime!==cloud.syncedAt){recoverSnapshot();cloud.status='Hay otra versión en Drive. Tu copia local está conservada';cloudPersist();renderCloud();await cloudMenu(files);}else if(cloud.dirty)cloudSchedule();}else{detachCloud();await cloudMenu(files);}}catch(e){toast('No se pudo conectar con Drive: '+e.message);}};
cloudOpen=async function(id,name){
  if(solving)return toast('Detén primero la búsqueda');
  if(!confirm('¿Abrir "'+name+'"? Se conservará una copia local de recuperación del proyecto actual.'))return;
  const epoch=cloudEpoch;
  try{const before=JSON.stringify(state),meta=await driveMetadata(id),p=parseProject(await driveGet(id));if(epoch!==cloudEpoch||before!==JSON.stringify(state))throw Error('El proyecto ha cambiado durante la descarga. Vuelve a abrirlo.');recoverSnapshot();detachCloud();mutate(()=>{state=p;});cloud.fileId=id;cloud.fileName=name;cloud.projectId=state.projectId;cloud.syncedAt=meta.modifiedTime;cloud.remoteVersion=meta.version;cloud.dirty=false;clearTimeout(cloudTimer);cloud.status='Abierto desde Drive';cloudPersist();renderCloud();closeModal();go('inicio');}catch(e){toast('No se pudo abrir: '+e.message);}
};
cloudSaveAsNew=async function(){
  if(solving||cloud.saving)return toast('Espera a que termine la operación actual');
  const epoch=cloudEpoch,body=JSON.stringify(state),projectId=state.projectId;
  cloud.saving=true;renderCloud();
  try{const f=await driveCreate(projName(),body);if(epoch!==cloudEpoch||state.projectId!==projectId)return;cloud.fileId=f.id;cloud.fileName=f.name;cloud.projectId=projectId;cloud.syncedAt=f.modifiedTime;cloud.remoteVersion=null;cloud.dirty=JSON.stringify(state)!==body;cloud.status=cloud.dirty?'Cambios pendientes':'Copia guardada en Drive';cloudPersist();closeModal();if(cloud.dirty)cloudSchedule();}
  catch(e){cloud.status='Sin guardar';toast(e.message);}finally{cloud.saving=false;renderCloud();}
};
cloudSchedule=function(){if(!cloud.user||!cloud.fileId)return;if(cloud.projectId&&cloud.projectId!==state.projectId)return detachCloud();cloud.projectId=state.projectId;cloud.dirty=true;cloud.status='Cambios pendientes de subir';cloudPersist();renderCloud();clearTimeout(cloudTimer);cloudTimer=setTimeout(cloudSaveNow,4000);};
cloudSaveNow=async function(){
  if(!cloud.user||!cloud.fileId||!cloud.dirty)return;
  if(solving||cloud.saving){clearTimeout(cloudTimer);cloudTimer=setTimeout(cloudSaveNow,2000);return;}
  const epoch=cloudEpoch,id=cloud.fileId,projectId=state.projectId,body=JSON.stringify(state),name=projName();
  cloud.saving=true;renderCloud();
  try{
    const meta=await driveMetadata(id);
    if(epoch!==cloudEpoch||id!==cloud.fileId||projectId!==state.projectId)return;
    if(!cloud.syncedAt||meta.modifiedTime!==cloud.syncedAt||(cloud.remoteVersion&&meta.version!==cloud.remoteVersion)){recoverSnapshot();throw Error('Drive tiene cambios de otro equipo. Tu copia local se conserva. Abre Drive o guarda como copia nueva.');}
    recoverSnapshot();const f=await driveUpdate(id,name,body,meta);
    if(epoch!==cloudEpoch||id!==cloud.fileId||projectId!==state.projectId)return;
    if(f.createdRevision)cloud.fileId=f.id;
    cloud.fileName=name;cloud.syncedAt=f.modifiedTime;cloud.remoteVersion=f.version||null;cloud.dirty=JSON.stringify(state)!==body;cloud.status=cloud.dirty?'Cambios pendientes':'Guardado en Drive';cloudPersist();if(cloud.dirty)cloudSchedule();
  }catch(e){if(epoch===cloudEpoch){cloud.status='Revisa el guardado en Drive';cloud.dirty=true;cloudPersist();toast(e.message);}}
  finally{cloud.saving=false;renderCloud();}
};
const originalSignOut=cloudSignOut;
cloudSignOut=function(){clearTimeout(cloudTimer);cloudEpoch++;originalSignOut();};
const originalCloudMenu=cloudMenu;
cloudMenu=async function(files){await originalCloudMenu(files);for(const btn of $$('#mbox button[data-drive-id]'))btn.onclick=()=>cloudOpen(btn.dataset.driveId,btn.dataset.driveName);};
function recoveryMenu(){let backups=[];try{backups=JSON.parse(localStorage.getItem(BACKUP_KEY)||'[]');}catch{}openModal('<h3>Copias de recuperación</h3><p>Se conservan las tres últimas copias anteriores a operaciones de Drive o importación.</p>'+backups.map((b,i)=>'<p>'+esc(b.project.name)+' · '+esc(new Date(b.date).toLocaleString('es-ES'))+' <button class="btn" onclick="restoreRecovery('+i+')">Recuperar</button></p>').join('')+(!backups.length?'<p>No hay copias todavía.</p>':''));}
function restoreRecovery(index){try{const p=parseProject(JSON.parse(localStorage.getItem(BACKUP_KEY)||'[]')[index].project);if(solving)throw Error('Detén la búsqueda');recoverSnapshot();detachCloud();mutate(()=>{state=p;});closeModal();}catch(e){toast(e.message);}}
