
// Google solo permite iniciar sesión desde https: si se abre por http en la web, se pasa a https
if (location.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) location.replace('https://' + location.host + location.pathname + location.search + location.hash);
/* =====================================================================
   MaxHorarios — generador y editor de horarios para centros educativos
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => globalThis.crypto?.randomUUID?.() || ('id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
function localDate(date = new Date()) { return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0'); }
const PALETTE = ['#4c6ef5','#f06595','#20c997','#fd7e14','#845ef7','#15aabf','#e64980','#82c91e','#fa5252','#7048e8','#1c7ed6','#fab005','#12b886','#e8590c','#40c057','#be4bdb','#228be6','#94d82d'];
const DEMO_MODE = /(?:\?|&)demo=1(?:&|$)/.test(location.search||'');
const STORAGE_PREFIX = DEMO_MODE ? 'maxhorario_demo' : 'maxhorario';
const KEY = STORAGE_PREFIX + '_v1';
const COLL = {T:'teachers', G:'groups', R:'rooms', S:'subjects'};
const TNAME = {T:'Profesor', G:'Grupo', R:'Aula', S:'Materia'};
const TPLUR = {T:'Profesores', G:'Grupos', R:'Aulas', S:'Materias'};
const TYPES = {
  clase:  {n:'Clase', c:null, d:'Sesión lectiva con alumnos'},
  guardia:{n:'Guardia', c:'#868e96', d:'Guardia del profesorado'},
  reunion:{n:'Reunión', c:'#5c5f66', d:'Reunión de departamento, equipo, CCP…'},
  compl:  {n:'Complementaria', c:'#a5abb6', d:'Atención a familias, biblioteca, coordinación…'}
};

/* tipo de centro: cambia la terminología, los niveles y los tramos por defecto */
const ETAPAS = {
  primaria: {n:'Colegio (Infantil y Primaria)', T:['Maestro/a','Maestros'], G:['Clase','Clases'], oneT:'maestro/a', oneG:'clase',
    levels:['Infantil 3 años','Infantil 4 años','Infantil 5 años','1º Primaria','2º Primaria','3º Primaria','4º Primaria','5º Primaria','6º Primaria'],
    slots:[['09:00','09:45'],['09:45','10:30'],['10:30','11:15'],['11:15','12:00'],['12:00','12:30',1],['12:30','13:15'],['13:15','14:00']]},
  secundaria: {n:'Instituto (ESO, Bachillerato, FP)', T:['Profesor','Profesores'], G:['Grupo','Grupos'], oneT:'profesor', oneG:'grupo',
    levels:['1º ESO','2º ESO','3º ESO','4º ESO','1º Bachillerato','2º Bachillerato','1º FP Básica','2º FP Básica','1º CFGM','2º CFGM','1º CFGS','2º CFGS'],
    slots:[['08:30','09:25'],['09:25','10:20'],['10:20','11:15'],['11:15','11:45',1],['11:45','12:40'],['12:40','13:35'],['13:35','14:30']]}
};
const etapa = () => ETAPAS[state.etapa] || ETAPAS.secundaria;
function applyEtapa(){
  const e = etapa();
  [TNAME.T, TPLUR.T] = e.T; [TNAME.G, TPLUR.G] = e.G;
  ENT.profesores.title = e.T[1]; ENT.profesores.one = e.oneT;
  ENT.grupos.title = e.G[1]; ENT.grupos.one = e.oneG;
}
/* nombre y abreviatura de una clase según nivel y letra */
function groupName(level, L){
  let m;
  if ((m = level.match(/^Infantil (\d) años/))) return [level+' '+L, 'I'+m[1]+L];
  if ((m = level.match(/^(\d)º Primaria/))) return [m[1]+'º '+L, m[1]+'º'+L];
  if ((m = level.match(/^(\d)º ESO/))) return [level+' '+L, m[1]+'E'+L];
  if ((m = level.match(/^(\d)º Bachillerato/))) return [level+' '+L, m[1]+'B'+L];
  m = level.match(/^(\d)º (.*)$/);
  return m ? [level+' '+L, m[1]+m[2].replace(/[^A-Z]/g,'')+L] : [level+' '+L, level.slice(0,3)+L];
}
// Centre and region setup is defined in setup.js.
function levelsModal(){
  const e = etapa();
  openModal(`<h3>Crear ${e.G[1].toLowerCase()} por niveles</h3>
    <p class="muted">Marca los niveles y cuántas líneas (A, B, C…) tiene cada uno.</p>
    <div class="chips" style="max-height:none">${e.levels.map(l => `<label><input type="checkbox" name="lv" value="${esc(l)}">${esc(l)}</label>`).join('')}</div>
    <label class="l">Número de líneas por nivel</label><input class="f" id="lvN" type="number" min="1" max="8" value="2" style="width:90px">
    <label style="display:block;margin-top:10px"><input type="checkbox" id="lvR" checked> Crear también un aula de referencia para cada ${e.oneG}</label>
    <div class="mfoot"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn pri" onclick="doLevels()">Crear</button></div>`);
}
function doLevels(){
  const lv = $$('#mbox input[name=lv]:checked').map(x => x.value), n = Math.min(8, Math.max(1, +$('#lvN').value || 1)), mkRoom = $('#lvR').checked;
  if (!lv.length) return toast('Marca al menos un nivel');
  let c = 0;
  mutate(() => {
    for (const l of lv) for (let i=0; i<n; i++){
      const L = String.fromCharCode(65+i), [name, short] = groupName(l, L);
      if (state.groups.some(g => g.name === name)) continue;
      const g = {id:uid(), name, short, level:l, av:{}};
      if (mkRoom){ const r = {id:uid(), name:'Aula '+name, short:'A'+short, kind:'Aula de referencia', av:{}}; state.rooms.push(r); g.roomId = r.id; }
      state.groups.push(g); c++;
    }
  });
  closeModal(); toast('Añadidos: '+c);
}

let state, IX, history = [], future = [];
let ui = { view:'inicio', ht:'G', hid:{}, sel:null, drag:null, rt:'T', rid:{}, brush:2, fGroup:'', fTeacher:'', st:'G', absDate:localDate(), pick:new Set() };

function currentSchoolCourse(date=new Date()){const year=Number(new Intl.DateTimeFormat('en',{timeZone:'Europe/Madrid',year:'numeric'}).format(date));return year+'-'+(year+1);}
function schoolCourseOptions(value='',date=new Date()){
 const first=+currentSchoolCourse(date).slice(0,4),courses=Array.from({length:6},(_,i)=>(first+i)+'-'+(first+i+1));
 const selected=String(value||courses[0]).replace('/','-');if(!courses.includes(selected))courses.unshift(selected);
 return courses.map(course=>'<option value="'+esc(course)+'" '+(selected===course?'selected':'')+'>'+esc(course.replace('-','/'))+'</option>').join('');
}

/* ---------- datos ---------- */
function blank(){
  return {
    name:'Mi centro', course:currentSchoolCourse(), etapa:null,
    days:['Lunes','Martes','Miércoles','Jueves','Viernes'],
    slots:[
      {start:'08:30',end:'09:25'},{start:'09:25',end:'10:20'},{start:'10:20',end:'11:15'},
      {start:'11:15',end:'11:45',recreo:true},
      {start:'11:45',end:'12:40'},{start:'12:40',end:'13:35'},{start:'13:35',end:'14:30'}
    ],
    teachers:[], groups:[], subjects:[], rooms:[], activities:[], lessons:[], versions:[], absences:[]
  };
}
let load;
/* normaliza datos antiguos o importados */
function fix(){
  const b = blank();
  for (const k in b) if (state[k] == null) state[k] = b[k];
  for (const c of ['teachers','groups','rooms','subjects']) for (const e of state[c]) { if (!e.av) e.av = {}; if (!e.id) e.id = uid(); }
  for (const a of state.activities){
    a.type ||= 'clase'; a.teacherIds ||= []; a.groupIds ||= []; a.parts ||= [];
    if (!a.roomIds){ a.roomIds = a.roomId ? [a.roomId] : []; delete a.roomId; }
    a.sessions ||= 1; a.dur ||= 1; a.maxDay ||= 1; a.spread ??= true;
  }
  syncLessons();
}
let save;
let mutate;
let undo;
let redo;

/* ---------- índices y recursos ---------- */
const allTeachers = a => [...new Set([...a.teacherIds, ...a.parts.flatMap(p => p.teacherIds || [])])];
const subjIds = a => [a.subjectId, ...a.parts.map(p => p.subjectId)].filter(Boolean);
function buildIndex(){
  IX = {T:new Map, G:new Map, R:new Map, S:new Map, A:new Map, L:new Map, byAct:new Map, res:new Map};
  for (const t in COLL) for (const e of state[COLL[t]]) IX[t].set(e.id, e);
  for (const a of state.activities){
    IX.A.set(a.id, a); IX.byAct.set(a.id, []);
    const r = [...allTeachers(a).map(id => ['T',id]), ...a.groupIds.map(id => ['G',id]), ...a.parts.filter(p => p.roomId).map(p => ['R',p.roomId])];
    IX.res.set(a.id, r.filter(([t,id]) => IX[t].has(id)));
  }
  for (const l of state.lessons){ IX.L.set(l.id, l); IX.byAct.get(l.actId)?.push(l); }
}
/* una "lesson" por cada sesión semanal de cada actividad */
function syncLessons(){
  buildIndex();
  const nS = state.slots.length, nD = state.days.length;
  state.lessons = state.lessons.filter(l => IX.A.has(l.actId));
  for (const a of state.activities){
    let ls = state.lessons.filter(l => l.actId === a.id);
    while (ls.length > a.sessions){
      const rm = ls.find(l => l.day == null && !l.locked) || ls.find(l => !l.locked) || ls[ls.length-1];
      state.lessons.splice(state.lessons.indexOf(rm), 1); ls = ls.filter(x => x !== rm);
    }
    while (ls.length < a.sessions){ const l = {id:uid(), actId:a.id, day:null, slot:null, room:null, locked:false}; state.lessons.push(l); ls.push(l); }
  }
  for (const l of state.lessons){
    const a = state.activities.find(x => x.id === l.actId);
    if (l.day == null){ l.room = null; continue; }
    if (l.day >= nD || l.slot + a.dur > nS){ l.day = l.slot = l.room = null; l.locked = false; continue; }
    const cands = a.roomIds.filter(r => state.rooms.some(x => x.id === r));
    if (!cands.length) l.room = null; else if (!cands.includes(l.room)) l.room = cands[0];
  }
  buildIndex();
}
const resL = l => { const r = IX.res.get(l.actId) || []; return l.room && IX.R.has(l.room) ? [...r, ['R', l.room]] : r; };
function lessonHas(l, t, id){
  const a = IX.A.get(l.actId); if (!a) return false;
  if (t === 'T') return allTeachers(a).includes(id);
  if (t === 'G') return a.groupIds.some(g=>groupsOverlap(g,id));
  return l.room === id || (l.day == null && a.roomIds[0] === id) || a.parts.some(p => p.roomId === id);
}
const actHas = (a, t, id) => t === 'T' ? allTeachers(a).includes(id) : t === 'G' ? a.groupIds.some(g=>groupsOverlap(g,id)) : (a.roomIds.includes(id) || a.parts.some(p => p.roomId === id));
const nm = (t, id, short) => { const e = IX[t].get(id); return e ? (short && e.short ? e.short : e.name) : '—'; };
const aName = a => { const s = IX.S.get(a.subjectId); return (s ? s.name : TYPES[a.type].n) + (a.parts.length ? ' / ' + a.parts.map(p => nm('S', p.subjectId)).join(' / ') : ''); };
const aShort = a => { const s = IX.S.get(a.subjectId); return (s ? (s.short || s.name) : TYPES[a.type].n) + (a.parts.length ? '/' + a.parts.map(p => nm('S', p.subjectId, 1)).join('/') : ''); };
const aColor = a => IX.S.get(a.subjectId)?.color || TYPES[a.type].c || '#999';
const actLabel = a => aName(a) + ' · ' + (a.groupIds.map(g => nm('G',g,1)).join(', ') || a.teacherIds.map(t => nm('T',t,1)).join(', ') || '—');
const classSlots = () => state.slots.filter(s => !s.recreo).length;
const dayName = d => state.days[d] || '?';
const slotRange = (s, dur) => state.slots[s].start + '–' + state.slots[s + dur - 1].end;

/* ---------- ocupación y comprobaciones ---------- */
function buildOcc(){ const occ = new Map(); for (const l of state.lessons) if (l.day != null) addOcc(occ, l); return occ; }
function addOcc(occ, l){
  const a = IX.A.get(l.actId); if (!a) return;
  for (const [t,id] of occupancyResources(l)) for (let k=0; k<a.dur; k++){
    const key = t+':'+id+':'+l.day+':'+(l.slot+k); let arr = occ.get(key); if (!arr) occ.set(key, arr = []); arr.push(l.id);
  }
}
function delOcc(occ, l){
  const a = IX.A.get(l.actId); if (!a) return;
  for (const [t,id] of occupancyResources(l)) for (let k=0; k<a.dur; k++){
    const arr = occ.get(t+':'+id+':'+l.day+':'+(l.slot+k)); if (arr){ const i = arr.indexOf(l.id); if (i>=0) arr.splice(i,1); }
  }
}
const busy = (occ, key, lid) => { const arr = occ.get(key); return !!arr && arr.some(x => x !== lid); };
function dayLoad(occ, t, id, d, lid){ let c = 0; for (let q=0; q<state.slots.length; q++) if (busy(occ, t+':'+id+':'+d+':'+q, lid)) c++; return c; }

/* Comprueba colocar la sesión l en (día d, tramo s).
   hard: imposible · soft: condiciones incumplidas · conf: sesiones con las que choca · pref: franjas "mejor no" · room: aula elegida */
