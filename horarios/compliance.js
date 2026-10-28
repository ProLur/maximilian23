/* Regulatory checks use real minutes. A conflict-free timetable is only a draft
   until curriculum, employment conditions and qualifications are reviewed.
   Built-in tables are sourced baselines, not a universal legal certificate. */
const HOURS_SOURCES={murcia:'https://www.borm.es/services/anuncio/ano/2022/numero/5907/pdf?id=813041',extremadura:'https://doe.juntaex.es/pdfs/doe/2022/1510o/22040159C.pdf'};
const MURCIA_HOURS=[
 ['Ciencias de la Naturaleza',[120,120,120,120,90,90]],['Ciencias Sociales',[90,90,90,90,90,90]],
 ['Educación en Valores Cívicos y Éticos',[0,0,0,0,0,90]],['Educación Física',[120,120,120,120,120,120]],
 ['Educación Plástica y Visual',[60,60,60,60,60,60]],['Lengua Castellana y Literatura',[330,330,300,300,270,240]],
 ['Lengua Extranjera',[120,120,180,180,180,180]],['Matemáticas',[300,300,270,270,240,240]],
 ['Música y Danza',[60,60,60,60,60,60]],['Profundización Educativa',[60,60,60,60,60,0]],
 ['Religión / Atención Educativa',[90,90,90,90,90,90]],['Segunda Lengua Extranjera',[0,0,0,0,90,90]]];
// Annex IV is per cycle. This proposed school allocation preserves cycle totals;
// 6th-year Values is not incorrectly divided between 5th and 6th.
const EXTREMADURA_HOURS=[
 ['Conocimiento del Medio Natural, Social y Cultural',[210,210,240,240,270,180]],['Educación Artística',[150,150,150,150,120,120]],
 ['Educación Física',[180,180,150,150,150,150]],['Educación en Valores Cívicos y Éticos',[0,0,0,0,0,90]],
 ['Lengua Castellana y Literatura',[270,270,270,270,270,270]],['Lengua Extranjera',[180,180,180,180,180,180]],
 ['Matemáticas',[240,240,240,240,240,240]],['Religión / Atención Educativa',[90,90,60,60,60,60]],
 ['Segunda Lengua Extranjera / Área transversal',[30,30,60,60,60,60]]];
