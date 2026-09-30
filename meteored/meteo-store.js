import{initializeApp,getApps}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import{getFirestore,collection,getDocs,doc,setDoc,serverTimestamp}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import{firebaseConfig}from'../stats/firebase-config.js?v=1';

const PREFIX='evento:meteo-2627/';
const app=getApps().find(item=>item.name==='maximilian-meteo')||initializeApp(firebaseConfig,'maximilian-meteo');
const db=getFirestore(app);

window.meteoStore={
  async list(){
    const snapshot=await getDocs(collection(db,'pageStats'));
    return snapshot.docs.map(item=>item.data()).filter(item=>String(item.path||'').startsWith(PREFIX)).map(item=>{
      try{return JSON.parse(item.title||'{}');}catch{return null;}
    }).filter(item=>item&&item.fecha);
  },
  async save(entry){
    const id=`meteo-2627-${entry.fecha}`;
    await setDoc(doc(db,'pageStats',id),{
      path:`${PREFIX}${entry.fecha}`,
      title:JSON.stringify(entry),
      total:0,
      lastVisit:serverTimestamp(),
      devices:{},
      days:{}
    },{merge:true});
  }
};

window.dispatchEvent(new Event('meteo-store-ready'));
