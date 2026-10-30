const fs=require('fs'),path=require('path'),crypto=require('crypto');
const [input='.',output='dist']=process.argv.slice(2);if(!input||!output)throw Error('Indica carpeta de origen y carpeta nueva de destino');
const source=fs.realpathSync(input),target=path.resolve(output);if(source===target||fs.existsSync(target))throw Error('El destino debe ser una carpeta nueva y distinta del origen');
const hiddenDirs=new Set(['.git','.github','.claude','.codex','.agents','node_modules','tests','test','scripts','functions','work','outputs','dist','firebase']);
const internalFiles=new Set(['firebase.json','.firebaserc','package.json','package-lock.json','requirements.txt','CNAME','AGENTS.md','GITHUB.md','LICENSE','VERIFICACION-PUBLICACION.json']);
const allowed=/\.(?:html?|css|m?js|json|webmanifest|xml|txt|svg|png|jpe?g|webp|avif|gif|ico|mp3|ogg|wav|m4a|mp4|webm|pdf|woff2?|ttf|otf|glb|gltf|fbx|obj|mtl|wasm|bin|data|unityweb|br|gz|csv)$/i;
const copied=[],excluded=[];fs.mkdirSync(target,{recursive:true});
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const from=path.join(dir,entry.name),rel=path.relative(source,from).replaceAll('\\','/');if(path.resolve(from)===target)continue;
 if(entry.isDirectory()){if(hiddenDirs.has(entry.name)||entry.name.startsWith('.')){excluded.push({path:rel,reason:'internal directory'});continue;}walk(from);continue;}
 if(!entry.isFile()){excluded.push({path:rel,reason:'non-regular file'});continue;}
 if(entry.name.startsWith('.')||internalFiles.has(entry.name)||/^readme(?:\.|$)/i.test(entry.name)||/\.map$|\.rules$|\.rules\.json$|(?:^|\/)(?:aula|stats)\/worker\.js$|(?:^|\/)_(?:worker\.js|routes\.json)$/.test(rel)||/^index(?:\d|HOY|U\.|LLAMA|VALIDO|CONPUNTo)/.test(entry.name)||!allowed.test(entry.name)){excluded.push({path:rel,reason:'development, backup or non-runtime file'});continue;}
 const size=fs.statSync(from).size;if(size>25*1024*1024)throw Error('Recurso mayor que 25 MiB: '+rel);const dest=path.join(target,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(from,dest);copied.push({path:rel,bytes:size,sha256:crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex')});
}}
walk(source);
if(!fs.existsSync(path.join(target,'404.html')))fs.writeFileSync(path.join(target,'404.html'),'<!doctype html><html lang="es"><meta charset="utf-8"><title>Pagina no encontrada</title><h1>Pagina no encontrada</h1><p><a href="/">Volver al inicio</a></p></html>');
fs.writeFileSync(path.join(target,'_headers'),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n/*.html\n  Cache-Control: no-cache\n');
fs.writeFileSync(target+'.manifest.json',JSON.stringify({source,target,copied,excluded},null,2));console.log(JSON.stringify({files:copied.length,bytes:copied.reduce((n,f)=>n+f.bytes,0),excluded:excluded.length,target}));