function regulationContext(g){return JSON.stringify([state.region,state.course,state.ownership,state.etapa,g?.level,state.days,state.slots,state.subjects.map(s=>[s.id,s.name])]);}
function regulatoryStore(){return state.regulatory||{groups:{},teachers:{}};}
function safeOfficialLink(url){try{return new URL(url).protocol==='https:';}catch{return false;}}
function primaryYear(g){return +(String(g.level||'').match(/^([1-6])º Primaria$/)?.[1]||0);}
function normalizedArea(name){const n=curriculumKey(name);if(/^(religion|atencion educativa)/.test(n))return 'religion';if(/segunda lengua extranjera|area.*transversal/.test(n))return 'segunda';if(/^(primera )?lengua extranjera/.test(n))return 'extranjera';if(/ciencias (de la naturaleza|naturales)/.test(n))return 'naturales';if(/educacion plastica/.test(n))return 'plastica';if(/^musica/.test(n))return 'musica';return n;}
function builtInRequirements(g){
 const year=primaryYear(g);if(!year||!HOURS_SOURCES[state.region])return null;
 const table=state.region==='murcia'?MURCIA_HOURS:EXTREMADURA_HOURS;
 return {source:HOURS_SOURCES[state.region],profile:state.region,context:regulationContext(g),reviewed:false,weeklyMinutes:1350,
 rows:table.map(([name,minutes])=>({name,minutes:minutes[year-1],subjectIds:state.subjects.filter(s=>normalizedArea(s.name)===normalizedArea(name)).map(s=>s.id)}))};
}
function manualRequirements(g){return {source:'',profile:'manual',context:regulationContext(g),reviewed:false,weeklyMinutes:primaryYear(g)?1350:null,rows:state.subjects.map(s=>({name:s.name,minutes:0,subjectIds:[s.id]}))};}
function teachingMinutes(l,a){if(l.day==null)return null;let minutes=0;for(let i=l.slot;i<l.slot+a.dur;i++){const s=state.slots[i];if(!s||s.recreo)return null;minutes+=timeMinutes(s.end)-timeMinutes(s.start);}return minutes;}
function complianceReport(){
 const pending=[],errors=[],groups=[],teachers=[],rules=regulatoryStore(),byAct=new Map();
 for(const l of state.lessons){if(!byAct.has(l.actId))byAct.set(l.actId,[]);byAct.get(l.actId).push(l);}
 const put=(list,msg)=>{if(!list.includes(msg))list.push(msg);};
 if(!state.region)pending.push('Selecciona la comunidad autónoma');if(!/^\d{4}-\d{4}$/.test(state.course||'')||+state.course.slice(5)!==+state.course.slice(0,4)+1)pending.push('Indica el curso escolar');if(!['publico','concertado','privado'].includes(state.ownership))pending.push('Indica la titularidad del centro');
 if(!state.groups.length||!state.teachers.length||!state.lessons.length)pending.push('Completa los grupos, docentes y actividades');
 frameIssues().forEach(m=>put(errors,m));
 if(state.lessons.some(l=>l.day==null))pending.push('Quedan sesiones sin colocar: las cargas reales todavía no están completas');
 const durations=state.slots.filter(s=>!s.recreo).map(s=>timeMinutes(s.end)-timeMinutes(s.start)),uniform=durations.length&&new Set(durations).size===1?durations[0]:null;
 for(const g of state.groups){
   const r=rules.groups?.[g.id]||builtInRequirements(g)||manualRequirements(g),rowValues=r.rows.map(row=>({...row,planned:0,placed:0}));let unsupported=false;
   if(!r.reviewed||r.context!==regulationContext(g)||!safeOfficialLink(r.source))put(pending,g.name+': revisa y guarda las horas con su fuente oficial');
   if(!r.rows.length||!(r.weeklyMinutes>0)||r.rows.reduce((n,row)=>n+row.minutes,0)!==r.weeklyMinutes)put(errors,g.name+': las materias no suman el total semanal exigido');
   if(new Set(r.rows.flatMap(row=>row.subjectIds)).size!==r.rows.flatMap(row=>row.subjectIds).length)put(errors,g.name+': una materia está vinculada a dos áreas');
   for(const row of rowValues)if(row.minutes>0&&!row.subjectIds.some(id=>state.subjects.some(s=>s.id===id)))put(pending,g.name+': vincula la materia de '+row.name);
   let pupilTotal=0;
   for(const a of state.activities.filter(a=>a.type==='clase'&&a.groupIds.some(id=>groupsOverlap(id,g.id)))){
     // Parallel options and child-group allocations need an explicit pupil route;
     // summing every option would falsely double the curriculum.
     if(a.parts.length||a.groupIds.some(id=>id!==g.id&&groupsOverlap(id,g.id))){unsupported=true;continue;}
     const row=rowValues.find(row=>row.subjectIds.includes(a.subjectId));
     if(!row){put(errors,g.name+': '+(state.subjects.find(s=>s.id===a.subjectId)?.name||'materia')+' no está en la distribución revisada');continue;}
     if(uniform)row.planned+=a.sessions*a.dur*uniform;
     else put(pending,g.name+': hay tramos de distinta duración; comprueba la carga colocada');
     for(const l of (byAct.get(a.id)||[])){const mins=teachingMinutes(l,a);if(mins!=null){row.placed+=mins;pupilTotal+=mins;}}
   }
   if(unsupported)put(pending,g.name+': desdobles, optativas simultáneas o subgrupos requieren revisar el itinerario de cada alumno');
   for(const row of rowValues){if(uniform&&row.planned!==row.minutes)put(errors,g.name+' · '+row.name+': previstas '+row.planned+' min; exigidas '+row.minutes+' min');if(row.placed!==row.minutes)put(errors,g.name+' · '+row.name+': colocadas '+row.placed+' min; exigidas '+row.minutes+' min');}
   if(['murcia','extremadura'].includes(r.profile)){
     if(!primaryYear(g)||state.region!==r.profile)put(pending,g.name+': perfil curricular incompatible con la comunidad o nivel');
     if(state.days.length!==5||state.slots.reduce((n,s)=>n+timeMinutes(s.end)-timeMinutes(s.start),0)!==300||state.slots.filter(s=>s.recreo).reduce((n,s)=>n+timeMinutes(s.end)-timeMinutes(s.start),0)!==30)put(errors,g.name+': la base de Primaria requiere cinco mañanas de 300 minutos, con 30 de recreo');
     if(r.profile==='murcia'&&durations.some(n=>n<45||n>90))put(errors,'Murcia: el marco ordinario requiere periodos de 45 a 90 minutos; los apoyos excepcionales necesitan revisión específica');
     if(r.profile==='extremadura'&&primaryYear(g)!==6&&r.rows.some(row=>/valores/.test(curriculumKey(row.name))&&row.minutes))put(errors,g.name+': Valores Cívicos y Éticos corresponde a sexto, no a este curso');
     if(r.rows.some(row=>row.subjectIds.some(id=>{const subject=state.subjects.find(s=>s.id===id);return subject&&normalizedArea(subject.name)!==normalizedArea(row.name);})))put(pending,g.name+': la correspondencia entre áreas y materias difiere del anexo. Revisa el ámbito o usa una distribución manual documentada');
     if(r.profile==='murcia'){const base=builtInRequirements(g);if(r.rows.length!==base.rows.length||r.rows.some((row,i)=>row.name!==base.rows[i]?.name||row.minutes!==base.rows[i]?.minutes))put(pending,g.name+': has modificado la base del anexo; documenta la excepción mediante distribución manual');}
   }
   groups.push({g,r,rows:rowValues,total:pupilTotal});
 }
 // In Extremadura a per-course change must still preserve both courses of the cycle.
 for(const [cycle,first]of [[1,1],[2,3],[3,5]]){
   const ext=groups.filter(x=>x.r.profile==='extremadura'&&Math.ceil(primaryYear(x.g)/2)===cycle);if(!ext.length)continue;
   const a=ext.filter(x=>primaryYear(x.g)===first),b=ext.filter(x=>primaryYear(x.g)===first+1);
   if(!a.length||!b.length){put(pending,'Extremadura, ciclo '+cycle+': falta la distribución del otro curso para contrastar el anexo IV');continue;}
   const expected=EXTREMADURA_HOURS;
   for(let i=0;i<expected.length;i++){
    const sum=expected[i][1][first-1]+expected[i][1][first];
    if(ext.some(x=>x.r.rows.length!==expected.length||x.r.rows.some((row,j)=>row.name!==expected[j][0])))put(pending,'Extremadura: distribución de ciclo modificada; requiere revisión manual documentada');
    else if(a.some(x=>x.r.rows[i].minutes!==a[0].r.rows[i].minutes)||b.some(x=>x.r.rows[i].minutes!==b[0].r.rows[i].minutes)||a[0].r.rows[i].minutes+b[0].r.rows[i].minutes!==sum)put(errors,'Extremadura, ciclo '+cycle+' · '+expected[i][0]+': no respeta las horas del ciclo');
   }
 }
 for(const t of state.teachers){
   const c=rules.teachers?.[t.id];let minutes=0,periods=0,presence=0,unknown=false;const subjects=new Set();
   for(const a of state.activities.filter(a=>allTeachers(a).includes(t.id))){
     const isTeaching=(c?.teachingTypes||['clase']).includes(a.type);
     if(isTeaching){if(a.teacherIds.includes(t.id)&&a.subjectId)subjects.add(a.subjectId);for(const part of a.parts)if(part.teacherIds?.includes(t.id)&&part.subjectId)subjects.add(part.subjectId);}
     for(const l of (byAct.get(a.id)||[])){const n=teachingMinutes(l,a);if(n==null){unknown=true;continue;}presence+=n;if(isTeaching){minutes+=n;periods+=a.dur;}}
   }
   const load=(c?.unit==='periods'?periods:minutes)+(c?.extraTeaching||0),attendance=presence+(c?.extraPresence||0);
   if(!c||!c.reviewed||c.context!==regulationContext()||!safeOfficialLink(c.source)||!c.qualificationReviewed)put(pending,t.name+': faltan jornada individual, reducciones y habilitaciones revisadas');
   if(c){
     if(!['minutes','periods'].includes(c.unit)||['min','max','presenceMin','presenceMax','extraTeaching','extraPresence'].some(k=>!Number.isFinite(c[k])||c[k]<0)||c.min>c.max||c.presenceMin>c.presenceMax)put(errors,t.name+': límites de jornada incorrectos');
     if(load<c.min||load>c.max)put(errors,t.name+': carga lectiva '+load+' '+(c.unit==='periods'?'periodos':'min')+' fuera de '+c.min+'–'+c.max);
     if(attendance<c.presenceMin||attendance>c.presenceMax)put(errors,t.name+': permanencia '+attendance+' min fuera de '+c.presenceMin+'–'+c.presenceMax);
     if(c.extraPresence<(c.unit==='minutes'?c.extraTeaching:c.extraTeaching*Math.min(...durations)))put(errors,t.name+': la permanencia externa no cubre la docencia externa declarada');
     if([...subjects].some(id=>!c.subjectIds?.includes(id)))put(errors,t.name+': tiene materias sin habilitación confirmada');
   }
   if(unknown)put(pending,t.name+': carga incompleta por sesiones pendientes');
   teachers.push({t,c,minutes,periods,load,presence:attendance});
 }
 if(state.lessons.length&&allIssues().size)put(errors,'El horario contiene conflictos o condiciones incumplidas');
 return {pending,errors,groups,teachers,ok:!pending.length&&!errors.length};
}
function minutesText(n){return Math.floor(n/60)+' h '+(n%60?String(n%60)+' min':'');}
function vNormativa(){
 const report=complianceReport();
 return '<h2>Horas y normativa</h2><p>Comparamos minutos reales por materia y grupo, la jornada individual y las habilitaciones declaradas. Sin estos datos, el horario sigue siendo un borrador. Las reglas guardadas necesitan revisión al cambiar comunidad, curso, materias o marco horario.</p>'+complianceBanner(report)+
 '<div class="card"><h3>1. Centro y curso</h3><div class="setup-grid"><label>Curso escolar<input class="f" id="lawCourse" value="'+esc(state.course)+'"></label><label>Titularidad<select class="f" id="lawOwnership">'+[['','Selecciona…'],['publico','Público'],['concertado','Concertado'],['privado','Privado']].map(([id,n])=>'<option value="'+id+'" '+(state.ownership===id?'selected':'')+'>'+n+'</option>').join('')+'</select></label></div><button class="btn" onclick="saveRegulatoryCentre()">Guardar datos del centro</button><button class="btn" onclick="chooseEtapa(false)">Cambiar comunidad y etapas</button></div>'+
 '<div class="card"><h3>2. Currículo de cada grupo</h3><p class="help">Primaria de Murcia: base del anexo I. Primaria de Extremadura: propuesta de reparto por curso, sujeta a aprobación del centro y comprobación de ambos cursos del ciclo. Para otras etapas y comunidades introduce la distribución y su fuente oficial. Las excepciones y los itinerarios simultáneos requieren revisión específica.</p>'+report.groups.map(x=>'<div class="row"><b class="grow">'+esc(x.g.name)+' · '+esc(x.g.level||'Sin nivel')+'</b><span>'+minutesText(x.total)+' colocados</span><button class="btn" onclick="curriculumHoursModal(\''+x.g.id+'\')">Revisar horas</button><button class="btn" onclick="createCurriculumActivities(\''+x.g.id+'\')">Crear actividades</button><details class="hours-comparison"><summary>Ver comparación por materia</summary><table class="t"><tr><th>Área</th><th>Exigidos (min)</th><th>Previstos (min)</th><th>Colocados (min)</th></tr>'+x.rows.map(row=>'<tr><td>'+esc(row.name)+'</td><td>'+row.minutes+'</td><td>'+row.planned+'</td><td>'+row.placed+'</td></tr>').join('')+'</table></details></div>').join('')+'</div>'+
 '<div class="card"><h3>3. Jornada de cada docente</h3><p class="help">No se aplica un máximo nacional por suposición. Indica los límites que correspondan a su contrato, comunidad, especialidad y reducciones. Las horas de reloj y los periodos lectivos son unidades diferentes. Incluye el trabajo fuera de esta rejilla cuando corresponda.</p>'+report.teachers.map(x=>'<div class="row"><b class="grow">'+esc(x.t.name)+'</b><span>'+minutesText(x.minutes)+' lectivos · '+x.periods+' periodos · '+minutesText(x.presence)+' permanencia</span><button class="btn" onclick="teacherHoursModal(\''+x.t.id+'\')">Revisar jornada</button></div>').join('')+'</div>'+
 '<div class="card"><h3>Qué queda por resolver</h3>'+(!report.errors.length&&!report.pending.length?'<p>Las comprobaciones configuradas están superadas. La dirección debe validar la normativa aplicable y los datos declarados antes de aprobar el horario.</p>':'<ul>'+[...report.pending,...report.errors].map(m=>'<li>'+esc(m)+'</li>').join('')+'</ul>')+'</div>';
}
function complianceBanner(report=complianceReport()){return '<div class="setup-notice regulatory-status" role="status"><b>'+(report.ok?'Comprobaciones configuradas superadas':'BORRADOR · comprobación normativa pendiente')+'</b><p>'+(report.ok?'Revisión final del centro necesaria; no es una certificación jurídica automática.':report.pending.length+' revisiones pendientes y '+report.errors.length+' diferencias. Un horario sin solapamientos puede incumplir horas curriculares o jornada.')+'</p><button class="btn noprint" onclick="go(\'normativa\')">Revisar horas y normativa</button></div>';}
function saveRegulatoryCentre(){const course=$('#lawCourse').value.trim(),ownership=$('#lawOwnership').value;if(!/^\d{4}-\d{4}$/.test(course)||+course.slice(5)!==+course.slice(0,4)+1||!['publico','concertado','privado'].includes(ownership))return toast('Selecciona titularidad y un curso válido, por ejemplo 2026-2027');mutate(()=>{state.course=course;state.ownership=ownership;});}
let hoursDraft=null;
function curriculumHoursModal(id){const g=state.groups.find(g=>g.id===id);if(!g)return;hoursDraft={id,rule:clone(regulatoryStore().groups?.[id]||builtInRequirements(g)||manualRequirements(g))};renderHoursDraft();}
function renderHoursDraft(){const {id,rule:r}=hoursDraft,g=state.groups.find(g=>g.id===id);openModal('<h3>Horas semanales · '+esc(g.name)+'</h3><p class="help">Introduce minutos semanales de cada área, no número de sesiones. Vincula las materias que la componen. Religión y Atención son alternativas: no sumes ambas como si cada alumno cursara las dos. Las opciones simultáneas quedan pendientes de revisión por itinerario.</p>'+(r.profile==='extremadura'?'<div class="setup-notice">El anexo IV fija horas por ciclo. Este reparto por curso es una propuesta editable del centro, no un reparto oficial obligatorio.</div>':'')+'<label class="l">Fuente oficial o disposición aplicable (enlace HTTPS)</label><input class="f full" id="hoursSource" value="'+esc(r.source)+'"><label class="l">Total curricular semanal, sin recreo (minutos)</label><input class="f" id="hoursTotal" type="number" min="1" value="'+esc(r.weeklyMinutes??'')+'"><div class="hours-table">'+r.rows.map((row,i)=>'<div class="hours-row"><label>'+esc(row.name)+'<input class="f" id="hoursRow'+i+'" type="number" min="0" step="1" value="'+row.minutes+'" aria-label="Minutos de '+esc(row.name)+'"></label><div class="setup-checks">'+state.subjects.map(s=>'<label><input type="checkbox" data-hours-row="'+i+'" value="'+s.id+'" '+(row.subjectIds.includes(s.id)?'checked':'')+'> '+esc(s.name)+'</label>').join('')+'</div></div>').join('')+'</div><label class="setup-option"><input type="checkbox" id="hoursReviewed"> He contrastado esta distribución, su vigencia y las opciones de este grupo con la normativa y la aprobación del centro.</label><div class="mfoot"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn" onclick="resetHoursDraft()">Cargar base autonómica</button><button class="btn" onclick="manualHoursDraft()">Distribución manual</button><button class="btn pri" onclick="saveCurriculumHours()">Guardar revisión</button></div>');}
function resetHoursDraft(){const g=state.groups.find(g=>g.id===hoursDraft.id),r=builtInRequirements(g);if(!r)return toast('No hay una tabla horaria automática contrastada para este nivel y comunidad. Usa la distribución manual con su fuente oficial.');hoursDraft.rule=r;renderHoursDraft();}
function manualHoursDraft(){hoursDraft.rule=manualRequirements(state.groups.find(g=>g.id===hoursDraft.id));renderHoursDraft();}
function saveCurriculumHours(){
 const g=state.groups.find(g=>g.id===hoursDraft.id),r=clone(hoursDraft.rule);r.source=$('#hoursSource').value.trim();r.weeklyMinutes=Number($('#hoursTotal').value);r.reviewed=$('#hoursReviewed').checked;r.context=regulationContext(g);
 for(let i=0;i<r.rows.length;i++){r.rows[i].minutes=Number($('#hoursRow'+i).value);r.rows[i].subjectIds=$$('input[data-hours-row="'+i+'"]:checked').map(el=>el.value);}
 if(!safeOfficialLink(r.source)||!r.reviewed||!Number.isInteger(r.weeklyMinutes)||r.weeklyMinutes<1||r.rows.some(row=>!Number.isInteger(row.minutes)||row.minutes<0||row.minutes>10080))return toast('Revisa los minutos, la fuente oficial y la casilla de revisión');
 if(r.rows.reduce((n,row)=>n+row.minutes,0)!==r.weeklyMinutes)return toast('Las materias no suman el total semanal indicado');
 if(new Set(r.rows.flatMap(row=>row.subjectIds)).size!==r.rows.flatMap(row=>row.subjectIds).length)return toast('Vincula cada materia a una sola área');
 if(!mutate(()=>{state.regulatory||={groups:{},teachers:{}};state.regulatory.groups[g.id]=r;}))return;closeModal();go('normativa');
}
function createCurriculumActivities(id){
 const g=state.groups.find(g=>g.id===id),r=regulatoryStore().groups?.[id];
 if(!r?.reviewed||r.context!==regulationContext(g))return toast('Revisa y guarda primero las horas de este grupo');
 if(state.activities.some(a=>a.groupIds.some(other=>groupsOverlap(id,other))))return toast('Este grupo ya tiene actividades. Ajusta sus sesiones para evitar duplicarlas');
 const durations=state.slots.filter(s=>!s.recreo).map(s=>timeMinutes(s.end)-timeMinutes(s.start));const duration=durations[0];
 if(!duration||new Set(durations).size!==1||r.rows.some(row=>row.minutes%duration))return toast('Las horas exigidas no se pueden dividir exactamente en estos tramos. Ajusta el marco o crea actividades con duraciones diferentes; no se redondean horas');
 if(r.rows.some(row=>row.minutes>0&&row.subjectIds.length!==1))return toast('Selecciona una materia por área para crear actividades. Las alternativas o ámbitos deben prepararse y revisarse manualmente');
 if(!mutate(()=>{for(const row of r.rows.filter(row=>row.minutes>0))state.activities.push({id:uid(),type:'clase',subjectId:row.subjectIds[0],teacherIds:[],groupIds:[id],roomIds:g.roomId?[g.roomId]:[],parts:[],sessions:row.minutes/duration,dur:1,maxDay:Math.ceil(row.minutes/duration/state.days.length),spread:true});}))return;toast('Actividades creadas con su carga exacta. Asigna docentes habilitados antes de generar');go('actividades');
}
function teacherHoursModal(id){const t=state.teachers.find(t=>t.id===id),c=regulatoryStore().teachers?.[id]||{};openModal('<h3>Jornada · '+esc(t.name)+'</h3><p class="help">Aplica el contrato y las reducciones de esta persona. La permanencia incluye docencia y actividades complementarias; los trabajos externos se añaden solo si no están ya en la rejilla. La revisión incluye cómo computan guardias, reuniones y demás actividades.</p><label class="l">Normativa o convenio aplicable (enlace HTTPS)</label><input class="f full" id="teacherLawSource" value="'+esc(c.source||'')+'"><label class="l">Unidad para la docencia</label><select class="f" id="teacherLawUnit"><option value="minutes">Minutos de reloj semanales</option><option value="periods" '+(c.unit==='periods'?'selected':'')+'>Periodos lectivos semanales (un tramo = un periodo)</option></select><div class="setup-grid">'+[['min','Docencia mínima (unidad elegida)'],['max','Docencia máxima (unidad elegida)'],['presenceMin','Permanencia mínima (minutos)'],['presenceMax','Permanencia máxima (minutos)'],['extraTeaching','Docencia fuera de la rejilla (unidad elegida)'],['extraPresence','Permanencia fuera de la rejilla (minutos)']].map(([key,label])=>'<label>'+label+'<input class="f" id="teacherLaw_'+key+'" type="number" min="0" value="'+esc(c[key]??(key.startsWith('extra')?0:''))+'"></label>').join('')+'</div><label class="l">Tipos que computan como lectivos según la norma aplicable</label><div class="setup-checks">'+Object.entries(TYPES).map(([key,type])=>'<label><input type="checkbox" data-law-type="'+key+'" '+((c.teachingTypes||['clase']).includes(key)?'checked':'')+'> '+type.n+'</label>').join('')+'</div><label class="l">Materias para las que has comprobado su habilitación</label><div class="setup-checks">'+state.subjects.map(s=>'<label><input type="checkbox" data-law-subject="'+s.id+'" '+(c.subjectIds?.includes(s.id)?'checked':'')+'> '+esc(s.name)+'</label>').join('')+'</div><label class="setup-option"><input type="checkbox" id="teacherLawReviewed"> He comprobado contrato, jornada, reducciones, cómputo de periodos y complementarias, y las habilitaciones de esta persona para este curso.</label><div class="mfoot"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn pri" onclick="saveTeacherHours(\''+id+'\')">Guardar revisión</button></div>');}
function saveTeacherHours(id){const c={source:$('#teacherLawSource').value.trim(),unit:$('#teacherLawUnit').value,context:regulationContext(),reviewed:$('#teacherLawReviewed').checked,qualificationReviewed:$('#teacherLawReviewed').checked,subjectIds:$$('input[data-law-subject]:checked').map(el=>el.dataset.lawSubject),teachingTypes:$$('input[data-law-type]:checked').map(el=>el.dataset.lawType)};
 for(const key of ['min','max','presenceMin','presenceMax','extraTeaching','extraPresence']){const value=$('#teacherLaw_'+key).value;c[key]=value.trim()===''?NaN:Number(value);}
 if(!safeOfficialLink(c.source)||!c.reviewed||['min','max','presenceMin','presenceMax','extraTeaching','extraPresence'].some(k=>!Number.isInteger(c[k])||c[k]<0)||c.min>c.max||c.presenceMin>c.presenceMax||!c.teachingTypes.includes('clase'))return toast('Revisa la fuente, todos los límites y la casilla de revisión. La docencia con alumnos debe contar como lectiva');
 if(!mutate(()=>{state.regulatory||={groups:{},teachers:{}};state.regulatory.teachers[id]=c;}))return;closeModal();go('normativa');
}
const renderWithoutCompliance=render;
render=function(){renderWithoutCompliance();if(['inicio','generar','horario','sabana','informes'].includes(ui.view))$('#view').insertAdjacentHTML('afterbegin',complianceBanner());};
const exportCSVReviewed=exportCSV;
exportCSV=function(){const report=complianceReport();if(report.ok)return exportCSVReviewed();openModal('<h3>El horario sigue siendo un borrador</h3><p>Hay cargas curriculares o jornadas pendientes de comprobar. Puedes exportar una copia identificada como borrador.</p><div class="mfoot"><button class="btn" onclick="closeModal();go(\'normativa\')">Revisar horas</button><button class="btn pri" onclick="exportDraftCSV()">Exportar borrador</button></div>');};
function exportDraftCSV(){const standardDownload=download;download=function(name,text,mime){standardDownload(name.replace('.csv','_BORRADOR.csv'),'BORRADOR: comprobación normativa pendiente\r\n'+text,mime);};try{exportCSVReviewed();closeModal();}finally{download=standardDownload;}}
const printReviewed=window.print;
if(printReviewed)window.print=function(){const report=complianceReport();if(!report.ok){toast('Impresión de borrador: hay comprobaciones normativas pendientes');document.body.classList.add('regulatory-draft');}else document.body.classList.remove('regulatory-draft');printReviewed.call(window);};

