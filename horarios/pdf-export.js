// PDFs are built entirely on the device. Dependencies are bundled with the app.
let timetablePdfLoading=null,timetablePdfBusy=false;
function loadTimetablePdf(){
 if(window.jspdf?.jsPDF&&window.jspdf.jsPDF.API.autoTable)return Promise.resolve();
 if(timetablePdfLoading)return timetablePdfLoading;
 const loadScript=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('No se pudo preparar el PDF. Comprueba que la carpeta vendor acompaña a la aplicación.'));};document.head.appendChild(s);});
 timetablePdfLoading=(async()=>{if(!window.jspdf?.jsPDF)await loadScript('vendor/jspdf.umd.min.js');if(!window.jspdf.jsPDF.API.autoTable)await loadScript('vendor/jspdf.plugin.autotable.min.js');})().catch(e=>{timetablePdfLoading=null;throw e;});
 return timetablePdfLoading;
}
function timetablePdfData(type,ids){
 if(!['G','T','R'].includes(type))throw Error('Selecciona clases, profesores o aulas.');
 const list=state[COLL[type]],issues=allIssues(),report=complianceReport();
 const describe=l=>{const a=IX.A.get(l.actId);return [aName(a),type!=='G'?a.groupIds.map(id=>nm('G',id)).join(', '):'',type!=='T'?allTeachers(a).map(id=>nm('T',id)).join(', '):'',type!=='R'?[...new Set([l.room,...a.parts.map(p=>p.roomId)].filter(Boolean))].map(id=>nm('R',id)).join(', '):''].filter(Boolean).join('\n');};
 const entities=ids.map(id=>list.find(e=>e.id===id)).filter(Boolean).map(e=>{
  const lessons=entityLessons(type,e.id),at=new Map();
  for(const l of lessons)if(l.day!=null){const a=IX.A.get(l.actId);for(let off=0;off<a.dur;off++){const key=l.day+':'+(l.slot+off);if(!at.has(key))at.set(key,[]);at.get(key).push({l,off});}}
  const rows=state.slots.map((slot,s)=>({time:slot.start+' - '+slot.end,recess:!!slot.recreo,cells:state.days.map((_,d)=>{
   const here=at.get(d+':'+s)||[],bad=here.some(({l})=>issues.has(l.id));
   return {text:slot.recreo?'Recreo':here.map(({l,off})=>(off?'(Continuación)\n':'')+describe(l)+(issues.has(l.id)?'\nCONFLICTO: '+issues.get(l.id).join('; '):'')).join('\n\n')||((e.av||{})[d+'-'+s]===2?'No disponible':''),bad};
  })}));
  return {name:e.name,rows,unplaced:lessons.filter(l=>l.day==null).map(l=>describe(l))};
 });
 if(!entities.length)throw Error('No hay horarios seleccionados para exportar.');
 if(!state.days.length||!state.slots.length)throw Error('Completa los días y tramos del marco horario antes de exportar.');
 return {centre:state.name,course:state.course,type,label:TNAME[type],plural:TPLUR[type],days:[...state.days],entities,draft:!report.ok,generated:new Date().toLocaleDateString('es-ES')};
}
function createTimetablePdf(data){
 const doc=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 // Helvetica's built-in encoding preserves Spanish accents and keeps the PDF selectable.
 const clean=s=>String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[–—]/g,'-').replace(/→/g,'->').replace(/↳/g,'');
 doc.setProperties({title:clean('Horarios - '+data.centre),author:'MaxHorarios',subject:clean(data.plural)});
 let first=true;
 for(const entity of data.entities){
  for(let offset=0;offset<data.days.length;offset+=5){
   if(!first)doc.addPage();first=false;
   const days=data.days.slice(offset,offset+5),width=doc.internal.pageSize.getWidth(),height=doc.internal.pageSize.getHeight();
   const title=doc.splitTextToSize(clean(data.centre+(data.course?' · '+data.course:'')),width-24);
   const name=doc.splitTextToSize(clean(data.label+': '+entity.name),width-24),top=12+title.length*5+name.length*4.5+9;
   if(top>height-40)throw Error('El nombre del centro o del horario es demasiado largo para el encabezado del PDF.');
   const header=()=>{doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(24,42,62);doc.text(title,12,12);doc.setFontSize(11);doc.text(name,12,12+title.length*5);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(data.draft?150:70,data.draft?65:70,45);doc.text(data.draft?'BORRADOR - revisión normativa pendiente':'Revisión final del centro necesaria',12,top-4);};
   const rows=entity.rows.map(row=>[{content:row.time,styles:{fontStyle:'bold',fillColor:[240,244,248]}},...row.cells.slice(offset,offset+5).map(cell=>({content:clean(cell.text),styles:cell.bad?{fillColor:[255,230,230]}:row.recess?{fillColor:[230,238,246],fontStyle:'italic'}:{}}))]);
   doc.autoTable({head:[['Hora',...days.map(clean)]],body:rows,startY:top,margin:{left:12,right:12,top,bottom:14},theme:'grid',styles:{font:'helvetica',fontSize:9,cellPadding:2.4,overflow:'linebreak',valign:'top',textColor:[24,35,48],lineColor:[210,219,228],lineWidth:.2},headStyles:{fillColor:[31,63,88],textColor:255,fontStyle:'bold'},columnStyles:{0:{cellWidth:25}},rowPageBreak:'avoid',showHead:'everyPage',willDrawPage:header});
  }
  if(entity.unplaced.length){
   doc.addPage();
   const heading=doc.splitTextToSize(clean(data.centre+' · '+data.label+': '+entity.name),doc.internal.pageSize.getWidth()-24),top=18+heading.length*5;
   doc.autoTable({head:[['Sesiones sin colocar - '+clean(entity.name)]],body:entity.unplaced.map(s=>[clean(s)]),startY:top,margin:{left:12,right:12,top,bottom:14},theme:'grid',styles:{font:'helvetica',fontSize:9,cellPadding:2.4},headStyles:{fillColor:[133,65,43]},willDrawPage:()=>{doc.setFontSize(10);doc.setTextColor(24,42,62);doc.text(heading,12,12);doc.setFontSize(8);doc.text(data.draft?'BORRADOR - revisión normativa pendiente':'Revisión final del centro necesaria',12,top-4);}});
  }
 }
 const total=doc.getNumberOfPages();for(let p=1;p<=total;p++){doc.setPage(p);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(90);doc.text('MaxHorarios · '+data.generated,12,doc.internal.pageSize.getHeight()-6);doc.text(p+' / '+total,doc.internal.pageSize.getWidth()-12,doc.internal.pageSize.getHeight()-6,{align:'right'});}
 return doc;
}
async function exportTimetablePDF(all=false){
 if(timetablePdfBusy)return toast('El PDF se está preparando.');
 if(solving)return toast('Espera a que termine la generación del horario.');
 timetablePdfBusy=true;
 try{
  const type=ui.ht,list=state[COLL[type]]||[],ids=all?list.map(e=>e.id):[ui.hid[type]||list[0]?.id];
  const data=timetablePdfData(type,ids);toast('Preparando PDF…');await loadTimetablePdf();
  const doc=createTimetablePdf(data),title=all?'Todos-'+data.plural:data.entities[0].name;
  const file=('Horario-'+data.centre+'-'+title+'.pdf').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-');
  doc.save(file);toast('PDF descargado'+(data.draft?' como borrador.':'.'));
 }catch(e){toast(e.message||'No se pudo generar el PDF.');}
 finally{timetablePdfBusy=false;}
}
