export function contarPantallas(datos, ahora) {
  if(!datos || typeof datos!=='object')return 0;
  return Object.values(datos).flatMap(v=>v && typeof v==='object'?Object.values(v):[])
    .filter(t=>Number.isFinite(t) && t<=ahora+1000 && ahora-t<90000).length;
}
export async function exigirPantalla({db,D,base,ahora}) {
  const [conexion,presencia]=await Promise.all([
    new Promise((resolve,reject)=>D.onValue(D.ref(db,'.info/connected'),resolve,reject,{onlyOnce:true})),
    D.get(D.ref(db,base+'/presencia')),
  ]);
  if(conexion.val()!==true)throw Error('Sin conexión con el servidor. No se ha enviado la orden.');
  if(contarPantallas(presencia.val(),ahora())===0)
    throw Error('No hay ninguna pantalla conectada a esta sesión. Conecta un visor con su código y vuelve a enviar.');
}
