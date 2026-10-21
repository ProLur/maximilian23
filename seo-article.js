// Search metadata only: this module never changes the visible article.
export function updateArticleMetadata(item){
  const base='https://maximilian23.com';
  const url=new URL(location.pathname,base);
  const id=new URLSearchParams(location.search).get('id');
  if(id)url.searchParams.set('id',id);
  const description=String(item.summary||'').trim();
  for(const selector of ['meta[name="description"]','meta[property="og:description"]','meta[name="twitter:description"]']){
    const element=document.querySelector(selector);if(element)element.content=description;
  }
  for(const selector of ['meta[property="og:title"]','meta[name="twitter:title"]']){
    const element=document.querySelector(selector);if(element)element.content=document.title;
  }
  const canonical=document.querySelector('link[rel="canonical"]');if(canonical)canonical.href=url.href;
  const ogUrl=document.querySelector('meta[property="og:url"]');if(ogUrl)ogUrl.content=url.href;
  const image=[...(item.imageDataUrls||[]),item.imageDataUrl,item.imageUrl].find(value=>/^https?:\/\//i.test(value||''));
  if(image)for(const selector of ['meta[property="og:image"]','meta[name="twitter:image"]']){
    const element=document.querySelector(selector);if(element)element.content=image;
  }
  const iso=value=>{try{const date=value?.toDate?value.toDate():new Date(value);return Number.isFinite(date.getTime())?date.toISOString():undefined;}catch{return undefined;}};
  const data={
    '@context':'https://schema.org','@type':'Article',
    mainEntityOfPage:{'@type':'WebPage','@id':url.href},url:url.href,
    headline:String(item.title||''),description,inLanguage:'es',
    publisher:{'@type':'EducationalOrganization',name:'CEIP Juan XXIII de Zafra',url:'https://cpjuanxxiiizafra.educarex.es/'},
    ...(item.author?{author:{'@type':'Person',name:String(item.author)}}:{}),
    ...(image?{image:[image]}:{}),
    ...(item.publishedAt||item.eventDate?{datePublished:iso(item.publishedAt||item.eventDate)}:{}),
    ...(item.updatedAt?{dateModified:iso(item.updatedAt)}:{}),
    ...(item.tags?.length?{keywords:item.tags.join(', ')}:{})
  };
  let schema=document.getElementById('maximilian-article-seo');
  if(!schema){schema=document.createElement('script');schema.id='maximilian-article-seo';schema.type='application/ld+json';document.head.appendChild(schema);}
  schema.textContent=JSON.stringify(data);
}
export function articleUnavailable(){
  const robots=document.querySelector('meta[name="robots"]');if(robots)robots.content='noindex, follow';
}

