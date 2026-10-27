import {normalizarCorreo,correoEducarex,claveCorreo,esPropietario} from './permisos.js?v=panel-rutinas1';
export function prepararGestionAdmin(fb){
  const {db,D,auth}=fb,form=document.getElementById('autorizar-correo'),estado=document.getElementById('estado-permisos');
  let uid=null,parar=null;
  form.addEventListener('submit',async e=>{e.preventDefault();estado.textContent='';const correo=normalizarCorreo(form.elements.correo.value);
    if(!esPropietario(auth.currentUser)){estado.textContent='Solo la cuenta propietaria puede añadir permisos.';return;}
    if(!correoEducarex(correo)){estado.textContent='Escribe un correo válido terminado en @educarex.es.';return;}
    const boton=form.querySelector('button[type=submit]');boton.disabled=true;
    try{await D.set(D.ref(db,'maximilian/correosAutorizados/'+claveCorreo(correo)),true);estado.textContent='Acceso autorizado para '+correo+'. Ya puede entrar con su cuenta Educarex.';form.reset();}catch{estado.textContent='No se ha podido autorizar el correo. Comprueba la conexión y tus permisos.';}finally{boton.disabled=false;}
  });
  return{usuario(user){parar?.();parar=null;uid=null;document.getElementById('menu-admin-propietario').hidden=!esPropietario(user);document.getElementById('correos-autorizados').replaceChildren();
    if(!esPropietario(user))return;uid=user.uid;
    parar=D.onValue(D.ref(db,'maximilian/correosAutorizados'),s=>{if(uid!==user.uid)return;const lista=document.getElementById('correos-autorizados');lista.replaceChildren();const claves=new Set(Object.keys(s.val()||{}).filter(k=>s.val()[k]===true));claves.add(claveCorreo(auth.currentUser.email));for(const clave of [...claves].sort()){const correo=clave.replaceAll(',','.'),li=document.createElement('li'),texto=document.createElement('span');texto.textContent=correo;li.append(texto);if(correo===normalizarCorreo(auth.currentUser.email)){const etiqueta=document.createElement('small');etiqueta.textContent='Propietaria';li.append(etiqueta);}else{const quitar=document.createElement('button');quitar.type='button';quitar.className='peligro';quitar.textContent='×';quitar.setAttribute('aria-label','Retirar acceso a '+correo);quitar.addEventListener('click',async()=>{quitar.disabled=true;try{if(!esPropietario(auth.currentUser))throw Error('Sin permiso');await D.remove(D.ref(db,'maximilian/correosAutorizados/'+clave));estado.textContent='Acceso retirado a '+correo+'.';}catch{estado.textContent='No se ha podido retirar el acceso.';quitar.disabled=false;}});li.append(quitar);}lista.append(li);}if(!lista.children.length){const li=document.createElement('li');li.textContent='Todavía no has añadido correos desde este apartado.';lista.append(li);}},()=>{estado.textContent='No se ha podido consultar la lista de correos.';});
  }};
}
