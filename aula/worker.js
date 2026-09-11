const BIN_ID='6aa116caac6210605ab70811';
const JSONBIN_URL='https://api.jsonbin.io/v3/b/'+BIN_ID;
const CLASSIF_BIN_ID='6aa13d37ffd5d16053f13ac9';
const CLASSIF_URL='https://api.jsonbin.io/v3/b/'+CLASSIF_BIN_ID;
const ORIGINS=new Set(['https://maximilian23.com','https://www.maximilian23.com']);
const SLOTS=new Set(['T1','T2','T3','T4','T5']);
const MASTER_CANCEL_HASH='46635b56d3c7f0b7bb26adae2a1692debbfd145d4a0986a9137fe91e73e70360';
const TEACHERS=new Set(['Lali','Inma','Mari Ángeles','Fani','Mawi','Mamen','Isabel','Rosa','Cristina','Marian','Chiqui','Gema','Paula','May','María Jesús','Silverio','Carmina','Manuel','Berna','Luis','Vero','Chari','Arancha','Susi','Fran','Sarah','Manoli','Admin','Adriana','Lidia'].map(userId));
const FIJAS=[{dia:5,tramo:'T2',grupo:'Religión'},{dia:2,tramo:'T3',grupo:'5º Bilingüe'},{dia:3,tramo:'T3',grupo:'6º Bilingüe'},{dia:4,tramo:'T4',grupo:'5º Bilingüe'}];

export default{async fetch(request,env){
  const origin=request.headers.get('Origin')||'',headers=cors(origin);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(!ORIGINS.has(origin))return out({error:'Origen no permitido.'},403,headers);
  try{
    const path=new URL(request.url).pathname.replace(/\/+$/,'')||'/';
    if(path==='/clasif')return classification(request,env,headers);
    if(request.method==='GET'){
      const record=await read(env.JSONBIN_KEY);
      return out({reservas:withFijas(record.reservas||{})},200,headers);
    }
    if(request.method!=='POST')return out({error:'Método no permitido.'},405,headers);
    const body=await request.json(),error=validate(body);
    if(error)return out({error},400,headers);
    const record=await read(env.JSONBIN_KEY),bookingKey=body.fecha+'_'+body.tramo;
    record.reservas||={};record.usuarios||={};

    if(body.accion!=='cancelar'&&esFija(body.fecha,body.tramo))return out({error:'Ese horario está reservado de forma fija para todo el curso.'},409,headers);

    if(body.accion==='cancelar'){
      const booking=record.reservas[bookingKey];
      if(!booking)return out({error:'La reserva ya no existe.'},404,headers);
      const entered=await passwordHash(body.password);
      const stored=booking.passwordHash||(booking.usuario&&record.usuarios[booking.usuario]?.passwordHash);
      if(entered!==MASTER_CANCEL_HASH){
        const legacy=await passwordHash('PARTIDOHOY');
        if(!stored&&entered!==legacy)return out({error:'Esta reserva antigua se anula con la contraseña anterior.'},401,headers);
        if(stored&&entered!==stored)return out({error:'Contraseña incorrecta.'},401,headers);
      }
      delete record.reservas[bookingKey];record.ultimaActualizacion=new Date().toISOString();
      if(!(await save(env.JSONBIN_KEY,record)).ok)throw Error();
      return out({ok:true},200,headers);
    }

    if(record.reservas[bookingKey])return out({error:'Ese hueco acaba de ser reservado. Elige otro.'},409,headers);
    const nombre=clean(body.nombre,60),grupo=clean(body.grupo,40),usuario=userId(nombre),hash=await passwordHash(body.password);
    if(!TEACHERS.has(usuario))return out({error:'No puedes crear una reserva del aula del futuro'},403,headers);
    if(usuario==='admin'&&hash!==MASTER_CANCEL_HASH)return out({error:'Contraseña de administrador incorrecta.'},401,headers);
    if(record.usuarios[usuario]&&record.usuarios[usuario].passwordHash!==hash)return out({error:'La contraseña no coincide con la registrada para ese nombre.'},401,headers);
    if(!record.usuarios[usuario])record.usuarios[usuario]={nombre,passwordHash:hash,creado:new Date().toISOString()};
    record.reservas[bookingKey]={nombre,grupo,usuario,passwordHash:hash,creada:new Date().toISOString()};
    record.ultimaActualizacion=new Date().toISOString();
    if(!(await save(env.JSONBIN_KEY,record)).ok)throw Error();
    return out({ok:true},201,headers);
  }catch(error){
    console.error('Aula reservas:',error?.message||error);
    return out({error:'No se ha podido conectar con las reservas. Espera unos segundos y vuelve a intentarlo.'},503,headers)
  }
}};

