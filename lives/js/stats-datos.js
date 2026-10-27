export const FUNCIONES={sesion:'Sesión',mensajes:'Mensajes',gestos:'Gestos y emociones',cuentos:'Cuentos',historial:'Historial',admin:'Admin',stats:'STATS',recursos:'Abrir dibujos y fichas',visor:'Abrir visor',nuevaSesion:'Nueva sesión',mensaje:'Mensaje enviado',detener:'Detener',pausar:'Pausar cuento',continuar:'Continuar cuento',saludar:'Saludar',guino:'Guiñar',atencion:'Atención',parpadeo:'Parpadeo',reposo:'Reposo',alegria:'Alegría',sorpresa:'Sorpresa',tristeza:'Tristeza',serio:'Serio',estrella:'Cuento: estrella',tortuga:'Cuento: Tina',nube:'Cuento: nube',zorro:'Cuento: Leo',semilla:'Cuento: semilla'};
export function funcionComando(d){if(d.tipo==='decir')return 'mensaje';if(d.tipo==='cuento')return d.cuento;if(d.tipo==='gesto')return d.gesto;if(d.tipo==='reproduccion')return d.accion;if(d.tipo==='detener')return 'detener';return null;}
export function resumirCuentas(datos,desde=0,ahora=Date.now()){
 const cuentas=[];for(const [uid,visitas] of Object.entries(datos||{})){const sesiones=Object.values(visitas||{}).filter(v=>v&&v.inicio>=desde&&typeof v.email==='string').sort((a,b)=>b.inicio-a.inicio);if(!sesiones.length)continue;
 const usos={},email=sesiones[0].email;let conectado=0,activo=0;for(const v of sesiones){conectado+=Number(v.segundos)||0;activo+=Number(v.activos)||0;for(const [k,n] of Object.entries(v.uso||{}))if(FUNCIONES[k])usos[k]=(usos[k]||0)+n;}
 cuentas.push({uid,email,accesos:sesiones.length,conectado,activo,ultimo:sesiones[0].inicio,enLinea:sesiones.some(v=>!v.fin&&ahora-v.actualizado<90000),usos,sesiones});}
 return cuentas.sort((a,b)=>b.ultimo-a.ultimo);
}
export function duracion(s){const m=Math.floor(Math.max(0,s)/60);return m>=60?Math.floor(m/60)+' h '+m%60+' min':m+' min';}
