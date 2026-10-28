// Optional local preview: node serve.cjs (no dependencies).
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.md':'text/plain; charset=utf-8'};
http.createServer((request,response)=>{
  try{
    const route=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+(route==='/'?'/index.html':route));
    if(!file.startsWith(root+path.sep)||!['.html','.js','.css'].includes(path.extname(file))){response.writeHead(404);return response.end('No encontrado');}
    fs.readFile(file,(error,content)=>{if(error){response.writeHead(404);return response.end('No encontrado');}response.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(content);});
  }catch{response.writeHead(400);response.end('Petición incorrecta');}
}).listen(8765,'127.0.0.1',()=>console.log('MaxHorarios: http://127.0.0.1:8765'));
