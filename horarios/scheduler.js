/* Search runs against a private snapshot. The same functions are serialized into
   a worker, so main-thread validation and background validation cannot diverge. */
function seededRandom(seed){let n=2166136261;for(const c of String(seed)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
async function searchSnapshot(project,budgetMs,seed,progress=()=>{},cancelled=()=>false,maxAttempts=Infinity){
  state=clone(project);syncLessons();
  const random=seededRandom(seed),start=performance.now();let lastYield=start,attempt=0;
  const snapshot=()=>state.lessons.map(l=>[l.id,l.day,l.slot,l.room,l.locked]);
  const apply=pos=>{const byId=new Map(pos.map(p=>[p[0],p]));for(const l of state.lessons){const p=byId.get(l.id);if(p)[,l.day,l.slot,l.room,l.locked]=p;}};
  const evaluate=()=>{const occ=buildOcc();return {u:state.lessons.filter(l=>l.day==null).length,issues:allIssues().size,q:quality(occ),pos:snapshot()};};
  const better=(a,b)=>a.issues<b.issues||(a.issues===b.issues&&(a.u<b.u||(a.u===b.u&&a.q<b.q)));
  let best=evaluate();progress({...best,pos:undefined,attempts:0});
  const fixed=state.lessons.filter(l=>l.locked), movable=state.lessons.filter(l=>!l.locked);
  const initialPositions=snapshot();for(const l of movable)l.day=l.slot=l.room=null;
  const fixedIssues=allIssues();const fixedProblems=fixed.filter(l=>l.day==null||fixedIssues.has(l.id));apply(initialPositions);
  if(fixedProblems.length)return {...best,blocked:true,attempts:0,ms:performance.now()-start,seed};
  const hardness=new Map(movable.map(l=>{const a=IX.A.get(l.actId);let n=0;for(const[t,id]of IX.res.get(a.id))n+=Object.values(IX[t].get(id).av).filter(v=>v===2).length;for(const id of subjIds(a))n+=Object.values(IX.S.get(id)?.av||{}).filter(v=>v===2).length;return [l.id,a.dur*4+IX.res.get(a.id).length*1.5+n*.15+(a.roomIds.length===1?1.5:0)];}));
  while(movable.length&&attempt<maxAttempts&&performance.now()-start<budgetMs&&!cancelled()){
    attempt++;
    // The current valid timetable remains the incumbent. Alternate partial
    // repairs of it with fresh starts to avoid losing good manual adjustments.
    apply(best.pos);
    for(const l of movable)if(attempt%3===0||l.day==null||random()<.3){l.day=l.slot=l.room=null;}
    const occ=buildOcc(),evictions=new Map(),noise=new Map(movable.map(l=>[l.id,hardness.get(l.id)+random()*3]));
    let queue=movable.filter(l=>l.day==null),iterations=0;
    while(queue.length&&iterations++<movable.length*40+300){
      if(performance.now()-lastYield>12){progress({u:best.u,issues:best.issues,q:best.q,attempts:attempt,ms:performance.now()-start});await sleep(0);lastYield=performance.now();if(cancelled()||performance.now()-start>=budgetMs)break;}
      queue.sort((a,b)=>(noise.get(b.id)+(evictions.get(b.id)||0)*2)-(noise.get(a.id)+(evictions.get(a.id)||0)*2));
      const l=queue.shift(),a=IX.A.get(l.actId);let candidate=null;
      for(let d=0;d<state.days.length;d++)for(let s=0;s<state.slots.length;s++){
        let r=check(l,d,s,occ);if(r.hard)continue;
        const conflicts=[...r.conf].map(id=>IX.L.get(id));if(conflicts.some(x=>x.locked))continue;
        // Remove the whole ejection set before evaluating daily limits and
        // consecutive periods. Restore it before considering the next move.
        const saved=conflicts.map(o=>[o,o.day,o.slot,o.room]);
        for(const[o]of saved){delOcc(occ,o);o.day=o.slot=o.room=null;}
        r=check(l,d,s,occ);
        let cost=Infinity;
        if(!r.hard&&!r.soft.length&&!r.conf.size)cost=saved.reduce((v,[o])=>v+100+(evictions.get(o.id)||0)*30,0)+r.pref*8+softCost(a,d,s,occ,l.id)+random()*2.5;
        for(const[o,day,slot,room]of saved){o.day=day;o.slot=slot;o.room=room;addOcc(occ,o);}
        if(cost<Infinity&&(!candidate||cost<candidate.cost))candidate={d,s,cost,room:r.room,conflicts:saved.map(([o])=>o)};
      }
      if(!candidate)continue;
      for(const o of candidate.conflicts){delOcc(occ,o);o.day=o.slot=o.room=null;evictions.set(o.id,(evictions.get(o.id)||0)+1);if(!queue.includes(o))queue.push(o);}
      Object.assign(l,{day:candidate.d,slot:candidate.s,room:candidate.room});addOcc(occ,l);
    }
    const result=evaluate();if(better(result,best)){best=result;progress({...best,attempts:attempt,ms:performance.now()-start});}
    if(best.u===0&&best.issues===0&&best.q===0)break;
    await sleep(0);
  }
  apply(best.pos);return {...best,attempts:attempt,ms:performance.now()-start,seed,cancelled:cancelled()};
}
let searchWorker=null,searchCancel=false,searchLatest=null;
function workerSource(){
  const functions=[originalBlank,allTeachers,subjIds,originalBuildIndex,groupLeaves,buildIndex,syncLessons,resL,nm,aName,actLabel,buildOcc,addOcc,delOcc,busy,dayLoad,originalCheck,activityIssues,groupSize,roomFits,check,softCost,dur1,allIssues,gapsOf,teacherWarnings,quality,dayName,seededRandom,searchSnapshot,timeMinutes,groupConstraints,groupBusy,inheritedGroupIssues,occupancyResources];
  // Explicit bindings preserve overridden function dependencies inside the worker.
  const names=['originalBlank','allTeachers','subjIds','originalBuildIndex','groupLeaves','buildIndex','syncLessons','resL','nm','aName','actLabel','buildOcc','addOcc','delOcc','busy','dayLoad','originalCheck','activityIssues','groupSize','roomFits','check','softCost','dur1','allIssues','gapsOf','teacherWarnings','quality','dayName','seededRandom','searchSnapshot','timeMinutes','groupConstraints','groupBusy','inheritedGroupIssues','occupancyResources'];
  return 'let state,IX;const COLL='+JSON.stringify(COLL)+';const TYPES='+JSON.stringify(TYPES)+';const clone=x=>JSON.parse(JSON.stringify(x));const uid=()=>crypto.randomUUID();const sleep=ms=>new Promise(r=>setTimeout(r,ms));\n'+functions.map((fn,i)=>'const '+names[i]+'='+fn.toString()+';').join('\n')+'\nonmessage=async e=>{try{const r=await searchSnapshot(e.data.project,e.data.budget,e.data.seed,p=>postMessage({type:"progress",data:p}));postMessage({type:"done",data:r});}catch(e){postMessage({type:"error",message:e.message});}};';
}
function searchLock(active){document.body.classList.toggle('is-solving',active);const btn=$('#cancelSolve');if(btn)btn.hidden=!active;const status=$('#genMsg');if(status)status.textContent=active?'Buscando el mejor horario…':'';}
cancelSolve=function(){searchCancel=true;if(searchWorker){searchWorker.terminate();searchWorker=null;searchFinish?.({...searchLatest,cancelled:true});}};
let searchFinish=null;
solve=async function(budgetMs,seed='maxhorario'){
  if(solving)throw Error('Ya hay una búsqueda en marcha');
  const bad=frameIssues();if(bad.length)throw Error(bad[0]);validateProject(state);
  const data=clone(state),before=JSON.stringify(state);solving=true;searchCancel=false;
  searchLatest={pos:state.lessons.map(l=>[l.id,l.day,l.slot,l.room,l.locked]),u:state.lessons.filter(l=>l.day==null).length,issues:allIssues().size,q:quality(buildOcc()),attempts:0,ms:0,seed};
  searchLock(true);
  try{
    let result;
    const report=p=>{searchLatest={...searchLatest,...p,pos:p.pos||searchLatest.pos};const el=$('#genMsg');if(el)el.textContent='Intento '+(p.attempts||0)+' · mejor: '+p.u+' sin colocar · '+p.issues+' conflictos';const bar=$('#genProg div');if(bar)bar.style.width=Math.min(100,(p.ms||0)/budgetMs*100)+'%';};
    if(typeof Worker!=='undefined'){
      result=await new Promise((resolve,reject)=>{
        const url=URL.createObjectURL(new Blob([workerSource()],{type:'text/javascript'}));
        try{searchWorker=new Worker(url);}catch(e){URL.revokeObjectURL(url);reject(Error('No se pudo iniciar el motor en segundo plano: '+e.message));return;}
        searchFinish=resolve;
        searchWorker.onmessage=e=>{if(e.data.type==='progress')report(e.data.data);else if(e.data.type==='done')resolve(e.data.data);else reject(Error(e.data.message));};
        searchWorker.onerror=e=>reject(Error('Error del motor: '+e.message));
        searchWorker.postMessage({project:data,budget:budgetMs,seed});URL.revokeObjectURL(url);
      });
    }else{
      // Compatibility fallback still restores the original project on failure.
      result=await searchSnapshot(data,budgetMs,seed,report,()=>searchCancel);
    }
    state=JSON.parse(before);syncLessons();const positions=new Map(result.pos.map(p=>[p[0],p]));
    for(const l of state.lessons){const p=positions.get(l.id);if(p)[,l.day,l.slot,l.room,l.locked]=p;}
    syncLessons();result.u=state.lessons.filter(l=>l.day==null).length;result.issues=allIssues().size;result.total=state.lessons.length;
    if(result.blocked)toast('Corrige o desfija las sesiones fijadas que tienen conflictos');
    history.push(before);if(history.length>100)history.shift();future=[];save();return result;
  }catch(e){state=JSON.parse(before);syncLessons();throw e;}
  finally{if(searchWorker)searchWorker.terminate();searchWorker=null;searchFinish=null;solving=false;searchLock(false);}
};

