export const PROPIETARIO_EMAIL='mmartinezf001@educarex.es';
export const PROPIETARIO_UID='maximilian-owner-d214a047-2e3c-4773-94bd-b36434ac33d4';
export function normalizarCorreo(correo){return String(correo||'').trim().toLowerCase();}
export function correoEducarex(correo){return /^[a-z0-9][a-z0-9._+\-]*@educarex\.es$/.test(correo)&&correo.length<=254;}
export function claveCorreo(correo){return normalizarCorreo(correo).replaceAll('.',',');}
export function esPropietario(user){return user?.uid===PROPIETARIO_UID&&user.emailVerified===true&&normalizarCorreo(user.email)===PROPIETARIO_EMAIL;}
export async function tieneAcceso({db,D},user){
  const uid=(await D.get(D.ref(db,'maximilian/admins/'+user.uid))).val()===true;
  if(uid)return true;
  const email=normalizarCorreo(user.email);if(!user.emailVerified||!correoEducarex(email))return false;
  return(await D.get(D.ref(db,'maximilian/correosAutorizados/'+claveCorreo(email)))).val()===true;
}
export function escucharAcceso({db,D},user,onCambio){
  const rutas=['maximilian/admins/'+user.uid],email=normalizarCorreo(user.email);
  if(user.emailVerified&&correoEducarex(email))rutas.push('maximilian/correosAutorizados/'+claveCorreo(email));
  const valores=rutas.map(()=>null),parar=[];let comprobacion=null;
  rutas.forEach((ruta,i)=>{const actualizar=v=>{valores[i]=v;if(valores.every(v=>v!==null)){clearTimeout(comprobacion);if(valores.some(Boolean))onCambio(true);else comprobacion=setTimeout(()=>onCambio(false),200);}};parar.push(D.onValue(D.ref(db,ruta),s=>actualizar(s.val()===true),()=>actualizar(false)));});
  return()=>{clearTimeout(comprobacion);parar.forEach(fn=>fn());};
}
