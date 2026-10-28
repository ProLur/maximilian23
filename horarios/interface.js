const originalOpenModal=openModal;
openModal=function(html){originalOpenModal('<button class="dismiss modal-close" aria-label="Cerrar ventana" onclick="closeModal()">×</button>'+html);};
const originalCloseModal=closeModal;
closeModal=function(){if(!state.etapa){try{const h=JSON.parse(localStorage.getItem(HELP_KEY)||'{}');h['first-visit']=true;localStorage.setItem(HELP_KEY,JSON.stringify(h));}catch{}}originalCloseModal();};
const originalGo=go;
go=function(view){if(solving)return toast('Detén la búsqueda para cambiar de sección');originalGo(view);};
moveTo=function(lid,d,s){
  if(solving)return toast('Detén primero la búsqueda');const lesson=IX.L.get(lid);if(!lesson||lesson.day===d&&lesson.slot===s)return;
  if(lesson.locked&&!confirm('La sesión está fijada. ¿Moverla igualmente?'))return;
  const live=state,occupancy=buildOcc();if(lesson.day!=null)delOcc(occupancy,lesson);const initial=check(lesson,d,s,occupancy);if(initial.hard)return toast(initial.hard);
  const others=[...initial.conf].map(id=>IX.L.get(id));
  let proposal=null;
  if(others.length&&lesson.day!=null&&others.every(o=>!o.locked&&IX.A.get(o.actId).dur===IX.A.get(lesson.actId).dur)){
    try{state=clone(live);buildIndex();const selected=IX.L.get(lid),oldDay=selected.day,oldSlot=selected.slot;selected.day=d;selected.slot=s;selected.room=initial.room;for(const other of others){const o=IX.L.get(other.id);o.day=oldDay;o.slot=oldSlot;o.room=null;}buildIndex();const occ=buildOcc();for(const other of others){const o=IX.L.get(other.id),r=check(o,oldDay,oldSlot,occ);delOcc(occ,o);o.room=r.room;addOcc(occ,o);}if(allIssues().size===0)proposal=clone(state);}finally{state=live;buildIndex();}
  }
  if(proposal){mutate(()=>{state=proposal;});ui.sel=lid;return toast('Sesiones intercambiadas y comprobadas');}
  const messages=[...initial.soft];if(initial.conf.size)messages.push('Choca con '+initial.conf.size+' sesión(es)');
  if(messages.length&&!confirm('Esta posición incumple condiciones:\n• '+[...new Set(messages)].join('\n• ')+'\n\n¿Colocarla de todos modos y marcarla como conflicto?'))return;
  mutate(()=>{const l=state.lessons.find(l=>l.id===lid);Object.assign(l,{day:d,slot:s,room:initial.room});});ui.sel=lid;
};
whyUnplaceable=function(lesson){
  const live=state;try{state=clone(live);for(const l of state.lessons)l.day=l.slot=l.room=null;buildIndex();const l=IX.L.get(lesson.id),reasons=new Map();let free=0;for(let d=0;d<state.days.length;d++)for(let s=0;s<state.slots.length;s++){const r=check(l,d,s,new Map());const messages=r.hard?[r.hard]:r.soft;if(!messages.length)free++;for(const m of messages)reasons.set(m,(reasons.get(m)||0)+1);}return free?null:[...reasons].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([m])=>m);}finally{state=live;buildIndex();}
};
const originalRender=render;
render=function(){originalRender();
  // Keep the main action available even when the welcome card is dismissed.
  if(ui.view==='inicio')$('#view').insertAdjacentHTML('afterbegin','<div class="page-heading"><div><span class="eyebrow">TU CENTRO · TU SEMANA</span><h2>Todo listo para organizarte</h2></div><div class="row"><button class="btn" onclick="recoveryMenu()">Recuperar copia</button><button class="btn pri" onclick="go(\'horario\')">Ver horario →</button></div></div>');
  for(const button of $$('button.iconbtn')){if(!button.textContent.trim())button.textContent='×';if(!button.getAttribute('aria-label'))button.setAttribute('aria-label',button.title||button.textContent.trim()||'Acción');}
  for(const step of $$('.step')){step.setAttribute('role','button');step.setAttribute('tabindex','0');step.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();step.click();}};}
  for(const el of $$('#view > .lead, #view > .help')){const key='intro-'+ui.view;if(helpVisible(key)){el.classList.add('dismissible','intro-help');el.insertAdjacentHTML('afterbegin','<button class="dismiss" aria-label="Cerrar ayuda de esta sección" onclick="dismissHelp(\''+key+'\')">×</button>');}else el.remove();}
  for(const input of $$('input,select,textarea'))if(!input.getAttribute('aria-label')&&!input.id&&!input.closest('label')){const cell=input.closest('td'),table=cell?.closest('table');input.setAttribute('aria-label',table?.querySelectorAll('th')[cell?.cellIndex]?.textContent?.trim()||input.placeholder||'Campo');}
};
function initialize(){
  try{const saved=JSON.parse(localStorage.getItem(CLOUD_KEY)||'{}');cloud.projectId=saved.projectId||null;cloud.remoteVersion=saved.remoteVersion||null;cloud.dirty=!!saved.dirty;}catch{}
  ENT.aulas.cols.push(['cap','Capacidad','number',110]);ENT.grupos.cols.push(['studentCount','Alumnos','number',100],['parentId','Subgrupo de','parent',150]);
  load();render();renderCloud();if(!state.etapa&&helpVisible('first-visit'))chooseEtapa(true);
}
window.addEventListener('beforeunload',e=>{if(localSaveFailed){e.preventDefault();e.returnValue='';}});
