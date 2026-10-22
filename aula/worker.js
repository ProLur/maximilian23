const ORIGINS=new Set(['https://maximilian23.com','https://www.maximilian23.com']);
const SLOTS=new Set(['T1','T2','T3','T4','T5']);
const MASTER_CANCEL_HASH='46635b56d3c7f0b7bb26adae2a1692debbfd145d4a0986a9137fe91e73e70360';
const TEACHERS=new Set(['Lali','Inma','Mari Ángeles','Fani','Mawi','Mamen','Isabel','Rosa','Cristina','Marian','Chiqui','Gema','Paula','May','María Jesús','Silverio','Carmina','Manuel','Berna','Luis','Vero','Chari','Arancha','Susi','Fran','Sarah','Manoli','Admin','Adriana','Lidia'].map(userId));
const FIJAS=[{dia:5,tramo:'T2',grupo:'Religión'},{dia:2,tramo:'T3',grupo:'5º Bilingüe'},{dia:3,tramo:'T3',grupo:'6º Bilingüe'},{dia:4,tramo:'T4',grupo:'5º Bilingüe'},{dia:2,tramo:'T4',grupo:'A.E.'},{dia:5,tramo:'T1',grupo:'A.E.'}];

export default{async fetch(request,env){
  const origin=request.headers.get('Origin')||'',headers=cors(origin);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(!ORIGINS.has(origin))return out({error:'Origen no permitido.'},403,headers);
  try{
    const path=new URL(request.url).pathname.replace(/\/+$/,'')||'/';
    if(path==='/blog-views')return await blogViews(request,env,headers);
    if(path==='/clasif')return await classification(request,env,headers);
    if(path==='/juez')return await juez(request,env,headers);
    if(path==='/blog-images'){
      headers['X-Blog-Images-Version']='firebase-rs256-v2';
      try{return await blogImages(request,env,headers);}
      catch(error){
        console.error('Blog images:',error?.message||'request failed');
        return out({error:'No se pudieron guardar las imágenes en el servidor. Conserva el texto e inténtalo de nuevo. Si se repite, comprueba la conexión con GitHub.'},503,headers);
      }
    }
    if(path==='/meteo')return await meteo(request,env,headers);
    if(request.method==='GET'){
      const record=await read(env);
      return out({reservas:withFijas(record.reservas||{})},200,headers);
    }
    if(request.method!=='POST')return out({error:'Método no permitido.'},405,headers);
    const body=await request.json();
    if(body.accion==='reset_password')return resetPassword(body,env,headers);
    const error=validate(body);
    if(error)return out({error},400,headers);
    const record=await read(env),bookingKey=body.fecha+'_'+body.tramo;
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
      if(!(await save(env,record)).ok)throw Error();
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
    if(!(await save(env,record)).ok)throw Error();
    return out({ok:true},201,headers);
  }catch(error){
    console.error('Aula reservas:',error?.message||error);
    return out({error:'No se ha podido conectar con las reservas. Espera unos segundos y vuelve a intentarlo.'},503,headers)
  }
}};