function check(l, d, s, occ, fixedRoom){
  const a = IX.A.get(l.actId), dur = a.dur, S = state.slots, r = {hard:null, soft:[], conf:new Set(), pref:0, room:null};
  if (s < 0 || s + dur > S.length){ r.hard = 'No cabe: la sesión ocupa '+dur+' tramos'; return r; }
  for (let k=0; k<dur; k++) if (S[s+k].recreo){ r.hard = 'Coincide con el recreo'; return r; }
  for (const [t,id] of IX.res.get(a.id)){
    const e = IX[t].get(id);
    for (let k=0; k<dur; k++){
      const v = e.av[d+'-'+(s+k)];
      if (v === 2) r.soft.push(e.name+' no está disponible'); else if (v === 1) r.pref++;
      const arr = occ.get(t+':'+id+':'+d+':'+(s+k)); if (arr) for (const x of arr) if (x !== l.id) r.conf.add(x);
    }
    if ((t === 'T' || t === 'G') && e.maxDay != null && e.maxDay !== ''){
      let c = 0; for (let q=0; q<S.length; q++){ if (q>=s && q<s+dur) continue; if (busy(occ, t+':'+id+':'+d+':'+q, l.id)) c++; }
      if (c + dur > e.maxDay) r.soft.push(e.name+' superaría '+e.maxDay+' h ese día');
    }
    if (t === 'T' && e.maxConsec != null && e.maxConsec !== ''){
      let run = 0, mx = 0;
      for (let q=0; q<S.length; q++){
        if (S[q].recreo){ run = 0; continue; }
        if ((q>=s && q<s+dur) || busy(occ, 'T:'+id+':'+d+':'+q, l.id)){ run++; mx = Math.max(mx, run); } else run = 0;
      }
      if (mx > e.maxConsec) r.soft.push(e.name+': más de '+e.maxConsec+' h seguidas');
    }
  }
  for (const sid of subjIds(a)){
    const e = IX.S.get(sid); if (!e) continue;
    for (let k=0; k<dur; k++){ const v = e.av[d+'-'+(s+k)]; if (v === 2) r.soft.push(e.name+': franja no permitida para la materia'); else if (v === 1) r.pref++; }
  }
  // aula: la preferida si está libre; si no, una alternativa libre
  const cands = a.roomIds.filter(id => IX.R.has(id));
  if (cands.length){
    const order = fixedRoom && l.room ? [l.room] : (l.room && cands.includes(l.room) ? [l.room, ...cands.filter(x => x !== l.room)] : cands);
    let pick = null;
    for (const R of order){
      let ok = true; const e = IX.R.get(R);
      for (let k=0; k<dur && ok; k++) if (e.av[d+'-'+(s+k)] === 2 || busy(occ, 'R:'+R+':'+d+':'+(s+k), l.id)) ok = false;
      if (ok){ pick = R; break; }
    }
    if (pick){ r.room = pick; if (pick !== cands[0]) r.pref += 0.3; }
    else {
      const R = order[0], e = IX.R.get(R); r.room = R;
      for (let k=0; k<dur; k++){
        if (e.av[d+'-'+(s+k)] === 2) r.soft.push(e.name+' no está disponible');
        const arr = occ.get('R:'+R+':'+d+':'+(s+k)); if (arr) for (const x of arr) if (x !== l.id) r.conf.add(x);
      }
    }
  }
  let same = 0, near = false;
  for (const o of IX.byAct.get(a.id) || []){ if (o.id === l.id || o.day == null) continue; if (o.day === d) same++; if (Math.abs(o.day - d) === 1) near = true; }
  if (same >= a.maxDay) r.soft.push('Ya hay '+same+' sesión(es) de '+aName(a)+' ese día');
  if (a.spread && near && a.sessions < state.days.length) r.pref += 1;
  return r;
}
/* coste "blando": evita huecos, respeta el día libre y compacta jornadas */
function softCost(a, d, s, occ, lid){
  const S = state.slots; let c = s * 0.1;
  for (const [t,id] of IX.res.get(a.id)){
    if (t === 'R') continue;
    const e = IX[t].get(id);
    const load = dayLoad(occ, t, id, d, lid);
    if (!load){
      if (t === 'T' && e.freeDay){
        let empty = 0; for (let dd=0; dd<state.days.length; dd++) if (!dayLoad(occ, 'T', id, dd, lid)) empty++;
        if (empty <= 1) c += 9;
      }
      if (t === 'T' && e.minDay && dur1(a) < e.minDay) c += 1;
      continue;
    }
    let p = s-1; while (p >= 0 && S[p].recreo) p--;
    let n = s + a.dur; while (n < S.length && S[n].recreo) n++;
    const adj = (p>=0 && busy(occ, t+':'+id+':'+d+':'+p, lid)) || (n<S.length && busy(occ, t+':'+id+':'+d+':'+n, lid));
    if (!adj) c += t === 'G' ? (e.allowGaps ? 1 : 5) : (e.maxGaps === 0 ? 4 : 1.5);
  }
  return c;
}
const dur1 = a => a.dur;
function allIssues(){
  const occ = buildOcc(), out = new Map();
  for (const l of state.lessons){
    if (l.day == null) continue;
    const r = check(l, l.day, l.slot, occ, true), iss = [];
    if (r.hard) iss.push(r.hard);
    iss.push(...r.soft);
    if (r.conf.size) iss.push('Choca con: ' + [...r.conf].map(x => actLabel(IX.A.get(IX.L.get(x).actId))).join(' / '));
    if (iss.length) out.set(l.id, iss);
  }
  return out;
}
function gapsOf(t, id, occ){
  let g = 0; const S = state.slots;
  for (let d=0; d<state.days.length; d++){
    const cls = []; for (let s=0; s<S.length; s++) if (!S[s].recreo) cls.push(busy(occ, t+':'+id+':'+d+':'+s, null));
    const f = cls.indexOf(true), la = cls.lastIndexOf(true);
    if (f >= 0) for (let i=f; i<=la; i++) if (!cls[i]) g++;
  }
  return g;
}
/* avisos de condiciones "blandas" del profesorado */
function teacherWarnings(e, occ){
  const w = [], gaps = gapsOf('T', e.id, occ);
  if (e.maxGaps != null && e.maxGaps !== '' && gaps > e.maxGaps) w.push(gaps+' huecos (máx. '+e.maxGaps+')');
  let free = 0;
  for (let d=0; d<state.days.length; d++){
    const n = dayLoad(occ, 'T', e.id, d, null);
    if (!n) free++; else if (e.minDay && n < e.minDay) w.push(dayName(d)+': solo '+n+' h (mín. '+e.minDay+')');
  }
  if (e.freeDay && !free) w.push('sin día libre');
  return w;
}
function quality(occ){
  let q = 0;
  for (const g of state.groups) q += gapsOf('G', g.id, occ) * (g.allowGaps ? 1 : 4);
  for (const t of state.teachers){ q += gapsOf('T', t.id, occ); q += teacherWarnings(t, occ).length * 6; if (t.maxGaps != null) q += Math.max(0, gapsOf('T', t.id, occ) - t.maxGaps) * 6; }
  for (const l of state.lessons) if (l.day != null) q += check(l, l.day, l.slot, occ, true).pref * 2;
  return q;
}
function hoursOf(t, id, type){ let h = 0; for (const a of state.activities) if (actHas(a,t,id) && (!type || (type === 'clase') === (a.type === 'clase'))) h += a.sessions * a.dur; return h; }
function availOf(t, id){
  const e = IX[t].get(id); let n = 0;
  state.days.forEach((_,d) => state.slots.forEach((sl,s) => { if (!sl.recreo && e.av[d+'-'+s] !== 2) n++; }));
  return n;
}

/* ---------- motor de generación ---------- */
let solving = false;
let solve;
/* depurador: explica por qué una sesión no se puede colocar */
let whyUnplaceable;

