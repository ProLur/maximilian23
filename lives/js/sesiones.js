import { RUTA } from './firebase.js';
export const DURACION_SESION = 4 * 60 * 60 * 1000;
export const codigoValido = codigo => /^[0-9]{5}$/.test(codigo);
export function codigoAleatorio() {
  const n = new Uint32Array(1);
  do { crypto.getRandomValues(n); } while (n[0] >= 4294890000);
  return String(10000 + n[0] % 90000);
}
export function rutaSesion(codigo) {
  if (!codigoValido(codigo)) throw Error('Escribe las cinco cifras del panel ADMIN.');
  return RUTA + '/sesiones/' + codigo;
}
export async function crearSesion({db,D}, uid, desfase = 0) {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2,'0')).join('');
  for (let intento=0; intento<20; intento++) {
    const codigo = codigoAleatorio(), ahora = Date.now()+desfase;
    const meta = {propietario:uid,creado:ahora,expira:ahora+DURACION_SESION,nonce};
    const resultado = await D.runTransaction(D.ref(db,rutaSesion(codigo)+'/meta'), actual => {
      if (actual && actual.expira > ahora) return;
      return meta;
    }, {applyLocally:false});
    if (resultado.committed) return {codigo,...meta};
  }
  throw Error('No se ha podido reservar un código. Vuelve a intentarlo.');
}
