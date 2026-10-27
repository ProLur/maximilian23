// Navegación local: no crea lecturas ni escrituras en Firebase.
export function prepararMenu(panel){
  const nav=panel.querySelector('#navegacion-panel'),toggle=panel.querySelector('#menu-toggle');
  const botones=[...nav.querySelectorAll('[data-vista]')],secciones=[...panel.querySelectorAll('[data-seccion]')];
  const cerrar=()=>{nav.classList.remove('abierto');toggle.setAttribute('aria-expanded','false');};
  function mostrar(id,enfocar=false){
    if(!secciones.some(s=>s.dataset.seccion===id))return;
    secciones.forEach(s=>s.hidden=s.dataset.seccion!==id);
    botones.forEach(b=>{if(b.dataset.vista===id)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    panel.querySelector('#seccion-actual').textContent=botones.find(b=>b.dataset.vista===id).textContent;
    cerrar();
    if(enfocar){const titulo=secciones.find(s=>!s.hidden).querySelector('h2');titulo.tabIndex=-1;titulo.focus();}
  }
  toggle.addEventListener('click',()=>{const abierta=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(abierta));nav.classList.toggle('abierto',abierta);});
  botones.forEach(b=>b.addEventListener('click',()=>mostrar(b.dataset.vista,true)));
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){cerrar();toggle.focus();}});
  mostrar('sesion');return{mostrar};
}
