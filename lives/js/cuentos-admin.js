import { CUENTOS } from './cuentos.js?v=cuentos-admin2';
export function prepararCuentosAdmin(enviar){
  const biblioteca=document.getElementById('biblioteca'),estado=document.getElementById('estado-cuento');
  for(const cuento of CUENTOS){
    const boton=document.createElement('button');boton.type='button';boton.className='tarjeta-cuento';boton.style.setProperty('--cuento-color',cuento.color);
    const icono=document.createElement('span');icono.className='cuento-mini-icono';icono.textContent=cuento.icono;
    const titulo=document.createElement('strong');titulo.textContent=cuento.titulo;
    const tema=document.createElement('small');tema.textContent=cuento.tema+' · 1 minuto aprox.';
    const accion=document.createElement('span');accion.className='cuento-accion';accion.textContent='▶ Contar este cuento';
    boton.append(icono,titulo,tema,accion);
    boton.addEventListener('click',async()=>{boton.disabled=true;estado.textContent='Enviando cuento…';try{const ok=await enviar({tipo:'cuento',cuento:cuento.id},biblioteca);estado.textContent=ok?'Enviado: '+cuento.titulo+'.':'';}finally{boton.disabled=false;}});
    document.getElementById('cuentos').append(boton);
  }
  for(const [id,datos,texto] of [['pausar-cuento-admin',{tipo:'reproduccion',accion:'pausar'},'Pausa enviada.'],['continuar-cuento-admin',{tipo:'reproduccion',accion:'continuar'},'Continuación enviada.'],['detener-cuento',{tipo:'detener'},'Cuento detenido.']]){
    document.getElementById(id).addEventListener('click',async()=>{estado.textContent=(await enviar(datos,biblioteca))?texto:'';});
  }
}
