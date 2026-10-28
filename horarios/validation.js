/* Validation, reproducible background search, safe persistence and accessible help.
   No build step; works from file:// and static hosting. */
'use strict';
const SCHEMA_VERSION = 2;
const BACKUP_KEY = 'maxhorario_recovery';
const HELP_KEY = 'maxhorario_help_v2';
const clone = value => JSON.parse(JSON.stringify(value));
function helpVisible(key) { try { return !JSON.parse(localStorage.getItem(HELP_KEY)||'{}')[key]; } catch { return true; } }
function dismissHelp(key) { try { const h=JSON.parse(localStorage.getItem(HELP_KEY)||'{}'); h[key]=true; localStorage.setItem(HELP_KEY,JSON.stringify(h)); } catch {} render(); }
function showHelp() { localStorage.removeItem(HELP_KEY); render(); toast('Las ayudas vuelven a estar visibles'); }
function timeMinutes(text) { if (!/^\d{2}:\d{2}$/.test(text||'')) return NaN; const [h,m]=text.split(':').map(Number); return h<24 && m<60 ? h*60+m : NaN; }
function frameIssues(project = state) {
  const errors=[];
  if (!project.days.length) errors.push('Añade al menos un día lectivo');
  if (!project.slots.some(s=>!s.recreo)) errors.push('Añade al menos un tramo de clase');
  project.slots.forEach((s,i)=>{
    const start=timeMinutes(s.start), end=timeMinutes(s.end);
    if (!Number.isFinite(start)||!Number.isFinite(end)||start>=end) errors.push('Tramo '+(i+1)+': revisa las horas de inicio y fin');
    if (i && start<timeMinutes(project.slots[i-1].end)) errors.push('Los tramos '+i+' y '+(i+1)+' se solapan o están desordenados');
  });
  return errors;
}
function validateProject(project) {
  const fail=m=>{throw Error('Proyecto inválido: '+m);};
  if (!project || typeof project!=='object' || Array.isArray(project)) fail('se esperaba un objeto');
  for(const k of ['name','course'])if(project[k]!=null&&typeof project[k]!=='string')fail(k+' debe ser texto');
  if (project.schemaVersion!=null && (!Number.isSafeInteger(project.schemaVersion)||project.schemaVersion>SCHEMA_VERSION)) fail('versión de archivo no compatible');
  const arrays=['days','slots','teachers','groups','subjects','rooms','activities','lessons','versions','absences'];
  arrays.forEach(k=>{if(!Array.isArray(project[k])) fail(k+' debe ser una lista'); if(project[k].length>20000)fail('demasiados elementos en '+k);});
  if(project.days.length>7 || project.slots.length>96) fail('máximo 7 días y 96 tramos');
  if(project.days.some(d=>typeof d!=='string'||!d.trim()))fail('hay días sin nombre');
  for(const s of project.slots) if(!s||!Number.isFinite(timeMinutes(s.start))||!Number.isFinite(timeMinutes(s.end)))fail('horas de tramo incorrectas');
  const ids={};
  const validId=id=>typeof id==='string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
  for(const k of arrays.slice(2)){
    ids[k]=new Set();
    for(const e of project[k]){
      if(!e||typeof e!=='object'||!validId(e.id)||ids[k].has(e.id))fail('identificador incorrecto o repetido en '+k);
      ids[k].add(e.id);
      if(['teachers','groups','rooms','subjects'].includes(k)){
        if(typeof e.name!=='string')fail('nombre incorrecto en '+k);
        if(e.color&&!/^#[0-9a-f]{3,8}$/i.test(e.color))fail('color incorrecto');
        if(!e.av||typeof e.av!=='object'||Array.isArray(e.av))fail('disponibilidad incorrecta');
        for(const [key,v] of Object.entries(e.av)){
          const m=/^(\d+)-(\d+)$/.exec(key);
          if(!m||+m[1]>=project.days.length||+m[2]>=project.slots.length||![0,1,2].includes(v))fail('franja de disponibilidad incorrecta');
        }
        for(const f of ['maxDay','minDay','maxConsec','maxGaps','cap','studentCount']) if(e[f]!=null&&e[f]!==''&&(!Number.isSafeInteger(e[f])||e[f]<0||e[f]>100000))fail(f+' debe ser un entero no negativo');
      }
    }
  }
  const refs=(values,k)=>{if(!Array.isArray(values)||new Set(values).size!==values.length||values.some(id=>!ids[k].has(id)))fail('referencias incorrectas a '+k);};
  let total=0;
  for(const a of project.activities){
    if(!TYPES[a.type])fail('tipo de actividad desconocido');
    for(const f of ['sessions','dur','maxDay'])if(!Number.isSafeInteger(a[f])||a[f]<1||a[f]>200)fail(f+' debe ser un entero entre 1 y 200');
    total+=a.sessions;
    refs(a.teacherIds,'teachers');refs(a.groupIds,'groups');refs(a.roomIds,'rooms');
    if(a.subjectId&&!ids.subjects.has(a.subjectId))fail('materia inexistente');
    if(!Array.isArray(a.parts))fail('desdobles incorrectos');
    for(const p of a.parts){refs(p.teacherIds||[],'teachers');if(p.roomId&&!ids.rooms.has(p.roomId))fail('aula de desdoble inexistente');if(p.subjectId&&!ids.subjects.has(p.subjectId))fail('materia de desdoble inexistente');}
  }
  if(total>10000)fail('máximo 10.000 sesiones por proyecto');
  for(const g of project.groups){
    if(g.roomId&&!ids.rooms.has(g.roomId))fail('aula de referencia inexistente');
    const seen=new Set([g.id]);let p=g.parentId;
    while(p){if(!ids.groups.has(p)||seen.has(p))fail('jerarquía de subgrupos incorrecta');seen.add(p);p=project.groups.find(x=>x.id===p).parentId;}
  }
  for(const l of project.lessons){
    if(!ids.activities.has(l.actId))fail('sesión con actividad inexistente');
    if(l.day!=null&&(!Number.isSafeInteger(l.day)||l.day<0||l.day>=project.days.length||!Number.isSafeInteger(l.slot)||l.slot<0||l.slot>=project.slots.length))fail('posición de sesión incorrecta');
    if(l.room&&!ids.rooms.has(l.room))fail('aula de sesión inexistente');
  }
  for(const v of project.versions){if(!v.pos||typeof v.pos!=='object'||Array.isArray(v.pos))fail('copia de horario incorrecta');for(const p of Object.values(v.pos))if(!Array.isArray(p)||p.length<2||p.length>4||(p[0]!=null&&(!Number.isSafeInteger(p[0])||p[0]<0))||(p[1]!=null&&(!Number.isSafeInteger(p[1])||p[1]<0)))fail('posición guardada incorrecta');}
  for(const a of project.absences){if(!/^\d{4}-\d{2}-\d{2}$/.test(a.date)||typeof a.teacherId!=='string'||!a.subs||typeof a.subs!=='object'||Array.isArray(a.subs))fail('ausencia incorrecta');}
  return project;
}
function parseProject(value) {
  const p=clone(value), b=blank();
  if(!p || typeof p!=='object'||Array.isArray(p)||!Array.isArray(p.days)||!Array.isArray(p.slots))throw Error('El archivo no es un proyecto de MaxHorarios');
  if(p.schemaVersion!=null&&p.schemaVersion>SCHEMA_VERSION)throw Error('Este archivo necesita una versión más reciente de MaxHorarios');
  for(const [k,v]of Object.entries(b))if(p[k]==null)p[k]=v;
  for(const k of ['teachers','groups','subjects','rooms']){
    if(!Array.isArray(p[k]))throw Error(k+' debe ser una lista');
    for(const e of p[k]){if(!e||typeof e!=='object')throw Error('Elemento inválido en '+k);e.id??=uid();e.av??={};}
  }
  if(!Array.isArray(p.activities))throw Error('Actividades incorrectas');
  for(const a of p.activities){a.type??='clase';a.teacherIds??=[];a.groupIds??=[];a.parts??=[];a.roomIds??=a.roomId?[a.roomId]:[];delete a.roomId;a.sessions??=1;a.dur??=1;a.maxDay??=1;a.spread??=true;}
  p.projectId ||= uid();p.schemaVersion=SCHEMA_VERSION;
  return validateProject(p);
}
const originalBlank=blank;
blank=function(){return {...originalBlank(),schemaVersion:SCHEMA_VERSION,projectId:uid()};};
const originalBuildIndex=buildIndex;
function groupLeaves(id,seen=new Set()){
  if(seen.has(id))return [];seen.add(id);
  const children=state.groups.filter(g=>g.parentId===id);
  return children.length?children.flatMap(g=>groupLeaves(g.id,new Set(seen))):[id];
}
function groupsOverlap(first,second){const leaves=new Set(groupLeaves(first));return groupLeaves(second).some(id=>leaves.has(id));}
function occupancyResources(l){const resources=resL(l).slice();for(const [type,id]of [...resources])if(type==='G'){let parent=IX.G.get(id)?.parentId;while(parent){resources.push(['G',parent]);parent=IX.G.get(parent)?.parentId;}}const seen=new Set();return resources.filter(([t,id])=>{const key=t+':'+id;if(seen.has(key))return false;seen.add(key);return true;});}
buildIndex=function(){originalBuildIndex();for(const a of state.activities){const resources=IX.res.get(a.id).filter(([t])=>t!=='G');for(const id of a.groupIds)for(const leaf of groupLeaves(id))resources.push(['G',leaf]);const seen=new Set();IX.res.set(a.id,resources.filter(([t,id])=>{const k=t+':'+id;if(seen.has(k))return false;seen.add(k);return true;}));}};
function activityIssues(a, mainRoom) {
  const errors=[], teachers=new Set(a.teacherIds), rooms=new Set(mainRoom?[mainRoom]:[]);
  if(!a.teacherIds.length)errors.push('La actividad necesita un profesor principal');
  if(a.type==='clase'&&(!a.groupIds.length||!a.subjectId))errors.push('La clase necesita grupo y materia');
  for(const p of a.parts){
    if(!p.teacherIds?.length)errors.push('Cada materia simultánea necesita otro profesor');
    for(const id of p.teacherIds||[]){if(teachers.has(id))errors.push('Un profesor no puede impartir dos materias simultáneas');teachers.add(id);}
    if(p.roomId){if(rooms.has(p.roomId))errors.push('Dos materias simultáneas no pueden ocupar la misma aula');rooms.add(p.roomId);}
  }
  if(a.roomIds.length&&a.roomIds.every(id=>a.parts.some(p=>p.roomId===id)))errors.push('Elige un aula principal distinta de las aulas de los desdobles');
  return [...new Set(errors)];
}
function groupSize(id){const g=IX.G.get(id);if(!g)return null;if(g.studentCount!=null&&g.studentCount!=='')return g.studentCount;const children=state.groups.filter(x=>x.parentId===id);if(!children.length)return null;const sizes=children.map(x=>groupSize(x.id));return sizes.every(x=>x!=null)?sizes.reduce((s,n)=>s+n,0):null;}
function roomFits(a,id){const cap=IX.R.get(id)?.cap;if(cap==null||cap==='')return true;const groups=a.groupIds.filter(id=>!a.groupIds.some(other=>other!==id&&groupLeaves(other).includes(id)));const sizes=groups.map(groupSize);return sizes.some(x=>x==null)||sizes.reduce((s,n)=>s+n,0)<=cap;}
function groupConstraints(a){const out=new Set();for(const id of a.groupIds){out.add(id);for(const leaf of groupLeaves(id)){let g=IX.G.get(leaf);while(g){out.add(g.id);g=IX.G.get(g.parentId);}}}return [...out];}
function groupBusy(id,d,s,occ,lid){return groupLeaves(id).some(leaf=>busy(occ,'G:'+leaf+':'+d+':'+s,lid));}
function inheritedGroupIssues(a,l,d,s,occ){const errors=[];for(const id of groupConstraints(a)){const g=IX.G.get(id);for(let k=0;k<a.dur;k++)if(g.av[d+'-'+(s+k)]===2)errors.push(g.name+' no está disponible');if(g.maxDay!=null&&g.maxDay!==''){let load=a.dur;for(let q=0;q<state.slots.length;q++)if((q<s||q>=s+a.dur)&&groupBusy(id,d,q,occ,l.id))load++;if(load>g.maxDay)errors.push(g.name+' supera su máximo diario');}}return [...new Set(errors)];}
const originalCheck=check;
check=function(l,d,s,occ,fixedRoom){
  const a=IX.A.get(l.actId);
  const invalid={hard:'Posición o actividad inválida',soft:[],violations:[],conf:new Set(),pref:0,room:null};
  if(!a||!Number.isSafeInteger(d)||d<0||d>=state.days.length||!Number.isSafeInteger(s)||s<0||s+a.dur>state.slots.length)return invalid;
  if((s>0&&timeMinutes(state.slots[s].start)<timeMinutes(state.slots[s-1].end))||(s+a.dur<state.slots.length&&timeMinutes(state.slots[s+a.dur].start)<timeMinutes(state.slots[s+a.dur-1].end)))return {...invalid,hard:'Hay tramos horarios solapados'};
  for(let k=1;k<a.dur;k++)if(state.slots[s+k-1].end!==state.slots[s+k].start)return {...invalid,hard:'Los tramos de una sesión deben ser contiguos en el tiempo'};
  const r=originalCheck(l,d,s,occ,fixedRoom);
  r.violations=r.soft;
  if(r.hard)return r;
  r.soft.push(...activityIssues(a),...inheritedGroupIssues(a,l,d,s,occ));
  const candidates=a.roomIds.filter(id=>IX.R.has(id));
  if(candidates.length){
    let choices=fixedRoom&&l.room?[l.room]:candidates;
    choices=choices.filter(id=>!a.parts.some(p=>p.roomId===id)&&roomFits(a,id));
    if(!choices.length){r.soft.push('No hay un aula principal con capacidad suficiente y distinta de los desdobles');return r;}
    // Rank alternatives by actual availability and preferences, not just input order.
    const scores=choices.map(id=>{
      const e=IX.R.get(id), conf=new Set();let cost=id===candidates[0]?0:0.3,banned=false;
      for(let k=0;k<a.dur;k++){const v=e.av[d+'-'+(s+k)];if(v===2)banned=true;else if(v===1)cost++;for(const x of occ.get('R:'+id+':'+d+':'+(s+k))||[])if(x!==l.id)conf.add(x);}
      return {id,cost,conf,banned,score:(banned?1e8:0)+[...conf].reduce((v,x)=>v+(IX.L.get(x)?.locked?1e7:100),0)+cost};
    }).sort((a,b)=>a.score-b.score);
    const best=scores[0];
    // Recheck with the selected room so old room conflicts and warnings cannot leak.
    const fresh=originalCheck({...l,room:best.id},d,s,occ,true);
    fresh.violations=fresh.soft;fresh.soft.push(...activityIssues(a,best.id),...inheritedGroupIssues(a,l,d,s,occ));
    fresh.pref+=best.cost-(best.id===candidates[0]?0:0.3);
    return fresh;
  }
  return r;
};
const originalDiagnostics=diagnostics;
diagnostics=function(){const out=originalDiagnostics();frameIssues().forEach(m=>out.push(['bad',esc(m)]));for(const a of state.activities){activityIssues(a).forEach(m=>out.push(['bad',esc(actLabel(a)+': '+m)]));if(a.roomIds.length&&a.roomIds.every(id=>!roomFits(a,id)))out.push(['bad',esc(actLabel(a)+': ninguna aula tiene capacidad suficiente')]);}
  for(const g of state.groups)if(g.studentCount==null)out.push(['warn',esc(g.name)+': indica el número de alumnos para comprobar aforos']);
  return out;};
function recoverSnapshot(p=state){try{const old=JSON.parse(localStorage.getItem(BACKUP_KEY)||'[]');old.unshift({date:new Date().toISOString(),project:p});localStorage.setItem(BACKUP_KEY,JSON.stringify(old.slice(0,3)));}catch{toast('No hay espacio para la copia de recuperación. Descarga el proyecto.');}}
load=function(){try{const raw=localStorage.getItem(KEY);state=raw?parseProject(JSON.parse(raw)):blank();fix();}catch(e){const raw=localStorage.getItem(KEY);try{if(raw)localStorage.setItem(KEY+'_invalid',raw);}catch{}state=blank();fix();setTimeout(()=>toast('No se pudo abrir el guardado local. Se conserva una copia para recuperación: '+e.message),100);}};
save=function(){state.schemaVersion=SCHEMA_VERSION;try{localStorage.setItem(KEY,JSON.stringify(state));localSaveFailed=false;}catch{localSaveFailed=true;toast('No se ha guardado en el navegador. Descarga una copia con Guardar.');}cloudSchedule();};
let localSaveFailed=false;
mutate=function(fn,rerender=true){
  if(solving){toast('Detén la búsqueda antes de modificar el proyecto');return false;}
  const before=JSON.stringify(state);
  try{fn();validateProject(state);syncLessons();}
  catch(e){state=JSON.parse(before);syncLessons();toast(e.message);if(rerender)render();return false;}
  history.push(before);if(history.length>100)history.shift();future=[];
  save();if(rerender)render();else renderNav();return true;
};
function restoreHistory(from,to){if(solving)return toast('Detén primero la búsqueda');if(!from.length)return toast('No hay cambios que recuperar');const p=parseProject(JSON.parse(from[from.length-1]));if(p.projectId!==state.projectId)detachCloud();to.push(JSON.stringify(state));from.pop();state=p;fix();save();ui.sel=null;render();}
undo=()=>restoreHistory(history,future);redo=()=>restoreHistory(future,history);
importJSON=async function(input){const f=input.files?.[0];if(!f)return;try{if(f.size>20*1024*1024)throw Error('El archivo supera 20 MB');const p=parseProject(JSON.parse(await f.text()));if(solving)throw Error('Detén primero la búsqueda');recoverSnapshot();detachCloud();mutate(()=>{state=p;});ui.sel=null;toast('Proyecto abierto: '+f.name);}catch(e){toast('No se pudo abrir: '+e.message);}finally{input.value='';}};
setF=function(c,id,f,val,num,rer){mutate(()=>{const e=state[c].find(x=>x.id===id);const value=num?(val===''?null:Number(val)):val;if(num&&value!=null&&(!Number.isSafeInteger(value)||value<0))throw Error('Introduce un número entero no negativo');e[f]=value;},!!rer);};
function updateSlot(i,field,value){mutate(()=>{state.slots[i][field]=value;const problems=frameIssues();if(problems.length)throw Error(problems[0]);});}
const originalVMarco=vMarco;
vMarco=function(){return originalVMarco().replace(/onchange="mutate\(\(\)=>state.slots\[(\d+)\]\.(start|end)=this.value,false\)"/g,'onchange="updateSlot($1,\'$2\',this.value)"');};
addSlot=function(i){mutate(()=>{const prev=state.slots[i-1],next=state.slots[i];const start=prev?timeMinutes(prev.end):(next?Math.max(0,timeMinutes(next.start)-55):480);const end=next?Math.min(start+55,timeMinutes(next.start)):start+55;if(end<=start||end>=1440)throw Error('No hay espacio entre esos tramos. Ajusta primero sus horas o añade uno al final.');remap('s',s=>s>=i?s+1:s);state.slots.splice(i,0,{start:toHM(start),end:toHM(end)});});};
const originalGenSlots=genSlots;
genSlots=function(){const n=+$('#gN').value,d=+$('#gD').value,r=+$('#gR').value,rd=+$('#gRD').value,start=timeMinutes($('#gS').value);if(![n,d,r,rd].every(Number.isSafeInteger)||n<1||n>48||d<1||rd<1||r<0||r>n||!Number.isFinite(start)||start+n*d+(r>0&&r<n?rd:0)>=1440)return toast('Revisa los tramos: cantidades enteras, duración positiva y jornada dentro del mismo día');originalGenSlots();};
function calendarDay(date){const n=new Date(date+'T12:00').getDay();if(!Number.isFinite(n))return -1;const names=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();return state.days.findIndex(d=>normalize(d)===names[n]);}
function intervalsOverlap(a,b){return a.day===b.day&&a.slot<b.slot+IX.A.get(b.actId).dur&&b.slot<a.slot+IX.A.get(a.actId).dur;}
function canSubstitute(rid,lid,tid){
  const record=state.absences.find(r=>r.id===rid),lesson=IX.L.get(lid),teacher=IX.T.get(tid);if(!record||!lesson||!teacher||lesson.day!==calendarDay(record.date)||!lessonHas(lesson,'T',record.teacherId))return false;
  if(state.absences.some(r=>r.date===record.date&&r.teacherId===tid))return false;
  const occ=buildOcc(),a=IX.A.get(lesson.actId);if(a.type!=='clase')return false;
  for(let k=0;k<a.dur;k++){if(teacher.av[lesson.day+'-'+(lesson.slot+k)]===2)return false;for(const id of occ.get('T:'+tid+':'+lesson.day+':'+(lesson.slot+k))||[])if(IX.A.get(IX.L.get(id).actId).type!=='guardia')return false;}
  for(const other of state.absences.filter(r=>r.date===record.date))for(const [id,t]of Object.entries(other.subs||{}))if(t===tid&&!(id===lid&&other.id===rid)){const l=IX.L.get(id);if(l&&intervalsOverlap(lesson,l))return false;}
  return true;
}
setSub=function(rid,lid,tid){if(tid&&!canSubstitute(rid,lid,tid))return toast('Ese profesor ya está ocupado, ausente o no está disponible durante toda la sesión');mutate(()=>{state.absences.find(r=>r.id===rid).subs[lid]=tid;});};
function substitutionIssues(){const out=[];for(const r of state.absences)for(const [lid,tid]of Object.entries(r.subs||{}))if(tid&&!canSubstitute(r.id,lid,tid))out.push({rid:r.id,lid,tid});return out;}
const originalVGuard=vGuard;
vGuard=function(){const errors=substitutionIssues().filter(x=>state.absences.find(r=>r.id===x.rid)?.date===ui.absDate);return (errors.length?'<div class="alertbox" role="alert">Hay '+errors.length+' sustituciones que ya no son válidas. Vuelve a seleccionar un profesor antes de imprimir.</div>':'')+originalVGuard();};
const originalPrintAbs=printAbs;
printAbs=function(){if(substitutionIssues().some(x=>state.absences.find(r=>r.id===x.rid)?.date===ui.absDate))return toast('Corrige primero las sustituciones incompatibles');originalPrintAbs();};
saveVersion=function(){const name=$('#verName').value.trim()||'Copia '+(state.versions.length+1);mutate(()=>{const snapshot=clone(state);snapshot.versions=[];const pos={};state.lessons.forEach(l=>pos[l.id]=[l.day,l.slot,l.room,l.locked]);state.versions.push({id:uid(),name,date:new Date().toLocaleString('es-ES'),pos,snapshot});});toast('Copia completa guardada');};
restoreVersion=function(id){const v=state.versions.find(v=>v.id===id);if(!v||!confirm('¿Restaurar "'+v.name+'"? Puedes deshacer el cambio.'))return;try{const p=v.snapshot?parseProject(v.snapshot):null;recoverSnapshot();mutate(()=>{if(p){const versions=state.versions;state=p;state.versions=versions;}else state.lessons.forEach(l=>{const pos=v.pos[l.id];if(pos)[l.day,l.slot,l.room,l.locked]=pos;else{l.day=l.slot=l.room=null;l.locked=false;}});});}catch(e){toast(e.message);}};

