import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const dataURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const three=pathToFileURL(path.join(root,'lives/vendor/three/build/three.module.js')).href;
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const utils=dataURL(read('lives/vendor/three/examples/jsm/utils/BufferGeometryUtils.js').replace("'three'",JSON.stringify(three)));
const loaderSource=read('lives/vendor/three/examples/jsm/loaders/GLTFLoader.js')
  .replace("'three'",JSON.stringify(three)).replace("'../utils/BufferGeometryUtils.js'",JSON.stringify(utils));
const {GLTFLoader}=await import(dataURL(loaderSource));
const {Maximilian}=await import(dataURL(read('lives/js/maximilian.js').replace("'three'",JSON.stringify(three))));
const {valido}=await import(dataURL(read('lives/js/protocolo.js')));
const bytes=fs.readFileSync(path.join(root,'lives/models/maximilian23.glb'));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const model=gltf.scene.getObjectByName('Maximilian23')??gltf.scene;
const max=new Maximilian(model,JSON.parse(read('lives/data/expresiones.json')));
max.nextBlink=Infinity;max.nextWander=Infinity;
const advance=seconds=>{for(let i=0;i<Math.ceil(seconds*60);i++)max.update(1/60);};

max.wink();assert.equal(max.expression,'guino');advance(2);
assert.equal(max.expression,'reposo','El guino vuelve a reposo sin otro comando');
assert(max.meshes.Ojo_L.morphTargetInfluences[max.meshes.Ojo_L.morphTargetDictionary.Parpadeo]<0.01);
max.wave();assert.equal(max.expression,'alegria');advance(5);
assert.equal(max.expression,'reposo','El saludo vuelve a reposo sin otro comando');
assert(Math.abs(max.arms.L.pose.fuera-10)<0.1,'El brazo vuelve a su postura de reposo');
for(const emocion of ['alegria','sorpresa','tristeza','serio']){
 const now=Date.now();
 assert(valido({id:'-1234567890123456789',tipo:'gesto',gesto:emocion,creado:now,expira:now+20000},now),'La emocion admite un comando sin texto');
 max.setExpression(emocion,{duracion:4});assert.equal(max.expression,emocion);
 advance(4.5);assert.equal(max.expression,'reposo');
}
console.log('OK: modelo GLB real; saludo y guino vuelven a reposo; emociones sin texto y con retorno automatico.');
