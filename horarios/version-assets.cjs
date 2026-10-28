// Run after changing CSS/JS, before publishing. No dependencies or bundler.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const privacySource=fs.readFileSync(path.join(__dirname,'privacy.js'),'utf8');
const privacyContent=JSON.parse(privacySource.match(/^const PRIVACY_CONTENT=(.+);$/m)[1]);
fs.writeFileSync(path.join(__dirname,'privacidad.html'),'<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="description" content="Privacidad de MaxHorarios: datos locales, Google Drive opcional y cuentas educativas."><title>Privacidad y cuentas educativas · MaxHorarios</title><link rel="stylesheet" href="styles.css"></head><body class="privacy-standalone"><main class="privacy-content"><a class="btn" href="index.html">Volver a MaxHorarios</a>'+privacyContent+'</main></body></html>');
for(const page of ['index.html','privacidad.html']){
const htmlPath=path.join(__dirname,page);
let html=fs.readFileSync(htmlPath,'utf8');
html=html.replace(/(src|href)="([a-z-]+\.(?:js|css))(?:\?v=[a-z0-9]+)?"/g,(_,attribute,name)=>{
  const content=fs.readFileSync(path.join(__dirname,name));
  const version=crypto.createHash('sha256').update(content).digest('hex').slice(0,12);
  return attribute+'="'+name+'?v='+version+'"';
});
fs.writeFileSync(htmlPath,html);

}