async function classification(request,env,headers){
  if(request.method==='GET'){
    const response=await jsonbinUrl(CLASSIF_URL,env.JSONBIN_KEY);
    const data=await response.json();
    return out(data.record||{},200,headers);
  }
  if(request.method!=='POST')return out({error:'Método no permitido.'},405,headers);
  const body=await request.json(),teams=['3º A','3º B','4º A','4º B','5º A','5º B'];
  if(!body?.scores||teams.some(team=>!Array.isArray(body.scores[team])||body.scores[team].length!==36))return out({error:'Datos de clasificación no válidos.'},400,headers);
  const scores={};
  for(const team of teams)scores[team]=body.scores[team].map(value=>Math.max(0,Math.min(10,Math.round((Number(value)||0)*10)/10)));
  const record={scores,lastUpdate:new Date().toISOString()};
  await jsonbinUrl(CLASSIF_URL,env.JSONBIN_KEY,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)});
  return out({ok:true,lastUpdate:record.lastUpdate},200,headers);
}

function cors(origin){return{'Access-Control-Allow-Origin':ORIGINS.has(origin)?origin:'https://maximilian23.com','Vary':'Origin','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store'}}
function out(data,status,headers){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}})}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function jsonbin(key,options={}){
  return jsonbinUrl(JSONBIN_URL,key,options);
}
async function jsonbinUrl(url,key,options={}){
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(url,{...options,headers:{...(options.headers||{}),'X-Master-Key':key}});
      if(response.ok)return response;
      lastError=Error(`JSONBin ${response.status}`);
      if(response.status<500&&response.status!==429)throw lastError;
    }catch(error){lastError=error}
    if(attempt<2)await wait(300*(attempt+1));
  }
  throw lastError||Error('JSONBin no disponible');
}
async function read(key){const response=await jsonbin(key);const data=await response.json();if(!data?.record)throw Error('Respuesta de JSONBin inválida');return data.record}
function save(key,record){return jsonbin(key,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)})}
function mondayOf(offset){const today=new Date();today.setHours(0,0,0,0);const monday=new Date(today);monday.setDate(today.getDate()-((today.getDay()+6)%7)+offset*7);return monday}
function isoDate(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function withFijas(reservas){const merged={...reservas};for(const fija of FIJAS)for(let offset=0;offset<=1;offset++){const d=mondayOf(offset);d.setDate(d.getDate()+(fija.dia-1));merged[isoDate(d)+'_'+fija.tramo]={nombre:fija.grupo,grupo:fija.grupo,usuario:'fija',fija:true}}return merged}
function esFija(fecha,tramo){const date=new Date(fecha+'T12:00:00');return FIJAS.some(f=>f.dia===date.getDay()&&f.tramo===tramo)}
function clean(value,max){return String(value||'').trim().replace(/[<>]/g,'').slice(0,max)}
function userId(nombre){return nombre.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-ES').replace(/\s+/g,' ').trim()}
async function passwordHash(value){const bytes=new TextEncoder().encode(String(value||''));const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')}
function validate(body){if(!body||!/^\d{4}-\d{2}-\d{2}$/.test(body.fecha)||!SLOTS.has(body.tramo)||String(body.password||'').length<4)return'La contraseña debe tener al menos 4 caracteres.';if(body.accion!=='cancelar'&&(!clean(body.nombre,60)||!clean(body.grupo,40)))return'Completa correctamente todos los datos.';const date=new Date(body.fecha+'T12:00:00');if(![1,2,3,4,5].includes(date.getDay()))return'Solo se puede reservar de lunes a viernes.';const today=new Date();today.setHours(0,0,0,0);const monday=new Date(today);monday.setDate(today.getDate()-((today.getDay()+6)%7));const end=new Date(monday);end.setDate(end.getDate()+11);if(date<monday||date>end)return'Solo están disponibles la semana actual y la siguiente.';return''}
