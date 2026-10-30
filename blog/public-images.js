// Images remain public through the website when the source repository is private.
export function publicImageUrl(value){
  if(typeof value!=='string')return value;
  try{const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='raw.githubusercontent.com')return value;
    const match=u.pathname.match(/^\/ProLur\/maximilian23\/(?:refs\/heads\/main|main)\/(.+)$/i);
    if(!match)return value;
    return '/'+match[1]+u.search+u.hash;
  }catch{return value;}
}
