// Run after changing CSS/JS, before publishing. No dependencies or bundler.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const htmlPath=path.join(__dirname,'index.html');
let html=fs.readFileSync(htmlPath,'utf8');
html=html.replace(/(src|href)="([a-z-]+\.(?:js|css))(?:\?v=[a-z0-9]+)?"/g,(_,attribute,name)=>{
  const content=fs.readFileSync(path.join(__dirname,name));
  const version=crypto.createHash('sha256').update(content).digest('hex').slice(0,12);
  return attribute+'="'+name+'?v='+version+'"';
});
fs.writeFileSync(htmlPath,html);
