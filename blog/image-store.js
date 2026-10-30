import{publicImageUrl}from'./public-images.js?v=1';
const IMAGE_API='https://aula-del-futuro-reservas.mmartinezf001.workers.dev/blog-images';

async function request(user,payload){
  if(!user)throw Error('No hay una sesión iniciada. Conserva el texto antes de volver a entrar.');
  for(let attempt=0;attempt<2;attempt++){
    let token;
    try{token=await user.getIdToken(true);}
    catch{throw Error('No se pudo renovar la sesión. Conserva el texto y vuelve a intentarlo.');}
    const response=await fetch(IMAGE_API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(payload)});
    const data=await response.json().catch(()=>({}));
    if(response.status===401&&attempt===0)continue;
    if(!response.ok)throw Error(data.error||'No se pudieron guardar las imágenes. El texto permanece en el formulario.');
    return data;
  }
}

export async function prepareImage(file){
  const bitmap=await createImageBitmap(file);let max=1800,quality=.84,last;
  for(let attempt=0;attempt<7;attempt++){
    const scale=Math.min(1,max/bitmap.width),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d',{alpha:false}).drawImage(bitmap,0,0,canvas.width,canvas.height);
    last=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
    if(last&&last.size<=700000)break;
    max*=.84;quality=Math.max(.58,quality-.06);
  }
  bitmap.close?.();
  if(!last)throw Error('No se pudo preparar una de las imágenes.');
  return new Promise((resolve,reject)=>{const reader=new FileReader;reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('No se pudo leer una de las imágenes.'));reader.readAsDataURL(last)});
}

export async function uploadImages(user,blog,postId,sources){
  if(!sources.length)return{urls:[],paths:[]};
  const dataUrls=[];
  for(const source of sources)dataUrls.push(typeof source==='string'?source:await prepareImage(source));
  const result=await request(user,{action:'upload',blog,postId,images:dataUrls});
  return {...result,urls:(result.urls||[]).map(publicImageUrl)};
}

export async function deleteImages(user,blog,paths){
  if(!paths?.length)return;
  await request(user,{action:'delete',blog,paths});
}

