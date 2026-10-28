/* Guided setup and configurable project templates. */
let setupDraft=null;
function initialSetupDraft(mode='center'){
  const center=state.etapa||'primaria';
  return {mode,center,region:state.region||'',stages:state.educationStages?.length?state.educationStages.slice():[center==='primaria'?'primaria':'eso'],modalities:state.bachModalities?.slice()||['ciencias'],regionalLanguage:state.regionalLanguage??true,optionalLanguages:false,religion:true,selected:null,name:state.name==='Mi centro'?'':state.name,teacherCount:12,groupCount:6,extraRooms:0,students:25,teacherNames:'',groupNames:'',customSubjects:'',createRooms:true};
}
function regionOptions(value){return '<option value="">Selecciona tu comunidad o ciudad autónoma…</option>'+REGIONS.map(r=>`<option value="${r.id}" ${value===r.id?'selected':''}>${esc(r.name)}</option>`).join('');}
function chooseEtapa(first){if(solving)return toast('Detén primero la búsqueda');setupDraft=initialSetupDraft('center');renderSetup();}
function templateModal(){if(solving)return toast('Detén primero la búsqueda');setupDraft=initialSetupDraft('template');renderSetup();}
function readSetupDraft(){
  if(!setupDraft)return;
  const read=id=>$('#'+id)?.value;
  if($('#setupRegion'))setupDraft.region=read('setupRegion');
  if($('#setupLanguage'))setupDraft.regionalLanguage=$('#setupLanguage').checked;
  if($('#setupOptionalLanguages'))setupDraft.optionalLanguages=$('#setupOptionalLanguages').checked;
  if($('#setupReligion'))setupDraft.religion=$('#setupReligion').checked;
  if($('#setupName')){
    setupDraft.name=read('setupName');
    for(const [key,id]of Object.entries({teacherCount:'tplTeachers',groupCount:'tplGroups',extraRooms:'tplRooms',students:'tplStudents',teacherNames:'tplTeacherNames',groupNames:'tplGroupNames',customSubjects:'tplCustomSubjects'}))setupDraft[key]=read(id);
    setupDraft.createRooms=$('#tplCreateRooms').checked;
  }
}
function setupCenter(center){readSetupDraft();if(setupDraft.center!==center){setupDraft.center=center;setupDraft.stages=[center==='primaria'?'primaria':'eso'];delete setupDraft.splitScience;delete setupDraft.splitArts;setupDraft.selected=null;}renderSetup();}
function setEtapa(center){if(!setupDraft)setupDraft=initialSetupDraft();setupCenter(center);}
function setupStage(stage,on){readSetupDraft();setupDraft.stages=on?[...new Set([...setupDraft.stages,stage])]:setupDraft.stages.filter(s=>s!==stage);setupDraft.selected=null;renderSetup();}
function setupModality(modality,on){readSetupDraft();setupDraft.modalities=on?[...new Set([...setupDraft.modalities,modality])]:setupDraft.modalities.filter(m=>m!==modality);setupDraft.selected=null;renderSetup();}
function setupRegion(){readSetupDraft();delete setupDraft.splitScience;delete setupDraft.splitArts;setupDraft.selected=null;renderSetup();}
function setupSplit(key,on){readSetupDraft();setupDraft[key]=on;setupDraft.selected=null;renderSetup();}
function renderSetup(){
  const d=setupDraft,template=d.mode==='template',region=REGIONS.find(r=>r.id===d.region);
  let catalog=null;try{catalog=curriculumCatalog(d);}catch{}
  const stages=Object.entries(EDUCATION_STAGES).filter(([,s])=>s.center===d.center);
  const config=`<div class="setup-progress"><span class="eyebrow">${template?'UNA BASE A TU MEDIDA':'CONFIGURACIÓN DEL CENTRO'}</span><h3>${template?'Crear plantilla':'Colegio o instituto'}</h3><p class="muted">${template?'Prepara tus docentes, clases, aulas y materias. Todos los nombres se pueden editar después.':'Selecciona el tipo de centro y, debajo, su comunidad autónoma para preparar las materias.'}</p></div>
  <div class="choice setup-center"><button class="${d.center==='primaria'?'selected':''}" aria-pressed="${d.center==='primaria'}" onclick="setupCenter('primaria')"><b>Colegio</b><small>Infantil y Primaria</small></button><button class="${d.center==='secundaria'?'selected':''}" aria-pressed="${d.center==='secundaria'}" onclick="setupCenter('secundaria')"><b>Instituto</b><small>ESO, Bachillerato y FP</small></button></div>
  <label class="l" for="setupRegion">Comunidad o ciudad autónoma</label><select id="setupRegion" class="f full" onchange="setupRegion()">${regionOptions(d.region)}</select>
  <label class="l">Etapas que imparte el centro</label><div class="setup-checks">${stages.map(([key,s])=>`<label><input type="checkbox" ${d.stages.includes(key)?'checked':''} onchange="setupStage('${key}',this.checked)"> ${esc(s.name)}</label>`).join('')}</div>
  ${d.stages.includes('bachillerato')?`<label class="l">Modalidades de Bachillerato</label><div class="setup-checks">${Object.entries(BACH_MODALITIES).map(([id,m])=>`<label><input type="checkbox" ${d.modalities.includes(id)?'checked':''} onchange="setupModality('${id}',this.checked)"> ${esc(m.name)}</label>`).join('')}</div>`:''}
  ${region?.languageConditional?`<label class="setup-option"><input type="checkbox" id="setupLanguage" ${d.regionalLanguage?'checked':''} onchange="readSetupDraft();setupDraft.selected=null;renderSetup()"> Incluir ${esc(region.language)} (según modelo lingüístico)</label>`:''}
  ${region?.optionalLanguages?.length?`<label class="setup-option"><input type="checkbox" id="setupOptionalLanguages" ${d.optionalLanguages?'checked':''} onchange="readSetupDraft();setupDraft.selected=null;renderSetup()"> Incluir lenguas propias opcionales o de zona</label>`:''}
  ${d.stages.includes('primaria')?`<details class="setup-details"><summary>Organización de las áreas de Primaria</summary><p class="help">Se propone la organización contrastada para tu comunidad. Puedes adaptarla a tu centro.</p><label><input type="checkbox" ${d.splitScience??!!region?.splitScience?'checked':''} onchange="setupSplit('splitScience',this.checked)"> Desdoblar Conocimiento del Medio en Naturales y Sociales</label><label><input type="checkbox" ${d.splitArts??!!region?.splitArts?'checked':''} onchange="setupSplit('splitArts',this.checked)"> Desdoblar Educación Artística en Plástica y Música</label></details>`:''}
  ${d.stages.some(s=>s!=='fp'&&s!=='infantil')?`<label class="setup-option"><input type="checkbox" id="setupReligion" ${d.religion?'checked':''} onchange="readSetupDraft();setupDraft.selected=null;renderSetup()"> Preparar Religión y Atención Educativa (según oferta y elección)</label>`:''}`;
  const counts=template?`<div class="setup-section"><h4>Tu plantilla</h4><label class="l" for="setupName">Nombre del centro</label><input id="setupName" class="f full" placeholder="Mi centro" value="${esc(d.name)}" onchange="readSetupDraft()"><div class="setup-grid"><label>Docentes<input class="f" id="tplTeachers" type="number" min="1" max="500" step="1" value="${esc(d.teacherCount)}" onchange="readSetupDraft()"></label><label>Clases / grupos<input class="f" id="tplGroups" type="number" min="1" max="300" step="1" value="${esc(d.groupCount)}" onchange="readSetupDraft()"></label><label>Aulas adicionales<input class="f" id="tplRooms" type="number" min="0" max="100" step="1" value="${esc(d.extraRooms)}" onchange="readSetupDraft()"></label><label>Alumnos por clase<input class="f" id="tplStudents" type="number" min="0" max="200" step="1" value="${esc(d.students)}" onchange="readSetupDraft()"></label></div><label class="setup-option"><input id="tplCreateRooms" type="checkbox" ${d.createRooms?'checked':''} onchange="readSetupDraft()"> Crear un aula de referencia por clase</label><details class="setup-details"><summary>Usar mis nombres y añadir materias</summary><p class="help">Un nombre por línea. Las posiciones vacías se completan como Docente 1, Docente 2… y con nombres de clase por nivel.</p><div class="setup-names"><label>Docentes<textarea class="f" id="tplTeacherNames" rows="4" onchange="readSetupDraft()">${esc(d.teacherNames)}</textarea></label><label>Clases<textarea class="f" id="tplGroupNames" rows="4" onchange="readSetupDraft()">${esc(d.groupNames)}</textarea></label></div><label class="l" for="tplCustomSubjects">Otras materias o módulos de FP (uno por línea)</label><textarea class="f full" id="tplCustomSubjects" rows="3" onchange="readSetupDraft()">${esc(d.customSubjects)}</textarea></details><p class="help">La plantilla prepara la estructura. La carga semanal y el reparto del profesorado se definen en Actividades; no se asignan horas oficiales ni especialidades por suposición.</p></div>`:'';
  const preview=catalog?`<div class="setup-section"><h4>Materias que se van a cargar <span class="muted">(${catalog.items.length})</span></h4><p class="help">Catálogo de las etapas seleccionadas: incluye áreas de distintos cursos y opciones. Desmarca lo que no ofrezca tu centro.</p><div class="curriculum-list">${catalog.items.map(item=>`<label><input type="checkbox" ${!d.selected||d.selected.includes(item.key)?'checked':''} data-curriculum-key="${esc(item.key)}" onchange="toggleSetupSubject(this.dataset.curriculumKey,this.checked)"><span>${esc(item.name)}<small>${esc(item.kind)}</small></span></label>`).join('')}</div>${catalog.notes.map(n=>`<p class="help curriculum-note">${esc(n)}</p>`).join('')}<details class="setup-details"><summary>Fuentes oficiales y alcance del catálogo</summary><p class="help">Base estatal de las etapas y variantes autonómicas contrastadas. Las denominaciones no equivalen a una distribución oficial de horas. Catálogo preparado el ${CURRICULUM_VERSION}.</p>${catalog.sources.map(s=>`<p class="help"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></p>`).join('')}</details></div>`:'<p class="setup-placeholder">Elige comunidad y al menos una etapa para ver las materias.</p>';
  openModal(config+counts+preview+`<div class="setup-notice"><b>Datos de partida, pendientes de revisión</b><p>${esc(CURRICULUM_WARNING)}</p></div><div class="mfoot"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn pri" ${catalog?'':'disabled'} onclick="applySetup()">${template?'Crear plantilla':'Cargar materias y continuar'}</button></div>`);
}
function toggleSetupSubject(key,checked){if(!setupDraft.selected)setupDraft.selected=curriculumCatalog(setupDraft).items.map(i=>i.key);setupDraft.selected=checked?[...new Set([...setupDraft.selected,key])]:setupDraft.selected.filter(k=>k!==key);}
function selectedCurriculum(config){const catalog=curriculumCatalog(config);if(config.selected)catalog.items=catalog.items.filter(i=>config.selected.includes(i.key));return catalog;}
function mergeCurriculum(project,config){
  const catalog=selectedCurriculum(config);let added=0;
  const existing=new Set(project.subjects.map(s=>curriculumKey(s.name)));
  for(const item of catalog.items)if(!existing.has(item.key)){project.subjects.push({id:uid(),name:item.name,short:item.name.split(/\s+/).map(w=>w[0]).join('').slice(0,7).toUpperCase(),color:PALETTE[project.subjects.length%PALETTE.length],av:{},curriculum:{region:config.region,stages:item.stages,kind:item.kind,sources:item.sources,version:catalog.version}});existing.add(item.key);added++;}
  project.region=config.region;project.educationStages=config.stages.slice();project.bachModalities=config.modalities?.slice()||[];project.regionalLanguage=!!config.regionalLanguage;
  project.curriculum={version:catalog.version,sources:catalog.sources,notes:catalog.notes,reviewRequired:true,warning:CURRICULUM_WARNING};return added;
}
function validateTemplateCounts(config){
  for(const [key,label,min,max]of [['teacherCount','docentes',1,500],['groupCount','clases',1,300],['extraRooms','aulas adicionales',0,100],['students','alumnos por clase',0,200]]){const value=Number(config[key]);if(!Number.isSafeInteger(value)||value<min||value>max)throw Error('Indica '+label+' como número entero entre '+min+' y '+max);}
}
function templateLetter(index){let result='';do{result=String.fromCharCode(65+index%26)+result;index=Math.floor(index/26)-1;}while(index>=0);return result;}
function createTemplateProject(config){
  validateTemplateCounts(config);const catalog=selectedCurriculum(config),project=blank();project.name=config.name?.trim()||'Mi centro';project.etapa=config.center;
  project.slots=ETAPAS[config.center].slots.map(([start,end,r])=>r?{start,end,recreo:true}:{start,end});
  const split=text=>String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean),teacherNames=split(config.teacherNames),groupNames=split(config.groupNames);
  if(teacherNames.length>+config.teacherCount||groupNames.length>+config.groupCount)throw Error('Hay más nombres que docentes o clases. Aumenta la cantidad o reduce la lista.');
  for(let i=0;i<+config.teacherCount;i++)project.teachers.push({id:uid(),name:teacherNames[i]||'Docente '+(i+1),short:'D'+(i+1),dept:'',av:{}});
  const levels=config.stages.flatMap(stage=>EDUCATION_STAGES[stage].levels);
  for(let i=0;i<+config.groupCount;i++){
    const level=levels[i%levels.length],letter=templateLetter(Math.floor(i/levels.length)),[defaultName,short]=groupName(level,letter);
    const group={id:uid(),name:groupNames[i]||defaultName,short,level,studentCount:+config.students,av:{}};
    if(config.createRooms){const room={id:uid(),name:'Aula '+group.name,short:'A'+(i+1),kind:'Aula de referencia',cap:+config.students,av:{}};project.rooms.push(room);group.roomId=room.id;}
    project.groups.push(group);
  }
  for(let i=0;i<+config.extraRooms;i++)project.rooms.push({id:uid(),name:'Aula adicional '+(i+1),short:'EX'+(i+1),kind:'Espacio adicional',av:{}});
  mergeCurriculum(project,config);
  for(const name of split(config.customSubjects))if(!project.subjects.some(s=>curriculumKey(s.name)===curriculumKey(name)))project.subjects.push({id:uid(),name,short:'M'+(project.subjects.length+1),color:PALETTE[project.subjects.length%PALETTE.length],av:{}});
  project.template={createdAt:new Date().toISOString(),teacherCount:+config.teacherCount,groupCount:+config.groupCount};validateProject(project);return project;
}
function setupLoadedMessage(extra=''){
  openModal(`<div class="setup-complete"><span class="complete-icon">✓</span><h3>Tu base ya está preparada</h3><p>${esc(extra)}</p></div><div class="setup-notice" role="alert"><b>Revisión necesaria</b><p>${esc(CURRICULUM_WARNING)}</p></div><div class="mfoot"><button class="btn" onclick="closeModal()">Seguir editando</button><button class="btn pri" onclick="closeModal();go('profesores')">Revisar docentes</button><button class="btn" onclick="closeModal();go('materias')">Revisar materias</button></div>`);
}
function dismissCurriculumNotice(){mutate(()=>{state.curriculum.noticeDismissed=true;});}
function showCurriculumInfo(){const sources=state.curriculum?.sources||[];openModal('<h3>Materias predeterminadas</h3><p>'+esc(CURRICULUM_WARNING)+'</p>'+(state.curriculum?.notes||[]).map(n=>'<p class="help">'+esc(n)+'</p>').join('')+sources.filter(s=>{try{return new URL(s.url).protocol==='https:';}catch{return false;}}).map(s=>'<p><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title)+'</a></p>').join('')+'<div class="mfoot"><button class="btn pri" onclick="closeModal()">Entendido</button></div>');}
function applySetup(){
  if(solving)return toast('Detén primero la búsqueda');readSetupDraft();const config=clone(setupDraft);
  try{
    selectedCurriculum(config);
    if(config.mode==='template'){
      const project=createTemplateProject(config);
      if((state.teachers.length||state.groups.length||state.activities.length||state.subjects.length)&&!confirm('¿Crear una plantilla nueva? Sustituirá el proyecto actual. Se conservará una copia de recuperación y podrás deshacer.'))return;
      recoverSnapshot();detachCloud();if(!mutate(()=>{state=project;}))return;ui.view='inicio';ui.sel=null;ui.hid={};ui.rid={};ui.pick.clear();render();setupLoadedMessage(project.teachers.length+' docentes, '+project.groups.length+' clases, '+project.rooms.length+' aulas y '+project.subjects.length+' materias. Cambia sus nombres y completa la carga semanal.');
    }else{
      const fresh=!state.activities.length&&!state.lessons.some(l=>l.day!=null);
      if(fresh&&state.etapa!==config.center&&Object.values(COLL).some(c=>state[c].some(e=>Object.keys(e.av).length))&&!confirm('Cambiar el tipo de centro reajusta los tramos y borra las disponibilidades marcadas. ¿Continuar?'))return;
      let added=0;
      if(!mutate(()=>{if(fresh&&state.etapa!==config.center){state.slots=ETAPAS[config.center].slots.map(([start,end,r])=>r?{start,end,recreo:true}:{start,end});for(const c of Object.values(COLL))for(const e of state[c])e.av={};}state.etapa=config.center;added=mergeCurriculum(state,config);} ))return;
      setupLoadedMessage('Se han añadido '+added+' materias al catálogo. Los datos y materias que ya tenías se conservan.');
    }
  }catch(e){toast(e.message);}
}