// Measurements are stored separately from visits, one document per date.
const METEO_PASSWORD_HASH='d5012077b8f1480d6f97bb97c91905dc0cb27e91be9e9f22f2199d8622ae9b30';
function validateMeteo(value){
  if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value.fecha||''))throw Error('Indica una fecha válida.');
  const date=new Date(value.fecha+'T12:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value.fecha||value.fecha<'2026-09-01'||value.fecha>'2100-08-31')throw Error('La fecha no es válida para este curso.');
  const entry={fecha:value.fecha};
  for(const [key,min,max] of [['temp_indoor',-80,80],['temp_outdoor',-80,80],['hum_outdoor',0,100],['wind_speed',0,150],['rain',0,3000]]){
    const raw=value[key];
    if(raw===null||raw===undefined||String(raw).trim()===''){entry[key]=null;continue;}
    const number=Number(String(raw).replace(',','.'));
    if(!Number.isFinite(number)||number<min||number>max)throw Error('Revisa el valor de '+key+'.');
    entry[key]=number;
  }
  entry.wind_direction=clean(value.wind_direction,40)||null;
  if(Object.entries(entry).filter(([key])=>key!=='fecha').every(([,v])=>v===null))throw Error('Introduce al menos una medición.');
  return entry;
}
async function meteo(request,env,headers){
  if(request.method==='GET'){
    const token=await getAccessToken(env),url=firestoreDocUrl(env,'meteoObservations');
    const rows=[];let pageToken='';
    do{
      const response=await fetch(url+'?pageSize=1000'+(pageToken?'&pageToken='+encodeURIComponent(pageToken):''),{headers:{Authorization:'Bearer '+token}});
      if(!response.ok)throw Error('Firestore meteo '+response.status);
      const data=await response.json();
      rows.push(...(data.documents||[]).map(d=>fromFsFields(d.fields||{})));
      pageToken=data.nextPageToken||'';
    }while(pageToken);
    return out({meteo:rows.sort((a,b)=>a.fecha.localeCompare(b.fecha))},200,headers);
  }
  if(request.method!=='POST')return out({error:'Método no permitido.'},405,headers);
  const body=await request.json();
  if(await passwordHash(body.password)!==(env.METEO_PASSWORD_HASH||METEO_PASSWORD_HASH))return out({error:'Contraseña incorrecta. Vuelve a iniciar sesión.'},401,headers);
  if(body.action==='login')return out({ok:true},200,headers);
  if(body.action!=='save')return out({error:'Acción no válida.'},400,headers);
  let entry;try{entry=validateMeteo(body.entry);}catch(error){return out({error:error.message},400,headers);}
  if(!(await save(env,entry,'meteoObservations/'+entry.fecha)).ok)throw Error('No se pudo guardar la medición.');
  return out({ok:true,fecha:entry.fecha},200,headers);
}

async function classification(request,env,headers){
  if(request.method==='GET'){
    const record=await read(env,'futbol/clasificacion');
    return out(record,200,headers);
  }
  if(request.method!=='POST')return out({error:'Método no permitido.'},405,headers);
  const body=await request.json(),teams=['3º A','3º B','4º A','4º B','5º A','5º B'];
  if(!body?.scores||teams.some(team=>!Array.isArray(body.scores[team])||body.scores[team].length!==36))return out({error:'Datos de clasificación no válidos.'},400,headers);
  const scores={};
  for(const team of teams)scores[team]=body.scores[team].map(value=>Math.max(0,Math.min(10,Math.round((Number(value)||0)*10)/10)));
  const record={scores,lastUpdate:new Date().toISOString()};
  if(!(await save(env,record,'futbol/clasificacion')).ok)throw Error();
  return out({ok:true,lastUpdate:record.lastUpdate},200,headers);
}

async function resetPassword(body,env,headers){
  const nombre=clean(body.nombre,60),adminPassword=String(body.adminPassword||'');
  if(!nombre)return out({error:'Indica el nombre del profesor.'},400,headers);
  const adminHash=await passwordHash(adminPassword);
  if(adminHash!==MASTER_CANCEL_HASH)return out({error:'Contraseña de administrador incorrecta.'},401,headers);
  const usuario=userId(nombre);
  if(usuario==='admin')return out({error:'La contraseña de Admin no se puede eliminar aquí.'},400,headers);
  if(!TEACHERS.has(usuario))return out({error:'Ese nombre no está en la lista de profesores.'},404,headers);
  const record=await read(env);
  record.usuarios||={};
  delete record.usuarios[usuario];
  record.ultimaActualizacion=new Date().toISOString();
  if(!(await save(env,record)).ok)throw Error();
  return out({ok:true},200,headers);
}

async function juez(request,env,headers){
  if(request.method==='GET'){
    const record=await read(env,'futbol/juez');
    return out(Object.keys(record).length?record:{fecha:null,decision:null},200,headers);
  }
  if(request.method!=='POST')return out({error:'Método no permitido.'},405,headers);
  const body=await request.json();
  if(!body||!['play','no-play'].includes(body.decision))return out({error:'Decisión no válida.'},400,headers);
  const hash=await passwordHash(body.password);
  if(hash!==MASTER_CANCEL_HASH)return out({error:'Contraseña incorrecta.'},401,headers);
  const record={fecha:madridDate(),decision:body.decision,actualizado:new Date().toISOString()};
  if(!(await save(env,record,'futbol/juez')).ok)throw Error();
  return out({ok:true},200,headers);
}
function madridDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function cors(origin){return{'Access-Control-Allow-Origin':ORIGINS.has(origin)?origin:'https://maximilian23.com','Vary':'Origin','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Cache-Control':'no-store'}}
function out(data,status,headers){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}})}

