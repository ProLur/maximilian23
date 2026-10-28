/* Subject catalogues are a starting inventory, never a per-course allocation.
   No subject hours or teacher qualifications are inferred from these lists. */
const CURRICULUM_VERSION='2026-10-28';
const CURRICULUM_WARNING='Hemos cargado los datos predeterminados. Se requiere revisión: pueden haberse cometido errores. Comprueba las materias, los cursos, las optativas, las cargas lectivas y las asignaciones de tu centro antes de generar el horario.';
const CURRICULUM_SOURCES={
  infantil:{title:'BOE · RD 95/2022 · Educación Infantil',url:'https://www.boe.es/eli/es/rd/2022/02/01/95/con'},
  primaria:{title:'BOE · RD 157/2022 · Educación Primaria',url:'https://www.boe.es/eli/es/rd/2022/03/01/157/con'},
  eso:{title:'BOE · RD 217/2022 · ESO',url:'https://www.boe.es/eli/es/rd/2022/03/29/217/con'},
  bachillerato:{title:'BOE · RD 243/2022 · Bachillerato',url:'https://www.boe.es/eli/es/rd/2022/04/05/243/con'},
  fp:{title:'TodoFP · Catálogo de títulos y módulos',url:'https://www.todofp.es/que-estudiar.html'},
  autonomias:{title:'Ministerio · Currículos de las comunidades autónomas',url:'https://educagob.educacionfpydeportes.gob.es/curriculo/curriculo-lomloe/curriculos-ccaa.html'}
};
const EDUCATION_STAGES={
  infantil:{name:'Infantil (2.º ciclo)',center:'primaria',levels:['Infantil 3 años','Infantil 4 años','Infantil 5 años']},
  primaria:{name:'Primaria',center:'primaria',levels:Array.from({length:6},(_,i)=>(i+1)+'º Primaria')},
  eso:{name:'ESO',center:'secundaria',levels:Array.from({length:4},(_,i)=>(i+1)+'º ESO')},
  bachillerato:{name:'Bachillerato',center:'secundaria',levels:['1º Bachillerato','2º Bachillerato']},
  fp:{name:'Formación Profesional',center:'secundaria',levels:['1º FP','2º FP']}
};
// splitScience / splitArts describe the initial organization of Primary only.
// Regional links document verified variants. Other stages explicitly retain
// the national common inventory plus languages; local electives need review.
const REGIONS=[
  {id:'andalucia',name:'Andalucía',foreign:'Primera Lengua Extranjera',primaryExtra:['Segunda Lengua Extranjera'],source:'https://www.juntadeandalucia.es/boja/2023/90/2.html'},
  {id:'aragon',name:'Aragón',splitScience:true,splitArts:true,optionalLanguages:['Lengua Propia de Aragón: Aragonés','Lengua Propia de Aragón: Catalán'],source:'https://educa.aragon.es/-/normativa-primaria'},
  {id:'asturias',name:'Principado de Asturias',splitScience:true,primaryExtra:['Lengua Asturiana y Literatura','Cultura Asturiana'],optionalLanguages:['Lengua Asturiana y Literatura'],source:'https://www.educastur.es/documents/34868/38805/2022-08-con-sis-curriculo-primaria.pdf/ee408cf9-ac29-2843-d232-1042b26d9561?t=1659971704757'},
  {id:'baleares',name:'Illes Balears',splitArts:true,language:'Lengua Catalana y Literatura',source:'https://www.caib.es/webgoib/w/decret-41/2025-d-1-d-agost-pel-qual-s-estableixen-l-ordenaci%C3%B3-i-el-curr%C3%ADculum-de-l-educaci%C3%B3-prim%C3%A0ria-de-les-illes-balears'},
  {id:'canarias',name:'Canarias',primaryExtra:['Educación Emocional y para la Creatividad','Segunda Lengua Extranjera'],source:'https://www.gobiernodecanarias.org/educacion/web/primaria/informacion/ordenacion/'},
  {id:'cantabria',name:'Cantabria',source:'https://www.educantabria.es/documents/39930/51416320/INSTRUCCIONES%2BCC%2BINFANTIL%2BY%2BPRIMARIA%2BINICIO%2BCURSO%2B24-25.signed.pdf/28624f60-b2eb-d74f-131d-374c9ee9cc82?download=true&t=1724827585349&version=1.0'},
  {id:'castilla-la-mancha',name:'Castilla-La Mancha',source:'https://educacion.castillalamancha.es/biblioteca-normativa/educacion-primaria/educacion-primaria/normativa/decreto-812022-de-12-de-julio'},
  {id:'castilla-y-leon',name:'Castilla y León',splitScience:true,splitArts:true,source:'https://www.educa.jcyl.es/es/educacion-primaria-curriculo-ordenacion/anexo-iii-areas-educacion-primaria'},
  {id:'cataluna',name:'Cataluña',language:'Lengua Catalana y Literatura',optionalLanguages:['Aranés y Literatura'],source:'https://xtec.gencat.cat/ca/curriculum/primaria/curriculum-175-2022/'},
  {id:'extremadura',name:'Extremadura',source:'https://doe.juntaex.es/eli/es-ex/d/2022/07/28/107/con/20230919/spa/pdf'},
  {id:'galicia',name:'Galicia',splitScience:true,splitArts:true,language:'Lengua Gallega y Literatura',source:'https://www.xunta.gal/dog/Publicados/2022/20220926/AnuncioG0655-190922-0001_es.html'},
  {id:'madrid',name:'Comunidad de Madrid',splitScience:true,source:'https://www.bocm.es/boletin/CM_Orden_BOCM/2022/07/18/BOCM-20220718-1.PDF'},
  {id:'murcia',name:'Región de Murcia',splitScience:true,splitArts:true,primaryExtra:['Segunda Lengua Extranjera','Profundización Educativa'],source:'https://www.borm.es/services/anuncio/ano/2022/numero/5907/pdf?id=813041'},
  {id:'navarra',name:'Comunidad Foral de Navarra',language:'Lengua Vasca y Literatura',languageConditional:true,source:'https://www.lexnavarra.navarra.es/detalle.asp?r=54950'},
  {id:'pais-vasco',name:'País Vasco',language:'Lengua Vasca y Literatura',foreign:'Primera Lengua Extranjera',source:'https://www.euskadi.eus/desarrollo-curricular/web01-a3hakade/es/'},
  {id:'la-rioja',name:'La Rioja',splitArts:true,primaryExtra:['Dramatización y Teatro','Educación Emocional y para la Creatividad'],source:'https://cravalleojatiron.larioja.edu.es/images/documentos/DECRETO_41_2022_13_JULIO_ED_PRIMARIA.pdf'},
  {id:'valencia',name:'Comunitat Valenciana',splitArts:true,language:'Valenciano: Lengua y Literatura',source:'https://ceice.gva.es/documents/162640733/359715821/04_Annex%2BIV_Distribuci%C3%B3%2Bhor%C3%A0ria_marca.pdf'},
  {id:'ceuta',name:'Ceuta',source:'https://www.boe.es/eli/es/o/2022/07/15/efp678/con'},
  {id:'melilla',name:'Melilla',source:'https://www.boe.es/eli/es/o/2022/07/15/efp678/con'}
];
const BACH_MODALITIES={
  ciencias:{name:'Ciencias y Tecnología',subjects:['Matemáticas I','Matemáticas II','Biología, Geología y Ciencias Ambientales','Dibujo Técnico I','Dibujo Técnico II','Física y Química','Tecnología e Ingeniería I','Tecnología e Ingeniería II','Biología','Física','Geología y Ciencias Ambientales','Química','Matemáticas Aplicadas a las Ciencias Sociales II']},
  humanidades:{name:'Humanidades y Ciencias Sociales',subjects:['Latín I','Latín II','Matemáticas Aplicadas a las Ciencias Sociales I','Matemáticas Aplicadas a las Ciencias Sociales II','Economía','Griego I','Griego II','Historia del Mundo Contemporáneo','Literatura Universal','Empresa y Diseño de Modelos de Negocio','Geografía','Historia del Arte']},
  general:{name:'General',subjects:['Matemáticas Generales','Economía, Emprendimiento y Actividad Empresarial','Ciencias Generales','Movimientos Culturales y Artísticos']},
  artesPlasticas:{name:'Artes · Plásticas, Imagen y Diseño',subjects:['Dibujo Artístico I','Dibujo Artístico II','Cultura Audiovisual','Dibujo Técnico Aplicado a las Artes Plásticas y al Diseño I','Dibujo Técnico Aplicado a las Artes Plásticas y al Diseño II','Proyectos Artísticos','Volumen','Diseño','Fundamentos Artísticos','Técnicas de Expresión Gráfico-plástica']},
  artesMusica:{name:'Artes · Música y Artes Escénicas',subjects:['Análisis Musical I','Análisis Musical II','Artes Escénicas I','Artes Escénicas II','Coro y Técnica Vocal I','Coro y Técnica Vocal II','Cultura Audiovisual','Lenguaje y Práctica Musical','Historia de la Música y de la Danza','Literatura Dramática']}
};
function curriculumKey(name){return name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}
function curriculumCatalog(config){
  const region=REGIONS.find(r=>r.id===config.region);if(!region)throw Error('Selecciona una comunidad o ciudad autónoma');
  const stages=config.stages;if(!Array.isArray(stages)||!stages.length||stages.some(s=>!EDUCATION_STAGES[s]||EDUCATION_STAGES[s].center!==config.center))throw Error('Selecciona al menos una etapa del tipo de centro elegido');
  const items=new Map(),sources=new Map(),notes=[];
  function add(name,stage,kind='Materia de la etapa',source=CURRICULUM_SOURCES[stage].url){const key=curriculumKey(name);let item=items.get(key);if(!item){item={key,name,stages:[],kind,sources:[]};items.set(key,item);}if(!item.stages.includes(stage))item.stages.push(stage);if(!item.sources.includes(source))item.sources.push(source);}
  for(const stage of stages){
    sources.set(CURRICULUM_SOURCES[stage].url,CURRICULUM_SOURCES[stage]);
    if(stage==='fp'){notes.push('FP: añade los módulos del título y ciclo concretos; no se han inventado módulos ni cargas lectivas.');continue;}
    if(stage==='infantil'){['Crecimiento en Armonía','Descubrimiento y Exploración del Entorno','Comunicación y Representación de la Realidad'].forEach(n=>add(n,stage,'Área globalizada'));continue;}
    if(stage==='primaria'){
      const science=config.splitScience??!!region.splitScience,arts=config.splitArts??!!region.splitArts;
      [...(science?['Ciencias de la Naturaleza','Ciencias Sociales']:['Conocimiento del Medio Natural, Social y Cultural']),...(arts?['Educación Plástica y Visual','Música y Danza']:['Educación Artística']),'Educación Física','Lengua Castellana y Literatura',region.foreign||'Lengua Extranjera','Matemáticas','Educación en Valores Cívicos y Éticos'].forEach(n=>add(n,stage,n.includes('Valores')?'Según curso del tercer ciclo':'Área de la etapa'));
      if(!region.baseOnly)for(const n of region.primaryExtra||[])add(n,stage,'Según curso u opción autonómica',region.source);
    }
    if(stage==='eso'){
      ['Biología y Geología','Educación Física','Educación Plástica, Visual y Audiovisual','Física y Química','Geografía e Historia','Lengua Castellana y Literatura','Lengua Extranjera','Matemáticas','Música','Tecnología y Digitalización','Educación en Valores Cívicos y Éticos','Matemáticas A','Matemáticas B','Digitalización','Economía y Emprendimiento','Expresión Artística','Formación y Orientación Personal y Profesional','Latín','Segunda Lengua Extranjera','Tecnología','Cultura Clásica'].forEach(n=>add(n,stage,'Según curso, elección u oferta'));
      notes.push('ESO: el catálogo reúne materias de distintos cursos y optativas; no todas corresponden a cada clase. Las optativas autonómicas no están exhaustivamente incorporadas.');
    }
    if(stage==='bachillerato'){
      ['Educación Física','Filosofía','Lengua Castellana y Literatura I','Lengua Castellana y Literatura II','Lengua Extranjera I','Lengua Extranjera II','Historia de España','Historia de la Filosofía'].forEach(n=>add(n,stage,'Común · según curso'));
      for(const m of config.modalities||[]){if(!BACH_MODALITIES[m])throw Error('Modalidad de Bachillerato no válida');for(const n of BACH_MODALITIES[m].subjects)add(n,stage,'Modalidad · '+BACH_MODALITIES[m].name);}
      notes.push('Bachillerato: revisa modalidades, vías, curso y optativas autonómicas. El catálogo no asigna todas las materias a todo el alumnado.');
    }
    if(region.language&&(!region.languageConditional||config.regionalLanguage)){
      if(stage==='bachillerato')for(const suffix of [' I',' II'])add(region.language+suffix,stage,'Lengua propia · según modelo o exención',region.source);
      else add(region.language,stage,'Lengua propia · según modelo o exención',region.source);
    }
    if(config.optionalLanguages)for(const name of region.optionalLanguages||[])add(name,stage,'Según zona, opción y oferta',region.source);
    if(config.religion){add('Religión',stage,'Elección del alumnado');add('Atención Educativa',stage,'Según organización del centro');}
  }
  if(stages.some(s=>s!=='fp'))sources.set(region.source,{title:'Referencia autonómica · '+region.name,url:region.source});
  if(region.baseOnly)notes.push('Para '+region.name+' se carga la base estatal'+(region.language?' y la lengua propia':'')+'. La adaptación autonómica completa está pendiente de contraste: revisa sus áreas específicas y desdobles.');
  return {items:[...items.values()],sources:[...sources.values()],notes,version:CURRICULUM_VERSION,region:region.id};
}