/* ---------- utilidades UI ---------- */
let toastT;
function toast(m){ const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2800); }
function openModal(h){ $('#mbox').innerHTML = h; $('#modal').classList.add('on'); const f = $('#mbox input.f, #mbox select.f'); if (f) f.focus(); }
function closeModal(){ $('#modal').classList.remove('on'); }
function go(v){ ui.view = v; ui.sel = null; ui.pick.clear(); render(); $('#view').scrollTop = 0; }
function download(name, text, type){
  const b = new Blob([text], {type}); const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const fname = () => (state.name || 'horario').replace(/[^\wáéíóúñÁÉÍÓÚÑ -]/g,'').trim().replace(/\s+/g,'_');
const toCSV = rows => '\ufeff' + rows.map(r => r.map(c => '"'+String(c ?? '').replace(/"/g,'""')+'"').join(';')).join('\r\n');
function exportJSON(){ download(fname()+'.maxh.json', JSON.stringify(state, null, 1), 'application/json'); toast('Proyecto guardado en Descargas'); }
let importJSON;
function exportCSV(){
  const rows = [['Día','Inicio','Fin','Tipo','Grupo(s)','Materia','Profesor(es)','Aula(s)','Fijada']];
  const ls = state.lessons.filter(l => l.day != null).sort((x,y) => x.day - y.day || x.slot - y.slot);
  for (const l of ls){
    const a = IX.A.get(l.actId);
    const rooms = [l.room, ...a.parts.map(p => p.roomId)].filter(Boolean).map(r => nm('R', r));
    rows.push([dayName(l.day), state.slots[l.slot].start, state.slots[l.slot + a.dur - 1].end, TYPES[a.type].n,
      a.groupIds.map(g => nm('G',g)).join(' + '), aName(a), allTeachers(a).map(t => nm('T',t)).join(' + '), rooms.join(' + '), l.locked ? 'Sí' : '']);
  }
  download(fname()+'_horario.csv', toCSV(rows), 'text/csv'); toast('Exportado para Excel');
}

/* ---------- navegación ---------- */
const VIEWTITLE = {inicio:'Inicio',marco:'Marco horario',profesores:'Profesores',grupos:'Grupos',materias:'Materias',aulas:'Aulas',actividades:'Actividades',privacidad:'Privacidad y cuentas educativas',restricciones:'Condiciones',normativa:'Horas y normativa',generar:'Generar horario',horario:'Horario',sabana:'Horario general',guardias:'Guardias y ausencias',informes:'Informes'};
function steps(){
  const placed = state.lessons.filter(l => l.day != null).length;
  return [
    {v:'marco', n:1, t:'Marco horario', d:'Días lectivos y tramos horarios, con recreos.', done: state.days.length && classSlots()},
    {v:'profesores', n:2, t:'Datos del centro', d:'Profesorado, grupos, materias y aulas.', done: state.teachers.length && state.groups.length && state.subjects.length},
    {v:'actividades', n:3, t:'Actividades', d:'Clases, desdobles, optativas, guardias y reuniones.', done: state.activities.length},
    {v:'restricciones', n:4, t:'Condiciones', d:'Disponibilidad, máximos, huecos, día libre, franjas.', done: [...state.teachers,...state.groups,...state.rooms,...state.subjects].some(e => Object.keys(e.av).length || e.maxDay)},
    {v:'generar', n:5, t:'Generar', d:'El motor coloca todas las sesiones automáticamente.', done: placed && placed === state.lessons.length},
    {v:'horario', n:6, t:'Ajustar y publicar', d:'Arrastra, intercambia, fija e imprime.', done: false},
  ];
}
function renderNav(){
  const st = steps();
  const b = (v, num, label, cnt='') => {
    const isStep = typeof num === 'number', done = isStep && st[num-1].done;
    return `<button class="${ui.view===v?'on':''}" aria-label="${esc(label)}" title="${esc(label)}" ${ui.view===v?'aria-current="page"':''} onclick="go('${v}')"><span class="num${done?' done':''}">${done && ui.view!==v ? '✓' : num}</span><span class="lbl">${label}</span><span class="cnt">${cnt}</span></button>`;
  };
  const placed = state.lessons.filter(l => l.day != null).length;
  $('#nav').innerHTML =
    b('inicio','·','Inicio') +
    `<div class="sec">Preparar</div>` +
    b('marco',1,'Marco horario', state.days.length+'×'+classSlots()) +
    b('profesores',2,TPLUR.T, state.teachers.length) +
    b('grupos','·',TPLUR.G, state.groups.length) +
    b('materias','·','Materias', state.subjects.length) +
    b('aulas','·','Aulas', state.rooms.length) +
    b('actividades',3,'Actividades', state.activities.length) +
    b('restricciones',4,'Condiciones') + b('normativa','·','Horas y normativa') +
    `<div class="sec">Horario</div>` +
    b('generar',5,'Generar') +
    b('horario',6,'Ver y ajustar', placed+'/'+state.lessons.length) +
    b('sabana','·','Horario general') +
    `<div class="sec">Gestión diaria</div>` +
    b('guardias','·','Guardias y ausencias') +
    b('informes','·','Informes') + `<div class="sec">Información</div>` + b('privacidad','·','Privacidad y cuentas');
  $('#title').innerHTML = esc(state.name || 'MaxHorarios') + (state.course ? ' · '+esc(state.course) : '') + '<small>' + VIEWTITLE[ui.view] + '</small>';
}
function render(){
  applyEtapa(); syncLessons(); renderNav();
  const v = ui.view, V = $('#view');
  const views = {inicio:vInicio, marco:vMarco, actividades:vAct, restricciones:vRest, privacidad:vPrivacidad, normativa:vNormativa, generar:vGen, horario:vHor, sabana:vSab, guardias:vGuard, informes:vInf};
  V.innerHTML = ENT[v] ? vEnt(v) : views[v]();
}

/* ---------- vista: inicio ---------- */
function diagnostics(){
  const w = [];
  if (!state.days.length) w.push(['bad','No hay días definidos.']);
  if (!classSlots()) w.push(['bad','No hay tramos de clase definidos.']);
  for (const t of ['T','G','R']) for (const e of state[COLL[t]]){
    const h = hoursOf(t, e.id), av = availOf(t, e.id);
    if (t !== 'R' && h > av) w.push(['bad', `${TNAME[t]} <b>${esc(e.name)}</b>: ${h} h de actividad y solo ${av} tramos disponibles.`]);
    if (e.maxDay != null && h > e.maxDay * state.days.length) w.push(['bad', `${TNAME[t]} <b>${esc(e.name)}</b>: ${h} h no caben con máx. ${e.maxDay} h/día.`]);
  }
  for (const a of state.activities){
    if (a.type === 'clase' && !a.groupIds.length) w.push(['warn', `La actividad <b>${esc(aName(a))}</b> no tiene grupo.`]);
    if (!allTeachers(a).length) w.push(['warn', `<b>${esc(actLabel(a))}</b> no tiene profesor.`]);
    if (a.sessions > a.maxDay * state.days.length) w.push(['bad', `<b>${esc(actLabel(a))}</b>: ${a.sessions} sesiones no caben con máx. ${a.maxDay}/día.`]);
  }
  let consec = 0, mx = 0; state.slots.forEach(s => { if (s.recreo) consec = 0; else { consec++; mx = Math.max(mx, consec); } });
  for (const a of state.activities) if (a.dur > mx){ w.push(['bad', `<b>${esc(actLabel(a))}</b> dura ${a.dur} tramos y no hay tantos tramos seguidos.`]); }
  return w;
}
function vInicio(){
  const st = steps(), placed = state.lessons.filter(l => l.day != null).length, iss = allIssues();
  const diag = diagnostics();
  const empty = !state.teachers.length && !state.groups.length && !state.subjects.length && !state.activities.length;
  return `
  ${helpVisible('welcome') ? `<div class="hero dismissible"><button class="dismiss" aria-label="Cerrar bienvenida" onclick="dismissHelp('welcome')">×</button>
    <img class="maxhead" src="https://maximilian23.com/Cabeza.png" alt="Maximilian 23" style="width:130px">
    <div class="grow"><h2>Bienvenido a MaxHorarios</h2>
    <p>Tu centro, organizado. Añade los datos, indica las condiciones y genera una propuesta de horario. Después podrás ajustarla, preparar sustituciones y exportarla.</p></div>
    <div class="row">
      ${empty ? `<button class="btn big" onclick="exampleModal()">Ver un ejemplo</button>` : ''}
      ${empty ? `<button class="btn pri big" onclick="go('marco')">Empezar de cero →</button>` : ''}
    </div>
  </div>` : ''}
  ${helpVisible('steps') ? `<div class="dismissible guide"><button class="dismiss" aria-label="Cerrar guía de primeros pasos" onclick="dismissHelp('steps')">×</button><div class="steps">${st.map(s => `<div class="step ${s.done?'done':''}" onclick="go('${s.v}')"><div class="n">${s.done?'✓':s.n}</div><b>${s.t}</b><small>${s.d}</small></div>`).join('')}</div></div>` : ''}
  <div class="row" style="align-items:stretch">
    <div class="card grow" style="min-width:300px"><h3>Resumen</h3><div class="stats">
      <div class="stat"><b>${state.teachers.length}</b><span>Profesores</span></div>
      <div class="stat"><b>${state.groups.length}</b><span>Grupos</span></div>
      <div class="stat"><b>${state.subjects.length}</b><span>Materias</span></div>
      <div class="stat"><b>${state.rooms.length}</b><span>Aulas</span></div>
      <div class="stat"><b>${state.lessons.length}</b><span>Sesiones semanales</span></div>
      <div class="stat"><b class="${placed===state.lessons.length&&placed?'pill-ok':''}">${placed}</b><span>Colocadas</span></div>
      <div class="stat"><b class="${iss.size?'pill-bad':''}">${iss.size}</b><span>Con conflictos</span></div>
    </div></div>
    <div class="card grow" style="min-width:300px"><h3>Comprobación de datos</h3>
      ${diag.length ? `<ul class="diag">${diag.slice(0,12).map(([k,m]) => `<li>${k==='bad'?'':''} ${m}</li>`).join('')}</ul>${diag.length>12?`<small class="muted">…y ${diag.length-12} más</small>`:''}`
        : state.lessons.length ? `<p class="pill-ok">✓ No se han detectado incoherencias en los datos.</p>` : `<p class="muted">Completa los datos y la carga semanal en Actividades. Todavía no hay sesiones para generar un horario.</p>`}
    </div>
  </div>
  <div class="card"><h3>Proyecto</h3><div class="row">
    <label class="muted">Centro</label><input class="f" style="width:240px" value="${esc(state.name)}" onchange="mutate(()=>state.name=this.value)">
    <label class="muted">Curso</label><select class="f" aria-label="Curso escolar" style="width:140px" onchange="mutate(()=>state.course=this.value)">${schoolCourseOptions(state.course)}</select>
    <label class="muted">Tipo</label><button class="btn alt" onclick="chooseEtapa()">${state.etapa==='primaria'?'Colegio':'Instituto'} · cambiar</button>
    <span class="grow"></span>
    <button class="btn" onclick="exampleModal()">Cargar ejemplo</button>
  </div></div>`;
}
// Nuevo always opens the full project wizard in setup.js.

/* ---------- vista: marco horario ---------- */
function vMarco(){
  return `<h2>1 · Marco horario</h2>
  <p class="lead">Define los días lectivos y los tramos de la jornada (mañana y, si hay, tarde). Marca como <b>recreo</b> los tramos sin clase: separan las sesiones y no cuentan como hueco. Si cambias algo, las condiciones y el horario se reajustan solos.</p>
  <div class="row" style="align-items:flex-start">
  <div class="card" style="width:300px"><h3>Días lectivos</h3>
    <table class="t">${state.days.map((d,i) => `<tr><td><input type="text" value="${esc(d)}" onchange="mutate(()=>state.days[${i}]=this.value,false)"></td><td style="width:30px"><button class="iconbtn" title="Quitar día" onclick="delDay(${i})">✕</button></td></tr>`).join('')}</table>
    <div class="row" style="margin-top:10px"><button class="btn sm" onclick="addDay()">Añadir día</button></div>
  </div>
  <div class="card grow" style="min-width:420px"><h3>Tramos horarios</h3>
    <table class="t"><tr><th>#</th><th>Inicio</th><th>Fin</th><th>Recreo / descanso</th><th></th></tr>
    ${state.slots.map((s,i) => `<tr style="${s.recreo?'background:var(--panel2)':''}"><td class="muted">${s.recreo?'☕':(state.slots.slice(0,i+1).filter(x=>!x.recreo).length+'ª')}</td>
      <td><input type="time" value="${s.start}" onchange="mutate(()=>state.slots[${i}].start=this.value,false)"></td>
      <td><input type="time" value="${s.end}" onchange="mutate(()=>state.slots[${i}].end=this.value,false)"></td>
      <td><input type="checkbox" ${s.recreo?'checked':''} onchange="mutate(()=>state.slots[${i}].recreo=this.checked)"></td>
      <td style="white-space:nowrap"><button aria-label="Insertar tramo debajo" class="iconbtn" title="Insertar tramo debajo" onclick="addSlot(${i+1})">+</button><button class="iconbtn" title="Quitar tramo" onclick="delSlot(${i})">✕</button></td></tr>`).join('')}
    </table>
    <div class="row" style="margin-top:10px"><button class="btn sm" onclick="addSlot(state.slots.length)">Añadir tramo al final</button></div>
  </div></div>
  <div class="card"><h3>Crear tramos automáticamente</h3>
    <div class="row">
      <label>Empieza a las <input class="f" type="time" id="gS" value="08:30"></label>
      <label>Clases de <input class="f" type="number" id="gD" value="55" style="width:70px"> min</label>
      <label>Nº de clases <input class="f" type="number" id="gN" value="6" style="width:60px"></label>
      <label>Recreo tras la <input class="f" type="number" id="gR" value="3" style="width:60px">ª</label>
      <label>de <input class="f" type="number" id="gRD" value="30" style="width:60px"> min</label>
      <button class="btn pri" onclick="genSlots()">Crear tramos</button>
    </div></div>`;
}
const toMin = t => { const [h,m] = t.split(':').map(Number); return h*60 + m; };
const toHM = m => String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0');
function genSlots(){
  let t = toMin($('#gS').value || '08:30'); const d = +$('#gD').value || 55, n = +$('#gN').value || 6, r = +$('#gR').value, rd = +$('#gRD').value || 30;
  if (state.lessons.some(l => l.day != null) && !confirm('Esto reemplaza los tramos, vacía el horario colocado y borra las franjas marcadas. ¿Continuar?')) return;
  mutate(() => {
    const sl = [];
    for (let i=1; i<=n; i++){ sl.push({start:toHM(t), end:toHM(t+d)}); t += d; if (i === r && i < n){ sl.push({start:toHM(t), end:toHM(t+rd), recreo:true}); t += rd; } }
    state.slots = sl; state.lessons.forEach(l => { l.day = l.slot = l.room = null; l.locked = false; });
    for (const c of ['teachers','groups','rooms','subjects']) for (const e of state[c]) e.av = {};
  });
  toast('Tramos creados');
}
function remap(dim, f){
  for (const c of ['teachers','groups','rooms','subjects']) for (const e of state[c]){
    const n = {}; for (const k in e.av){ let [d,s] = k.split('-').map(Number); if (dim==='d') d = f(d); else s = f(s); if (d>=0 && s>=0) n[d+'-'+s] = e.av[k]; } e.av = n;
  }
  for (const l of state.lessons){
    if (l.day == null) continue;
    if (dim === 'd'){ const nd = f(l.day); if (nd < 0){ l.day = l.slot = null; l.locked = false; } else l.day = nd; }
    else {
      const a = IX.A.get(l.actId), ns = f(l.slot); let ok = ns >= 0;
      for (let k=1; k<a.dur; k++) if (f(l.slot+k) !== ns+k) ok = false;
      if (!ok){ l.day = l.slot = null; l.locked = false; } else l.slot = ns;
    }
  }
}
function addDay(){ const names = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']; mutate(() => state.days.push(names[state.days.length] || 'Día '+(state.days.length+1))); }
function delDay(i){ if (!confirm('¿Quitar "'+state.days[i]+'"? Sus sesiones pasarán a "sin colocar".')) return; mutate(() => { remap('d', d => d===i ? -1 : d>i ? d-1 : d); state.days.splice(i,1); }); }
let addSlot;
function delSlot(i){ mutate(() => { remap('s', s => s===i ? -1 : s>i ? s-1 : s); state.slots.splice(i,1); }); }

/* ---------- vistas: profesores / grupos / materias / aulas ---------- */
const ENT = {
  profesores:{c:'teachers', t:'T', title:'Profesores', one:'profesor', step:'2 · ', lead:'El profesorado del centro con su departamento. La abreviatura aparece en las celdas del horario. Las condiciones detalladas (máximos, huecos, día libre…) están en el paso 4.',
    cols:[['name','Nombre','text'],['short','Abrev.','text',90],['dept','Departamento','dept',180],['maxDay','Máx. h/día','number',100]]},
  grupos:{c:'groups', t:'G', title:'Grupos', one:'grupo', step:'', lead:'Los grupos de alumnos (1º ESO A, 2º Bach B…). El aula de referencia se propone automáticamente al crear sus actividades.',
    cols:[['name','Nombre','text'],['short','Abrev.','text',90],['level','Nivel / etapa','text',150],['roomId','Aula de referencia','room',190]]},
  materias:{c:'subjects', t:'S', title:'Materias', one:'materia', step:'', lead:'Las materias o asignaturas. El color pinta sus sesiones en el horario. En «Condiciones» puedes indicar franjas preferidas o prohibidas para cada materia.',
    cols:[['name','Nombre','text'],['short','Abrev.','text',90],['color','Color','color',70]]},
  aulas:{c:'rooms', t:'R', title:'Aulas', one:'aula', step:'', lead:'Espacios del centro. Asigna aulas a las actividades cuando importe (gimnasio, laboratorio, informática…) para que nunca coincidan dos grupos. Puedes dar aulas alternativas.',
    cols:[['name','Nombre','text'],['short','Abrev.','text',90],['kind','Tipo','text',160],['cap','Capacidad','number',100]]}
};
function vEnt(v){
  const E = ENT[v], list = state[E.c];
  const tabs = `<div class="seg" style="margin-bottom:14px">${Object.entries(ENT).map(([k,x]) => `<button class="${k===v?'on':''}" onclick="go('${k}')">${x.title} (${state[x.c].length})</button>`).join('')}</div>`;
  const showH = E.t !== 'S';
  const depts = [...new Set(state.teachers.map(t => t.dept).filter(Boolean))];
  const ids = list.map(e => e.id), idsJ = esc(JSON.stringify(ids));
  const head = `<tr>${pickHead(ids)}${E.cols.map(c => `<th style="${c[3]?'width:'+c[3]+'px':''}">${c[1]}</th>`).join('')}${showH?`<th style="width:150px">${E.t==='T'?'Horas (lectivas) / disp.':'Horas / disponibles'}</th>`:'<th style="width:120px">Horas semanales</th>'}<th style="width:110px"></th></tr>`;
  const rows = list.map(e => {
    const cells = E.cols.map(([f,,type]) => {
      if (type === 'parent') return `<td><select aria-label="Grupo al que pertenece" onchange="setF('${E.c}','${e.id}','${f}',this.value,false,true)"><option value="">Grupo completo</option>${state.groups.filter(g=>g.id!==e.id).map(g=>`<option value="${g.id}" ${e[f]===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select></td>`;
      if (type === 'room') return `<td><select onchange="setF('${E.c}','${e.id}','${f}',this.value)"><option value="">—</option>${state.rooms.map(r => `<option value="${r.id}" ${e[f]===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select></td>`;
      if (type === 'color') return `<td><input type="color" value="${e.color||'#888888'}" onchange="setF('${E.c}','${e.id}','color',this.value,false,true)" style="width:44px;height:30px;border:0;background:none;padding:0"></td>`;
      if (type === 'dept') return `<td><input type="text" list="deptList" value="${esc(e[f] ?? '')}" onchange="setF('${E.c}','${e.id}','${f}',this.value)"></td>`;
      return `<td><input type="${type}" ${type==='number'?'min="0" placeholder="—"':''} value="${esc(e[f] ?? '')}" onchange="setF('${E.c}','${e.id}','${f}',this.value,${type==='number'})"></td>`;
    }).join('');
    let hc;
    if (showH){ const h = hoursOf(E.t, e.id), a = availOf(E.t, e.id); hc = `<td class="${h>a?'pill-bad':''}">${h} h${E.t==='T'?` <span class="muted">(${hoursOf('T',e.id,'clase')})</span>`:''} <span class="muted">/ ${a}</span></td>`; }
    else { let h = 0; state.activities.forEach(a => { if (subjIds(a).includes(e.id)) h += a.sessions*a.dur; }); hc = `<td>${h} h</td>`; }
    const act = `<button aria-label="Condiciones y disponibilidad" class="iconbtn" title="Condiciones y disponibilidad" onclick="ui.rt='${E.t}';ui.rid['${E.t}']='${e.id}';go('restricciones')">⚙</button>`
      + (E.t !== 'S' ? `<button aria-label="Ver su horario" class="iconbtn" title="Ver su horario" onclick="ui.ht='${E.t}';ui.hid['${E.t}']='${e.id}';go('horario')">▦</button>` : '')
      + `<button aria-label="Eliminar" class="iconbtn" title="Eliminar" onclick="delEnt('${E.c}','${e.id}')">×</button>`;
    return `<tr>${pickBox(e.id)}${cells}${hc}<td style="white-space:nowrap;text-align:right">${act}</td></tr>`;
  }).join('');
  return `${tabs}<h2>${E.step}${E.title}</h2><p class="lead">${E.lead}</p>
  <datalist id="deptList">${depts.map(d => `<option value="${esc(d)}">`).join('')}</datalist>
  <div class="card">
    <div class="row" style="margin-bottom:10px"><button class="btn pri" onclick="addEnt('${v}')">Añadir ${E.one}</button>${E.t==='G'?`<button class="btn alt" onclick="levelsModal()">Crear por niveles</button>`:''}<button class="btn" onclick="bulkEnt('${v}')">Pegar una lista</button>
      ${delBar(ids, `delEnts('${E.c}',${idsJ}.filter(id=>ui.pick.has(id)))`, `delEnts('${E.c}',${idsJ})`)}</div>
    ${list.length ? `<table class="t">${head}${rows}</table>` : `<div class="empty"><b>Todavía no hay ${E.title.toLowerCase()}</b>Pulsa «Añadir» o pega una lista (por ejemplo, copiada de Excel).</div>`}
  </div>`;
}
let setF;
function newEnt(c, name, short, third){
  const e = {id:uid(), name, short:short||'', av:{}};
  if (c === 'subjects') e.color = PALETTE[state.subjects.length % PALETTE.length];
  if (c === 'teachers' && third) e.dept = third;
  if (c === 'groups' && third) e.level = third;
  return e;
}
function addEnt(v){
  const E = ENT[v];
  mutate(() => state[E.c].push(newEnt(E.c, (E.one[0].toUpperCase()+E.one.slice(1))+' '+(state[E.c].length+1))));
  setTimeout(() => { const ins = $$('#view table.t tr:last-child input[type=text]'); if (ins[0]){ ins[0].focus(); ins[0].select(); } }, 0);
}
function bulkEnt(v){
  const E = ENT[v];
  const ex = {T:'Ana García; AGA; Lengua', G:'1º ESO A; 1A; ESO', S:'Matemáticas; MAT', R:'Laboratorio; LAB'}[E.t];
  openModal(`<h3>Añadir varios ${E.title.toLowerCase()}</h3><p class="muted">Uno por línea. Puedes añadir la abreviatura${E.t==='T'?' y el departamento':E.t==='G'?' y el nivel':''} separados por punto y coma o tabulador (copiado de Excel).<br>Ejemplo: <code>${ex}</code></p>
   <textarea class="f" id="bulk" rows="10" style="width:100%"></textarea>
   <div class="mfoot"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn pri" onclick="doBulk('${v}')">Añadir</button></div>`);
  $('#bulk').focus();
}
function doBulk(v){
  const E = ENT[v], lines = $('#bulk').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length) return closeModal();
  mutate(() => lines.forEach(ln => { const [n, s, x] = ln.split(/[;\t]/).map(y => y.trim()); state[E.c].push(newEnt(E.c, n, s, x)); }));
  closeModal(); toast(lines.length+' añadidos');
}
function delEnt(c, id){ delEnts(c, [id]); }
/* elimina varios elementos y los quita de las actividades donde aparecen */
function delEnts(c, ids){
  if (!ids.length) return;
  const del = new Set(ids), has = id => del.has(id);
  const used = state.activities.filter(a => subjIds(a).some(has) || allTeachers(a).some(has) || a.groupIds.some(has) || a.roomIds.some(has) || a.parts.some(p => has(p.roomId))).length;
  const what = ids.length === 1 ? '"'+state[c].find(x => x.id === ids[0]).name+'"' : ids.length+' elementos';
  if (!confirm('¿Eliminar '+what+'?' + (used ? '\nAparecen en '+used+' actividad(es)' + (c==='subjects' ? ', que se eliminarán si es su materia principal.' : '; se quitarán de ellas.') : '') + '\n(Puedes deshacer con Ctrl+Z)')) return;
  mutate(() => {
    state[c] = state[c].filter(x => !has(x.id));
    if (c === 'subjects') state.activities = state.activities.filter(a => !has(a.subjectId));
    for (const a of state.activities){
      a.teacherIds = a.teacherIds.filter(x => !has(x)); a.groupIds = a.groupIds.filter(x => !has(x)); a.roomIds = a.roomIds.filter(x => !has(x));
      a.parts = a.parts.filter(p => !has(p.subjectId)).map(p => ({...p, teacherIds:(p.teacherIds||[]).filter(x => !has(x)), roomId: has(p.roomId) ? '' : p.roomId}));
    }
    for (const g of state.groups) { if (has(g.roomId)) g.roomId = ''; if (has(g.parentId)) g.parentId = ''; }
    if(c==='teachers')state.absences=state.absences.filter(r=>!has(r.teacherId));
    for(const r of state.absences)for(const lid of Object.keys(r.subs||{}))if(has(r.subs[lid]))delete r.subs[lid];
    for (const id of ids) ui.pick.delete(id);
  });
  toast('Eliminado: '+what);
}
/* casillas de selección comunes a todas las tablas */
function pickBox(id){ return `<td style="width:30px" onclick="event.stopPropagation()"><input type="checkbox" ${ui.pick.has(id)?'checked':''} onchange="pickSet(['${id}'],this.checked)"></td>`; }
function pickHead(ids){ const all = ids.length && ids.every(id => ui.pick.has(id)); return `<th style="width:30px"><input type="checkbox" title="Seleccionar todo" ${all?'checked':''} onchange="pickSet(${esc(JSON.stringify(ids))},this.checked)"></th>`; }
function pickSet(ids, on){ ids.forEach(id => on ? ui.pick.add(id) : ui.pick.delete(id)); render(); }
function delBar(ids, onSel, onAll){
  const n = ids.filter(id => ui.pick.has(id)).length;
  return `<span class="grow"></span><button class="btn danger" ${n?'':'disabled'} onclick="${onSel}">Borrar seleccionados${n?' ('+n+')':''}</button><button class="btn danger" ${ids.length?'':'disabled'} onclick="${onAll}">Borrar todo</button>`;
}
function delActs(ids){
  if (!ids.length) return;
  if (!confirm('¿Eliminar '+(ids.length === 1 ? 'esta actividad' : ids.length+' actividades')+' y sus sesiones del horario?\n(Puedes deshacer con Ctrl+Z)')) return;
  const del = new Set(ids);
  mutate(() => { state.activities = state.activities.filter(a => !del.has(a.id)); ids.forEach(id => ui.pick.delete(id)); });
  toast('Eliminadas: '+ids.length);
}

/* ---------- vista: actividades ---------- */
function vAct(){
  if(ui.fGroup&&!state.groups.some(g=>g.id===ui.fGroup))ui.fGroup='';
  if(ui.fTeacher&&!state.teachers.some(t=>t.id===ui.fTeacher))ui.fTeacher='';
  ui.fSubjectIds=(ui.fSubjectIds||[]).filter(id=>state.subjects.some(s=>s.id===id));
  let acts = state.activities;
  if (ui.fGroup) acts = acts.filter(a => a.groupIds.some(id=>groupsOverlap(id,ui.fGroup)));
  if (ui.fTeacher) acts = acts.filter(a => allTeachers(a).includes(ui.fTeacher));
  if(ui.fSubjectIds?.length)acts=acts.filter(a=>subjIds(a).some(id=>ui.fSubjectIds.includes(id)));
  const canAdd = state.subjects.length && state.groups.length;
  const total = acts.reduce((s,a) => s + a.sessions*a.dur, 0);
  const rows = acts.map(a => {
    const ls = IX.byAct.get(a.id) || [], pl = ls.filter(l => l.day != null).length;
    return `<tr ondblclick="actModal('${a.id}')" style="cursor:pointer">${pickBox(a.id)}
      <td><span class="dot" style="background:${aColor(a)}"></span><b>${esc(aName(a))}</b>${a.type!=='clase'?` <span class="tag t2">${TYPES[a.type].n}</span>`:''}${a.parts.length?' <span class="tag t2">simultánea</span>':''}</td>
      <td>${a.groupIds.map(g => `<span class="tag">${esc(nm('G',g,1))}</span>`).join('') || (a.type==='clase'?'<span class="pill-warn">sin grupo</span>':'<span class="muted">—</span>')}</td>
      <td>${allTeachers(a).map(t => `<span class="tag">${esc(nm('T',t))}</span>`).join('') || '<span class="pill-warn">sin profesor</span>'}</td>
      <td>${[...a.roomIds.map((r,i) => esc(nm('R',r,1)) + (i===0&&a.roomIds.length>1?'*':'')), ...a.parts.filter(p=>p.roomId).map(p => esc(nm('R',p.roomId,1)))].join(', ') || '<span class="muted">—</span>'}</td>
      <td>${a.sessions} × ${a.dur===1?'1 tramo':a.dur+' tramos'}</td>
      <td>${a.maxDay}</td>
      <td class="${pl===ls.length?'pill-ok':pl?'pill-warn':'muted'}">${pl}/${ls.length}</td>
      <td style="white-space:nowrap;text-align:right"><button aria-label="Editar" class="iconbtn" title="Editar" onclick="actModal('${a.id}')">✎</button><button class="iconbtn" title="Duplicar" onclick="dupAct('${a.id}')">⧉</button><button aria-label="Eliminar" class="iconbtn" title="Eliminar" onclick="delAct('${a.id}')">×</button></td></tr>`;
  }).join('');
  return `<h2>3 · Actividades</h2>
  <p class="lead">Una actividad es <b>lo que hay que colocar en el horario</b>: una materia, con su profesorado y grupo(s), y cuántas sesiones semanales tiene. Admite <b>grupos unidos</b>, <b>varios profesores</b> (apoyos), <b>materias simultáneas</b> (optativas o desdobles a la misma hora), <b>aulas alternativas</b>, sesiones dobles, y actividades del profesorado sin alumnos: <b>guardias, reuniones y complementarias</b>.</p>
  <div class="card">
    <div class="row" style="margin-bottom:12px">
      <button class="btn pri" ${canAdd?'':'disabled'} onclick="quickLoad()">Carga rápida por grupo</button>
      <button class="btn" ${canAdd?'':'disabled'} onclick="actModal()">Nueva actividad</button>
      <button class="btn" ${state.teachers.length?'':'disabled'} onclick="actModal(null,'guardia')">Guardias / reuniones</button>
      <span class="grow"></span>
      ${ui.fGroup||ui.fTeacher||ui.fSubjectIds?.length?`<button class="btn sm" onclick="clearActivityFilters()">Quitar filtros</button>`:''}
      ${ui.fSubjectIds?.length?`<span class="tag">Materia: ${ui.fSubjectIds.map(id=>esc(nm('S',id))).join(', ')}</span>`:''}
      <select class="f" aria-label="Filtrar actividades por grupo" onchange="ui.fGroup=this.value;ui.fSubjectIds=[];render()"><option value="">Todos los grupos</option>${state.groups.map(g => `<option value="${g.id}" ${ui.fGroup===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select>
      <select class="f" aria-label="Filtrar actividades por docente" onchange="ui.fTeacher=this.value;ui.fSubjectIds=[];render()"><option value="">Todos los profesores</option>${state.teachers.map(t => `<option value="${t.id}" ${ui.fTeacher===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select>
    </div>
    ${!canAdd ? `<div class="empty"><b>Primero añade grupos y materias</b><button class="btn" onclick="go('grupos')">Ir a Grupos</button></div>` :
      acts.length ? `<div class="row" style="margin-bottom:8px"><span class="muted">${ui.fGroup||ui.fTeacher||ui.fSubjectIds?.length ? 'Mostrando las actividades filtradas («Borrar todo» borra solo estas)' : ''}</span>${delBar(acts.map(a => a.id), `delActs(${esc(JSON.stringify(acts.map(a => a.id)))}.filter(id=>ui.pick.has(id)))`, `delActs(${esc(JSON.stringify(acts.map(a => a.id)))})`)}</div>
      <table class="t"><tr>${pickHead(acts.map(a => a.id))}<th>Materia / tipo</th><th>Grupos</th><th>Profesorado</th><th>Aulas</th><th>Sesiones/semana</th><th>Máx./día</th><th>Colocadas</th><th></th></tr>${rows}</table>
      <p class="muted" style="margin:10px 0 0">${acts.length} actividades · ${total} tramos semanales. Doble clic en una fila para editarla. * = aula preferente con alternativas.</p>`
      : `<div class="empty"><b>No hay actividades</b>Usa la carga rápida para crear todas las de un grupo de una vez.</div>`}
  </div>`;
}
function clearActivityFilters(){ui.fGroup='';ui.fTeacher='';ui.fSubjectIds=[];render();}
function partRow(p = {}){
  return `<div class="partrow">
    <select class="f pS"><option value="">Materia…</option>${state.subjects.map(s => `<option value="${s.id}" ${p.subjectId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select>
    <select class="f pT"><option value="">Profesor…</option>${state.teachers.map(t => `<option value="${t.id}" ${(p.teacherIds||[])[0]===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select>
    <select class="f pR"><option value="">Aula…</option>${state.rooms.map(r => `<option value="${r.id}" ${p.roomId===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select>
    <button class="iconbtn" onclick="this.parentNode.remove()">✕</button></div>`;
}
function actModal(id, type){
  const a = id ? state.activities.find(x => x.id === id)
    : {type: type || 'clase', subjectId: type ? '' : (ui.fSubjectIds?.[0]||state.subjects[0]?.id), teacherIds: ui.fTeacher ? [ui.fTeacher] : [], groupIds: !type && ui.fGroup ? [ui.fGroup] : [], roomIds:[], parts:[], sessions: type ? 1 : 3, dur:1, maxDay:1, spread:true};
  const chips = (t, sel, name = t) => `<div class="chips">${state[COLL[t]].map(e => `<label><input type="checkbox" name="${name}" value="${e.id}" ${sel.includes(e.id)?'checked':''}>${esc(e.name)}</label>`).join('') || '<span class="muted">No hay '+TPLUR[t].toLowerCase()+'</span>'}</div>`;
  openModal(`<h3>${id ? 'Editar' : 'Nueva'} actividad</h3>
    <div class="row" style="align-items:flex-end">
      <div><label class="l">Tipo</label><select class="f" id="aY">${Object.entries(TYPES).map(([k,x]) => `<option value="${k}" ${a.type===k?'selected':''}>${x.n}</option>`).join('')}</select></div>
      <div class="grow"><label class="l">Materia ${a.type!=='clase'?'(opcional)':''}</label><select class="f" id="aS" style="width:100%"><option value="">— Sin materia —</option>${state.subjects.map(s => `<option value="${s.id}" ${a.subjectId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
    </div>
    <label class="l">Grupo(s) — marca varios para grupos unidos</label>${chips('G', a.groupIds)}
    <label class="l">Profesorado — marca varios para apoyos o docencia compartida</label>${chips('T', a.teacherIds)}
    <label class="l">Aula(s) — la primera marcada es la preferente; las demás, alternativas</label>${chips('R', a.roomIds)}
    <div class="row" style="align-items:flex-end">
      <div><label class="l">Sesiones/semana</label><input class="f" id="aN" type="number" min="1" max="40" value="${a.sessions}" style="width:90px"></div>
      <div><label class="l">Duración</label><select class="f" id="aD">${[1,2,3].map(n => `<option value="${n}" ${a.dur===n?'selected':''}>${n===1?'1 tramo':n+' tramos seguidos'}</option>`).join('')}</select></div>
      <div><label class="l">Máx. sesiones/día</label><input class="f" id="aM" type="number" min="1" max="10" value="${a.maxDay}" style="width:90px"></div>
      <label style="margin-bottom:8px"><input type="checkbox" id="aSp" ${a.spread?'checked':''}> Repartir en días no consecutivos</label>
    </div>
    <label class="l">Materias simultáneas (optativas / desdobles) — se imparten a la vez que la principal, con otro profesor y aula</label>
    <div id="parts">${a.parts.map(partRow).join('')}</div>
    <button class="btn sm" onclick="$('#parts').insertAdjacentHTML('beforeend', partRow())">Añadir materia simultánea</button>
    <div class="mfoot">${id ? `<button class="btn danger" style="margin-right:auto" onclick="closeModal();delAct('${id}')">Eliminar</button>` : ''}<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn pri" onclick="saveAct('${id||''}')">Guardar</button></div>`);
  if (!id){ // mantener el orden de marcado de aulas
    $$('#mbox input[name=R]').forEach(x => x.onchange = () => { x.dataset.t = Date.now(); });
  }
}
function saveAct(id){
  const rooms = $$('#mbox input[name=R]:checked');
  const old = id ? state.activities.find(x => x.id === id).roomIds : [];
  rooms.sort((x,y) => { const ix = old.indexOf(x.value), iy = old.indexOf(y.value); if (ix>=0 && iy>=0) return ix-iy; if (ix>=0) return -1; if (iy>=0) return 1; return (+x.dataset.t||0) - (+y.dataset.t||0); });
  const v = {
    type: $('#aY').value, subjectId: $('#aS').value, roomIds: rooms.map(x => x.value),
    groupIds: $$('#mbox input[name=G]:checked').map(x => x.value), teacherIds: $$('#mbox input[name=T]:checked').map(x => x.value),
    sessions: Math.max(1, +$('#aN').value || 1), dur: +$('#aD').value || 1, maxDay: Math.max(1, +$('#aM').value || 1), spread: $('#aSp').checked,
    parts: $$('#parts .partrow').map(r => ({subjectId: $('.pS',r).value, teacherIds: $('.pT',r).value ? [$('.pT',r).value] : [], roomId: $('.pR',r).value})).filter(p => p.subjectId)
  };
  if (![v.sessions, v.dur, v.maxDay].every(n => Number.isSafeInteger(n) && n > 0 && n <= 200)) return toast('Las sesiones, duración y máximos deben ser números enteros entre 1 y 200');
  if (v.type === 'clase' && !v.subjectId) return toast('Elige una materia');
  if (v.type === 'clase' && !v.groupIds.length) return toast('Elige al menos un grupo');
  if (!v.teacherIds.length) return toast('Elige al menos un profesor');
  const invalid = activityIssues(v); if (invalid.length) return toast(invalid[0]);
  mutate(() => {
    if (id){ const a = state.activities.find(x => x.id === id); if (a.dur !== v.dur) state.lessons.forEach(l => { if (l.actId === id){ l.day = l.slot = null; l.locked = false; } }); Object.assign(a, v); }
    else state.activities.push({id:uid(), ...v});
  });
  closeModal(); toast('Actividad guardada');
}
function dupAct(id){ mutate(() => { const a = state.activities.find(x => x.id === id); state.activities.splice(state.activities.indexOf(a)+1, 0, {...JSON.parse(JSON.stringify(a)), id:uid()}); }); toast('Duplicada'); }
function delAct(id){ delActs([id]); }

function quickLoad(gid){
  gid = gid || ui.fGroup || state.groups[0].id;
  const g = IX.G.get(gid);
  const ex = sid => state.activities.find(a => a.type === 'clase' && a.subjectId === sid && !a.parts.length && a.groupIds.length === 1 && a.groupIds[0] === gid);
  openModal(`<h3>Carga rápida por grupo</h3>
    <p class="muted">Horas semanales de cada materia para el grupo y quién la imparte. Deja 0 en las que no cursa. (Optativas y desdobles se crean con «Nueva actividad».)</p>
    <label class="l">Grupo</label><select class="f" onchange="quickLoad(this.value)">${state.groups.map(x => `<option value="${x.id}" ${x.id===gid?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
    <table class="t" style="margin-top:10px"><tr><th>Materia</th><th style="width:80px">Horas</th><th style="width:110px">Sesiones de</th><th>Profesor</th><th>Aula</th></tr>
    ${state.subjects.map(s => { const a = ex(s.id);
      return `<tr data-s="${s.id}" data-a="${a?.id||''}"><td><span class="dot" style="background:${s.color}"></span>${esc(s.name)}</td>
        <td><input type="number" class="qh" min="0" max="40" value="${a ? a.sessions : 0}" style="border:1px solid var(--line)"></td>
        <td><select class="qd">${[1,2].map(n => `<option value="${n}" ${(a?.dur||1)===n?'selected':''}>${n} tramo${n>1?'s':''}</option>`).join('')}</select></td>
        <td><select class="qt"><option value="">—</option>${state.teachers.map(t => `<option value="${t.id}" ${a?.teacherIds[0]===t.id?'selected':''}>${esc(t.name)}${t.dept?' ('+esc(t.dept)+')':''}</option>`).join('')}</select></td>
        <td><select class="qr"><option value="">—</option>${state.rooms.map(r => `<option value="${r.id}" ${(a ? a.roomIds[0] : g.roomId)===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select></td></tr>`; }).join('')}
    </table>
    <div class="mfoot"><span class="muted" style="margin-right:auto" id="qTot"></span><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn pri" onclick="saveQuick('${gid}')">Guardar ${esc(g.name)}</button></div>`);
  const upd = () => { let t = 0; $$('#mbox tr[data-s]').forEach(tr => t += (+$('.qh',tr).value||0) * (+$('.qd',tr).value)); $('#qTot').textContent = 'Total: '+t+' h de '+classSlots()*state.days.length+' tramos'; };
  $$('#mbox .qh, #mbox .qd').forEach(x => x.oninput = upd); upd();
}
function saveQuick(gid){
  const rows = $('#mbox tr[data-s]').map(tr => ({s: tr.dataset.s, a: tr.dataset.a, h: +$('.qh',tr).value||0, d: +$('.qd',tr).value, t: $('.qt',tr).value, r: $('.qr',tr).value}));
  if (rows.some(x => !Number.isSafeInteger(x.h) || x.h < 0 || x.h > 200 || (x.h && !x.t))) return toast('Indica sesiones enteras (0–200) y un profesor para cada materia');
  mutate(() => {
    for (const x of rows){
      const a = x.a && state.activities.find(y => y.id === x.a);
      if (!x.h){ if (a) state.activities = state.activities.filter(y => y !== a); continue; }
      const roomIds = x.r ? [x.r, ...(a ? a.roomIds.filter(r => r !== x.r) : [])] : [];
      if (a){ if (a.dur !== x.d) state.lessons.forEach(l => { if (l.actId === a.id){ l.day = l.slot = null; l.locked = false; } }); Object.assign(a, {sessions:x.h, dur:x.d, teacherIds: x.t ? [x.t] : [], roomIds, maxDay: Math.max(a.maxDay, Math.ceil(x.h / state.days.length))}); }
      else state.activities.push({id:uid(), type:'clase', subjectId:x.s, groupIds:[gid], teacherIds: x.t ? [x.t] : [], roomIds, parts:[], sessions:x.h, dur:x.d, maxDay: Math.ceil(x.h / state.days.length), spread:true});
    }
  });
  closeModal(); toast('Carga del grupo guardada');
}

/* ---------- vista: condiciones ---------- */
function condForm(t, e){
  const num = (f, label, ph, help) => `<label>${label}<input class="f" type="number" min="0" value="${e[f] ?? ''}" placeholder="${ph}" onchange="setF('${COLL[t]}','${e.id}','${f}',this.value,true)"><span class="help" style="font-weight:400">${help}</span></label>`;
  const chk = (f, label) => `<label class="chk"><input type="checkbox" ${e[f]?'checked':''} onchange="mutate(()=>IX['${t}'].get('${e.id}').${f}=this.checked,false)"> ${label}</label>`;
  if (t === 'T') return `<div class="conds">
    ${num('maxDay','Máx. horas al día','sin límite','Obligatorio')}
    ${num('minDay','Mín. horas los días que venga','sin mínimo','Evita venir por 1 hora')}
    ${num('maxGaps','Máx. huecos a la semana','sin límite','Preferencia: se procura cumplir')}
    ${num('maxConsec','Máx. horas seguidas','sin límite','Obligatorio (el recreo corta)')}
    ${chk('freeDay','Quiere un día libre a la semana')}</div>`;
  if (t === 'G') return `<div class="conds">${num('maxDay','Máx. horas al día','sin límite','Obligatorio')}${chk('allowGaps','Reducir la prioridad de evitar huecos (p. ej. Bachillerato)')}</div><p class="help">Los huecos se minimizan como preferencia. Desmarcar esta opción aumenta su penalización.</p>`;
  if (t === 'S') return `<p class="help" style="margin-top:12px">Ejemplos: Educación Física no a primera hora («mejor no»), Matemáticas preferentemente por la mañana (marca «mejor no» las últimas horas), una optativa solo los martes («no disponible» el resto).</p>`;
  return `<p class="help" style="margin-top:12px">Marca cuándo no se puede usar el aula (por ejemplo, reservada para otra etapa).</p>`;
}
function vRest(){
  const t = ui.rt, list = state[COLL[t]];
  let id = ui.rid[t]; if (!IX[t].has(id)) id = ui.rid[t] = list[0]?.id;
  const e = id && IX[t].get(id);
  const sym = ['', '·', '✕'];
  let grid = '';
  if (e){
    grid = `<div class="gridwrap"><table class="grid av" onmouseleave="paintEnd()"><tr><th class="time">Tramo</th>${state.days.map((d,di) => `<th class="clk" title="Pintar todo el día" onclick="paintCol(${di})">${esc(d)}</th>`).join('')}</tr>
    ${state.slots.map((sl,s) => sl.recreo ? `<tr class="recreo"><th>${sl.start}</th><td colspan="${state.days.length}">Recreo</td></tr>` :
      `<tr><th class="time clk" title="Pintar toda la fila" onclick="paintRow(${s})">${sl.start}<small>${sl.end}</small></th>${state.days.map((_,d) => { const v = e.av[d+'-'+s] || 0; return `<td class="v${v}" data-k="${d}-${s}" onmousedown="paintStart(event,this)" onmouseenter="paintOver(this)">${sym[v]}</td>`; }).join('')}</tr>`).join('')}
    </table></div>`;
  }
  return `<h2>4 · Condiciones</h2>
  <p class="lead">Elige un pincel y <b>pinta</b> la disponibilidad (puedes arrastrar; clic en un día o una hora pinta la columna o la fila). <b>No disponible</b> se respeta siempre; <b>mejor no</b> se evita si es posible. Debajo, las condiciones de cada ${TNAME[t].toLowerCase()}.</p>
  <div class="row" style="margin-bottom:14px"><div class="seg">${['T','G','S','R'].map(x => `<button class="${t===x?'on':''}" onclick="ui.rt='${x}';render()">${TPLUR[x]}</button>`).join('')}</div></div>
  ${!list.length ? `<div class="card empty"><b>No hay ${TPLUR[t].toLowerCase()}</b></div>` :
  `<div class="rlayout"><div class="card rlist">${list.map(x => { const n = Object.values(x.av).filter(v=>v).length; return `<button class="${x.id===id?'on':''}" onclick="ui.rid['${t}']='${x.id}';render()"><span>${esc(x.name)}</span><span class="muted">${n?n+' ':''}</span></button>`; }).join('')}</div>
  <div class="card grow" style="min-width:0">
    <div class="row" style="margin-bottom:12px"><h3 style="margin:0">${esc(e.name)}</h3><span class="grow"></span>
      <div class="seg brush">${[[0,'✓ Disponible'],[1,'· Mejor no'],[2,'✕ No disponible']].map(([v,l]) => `<button class="${ui.brush===v?'on':''}" onclick="ui.brush=${v};render()">${l}</button>`).join('')}</div>
      <button class="btn sm" onclick="mutate(()=>IX['${t}'].get('${id}').av={})">Limpiar</button>
      <button class="btn sm danger" onclick="clearAllConds('${t}')">Borrar todo (${TPLUR[t].toLowerCase()})</button></div>
    ${grid}
    <div class="legend"><span><i style="background:var(--cell)"></i>Disponible</span><span><i style="background:#3a3112"></i>Mejor no</span><span><i style="background:#45161e"></i>No disponible</span></div>
    ${condForm(t, e)}
  </div></div>`}`;
}
function clearAllConds(t){
  if (!confirm('¿Borrar la disponibilidad y las condiciones de todos los '+TPLUR[t].toLowerCase()+'?\n(Puedes deshacer con Ctrl+Z)')) return;
  mutate(() => state[COLL[t]].forEach(e => { e.av = {}; ['maxDay','minDay','maxGaps','maxConsec','freeDay','allowGaps'].forEach(f => delete e[f]); }));
  toast('Condiciones borradas');
}
let painting = false;
function curEnt(){ return IX[ui.rt].get(ui.rid[ui.rt]); }
function paintCell(td){ const e = curEnt(), v = ui.brush; if (v) e.av[td.dataset.k] = v; else delete e.av[td.dataset.k]; td.className = 'v'+v; td.textContent = ['','·','✕'][v]; }
function paintStart(ev, td){ ev.preventDefault(); history.push(JSON.stringify(state)); future = []; painting = true; paintCell(td); }
function paintOver(td){ if (painting) paintCell(td); }
function paintEnd(){ if (!painting) return; painting = false; save(); render(); }
function paintCol(d){ mutate(() => { const e = curEnt(); state.slots.forEach((s,i) => { if (s.recreo) return; if (ui.brush) e.av[d+'-'+i] = ui.brush; else delete e.av[d+'-'+i]; }); }); }
function paintRow(s){ mutate(() => { const e = curEnt(); state.days.forEach((_,d) => { if (ui.brush) e.av[d+'-'+s] = ui.brush; else delete e.av[d+'-'+s]; }); }); }
document.addEventListener('mouseup', paintEnd);

/* ---------- vista: generar ---------- */
function vGen(){
  const tot = state.lessons.length, locked = state.lessons.filter(l => l.locked).length, placed = state.lessons.filter(l => l.day != null).length;
  const diag = diagnostics().filter(d => d[0] === 'bad');
  const un = state.lessons.filter(l => l.day == null);
  const debugByActivity=new Map(),dbg=[];
  for(const l of un){if(!debugByActivity.has(l.actId)){if(debugByActivity.size>=60)continue;debugByActivity.set(l.actId,whyUnplaceable(l));}const why=debugByActivity.get(l.actId);if(why&&dbg.length<15)dbg.push([l,why]);}
  return `<h2>5 · Generar horario</h2>
  <p class="lead">El motor prueba miles de combinaciones y se queda con la mejor: sin solapamientos de profesores, grupos ni aulas, respetando todas las condiciones obligatorias y minimizando huecos de alumnos y profesores, franjas «mejor no» y sesiones en días seguidos. Las sesiones <b>fijadas </b> no se mueven: fija lo que te guste y vuelve a generar el resto.</p>
  <div class="card" style="text-align:center;padding:30px">
    <div class="stats" style="max-width:600px;margin:0 auto 22px;text-align:left">
      <div class="stat"><b>${tot}</b><span>Sesiones a colocar</span></div>
      <div class="stat"><b>${placed}</b><span>Colocadas ahora</span></div>
      <div class="stat"><b>${locked}</b><span>Fijadas </span></div>
    </div>
    ${diag.length ? `<p class="pill-bad">Hay ${diag.length} problema(s) en los datos que impedirán un horario completo. <a href="#" onclick="go('inicio');return false">Ver comprobaciones</a></p>` : ''}
    <div class="row" style="justify-content:center;margin-bottom:16px">
      <label>Tiempo de búsqueda:
      <select class="f" id="budget"><option value="3000">Rápido (3 s)</option><option value="10000" selected>Normal (10 s)</option><option value="30000">Intenso (30 s)</option><option value="90000">Muy intenso (90 s)</option><option value="240000">Máximo (4 min)</option></select></label>
    </div>
    <label class="seed-label">Referencia de búsqueda <input class="f" id="searchSeed" value="maxhorario" aria-label="Semilla reproducible"></label><button class="btn pri big" id="genBtn" ${tot?'':'disabled'} onclick="runSolve()">Generar horario</button>
    <div style="max-width:520px;margin:20px auto 0"><div class="progress" id="genProg"><div></div></div><p class="muted" id="genMsg" style="min-height:20px"></p></div>
    <button class="btn danger" id="cancelSolve" hidden onclick="cancelSolve()">Detener y conservar el mejor</button><div id="genRes" aria-live="polite"></div>
  </div>
  ${dbg.length ? `<div class="card"><h3 class="pill-bad">Sesiones que necesitan revisión</h3><p class="help">Estas sesiones no tienen ningún tramo posible ni siquiera con el horario vacío. Diagnóstico rápido de hasta 60 actividades; el generador comprueba todas. Revisa sus condiciones:</p>
    <ul class="diag">${dbg.slice(0,15).map(([l,why]) => `<li><b>${esc(actLabel(IX.A.get(l.actId)))}</b>: ${why.map(esc).join('; ')}</li>`).join('')}</ul></div>` : ''}
  <div class="card"><h3>Copias del proyecto</h3><p class="help" style="margin-top:-6px">Las nuevas copias incluyen datos, condiciones y horario. Las versiones antiguas solo incluyen posiciones.</p>
    <div class="row" style="margin-bottom:10px"><input class="f" id="verName" placeholder="Nombre (p. ej. Propuesta A)" style="width:260px"><button class="btn pri" onclick="saveVersion()">Guardar versión actual</button><span class="grow"></span><button class="btn danger" ${state.versions.length?'':'disabled'} onclick="if(confirm('¿Borrar todas las versiones guardadas?'))mutate(()=>state.versions=[])">Borrar todas</button></div>
    ${state.versions.length ? `<table class="t"><tr><th>Versión</th><th>Fecha</th><th>Colocadas</th><th></th></tr>${state.versions.map(v => `<tr><td><b>${esc(v.name)}</b></td><td>${esc(v.date)}</td><td>${Object.values(v.pos).filter(p => p[0] != null).length}</td><td style="text-align:right"><button class="btn sm" onclick="restoreVersion('${v.id}')">Restaurar</button> <button aria-label="Eliminar copia" class="iconbtn" onclick="mutate(()=>state.versions=state.versions.filter(x=>x.id!=='${v.id}'))"></button></td></tr>`).join('')}</table>` : '<p class="muted">Aún no hay versiones guardadas.</p>'}
  </div>
  <div class="card"><h3>Herramientas</h3><div class="row">
    <button class="btn" onclick="mutate(()=>state.lessons.forEach(l=>{if(l.day!=null)l.locked=true}));toast('Todas las sesiones colocadas quedan fijadas')">Fijar todo lo colocado</button>
    <button class="btn" onclick="mutate(()=>state.lessons.forEach(l=>l.locked=false));toast('Todo desfijado')">Desfijar todo</button>
    <button class="btn danger" onclick="if(confirm('¿Quitar del horario todas las sesiones no fijadas?'))mutate(()=>state.lessons.forEach(l=>{if(!l.locked){l.day=l.slot=l.room=null}}))">Vaciar horario (salvo fijadas)</button>
  </div></div>`;
}
async function runSolve(){
  const btn = $('#genBtn'); if (solving) return; btn.disabled = true; btn.textContent = 'Generando…'; $('#genRes').innerHTML = '';
  let r; try { r = await solve(+$('#budget').value, $('#searchSeed')?.value || 'maxhorario'); } catch(e){ toast(e.message); render(); return; }
  if (!r) return;
  renderNav();
  if (ui.view !== 'generar') return;
  render();
  $('#genProg div').style.width = '100%';
  $('#genMsg').textContent = r.attempts+' intentos en '+(r.ms/1000).toFixed(1)+' s';
  const occ = buildOcc(); let gg = 0, gt = 0, warn = 0;
  state.groups.forEach(g => gg += gapsOf('G', g.id, occ)); state.teachers.forEach(t => { gt += gapsOf('T', t.id, occ); warn += teacherWarnings(t, occ).length; });
  $('#genRes').innerHTML = (r.u === 0 && r.issues === 0
    ? `<h3 class="pill-ok" style="margin-top:10px">✓ Todas las sesiones colocadas y sin conflictos de horario. Comprueba también la carga curricular y la jornada docente en «Horas y normativa».</h3>`
    : `<h3 class="pill-warn" style="margin-top:10px">Se han colocado ${r.total - r.u} de ${r.total} sesiones.</h3><p class="muted">Quedan ${r.u} sin colocar y ${r.issues} con conflictos. Prueba una búsqueda más intensa, relaja condiciones o colócalas a mano.</p>`)
    + `<p class="muted">${r.cancelled ? 'Búsqueda detenida. Se conserva el mejor horario encontrado. · ' : ''}Semilla: ${esc(r.seed)} · Huecos de alumnos: <b>${gg}</b> · Huecos de profesores: <b>${gt}</b> · Avisos de condiciones: <b>${warn}</b></p><button class="btn pri" onclick="go('horario')">Ver y ajustar →</button> <button class="btn" onclick="go('informes')">Ver informes</button>`;
}
let saveVersion;
let restoreVersion;

/* ---------- vista: horario (editor) ---------- */
function entityLessons(t, id){ return state.lessons.filter(l => lessonHas(l, t, id)); }
function cardHTML(l, t, id, opts = {}){
  const a = IX.A.get(l.actId);
  // en vista de profesor/aula, mostrar la parte simultánea que le corresponde
  let subj = aShort(a), color = aColor(a), part = null;
  if (t === 'T' && !a.teacherIds.includes(id)) part = a.parts.find(p => (p.teacherIds||[]).includes(id));
  if (t === 'R' && l.room !== id) part = a.parts.find(p => p.roomId === id);
  if (part){ const s = IX.S.get(part.subjectId); subj = s ? (s.short || s.name) : '?'; color = s?.color || color; }
  const lines = [];
  if (t !== 'G') lines.push(a.groupIds.map(g => nm('G',g,1)).join(', '));
  if (t !== 'T') lines.push(allTeachers(a).map(x => nm('T',x,1)).join(', '));
  if (t !== 'R'){ const rooms = [l.room, ...a.parts.map(p => p.roomId)].filter(Boolean); if (rooms.length) lines.push(rooms.map(r => nm('R',r,1)).join(', ')); }
  else if (part || l.room) {}
  const cls = ['lc', opts.cont ? 'cont' : '', ui.sel === l.id ? 'sel' : '', opts.bad ? 'bad' : ''].join(' ');
  const title = actLabel(a) + (opts.bad ? '\n' + opts.bad.join('\n') : '');
  const inter = opts.print ? '' : `draggable="true" data-lid="${l.id}" data-off="${opts.off||0}" ondragstart="dStart(event)" ondragend="dEnd()" onclick="selLesson(event,'${l.id}')"`;
  return `<div class="${cls}" style="--c:${color}" title="${esc(title)}" ${inter}>
    <span class="ic">${l.locked?'FIJA':''}${opts.bad?' !':''}</span>
    <b>${opts.cont ? '↳ ' : ''}${esc(subj)}</b>${lines.filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</div>`;
}
function gridHTML(t, id, opts = {}){
  const e = IX[t].get(id), ls = entityLessons(t, id).filter(l => l.day != null);
  const iss = opts.issues || new Map(), hl = opts.hl || null;
  const at = {};
  for (const l of ls){ const a = IX.A.get(l.actId); for (let k=0; k<a.dur; k++) (at[l.day+'-'+(l.slot+k)] ||= []).push([l, k]); }
  let h = `<table class="grid"><tr><th class="time"></th>${state.days.map(d => `<th>${esc(d)}</th>`).join('')}</tr>`;
  state.slots.forEach((sl, s) => {
    if (sl.recreo){ h += `<tr class="recreo"><th>${sl.start}</th><td colspan="${state.days.length}">Recreo · ${sl.start} – ${sl.end}</td></tr>`; return; }
    h += `<tr><th class="time">${sl.start}<small>${sl.end}</small></th>`;
    state.days.forEach((_, d) => {
      const k = d+'-'+s, v = e.av[k];
      const cls = [v===2?'na':v===1?'pn':'', hl ? hl[k] || '' : ''].join(' ');
      const inter = opts.print ? '' : `data-d="${d}" data-s="${s}" ondragover="dOver(event,this)" ondragleave="this.classList.remove('over')" ondrop="dDrop(event,this)" onclick="cellClick(${d},${s})"`;
      h += `<td class="${cls}" ${inter}>${(at[k]||[]).map(([l,off]) => cardHTML(l, t, id, {cont: off>0, off, bad: iss.get(l.id), print: opts.print})).join('')}</td>`;
    });
    h += '</tr>';
  });
  return h + '</table>';
}
function highlightFor(lid){
  const l = IX.L.get(lid); if (!l) return null;
  const occ = buildOcc(); if (l.day != null) delOcc(occ, l);
  const hl = {};
  state.days.forEach((_, d) => state.slots.forEach((sl, s) => {
    if (sl.recreo) return;
    const r = check(l, d, s, occ);
    hl[d+'-'+s] = r.hard ? 'h-bad' : r.soft.length ? 'h-warn' : r.conf.size ? 'h-clash' : 'h-ok';
  }));
  return hl;
}
function vHor(){
  const t = ui.ht, list = state[COLL[t]];
  let id = ui.hid[t]; if (!IX[t].has(id)) id = ui.hid[t] = list[0]?.id;
  const seg = `<div class="seg">${['G','T','R'].map(x => `<button class="${t===x?'on':''}" onclick="ui.ht='${x}';ui.sel=null;render()">${TPLUR[x]}</button>`).join('')}</div>`;
  if (!id) return `<div class="row" style="margin-bottom:14px">${seg}</div><div class="card empty"><b>No hay ${TPLUR[t].toLowerCase()}</b>Añádelos en el paso 2.</div>`;
  const iss = allIssues();
  const sel = ui.sel && IX.L.get(ui.sel);
  const hl = sel ? highlightFor(ui.sel) : null;
  const mine = entityLessons(t, id), un = mine.filter(l => l.day == null), pl = mine.filter(l => l.day != null);
  const occ = buildOcc(), gaps = gapsOf(t, id, occ);
  const ent = IX[t].get(id);
  const warns = t === 'T' ? teacherWarnings(ent, occ) : [];
  const badHere = pl.filter(l => iss.has(l.id)).length;
  let detail = '';
  if (sel){
    const a = IX.A.get(sel.actId), si = iss.get(sel.id);
    const why = sel.day == null ? whyUnplaceable(sel) : null;
    detail = `<div class="card" style="padding:14px"><div class="row"><span class="dot" style="background:${aColor(a)}"></span><b class="grow">${esc(aName(a))}</b><button class="iconbtn" onclick="ui.sel=null;render()">✕</button></div>
      <p style="margin:8px 0;line-height:1.6;font-size:13px">${a.type!=='clase'?''+TYPES[a.type].n+'<br>':''}${a.groupIds.map(g => esc(nm('G',g))).join(', ')||'—'}<br>${allTeachers(a).map(x => esc(nm('T',x))).join(', ')||'—'}<br>${[sel.room, ...a.parts.map(p=>p.roomId)].filter(Boolean).map(r => esc(nm('R',r))).join(', ') || '—'}<br>${sel.day!=null ? esc(dayName(sel.day))+' '+slotRange(sel.slot, a.dur) : '<i>Sin colocar</i>'}</p>
      ${si ? `<div class="alertbox">${si.map(x => ''+esc(x)).join('<br>')}</div>` : ''}
      ${why ? `<div class="alertbox">No tiene ningún tramo posible: ${why.map(esc).join('; ')}</div>` : ''}
      <p class="help" style="margin:0 0 8px">Clic en una celda <b style="color:var(--ok)">verde</b> para moverla; <b style="color:#e8590c">naranja</b> = ocupada (se intenta intercambiar). Teclas: <code>Supr</code> quitar · <code>F</code> fijar.</p>
      <div class="row">${sel.day!=null ? `<button class="btn sm" onclick="toggleLock('${sel.id}')">${sel.locked?'Desfijar':'Fijar'}</button><button class="btn sm" onclick="unplace('${sel.id}')">Quitar</button>` : ''}<button class="btn sm" onclick="actModal('${a.id}')">Actividad</button></div></div>`;
  }
  return `<div class="row noprint" style="margin-bottom:14px">${seg}
    <button class="iconbtn" title="Anterior" onclick="stepEnt(-1)">◀</button>
    <select class="f" onchange="ui.hid['${t}']=this.value;ui.sel=null;render()" style="min-width:200px;font-weight:600">${list.map(x => `<option value="${x.id}" ${x.id===id?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
    <button class="iconbtn" title="Siguiente" onclick="stepEnt(1)">▶</button>
    <span class="muted">${pl.reduce((n,l) => n + IX.A.get(l.actId).dur, 0)} h · ${gaps} hueco${gaps===1?'':'s'}${badHere ? ` · <span class="pill-bad">${badHere} con conflicto</span>` : ''}${warns.length ? ` · <span class="pill-warn" title="${esc(warns.join('\n'))}">${warns.length} aviso(s)</span>` : ''}</span>
    <span class="grow"></span>
    <button class="btn" onclick="window.print()">Imprimir</button>
    <button class="btn" onclick="printAll('${t}')">Todos</button>
  </div>
  <div class="hlayout">
    <div class="gmain card" style="padding:14px"><div class="row" style="margin-bottom:10px"><h2 style="font-size:18px;margin:0">${TNAME[t]}: ${esc(ent.name)}</h2><span class="muted">${esc(state.name)}${state.course?' · '+esc(state.course):''}${t==='T'&&ent.dept?' · Dpto. '+esc(ent.dept):''}</span></div>
      <div class="gridwrap">${gridHTML(t, id, {issues: iss, hl})}</div>
      ${warns.length ? `<p class="pill-warn noprint" style="font-weight:400;font-size:13px">${warns.map(esc).join(' · ')}</p>` : ''}
      <div class="legend"><span><i style="background:#0f3329;border-color:var(--ok)"></i>Libre</span><span><i style="background:#33220f;border-color:var(--accent)"></i>Ocupado (intercambiar)</span><span><i style="background:#2e2610;border-color:#e9c037"></i>Incumple condición</span><span><i style="background:#26151b"></i>No disponible</span><span>FIJA = sesión fijada</span><span>Borde rojo = conflicto</span></div>
    </div>
    <div class="gside">
      ${detail}
      <div class="card" style="padding:14px"><h3 style="margin-bottom:8px">Sin colocar (${un.length})</h3>
        <div class="tray" ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="trayDrop(event,this)">
          ${un.map(l => cardHTML(l, t, id)).join('') || '<p class="muted" style="text-align:center;font-size:12px;margin:18px 0">✓ Todo colocado.<br>Arrastra aquí una sesión para quitarla del horario.</p>'}
        </div></div>
      ${iss.size ? `<div class="card" style="padding:14px"><h3 class="pill-bad" style="margin-bottom:6px">${iss.size} conflicto(s) en el centro</h3><p class="help" style="margin:0">Las sesiones con borde rojo chocan con otra o incumplen una condición obligatoria. Púlsalas para ver el motivo.</p></div>` : ''}
    </div>
  </div>`;
}
function stepEnt(dir){ const t = ui.ht, list = state[COLL[t]]; const i = list.findIndex(x => x.id === ui.hid[t]); ui.hid[t] = list[(i + dir + list.length) % list.length].id; ui.sel = null; render(); }
function selLesson(ev, lid){ ev.stopPropagation(); ui.sel = ui.sel === lid ? null : lid; render(); }
function cellClick(d, s){ if (!ui.sel) return; moveTo(ui.sel, d, s); }
function toggleLock(lid){ mutate(() => { const l = state.lessons.find(x => x.id === lid); if (l.day != null) l.locked = !l.locked; }); }
function unplace(lid){ mutate(() => { const l = state.lessons.find(x => x.id === lid); l.day = l.slot = l.room = null; l.locked = false; }); }

/* mover una sesión; si la celda está ocupada, intenta intercambiar */
let moveTo;
function dStart(ev){
  const el = ev.currentTarget; ui.drag = {lid: el.dataset.lid, off: +el.dataset.off};
  ev.dataTransfer.setData('text/plain', ui.drag.lid); ev.dataTransfer.effectAllowed = 'move';
  setTimeout(() => {
    if (!ui.drag) return;
    el.classList.add('dragging');
    const hl = highlightFor(ui.drag.lid); if (!hl) return;
    $$('#view table.grid td[data-d]').forEach(td => { const k = (+td.dataset.d) + '-' + (+td.dataset.s - ui.drag.off); td.classList.remove('h-ok','h-warn','h-clash','h-bad'); td.classList.add(hl[k] || 'h-bad'); });
  }, 0);
}
function dEnd(){ ui.drag = null; $$('.dragging').forEach(x => x.classList.remove('dragging')); $$('#view td.over').forEach(x => x.classList.remove('over')); if (ui.view === 'horario') setTimeout(render, 0); }
function dOver(ev, td){ if (!ui.drag) return; ev.preventDefault(); $$('#view td.over').forEach(x => x !== td && x.classList.remove('over')); td.classList.add('over'); }
function dDrop(ev, td){ ev.preventDefault(); if (!ui.drag) return; const {lid, off} = ui.drag; ui.drag = null; ui.sel = lid; moveTo(lid, +td.dataset.d, +td.dataset.s - off); }
function trayDrop(ev, el){ ev.preventDefault(); el.classList.remove('over'); if (!ui.drag) return; const lid = ui.drag.lid; ui.drag = null; const l = IX.L.get(lid); if (l && l.day != null){ unplace(lid); toast('Sesión quitada del horario'); } }
function printAll(t){
  const list = state[COLL[t]];
  $('#printArea').innerHTML = list.map(e => `<div class="pblock"><h2>${esc(state.name)}${state.course?' · '+esc(state.course):''} — ${TNAME[t]}: ${esc(e.name)}</h2>${gridHTML(t, e.id, {print:true})}</div>`).join('');
  document.body.classList.add('printall');
  window.print();
}
window.addEventListener('afterprint', () => document.body.classList.remove('printall'));

/* ---------- vista: horario general (sábana) ---------- */
function vSab(){
  const t = ui.st, list = state[COLL[t]], S = state.slots;
  const cls = S.map((s,i) => [s,i]).filter(([s]) => !s.recreo);
  const occ = buildOcc(), iss = allIssues();
  let h = `<table class="sab"><tr><th class="ent" rowspan="2">${TNAME[t]}</th>${state.days.map(d => `<th colspan="${cls.length}">${esc(d)}</th>`).join('')}</tr><tr>${state.days.map(() => cls.map(([s]) => `<th>${s.start}</th>`).join('')).join('')}</tr>`;
  for (const e of list){
    h += `<tr><th class="ent" onclick="ui.ht='${t}';ui.hid['${t}']='${e.id}';go('horario')" title="Abrir su horario">${esc(e.short || e.name)}</th>`;
    state.days.forEach((_, d) => cls.forEach(([sl, s], j) => {
      const arr = (occ.get(t+':'+e.id+':'+d+':'+s) || []).map(x => IX.L.get(x));
      const first = j === 0 ? ' ds' : '';
      if (!arr.length){ h += `<td class="${first.trim()}"></td>`; return; }
      if (arr.some(l => iss.has(l.id))){ h += `<td class="x${first}" title="Conflicto">${arr.length>1?'×'+arr.length:'!'}</td>`; return; }
      if(arr.length>1){h+=`<td class="f${first}" title="Subgrupos simultáneos: ${esc(arr.map(l=>aName(IX.A.get(l.actId))).join(' / '))}">${esc(arr.map(l=>aShort(IX.A.get(l.actId))).join(' / '))}</td>`;return;}
      const l = arr[0], a = IX.A.get(l.actId);
      const txt = t === 'G' ? aShort(a) : t === 'T' ? (a.groupIds.map(g => nm('G',g,1)).join('+') || TYPES[a.type].n.slice(0,4)) : a.groupIds.map(g => nm('G',g,1)).join('+');
      h += `<td class="f${first}" style="--c:${aColor(a)}" title="${esc(actLabel(a))}">${esc(txt)}</td>`;
    }));
    h += '</tr>';
  }
  h += '</table>';
  return `<div class="row noprint" style="margin-bottom:14px"><h2 style="margin:0">Horario general</h2><div class="seg">${['G','T','R'].map(x => `<button class="${t===x?'on':''}" onclick="ui.st='${x}';render()">${TPLUR[x]}</button>`).join('')}</div><span class="grow"></span><button class="btn" onclick="window.print()">Imprimir</button></div>
  <p class="lead noprint">Vista de conjunto («sábana») de todo el centro. Haz clic en un nombre para abrir y editar su horario.</p>
  <div class="card" style="overflow:auto;padding:10px">${list.length ? h : '<div class="empty"><b>Sin datos</b></div>'}</div>`;
}

/* ---------- vista: guardias y ausencias ---------- */
function teachersAt(occ, d, s, filterType){
  const out = [];
  for (const t of state.teachers){
    const arr = occ.get('T:'+t.id+':'+d+':'+s) || [];
    if (arr.some(x => { const a = IX.A.get(IX.L.get(x).actId); return !filterType || a.type === filterType; })) out.push(t);
  }
  return out;
}
function vGuard(){
  const occ = buildOcc();
  let grid = `<table class="grid"><tr><th class="time"></th>${state.days.map(d => `<th>${esc(d)}</th>`).join('')}</tr>`;
  state.slots.forEach((sl, s) => {
    if (sl.recreo){ grid += `<tr class="recreo"><th>${sl.start}</th><td colspan="${state.days.length}">Recreo</td></tr>`; return; }
    grid += `<tr><th class="time">${sl.start}<small>${sl.end}</small></th>`;
    state.days.forEach((_, d) => {
      const g = teachersAt(occ, d, s, 'guardia');
      grid += `<td style="${g.length?'':'background:#1f1216'}">${g.map(t => `<span class="tag">${esc(t.short||t.name)}</span>`).join('') || '<span class="pill-bad" style="font-size:11px">sin guardia</span>'}</td>`;
    });
    grid += '</tr>';
  });
  grid += '</table>';
  // ausencias
  const date = ui.absDate, dt = new Date(date+'T00:00'), dIdx = calendarDay(date);
  const valid = !isNaN(dt) && calendarDay(date) >= 0;
  const recs = state.absences.filter(r => r.date === date);
  const subCount = {}; state.absences.forEach(r => Object.values(r.subs||{}).forEach(t => { if (t) subCount[t] = (subCount[t]||0) + 1; }));
  const absentIds = recs.map(r => r.teacherId);
  const recHTML = recs.map(r => {
    const t = IX.T.get(r.teacherId); if (!t) return '';
    const ls = state.lessons.filter(l => l.day === dIdx && lessonHas(l, 'T', t.id)).sort((a,b) => a.slot - b.slot);
    const rows = ls.map(l => {
      const a = IX.A.get(l.actId);
      const onG = [], free = [];
      for (const c of state.teachers){
        if (c.id === t.id || absentIds.includes(c.id)) continue;
        let g = true, f = true;
        for (let k=0; k<a.dur; k++){
          const arr = occ.get('T:'+c.id+':'+dIdx+':'+(l.slot+k)) || [];
          const types = arr.map(x => IX.A.get(IX.L.get(x).actId).type);
          if (!types.includes('guardia')) g = false;
          if (arr.length || c.av[dIdx+'-'+(l.slot+k)] === 2) f = false;
        }
        if (!canSubstitute(r.id, l.id, c.id)) continue; if (g) onG.push(c); else if (f) free.push(c);
      }
      const takenElsewhere = new Set(); recs.forEach(rr => Object.entries(rr.subs||{}).forEach(([lid2, tid]) => { if (tid && !(rr.id === r.id && lid2 === l.id)){ const l2 = IX.L.get(lid2); if (l2 && intervalsOverlap(l, l2)) takenElsewhere.add(tid); } }));
      const opt = c => `<option value="${c.id}" ${r.subs?.[l.id]===c.id?'selected':''} ${takenElsewhere.has(c.id)?'disabled':''}>${esc(c.name)} (${subCount[c.id]||0} sust.)</option>`;
      return `<tr><td>${slotRange(l.slot, a.dur)}</td><td><span class="dot" style="background:${aColor(a)}"></span>${esc(aName(a))}</td><td>${a.groupIds.map(g => esc(nm('G',g,1))).join(', ') || '—'}</td><td>${l.room ? esc(nm('R',l.room,1)) : '—'}</td>
        <td>${a.type === 'clase' ? `<select class="f" style="width:100%" onchange="setSub('${r.id}','${l.id}',this.value)"><option value="">— Sin cubrir —</option>${onG.length?`<optgroup label="De guardia">${onG.map(opt).join('')}</optgroup>`:''}${free.length?`<optgroup label="Libres a esa hora">${free.map(opt).join('')}</optgroup>`:''}</select>` : '<span class="muted">No requiere sustitución</span>'}</td></tr>`;
    }).join('');
    return `<div class="absrec"><div class="row"><b class="grow">${esc(t.name)}</b><input class="f" placeholder="Motivo / tarea para los alumnos" value="${esc(r.note||'')}" style="width:300px" onchange="mutate(()=>state.absences.find(x=>x.id==='${r.id}').note=this.value,false)"><button class="iconbtn noprint" onclick="mutate(()=>state.absences=state.absences.filter(x=>x.id!=='${r.id}'))"></button></div>
      ${ls.length ? `<table class="t" style="margin-top:8px"><tr><th>Hora</th><th>Actividad</th><th>Grupo</th><th>Aula</th><th>Sustituto</th></tr>${rows}</table>` : '<p class="muted">No tiene sesiones ese día.</p>'}</div>`;
  }).join('');
  return `<h2>Guardias y ausencias</h2>
  <p class="lead">Cuadrante de guardias del horario y gestor de ausencias: registra quién falta un día y MaxHorarios te propone quién puede cubrir cada clase (primero el profesorado de guardia y después quien esté libre), equilibrando el número de sustituciones.</p>
  <div class="card"><div class="row" style="margin-bottom:12px"><h3 style="margin:0" class="grow">Parte de ausencias</h3>
    <label>Fecha <input class="f" type="date" value="${date}" onchange="ui.absDate=this.value;render()"></label>
    <span class="muted">${valid ? esc(dayName(dIdx)) : 'Día no lectivo'}</span>
    <select class="f" id="absT" ${valid?'':'disabled'}><option value="">Añadir profesor ausente…</option>${state.teachers.filter(t => !absentIds.includes(t.id)).map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>
    <button class="btn pri" ${valid?'':'disabled'} onclick="addAbs()">Registrar ausencia</button>
    <button class="btn" ${recs.length?'':'disabled'} onclick="printAbs()">Imprimir parte</button>
    <button class="btn danger" ${recs.length?'':'disabled'} onclick="if(confirm('¿Borrar las ausencias de este día?'))mutate(()=>state.absences=state.absences.filter(r=>r.date!==ui.absDate))">Borrar día</button>
    <button class="btn danger" ${state.absences.length?'':'disabled'} onclick="if(confirm('¿Borrar TODAS las ausencias registradas?'))mutate(()=>state.absences=[])">Borrar todo</button></div>
    <div id="absList">${recHTML || '<p class="muted">No hay ausencias registradas para esta fecha.</p>'}</div>
  </div>
  <div class="card"><h3>Cuadrante de guardias</h3><p class="help" style="margin-top:-6px">Profesorado con actividad de tipo «Guardia» en cada tramo. Créalas en Actividades → «Guardias / reuniones».</p><div class="gridwrap">${grid}</div></div>`;
}
function addAbs(){
  const tid = $('#absT').value; if (!tid) return toast('Elige el profesor ausente');
  mutate(() => state.absences.push({id:uid(), date:ui.absDate, teacherId:tid, note:'', subs:{}}));
}
let setSub;
function printAbs(){
  const date = ui.absDate, dIdx = calendarDay(date);
  const recs = state.absences.filter(r => r.date === date);
  const rows = [];
  for (const r of recs) for (const l of state.lessons.filter(l => l.day === dIdx && lessonHas(l, 'T', r.teacherId)).sort((a,b) => a.slot - b.slot)){
    const a = IX.A.get(l.actId);
    rows.push(`<tr><td>${slotRange(l.slot, a.dur)}</td><td>${esc(nm('T', r.teacherId))}</td><td>${esc(aName(a))}</td><td>${a.groupIds.map(g => esc(nm('G',g))).join(', ')}</td><td>${l.room ? esc(nm('R',l.room)) : ''}</td><td><b>${r.subs?.[l.id] ? esc(nm('T', r.subs[l.id])) : '—'}</b></td><td>${esc(r.note||'')}</td></tr>`);
  }
  $('#printArea').innerHTML = `<div class="pblock"><h2>${esc(state.name)} — Parte de ausencias · ${esc(dayName(dIdx))} ${new Date(date+'T00:00').toLocaleDateString('es-ES')}</h2><table class="t" border="1" style="border-collapse:collapse"><tr><th>Hora</th><th>Ausente</th><th>Actividad</th><th>Grupo</th><th>Aula</th><th>Sustituto</th><th>Observaciones</th></tr>${rows.join('')}</table></div>`;
  document.body.classList.add('printall'); window.print();
}

/* ---------- vista: informes ---------- */
function infData(){
  const occ = buildOcc();
  const T = state.teachers.map(t => {
    const lect = hoursOf('T', t.id, 'clase'), all = hoursOf('T', t.id);
    let days = 0, mx = 0; for (let d=0; d<state.days.length; d++){ const n = dayLoad(occ, 'T', t.id, d, null); if (n) days++; mx = Math.max(mx, n); }
    const guard = state.activities.filter(a => a.type === 'guardia' && allTeachers(a).includes(t.id)).reduce((s,a) => s + a.sessions*a.dur, 0);
    return {e:t, lect, guard, other: all - lect - guard, all, days, mx, gaps: gapsOf('T', t.id, occ), warns: teacherWarnings(t, occ)};
  });
  const G = state.groups.map(g => { let placed = 0; state.lessons.forEach(l => { if (l.day != null && lessonHas(l,'G',g.id)) placed += IX.A.get(l.actId).dur; }); return {e:g, h: hoursOf('G', g.id), placed, gaps: gapsOf('G', g.id, occ)}; });
  const total = state.days.length * classSlots();
  const R = state.rooms.map(r => { let used = 0; state.days.forEach((_,d) => state.slots.forEach((sl,s) => { if (!sl.recreo && busy(occ, 'R:'+r.id+':'+d+':'+s, null)) used++; })); return {e:r, used, pct: total ? Math.round(used/total*100) : 0}; });
  return {T, G, R};
}
function vInf(){
  const {T, G, R} = infData();
  const depts = [...new Set(T.map(x => x.e.dept || 'Sin departamento'))].sort();
  return `<div class="row noprint" style="margin-bottom:6px"><h2 class="grow" style="margin:0">Informes</h2><button class="btn" onclick="exportInf()">Exportar a Excel</button><button class="btn" onclick="window.print()">Imprimir</button></div>
  <p class="lead noprint">Carga horaria del profesorado por departamento, huecos y cumplimiento de condiciones; huecos de los grupos y ocupación de aulas.</p>
  <div class="card"><h3>Profesorado</h3><table class="t"><tr><th>Profesor</th><th>Departamento</th><th>Lectivas</th><th>Guardias</th><th>Otras</th><th>Total</th><th>Días</th><th>Máx./día</th><th>Huecos</th><th>Avisos</th></tr>
  ${depts.map(dp => T.filter(x => (x.e.dept || 'Sin departamento') === dp).map(x => `<tr><td><a href="#" onclick="ui.ht='T';ui.hid.T='${x.e.id}';go('horario');return false">${esc(x.e.name)}</a></td><td>${esc(dp)}</td><td><b>${x.lect}</b></td><td>${x.guard}</td><td>${x.other}</td><td>${x.all}</td><td>${x.days}</td><td>${x.mx}</td><td>${x.gaps}</td><td class="${x.warns.length?'pill-warn':'pill-ok'}" style="font-weight:400">${x.warns.length ? x.warns.map(esc).join('; ') : '✓'}</td></tr>`).join('')).join('')}
  </table></div>
  <div class="row" style="align-items:flex-start">
  <div class="card grow"><h3>Grupos</h3><table class="t"><tr><th>Grupo</th><th>Horas semanales</th><th>Colocadas</th><th>Huecos</th></tr>
  ${G.map(x => `<tr><td>${esc(x.e.name)}</td><td>${x.h}</td><td class="${x.placed===x.h?'pill-ok':'pill-warn'}">${x.placed}</td><td class="${x.gaps?'pill-warn':''}">${x.gaps}</td></tr>`).join('')}</table></div>
  <div class="card grow"><h3>Ocupación de aulas</h3><table class="t"><tr><th>Aula</th><th>Tramos ocupados</th><th style="width:40%">Ocupación</th></tr>
  ${R.map(x => `<tr><td>${esc(x.e.name)}</td><td>${x.used}</td><td><div class="progress" style="height:10px"><div style="width:${x.pct}%"></div></div><small class="muted">${x.pct}%</small></td></tr>`).join('')}</table></div>
  </div>`;
}
function exportInf(){
  const {T} = infData();
  const rows = [['Profesor','Departamento','Lectivas','Guardias','Otras','Total','Días','Máx/día','Huecos','Avisos']];
  T.forEach(x => rows.push([x.e.name, x.e.dept||'', x.lect, x.guard, x.other, x.all, x.days, x.mx, x.gaps, x.warns.join('; ')]));
  download(fname()+'_informe_profesorado.csv', toCSV(rows), 'text/csv'); toast('Informe exportado');
}

/* ---------- teclado ---------- */
document.addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (e.key === 'Escape'){ if ($('#modal').classList.contains('on')) closeModal(); else if (ui.sel){ ui.sel = null; render(); } }
  if ((e.ctrlKey || e.metaKey) && !typing){
    if (e.key.toLowerCase() === 'z' && !e.shiftKey){ e.preventDefault(); undo(); }
    else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)){ e.preventDefault(); redo(); }
  }
  if (ui.view === 'horario' && ui.sel && !typing && !$('#modal').classList.contains('on')){
    if (e.key === 'Delete' || e.key === 'Backspace'){ unplace(ui.sel); }
    if (e.key.toLowerCase() === 'f' && !e.ctrlKey){ toggleLock(ui.sel); }
  }
  if (e.key === 'Enter' && $('#modal').classList.contains('on') && e.target.tagName === 'INPUT' && !['checkbox','radio','file'].includes(e.target.type)){ const b = $('#mbox .btn.pri'); if (b && !b.disabled){ e.preventDefault(); b.click(); } }
});

/* ---------- datos de ejemplo ---------- */
function loadSample(){
  if(solving)return toast('Detén primero la búsqueda');
  if ((state.teachers.length || state.activities.length) && !confirm('¿Reemplazar los datos actuales por el ejemplo? (puedes deshacer con Ctrl+Z)')) return;
  detachCloud();
  mutate(() => {
    if (state.etapa === 'primaria'){ state = samplePrimaria(); return; }
    state = sampleSecundaria();
  });
  ui.view = 'inicio'; render(); toast('Ejemplo cargado: ahora pulsa «Generar»');
}

/* ejemplo de colegio: tutores con su clase y especialistas */
function samplePrimaria(){
  const s = blank(); s.name = 'CEIP Ejemplo'; s.course = currentSchoolCourse(); s.etapa = 'primaria';
  s.slots = ETAPAS.primaria.slots.map(([start, end, r]) => r ? {start, end, recreo:true} : {start, end});
  const mk = (c, n, sh, extra = {}) => { const e = {id:uid(), name:n, short:sh, av:{}, ...extra}; s[c].push(e); return e; };
  const R = {gim: mk('rooms','Gimnasio','GIM',{kind:'Deportes'}), pat: mk('rooms','Patio','PAT',{kind:'Deportes'}), mus: mk('rooms','Aula de Música','MUS',{kind:'Específica'}), bib: mk('rooms','Biblioteca','BIB',{kind:'Específica'})};
  const G = {};
  for (const [lv, L] of [['1º Primaria','A'],['1º Primaria','B'],['2º Primaria','A'],['2º Primaria','B']]){
    const [name, short] = groupName(lv, L), r = mk('rooms','Aula '+name,'A'+short,{kind:'Aula de referencia'});
    G[short] = mk('groups', name, short, {level:lv, roomId:r.id});
  }
  const S = {}; let ci = 0;
  [['LEN','Lengua Castellana'],['MAT','Matemáticas'],['CN','Ciencias de la Naturaleza'],['CS','Ciencias Sociales'],['ING','Inglés'],['EF','Educación Física'],['MUS','Música'],['PLA','Plástica'],['LEC','Lectura'],['REL','Religión'],['ATE','Atención Educativa']]
    .forEach(([sh,n]) => S[sh] = mk('subjects', n, sh, {color: PALETTE[ci++]}));
  const T = {};
  [['carmen','Carmen Ruiz','CRU','Tutoría 1º A'],['antonio','Antonio Gil','AGI','Tutoría 1º B'],['rosa','Rosa Martín','RMA','Tutoría 2º A'],['javier','Javier León','JLE','Tutoría 2º B'],
   ['laura','Laura Prieto','LPR','Inglés'],['miguel','Miguel Cano','MCA','Educación Física',{maxConsec:4}],['pilar','Pilar Soto','PSO','Música'],['teresa','Teresa Vidal','TVI','Religión']]
    .forEach(([k,n,sh,dp,ex]) => T[k] = mk('teachers', n, sh, {dept:dp, ...ex}));
  const add = (sub, g, t, h, rooms, extra = {}) => s.activities.push({id:uid(), type:'clase', subjectId:S[sub].id, groupIds:[G[g].id], teacherIds:[T[t].id], roomIds: rooms || [G[g].roomId], parts:[], sessions:h, dur:1, maxDay: h > 5 ? 2 : 1, spread: h <= 3, ...extra});
  const tutor = {'1ºA':'carmen','1ºB':'antonio','2ºA':'rosa','2ºB':'javier'};
  for (const g in tutor){
    const t = tutor[g];
    add('LEN', g, t, 5); add('MAT', g, t, 5); add('CN', g, t, 2); add('CS', g, t, 2); add('PLA', g, t, 1); add('LEC', g, t, 1);
    add('ING', g, 'laura', 3); add('EF', g, 'miguel', 3, [R.gim.id, R.pat.id]); add('MUS', g, 'pilar', 1, [R.mus.id]);
    // Religión y Atención Educativa a la misma hora (el grupo se divide)
    add('REL', g, 'teresa', 2, [G[g].roomId], {parts:[{subjectId:S.ATE.id, teacherIds:[T.pilar.id], roomId:R.bib.id}]});
  }
  s.activities.push({id:uid(), type:'reunion', subjectId:'', groupIds:[], teacherIds:[T.carmen.id, T.antonio.id, T.rosa.id, T.javier.id], roomIds:[], parts:[], sessions:1, dur:1, maxDay:1, spread:false});
  s.activities.push({id:uid(), type:'compl', subjectId:'', groupIds:[], teacherIds:[T.laura.id], roomIds:[], parts:[], sessions:2, dur:1, maxDay:1, spread:false});
  [0,1,2,3,5,6].forEach(sl => { T.teresa.av['2-'+sl] = 2; T.teresa.av['4-'+sl] = 2; }); // Teresa (itinerante) no viene miércoles ni viernes
  [0,1,2,3,4].forEach(d => S.EF.av[d+'-0'] = 1);                                        // Ed. Física mejor no a primera hora
  [0,1,2,3,4].forEach(d => { S.MAT.av[d+'-6'] = 1; S.LEN.av[d+'-6'] = 1; });              // Lengua y Mates mejor por la mañana
  return s;
}

/* =====================================================================
   Nube: inicio de sesión con Google (cuenta Educarex) y guardado en su Drive.
   Solo usa el permiso drive.file: la app ve únicamente los archivos que ella crea.
   ===================================================================== */
const GOOGLE_CLIENT_ID = '657014385303-nh40rev8ahjd03gnjof9k6kltnus8v5r.apps.googleusercontent.com'; // proyecto maximilian23-visor, cliente «MaxHorarios web»
const CLOUD_KEY = STORAGE_PREFIX + '_cloud';
const SCOPES = 'https://www.googleapis.com/auth/drive.file openid email';
let cloud = { token:null, exp:0, user:null, fileId:null, fileName:'', status:'', saving:false, dirty:false };
let tokenClient = null, cloudTimer = null, tokenWaiters = [], authEpoch=0;
try { const c = JSON.parse(localStorage.getItem(CLOUD_KEY) || '{}'); cloud.fileId = c.fileId || null; cloud.fileName = c.fileName || ''; cloud.hint = c.email || ''; cloud.syncedAt = c.syncedAt || ''; } catch(e){}
/* syncedAt = fecha de Drive de la última versión que este equipo subió o abrió */
function cloudPersist(){ try { localStorage.setItem(CLOUD_KEY, JSON.stringify({fileId: cloud.fileId, fileName: cloud.fileName, email: cloud.user?.email || cloud.hint || '', syncedAt: cloud.syncedAt || ''})); } catch(e){} }

function renderCloud(){
  const el = $('#cloud'); if (!el) return;
  if (!cloud.user){
    el.innerHTML = `<button class="btn alt" onclick="cloudSignIn()" title="Guarda tus horarios en el Google Drive de tu cuenta Educarex">Entrar con Google</button>`;
    return;
  }
  const st = cloud.saving ? 'Guardando…' : cloud.status;
  el.innerHTML = `<button class="btn alt" onclick="cloudMenu()" title="${esc(cloud.user.email)}">${esc(cloud.user.name || cloud.user.email)}</button><small class="muted" style="font-family:var(--mono)">${esc(st)}</small>`;
}
function gisReady(){ return window.google && google.accounts && google.accounts.oauth2; }
function cloudSignIn(){
  if (!GOOGLE_CLIENT_ID) return openModal(`<h3>Guardado en Google Drive</h3><p>Falta configurar el <b>ID de cliente de Google</b> en el programa (constante <code>GOOGLE_CLIENT_ID</code>). Mientras tanto, los datos se guardan en este navegador y puedes usar «Guardar».</p><div class="mfoot"><button class="btn pri" onclick="closeModal()">Entendido</button></div>`);
  if (location.protocol === 'file:') return toast('Para entrar con Google abre MaxHorarios desde la web (maximilian23.com/horarios)');
  if (!gisReady()) return toast('Cargando el acceso de Google… vuelve a intentarlo en un momento');
  getToken(true).then(cloudAfterLogin).catch(e => toast('No se pudo iniciar sesión: ' + e.message));
}
/* obtiene un token de acceso; interactive=false intenta renovarlo sin molestar */
function getToken(interactive){
  if (cloud.token && Date.now() < cloud.exp - 60000) return Promise.resolve(cloud.token);
  return new Promise((resolve, reject) => {
    tokenWaiters.push({resolve, reject});
    if (tokenWaiters.length > 1) return;
    const requestEpoch=authEpoch;
    if (!tokenClient) tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID, scope: SCOPES,
      callback: r => {
        if(requestEpoch!==authEpoch)return;
        const ws = tokenWaiters; tokenWaiters = [];
        if (r.error){ ws.forEach(w => w.reject(new Error(r.error_description || r.error))); return; }
        cloud.token = r.access_token; cloud.exp = Date.now() + (r.expires_in || 3600) * 1000;
        ws.forEach(w => w.resolve(cloud.token));
      },
      error_callback: e => { if(requestEpoch!==authEpoch)return;const ws = tokenWaiters; tokenWaiters = []; ws.forEach(w => w.reject(new Error(e.type === 'popup_closed' ? 'ventana cerrada' : (e.message || e.type)))); }
    });
    tokenClient.requestAccessToken({prompt: interactive ? '' : 'none', login_hint: cloud.user?.email || cloud.hint || undefined});
  });
}
async function gapi(url, opts = {}, retry = true){
  const epoch=authEpoch;
  const token = await getToken(false).catch(e=>{if(epoch!==authEpoch)throw e;return getToken(true);});
  if(epoch!==authEpoch)throw Error('Conexión cancelada');
  const r = await fetch(url, {...opts, headers: {...(opts.headers || {}), Authorization: 'Bearer ' + token}});
  if(epoch!==authEpoch)throw Error('Conexión cancelada');
  if (r.status === 401 && retry){ cloud.token = null; return gapi(url, opts, false); }
  if (!r.ok){ let m = r.status + ''; try { m = (await r.json()).error.message; } catch(e){} throw new Error(m); }
  return r;
}
const DRIVE = 'https://www.googleapis.com/drive/v3/files', UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const projName = () => 'MaxHorarios - ' + (state.name || 'Horario') + (state.course ? ' ' + state.course : '') + '.json';
let driveList;
async function driveCreate(name, body){
  const meta = {name, mimeType:'application/json', appProperties:{maxhorario:'1'}};
  const fd = new FormData();
  fd.append('metadata', new Blob([JSON.stringify(meta)], {type:'application/json'}));
  fd.append('file', new Blob([body], {type:'application/json'}));
  return (await gapi(`${UPLOAD}?uploadType=multipart&fields=id,name,modifiedTime`, {method:'POST', body:fd})).json();
}
let driveUpdate;
async function driveGet(id){ return (await gapi(`${DRIVE}/${id}?alt=media`)).json(); }

let cloudAfterLogin;
async function cloudMenu(files){
  if (!cloud.user) return cloudSignIn();
  try { files = files || await driveList(); } catch(e){ return toast('' + e.message); }
  const fmt = t => new Date(t).toLocaleString('es-ES', {dateStyle:'short', timeStyle:'short'});
  openModal(`<h3>Mis horarios en Google Drive</h3>
    <p class="muted">Cuenta: <b>${esc(cloud.user.email)}</b>. Los archivos se guardan en tu Drive y se actualizan solos mientras trabajas. Puedes compartirlos desde Drive con tu equipo directivo.</p>
    ${files.length ? `<table class="t"><tr><th>Archivo</th><th>Modificado</th><th></th></tr>${files.map(f => `<tr><td>${f.id === cloud.fileId ? '✅ ' : ''}${esc(f.name)}</td><td>${fmt(f.modifiedTime)}</td><td style="text-align:right;white-space:nowrap">${f.id === cloud.fileId ? '<span class="pill-ok">Abierto</span>' : `<button class="btn sm" data-drive-id="${esc(f.id)}" data-drive-name="${esc(f.name)}">Abrir</button>`} <button class="btn sm danger" data-trash-id="${esc(f.id)}">Borrar</button></td></tr>`).join('')}</table>`
      : '<p class="muted">Todavía no tienes horarios guardados en tu Drive.</p>'}
    <div class="mfoot"><button class="btn danger" style="margin-right:auto" onclick="cloudSignOut()">Cerrar sesión</button><button class="btn" onclick="closeModal()">Cerrar</button><button class="btn pri" onclick="cloudSaveAsNew()">Guardar el proyecto actual ${cloud.fileId ? 'como copia nueva' : 'en mi Drive'}</button></div>`);
}
let cloudOpen;
let cloudSaveAsNew;
let cloudSchedule;
let cloudSaveNow;
function cloudSignOut(){
  authEpoch++;const waiters=tokenWaiters;tokenWaiters=[];for(const w of waiters)w.reject(Error('Conexión cancelada'));
  if (cloud.token && gisReady()) google.accounts.oauth2.revoke(cloud.token, () => {});
  cloud = {token:null, exp:0, user:null, fileId:null, fileName:'', status:'', saving:false, dirty:false};
  tokenClient = null; try { localStorage.removeItem(CLOUD_KEY); } catch(e){}
  closeModal(); renderCloud(); toast('Sesión cerrada. Tus archivos siguen en tu Drive.');
}
window.addEventListener('beforeunload', e => { if (cloud.dirty || cloud.saving){ e.preventDefault(); e.returnValue = ''; } });
// Google Identity is loaded on demand after requesting a connection (privacy.js).

// Initialization is called after the validation and interface modules have installed validation and UI behavior.

function sampleSecundaria(){
    const s = blank(); s.name = 'IES Ejemplo'; s.course = currentSchoolCourse(); s.etapa = 'secundaria';
    const mk = (c, n, sh, extra = {}) => { const e = {id:uid(), name:n, short:sh, av:{}, ...extra}; s[c].push(e); return e; };
    const R = {};
    [['101','A101'],['102','A102'],['201','A201'],['202','A202']].forEach(([n,sh]) => R[n] = mk('rooms','Aula '+n, sh, {kind:'Aula ordinaria', cap:30}));
    R.gim = mk('rooms','Gimnasio','GIM',{kind:'Deportes'}); R.pat = mk('rooms','Pista exterior','PIS',{kind:'Deportes'});
    R.lab = mk('rooms','Laboratorio','LAB',{kind:'Específica', cap:24}); R.mus = mk('rooms','Aula de Música','MUS',{kind:'Específica'});
    R.pla = mk('rooms','Aula de Plástica','PLA',{kind:'Específica'}); R.tal = mk('rooms','Taller de Tecnología','TAL',{kind:'Específica'});
    R.des = mk('rooms','Aula de desdoble','DES',{kind:'Aula pequeña', cap:15});
    const G = {
      '1A': mk('groups','1º ESO A','1A',{level:'1º ESO', roomId:R['101'].id}), '1B': mk('groups','1º ESO B','1B',{level:'1º ESO', roomId:R['102'].id}),
      '2A': mk('groups','2º ESO A','2A',{level:'2º ESO', roomId:R['201'].id}), '2B': mk('groups','2º ESO B','2B',{level:'2º ESO', roomId:R['202'].id})
    };
    const S = {}; let ci = 0;
    [['LEN','Lengua Castellana'],['MAT','Matemáticas'],['ING','Inglés'],['GH','Geografía e Historia'],['BIO','Biología y Geología'],['FQ','Física y Química'],['EF','Educación Física'],['MUS','Música'],['EPV','Educación Plástica'],['TEC','Tecnología'],['TUT','Tutoría'],['FRA','Francés'],['RMT','Refuerzo de Matemáticas']]
      .forEach(([sh,n]) => S[sh] = mk('subjects', n, sh, {color: PALETTE[ci++]}));
    const T = {};
    [['ana','Ana García','AGA','Lengua'],['luis','Luis Pérez','LPE','Lengua'],['marta','Marta Ruiz','MRU','Matemáticas'],['jorge','Jorge López','JLO','Matemáticas'],
     ['elena','Elena Sanz','ESA','Inglés',{freeDay:true}],['pablo','Pablo Díaz','PDI','Geografía e Historia',{maxDay:4}],['lucia','Lucía Romero','LRO','Ciencias',{maxGaps:3}],
     ['carlos','Carlos Moreno','CMO','Educación Física',{maxConsec:3}],['sara','Sara Gil','SGI','Música'],['raul','Raúl Ortiz','ROR','Dibujo'],['irene','Irene Vega','IVE','Tecnología'],['nora','Nora Blanco','NBL','Francés',{minDay:2}]]
      .forEach(([k,n,sh,dp,ex]) => T[k] = mk('teachers', n, sh, {dept:dp, ...ex}));
    const add = (sub, g, t, h, rooms, dur = 1, extra = {}) => s.activities.push({id:uid(), type:'clase', subjectId:S[sub].id, groupIds:[G[g].id], teacherIds:[T[t].id], roomIds: rooms || [G[g].roomId], parts:[], sessions:h, dur, maxDay:1, spread:true, ...extra});
    for (const g of ['1A','1B']){
      add('LEN', g, 'ana', 4); add('MAT', g, 'marta', 4); add('ING', g, 'elena', 4); add('GH', g, 'pablo', 3);
      add('BIO', g, 'lucia', 3, [R.lab.id, G[g].roomId]); add('EF', g, 'carlos', 2, [R.gim.id, R.pat.id]); add('MUS', g, 'sara', 2, [R.mus.id]); add('EPV', g, 'raul', 1, [R.pla.id], 2);
    }
    for (const g of ['2A','2B']){
      add('LEN', g, 'luis', 4); add('MAT', g, 'jorge', 4); add('ING', g, 'elena', 3); add('GH', g, 'pablo', 3);
      add('FQ', g, 'lucia', 3, [R.lab.id, G[g].roomId]); add('EF', g, 'carlos', 2, [R.gim.id, R.pat.id]); add('MUS', g, 'sara', 2, [R.mus.id]); add('TEC', g, 'irene', 3, [R.tal.id]);
    }
    add('TUT','1A','ana',1); add('TUT','1B','jorge',1); add('TUT','2A','luis',1); add('TUT','2B','lucia',1);
    // optativas simultáneas de 2º: Francés / Refuerzo de Matemáticas (grupos 2A+2B a la vez)
    s.activities.push({id:uid(), type:'clase', subjectId:S.FRA.id, groupIds:[G['2A'].id, G['2B'].id], teacherIds:[T.nora.id], roomIds:[R['201'].id], parts:[{subjectId:S.RMT.id, teacherIds:[T.marta.id], roomId:R.des.id}], sessions:2, dur:1, maxDay:1, spread:true});
    // guardias y reuniones
    const guard = (t, n) => s.activities.push({id:uid(), type:'guardia', subjectId:'', groupIds:[], teacherIds:[T[t].id], roomIds:[], parts:[], sessions:n, dur:1, maxDay:1, spread:false});
    ['ana','luis','marta','jorge','pablo','sara','raul','irene','nora','carlos'].forEach(t => guard(t, 2)); guard('elena', 1);
    s.activities.push({id:uid(), type:'reunion', subjectId:'', groupIds:[], teacherIds:[T.ana.id, T.luis.id], roomIds:[], parts:[], sessions:1, dur:1, maxDay:1, spread:false});
    s.activities.push({id:uid(), type:'reunion', subjectId:'', groupIds:[], teacherIds:[T.marta.id, T.jorge.id], roomIds:[], parts:[], sessions:1, dur:1, maxDay:1, spread:false});
    // condiciones de ejemplo
    [0,1,2,4,5,6].forEach(sl => T.carlos.av['4-'+sl] = 2);   // Carlos no puede los viernes
    [0,1,2,4,5,6].forEach(sl => T.sara.av['2-'+sl] = 2);     // Sara no puede los miércoles
    T.ana.av['0-0'] = 1; T.ana.av['0-1'] = 1;                // Ana prefiere no empezar el lunes pronto
    [0,1,2,3,4].forEach(d => T.irene.av[d+'-6'] = 2);        // Irene no puede a última hora
    [0,1,2,3,4].forEach(d => S.EF.av[d+'-0'] = 1);           // Ed. Física mejor no a primera hora
    [0,1,2,3,4].forEach(d => S.MAT.av[d+'-6'] = 1);          // Matemáticas mejor no a última hora
    return s;
}