// The solver cannot repair the wrong number of weekly sessions. Block known
// mismatches before searching; incomplete regulatory profiles remain drafts.
const solveWithRegulatoryReview=solve;
solve=async function(budget,seed){
 const report=complianceReport(),blocking=report.errors.filter(m=>m.includes(': previstas ')&&report.groups.some(x=>x.r.reviewed&&x.r.context===regulationContext(x.g)&&m.startsWith(x.g.name+' · ')));
 const durations=state.slots.filter(s=>!s.recreo).map(s=>timeMinutes(s.end)-timeMinutes(s.start));
 for(const t of state.teachers){const c=regulatoryStore().teachers?.[t.id];if(!c?.reviewed||c.context!==regulationContext())continue;const periods=state.activities.filter(a=>allTeachers(a).includes(t.id)&&c.teachingTypes.includes(a.type)).reduce((n,a)=>n+a.sessions*a.dur,0);const lower=(c.unit==='periods'?periods:periods*Math.min(...durations))+c.extraTeaching;if(lower>c.max)blocking.push(t.name+': la docencia prevista supera su máximo semanal revisado');}
 if(blocking.length)throw Error('Corrige la carga semanal antes de generar: '+blocking.slice(0,3).join('; '));
 return solveWithRegulatoryReview(budget,seed);
};
window.addEventListener('beforeprint',()=>document.body.classList.toggle('regulatory-draft',!complianceReport().ok));