// --- Imágenes de los blogs en GitHub ---
const BLOG_EDITORS={
  cite:new Set(['mmartinezf001@educarex.es']),
  aula:new Set(['fmhernandezr02@educarex.es','mmartinezf001@educarex.es']),
  meteo:new Set(['mmartinezf001@educarex.es','fjboraitab01@educarex.es']),
  huerto:new Set(['mmartinezf001@educarex.es','silverio68@educarex.es'])
};
async function blogImages(request,env,headers){
  if(request.method!=='POST')return out({error:'Método no permitido.'},405,headers);
  const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const identity=await firebaseIdentity(token,env);
  if(!identity)return out({error:'La sesión ha caducado. Cierra sesión y vuelve a entrar.'},401,headers);
  const body=await request.json(),blog=String(body.blog||'').toLowerCase();
  if(!BLOG_EDITORS[blog]?.has(identity.email))return out({error:'Esta cuenta no está autorizada para editar este blog.'},403,headers);
  if(body.action==='upload'){
    const postId=safePart(body.postId,100),images=Array.isArray(body.images)?body.images:[];
    if(!postId||!images.length||images.length>4)return out({error:'Envío de imágenes no válido.'},400,headers);
    const urls=[],paths=[];
    for(let index=0;index<images.length;index++){
      const match=String(images[index]).match(/^data:image\/webp;base64,([A-Za-z0-9+/=]+)$/);
      if(!match||match[1].length>1000000)return out({error:'Una imagen no tiene un formato o tamaño válido.'},400,headers);
      const path=`blog/${blog}/images/${postId}/${String(index+1).padStart(2,'0')}-${crypto.randomUUID()}.webp`;
      await githubPut(env,path,match[1],`Añadir imagen de ${blog}: ${postId}`);
      paths.push(path);urls.push(`https://raw.githubusercontent.com/ProLur/maximilian23/main/${path}`);
    }
    return out({urls,paths},201,headers);
  }
  if(body.action==='delete'){
    const paths=Array.isArray(body.paths)?body.paths:[];
    if(paths.length>20)return out({error:'Demasiadas imágenes para eliminar.'},400,headers);
    for(const path of paths){
      const value=String(path||'');
      if(!value.startsWith(`blog/${blog}/images/`)||value.includes('..'))return out({error:'Ruta de imagen no válida.'},400,headers);
      await githubDelete(env,value,`Eliminar imagen de ${blog}`);
    }
    return out({ok:true},200,headers);
  }
  return out({error:'Acción no válida.'},400,headers);
}
const FIREBASE_JWKS_URL='https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let firebaseSigningKeys={keys:[],expires:0,fetched:0};
function decodeJwtPart(value){
  if(!/^[A-Za-z0-9_-]+$/.test(value))throw Error('Invalid token encoding');
  const padded=value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4);
  return Uint8Array.from(atob(padded),c=>c.charCodeAt(0));
}
async function firebaseSigningKey(kid){
  const now=Date.now();
  const known=firebaseSigningKeys.keys.find(key=>key.kid===kid);
  if(firebaseSigningKeys.expires<=now||(!known&&now-firebaseSigningKeys.fetched>60000)){
    const response=await fetch(FIREBASE_JWKS_URL,{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('No se pudo comprobar la sesión con Firebase. Conserva el texto e inténtalo de nuevo.');
    const data=await response.json();
    if(!Array.isArray(data.keys)||!data.keys.length)throw Error('Firebase no devolvió sus claves de verificación.');
    const seconds=Number((response.headers.get('Cache-Control')||'').match(/max-age=(\d+)/)?.[1]||3600);
    firebaseSigningKeys={keys:data.keys,expires:now+Math.min(seconds,86400)*1000,fetched:now};
  }
  return firebaseSigningKeys.keys.find(key=>key.kid===kid&&key.kty==='RSA'&&key.alg==='RS256');
}
async function firebaseIdentity(token,env){
  if(typeof token!=='string'||!token||token.length>20000)return null;
  let header,claims,signature,parts;
  try{
    parts=token.split('.');
    if(parts.length!==3)return null;
    header=JSON.parse(new TextDecoder().decode(decodeJwtPart(parts[0])));
    claims=JSON.parse(new TextDecoder().decode(decodeJwtPart(parts[1])));
    signature=decodeJwtPart(parts[2]);
  }catch{return null;}
  const project=env.FIREBASE_PROJECT_ID||'cronica-escolar-maximilian23',now=Math.floor(Date.now()/1000);
  if(header.alg!=='RS256'||typeof header.kid!=='string'||!header.kid)return null;
  if(claims.aud!==project||claims.iss!=='https://securetoken.google.com/'+project)return null;
  if(!Number.isInteger(claims.exp)||claims.exp<=now||!Number.isInteger(claims.iat)||claims.iat>now||claims.exp<=claims.iat)return null;
  if(!Number.isInteger(claims.auth_time)||claims.auth_time>now)return null;
  if(typeof claims.sub!=='string'||!claims.sub||claims.sub.length>128)return null;
  if(claims.email_verified!==true||typeof claims.email!=='string'||!claims.email.trim())return null;
  const jwk=await firebaseSigningKey(header.kid);
  if(!jwk)return null;
  let verified=false;
  try{
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    verified=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,signature,new TextEncoder().encode(parts[0]+'.'+parts[1]));
  }catch{return null;}
  return verified?{email:claims.email.trim().toLowerCase(),uid:claims.sub}:null;
}
function safePart(value,max){return String(value||'').toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/(^-|-$)/g,'').slice(0,max)}
function githubHeaders(env){return{'Authorization':'Bearer '+env.GITHUB_TOKEN,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json','User-Agent':'maximilian23-blog-images'}}
async function githubPut(env,path,content,message){
  const response=await fetch('https://api.github.com/repos/ProLur/maximilian23/contents/'+path,{method:'PUT',headers:githubHeaders(env),body:JSON.stringify({message,content,branch:'main'})});
  if(!response.ok)throw Error('GitHub upload '+response.status);
}
async function githubDelete(env,path,message){
  const url='https://api.github.com/repos/ProLur/maximilian23/contents/'+path;
  const current=await fetch(url,{headers:githubHeaders(env)});
  if(current.status===404)return;
  if(!current.ok)throw Error('GitHub read '+current.status);
  const {sha}=await current.json();
  const response=await fetch(url,{method:'DELETE',headers:githubHeaders(env),body:JSON.stringify({message,sha,branch:'main'})});
  if(!response.ok&&response.status!==404)throw Error('GitHub delete '+response.status);
}

// --- Firestore ---
let cachedSA=null,cachedToken=null;
function getSA(env){
  if(!cachedSA)cachedSA=JSON.parse(env.FIREBASE_SA_KEY);
  return cachedSA;
}
function b64urlFromBuffer(buf){
  let binary='';
  for(const b of new Uint8Array(buf))binary+=String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64url(str){return b64urlFromBuffer(new TextEncoder().encode(str))}
async function importPrivateKey(pem){
  const body=pem.replace(/-----BEGIN PRIVATE KEY-----/,'').replace(/-----END PRIVATE KEY-----/,'').replace(/\s+/g,'');
  const der=Uint8Array.from(atob(body),c=>c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8',der.buffer,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
}
async function signJwt(sa){
  const now=Math.floor(Date.now()/1000);
  const header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const claims=b64url(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const unsigned=header+'.'+claims;
  const key=await importPrivateKey(sa.private_key);
  const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned));
  return unsigned+'.'+b64urlFromBuffer(sig);
}
async function getAccessToken(env){
  const now=Math.floor(Date.now()/1000);
  if(cachedToken&&cachedToken.exp>now+60)return cachedToken.token;
  const sa=getSA(env);
  const assertion=await signJwt(sa);
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion='+encodeURIComponent(assertion)});
  if(!response.ok)throw Error('Firebase auth '+response.status);
  const data=await response.json();
  cachedToken={token:data.access_token,exp:now+data.expires_in};
  return cachedToken.token;
}
function firestoreDocUrl(env,docPath){
  return `https://firestore.googleapis.com/v1/projects/${getSA(env).project_id}/databases/(default)/documents/${docPath}`;
}
function toFsValue(v){
  if(v===null||v===undefined)return{nullValue:null};
  if(typeof v==='boolean')return{booleanValue:v};
  if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
  if(typeof v==='string')return{stringValue:v};
  if(Array.isArray(v))return{arrayValue:{values:v.map(toFsValue)}};
  return{mapValue:{fields:toFsFields(v)}};
}
function toFsFields(obj){
  const fields={};
  for(const k in obj)fields[k]=toFsValue(obj[k]);
  return fields;
}
function fromFsValue(v){
  if(!v||'nullValue' in v)return null;
  if('booleanValue' in v)return v.booleanValue;
  if('integerValue' in v)return Number(v.integerValue);
  if('doubleValue' in v)return v.doubleValue;
  if('stringValue' in v)return v.stringValue;
  if('arrayValue' in v)return(v.arrayValue.values||[]).map(fromFsValue);
  if('mapValue' in v)return fromFsFields(v.mapValue.fields||{});
  return null;
}
function fromFsFields(fields){
  const obj={};
  for(const k in fields)obj[k]=fromFsValue(fields[k]);
  return obj;
}
async function read(env,docPath='aula/estado'){
  const token=await getAccessToken(env);
  const response=await fetch(firestoreDocUrl(env,docPath),{headers:{Authorization:'Bearer '+token}});
  if(response.status===404)return docPath==='aula/estado'?{config:{},reservas:{},usuarios:{}}:{};
  if(!response.ok)throw Error('Firestore '+response.status);
  const data=await response.json();
  return fromFsFields(data.fields||{});
}
async function save(env,record,docPath='aula/estado'){
  const token=await getAccessToken(env);
  const response=await fetch(firestoreDocUrl(env,docPath),{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({fields:toFsFields(record)})});
  return{ok:response.ok};
}

function mondayOf(offset){const today=new Date();today.setHours(0,0,0,0);const monday=new Date(today);monday.setDate(today.getDate()-((today.getDay()+6)%7)+offset*7);return monday}
function isoDate(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function withFijas(reservas){const merged={...reservas};for(const fija of FIJAS)for(let offset=0;offset<=1;offset++){const d=mondayOf(offset);d.setDate(d.getDate()+(fija.dia-1));merged[isoDate(d)+'_'+fija.tramo]={nombre:fija.grupo,grupo:fija.grupo,usuario:'fija',fija:true}}return merged}
function esFija(fecha,tramo){const date=new Date(fecha+'T12:00:00');return FIJAS.some(f=>f.dia===date.getDay()&&f.tramo===tramo)}
function clean(value,max){return String(value||'').trim().replace(/[<>]/g,'').slice(0,max)}
function userId(nombre){return nombre.normalize('NFD').replace(/[̀-ͯ]/g,'').toLocaleLowerCase('es-ES').replace(/\s+/g,' ').trim()}
async function passwordHash(value){const bytes=new TextEncoder().encode(String(value||''));const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')}
function validate(body){if(!body||!/^\d{4}-\d{2}-\d{2}$/.test(body.fecha)||!SLOTS.has(body.tramo)||String(body.password||'').length<4)return'La contraseña debe tener al menos 4 caracteres.';if(body.accion!=='cancelar'&&(!clean(body.nombre,60)||!clean(body.grupo,40)))return'Completa correctamente todos los datos.';const date=new Date(body.fecha+'T12:00:00');if(![1,2,3,4,5].includes(date.getDay()))return'Solo se puede reservar de lunes a viernes.';const today=new Date();today.setHours(0,0,0,0);const monday=new Date(today);monday.setDate(today.getDate()-((today.getDay()+6)%7));const end=new Date(monday);end.setDate(end.getDate()+11);end.setHours(23,59,59,999);if(date<monday||date>end)return'Solo están disponibles la semana actual y la siguiente.';return''}


// Included in worker.js: only these four collections can be counted.
const BLOG_COLLECTIONS = { cite: 'citePosts', aula: 'aulaBlogPosts', meteo: 'meteoBlogPosts', huerto: 'huertoBlogPosts' };
const BLOG_PROJECT = 'cronica-escolar-maximilian23';
const VIEW_WINDOW_MS = 30 * 60 * 1000;
let viewHmacKey;

async function blogViews(request, env, headers) {
  headers['X-Blog-Views-Version'] = 'server-v1';
  if (request.method !== 'POST') return out({ error: 'Método no permitido.' }, 405, headers);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return out({ error: 'Se requiere JSON.' }, 415, headers);
  if (Number(request.headers.get('Content-Length') || 0) > 1024) return out({ error: 'Solicitud demasiado grande.' }, 413, headers);
  // Bound streaming bodies as well as requests carrying Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return out({ error: 'Faltan datos.' }, 400, headers);
  let size = 0, chunks = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1024) { await reader.cancel(); return out({ error: 'Solicitud demasiado grande.' }, 413, headers); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let body;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { return out({ error: 'JSON no válido.' }, 400, headers); }
  if (!body || Array.isArray(body) || Object.keys(body).some(k => !['blog', 'id', 'visitorId'].includes(k))
    || !Object.hasOwn(BLOG_COLLECTIONS, body.blog)
    || typeof body.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,199}$/.test(body.id)
    || typeof body.visitorId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.visitorId)) {
    return out({ error: 'Datos de visita no válidos.' }, 400, headers);
  }
  // Reuse the existing server credential; never send it to the browser.
  // A distinct domain-separated HMAC input prevents recovering visitor UUIDs.
  viewHmacKey ||= await crypto.subtle.importKey('raw', new TextEncoder().encode(getSA(env).private_key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', viewHmacKey, new TextEncoder().encode(`blog-views-v1:${body.blog}:${body.id}:${body.visitorId.toLowerCase()}`));
  const receiptId = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  const database = `projects/${BLOG_PROJECT}/databases/(default)`;
  const base = `https://firestore.googleapis.com/v1/${database}/documents`;
  const postName = `${database}/documents/${BLOG_COLLECTIONS[body.blog]}/${body.id}`;
  const receiptName = `${database}/documents/_blogViewReceipts/${receiptId}`;
  const token = await getAccessToken(env);
  const auth = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  const fsFetch = (url, options = {}) => fetch(url, { ...options, headers: auth, signal: AbortSignal.timeout(10000) });
  // Optimistic preconditions + one atomic commit handle simultaneous tabs and retries.
  for (let attempt = 0; attempt < 4; attempt++) {
    const postResponse = await fsFetch(`https://firestore.googleapis.com/v1/${postName}?mask.fieldPaths=status&mask.fieldPaths=views`);
    if (postResponse.status === 404) return out({ error: 'Entrada no disponible.' }, 404, headers);
    if (!postResponse.ok) throw Error('Blog views read ' + postResponse.status);
    const post = await postResponse.json();
    if (post.fields?.status?.stringValue !== 'published') return out({ error: 'Entrada no disponible.' }, 404, headers);
    const raw = post.fields?.views;
    const views = raw ? Number(raw.integerValue) : 0;
    if (!Number.isSafeInteger(views) || views < 0) throw Error('Invalid blog view counter');
    const receiptResponse = await fsFetch(`https://firestore.googleapis.com/v1/${receiptName}`);
    if (!receiptResponse.ok && receiptResponse.status !== 404) throw Error('Blog receipt read ' + receiptResponse.status);
    const receipt = receiptResponse.ok ? await receiptResponse.json() : null;
    const now = Date.now(), last = Date.parse(receipt?.fields?.countedAt?.timestampValue || '');
    if (Number.isFinite(last) && now - last < VIEW_WINDOW_MS) {
      return out({ ok: true, counted: false, views, retryAfterMs: Math.min(VIEW_WINDOW_MS, VIEW_WINDOW_MS - (now - last)) }, 200, headers);
    }
    const commit = await fsFetch(base + ':commit', { method: 'POST', body: JSON.stringify({ writes: [
      { transform: { document: postName, fieldTransforms: [{ fieldPath: 'views', increment: { integerValue: '1' } }] }, currentDocument: { updateTime: post.updateTime } },
      { update: { name: receiptName, fields: { countedAt: { timestampValue: new Date(now).toISOString() }, expireAt: { timestampValue: new Date(now + 86400000).toISOString() } } }, currentDocument: receipt ? { updateTime: receipt.updateTime } : { exists: false } }
    ] }) });
    if ([409, 412].includes(commit.status)) continue;
    // FAILED_PRECONDITION may also be surfaced as HTTP 400 by Firestore.
    if (!commit.ok) {
      const failure = await commit.json().catch(() => ({}));
      if (['ABORTED', 'ALREADY_EXISTS', 'FAILED_PRECONDITION'].includes(failure.error?.status)) continue;
      throw Error('Blog views commit ' + commit.status);
    }
    return out({ ok: true, counted: true, views: views + 1, retryAfterMs: VIEW_WINDOW_MS }, 200, headers);
  }
  return out({ error: 'Visita pendiente. Vuelve a intentarlo.' }, 503, headers);
}
