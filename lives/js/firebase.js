// Carga del SDK de Firebase bajo demanda (solo si hay configuracion).

import { FIREBASE_CONFIG } from './firebase-config.js';

const VERSION = '10.14.1';
const BASE = `https://www.gstatic.com/firebasejs/${VERSION}`;

/** Raiz de los datos de Maximilian en la Realtime Database. */
export const RUTA = 'maximilian';

export function configurado() {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.databaseURL);
}

/** Devuelve { app, db, D, auth, A } o null si falta la configuracion. D y A son los modulos. */
export async function cargarFirebase({ conAuth = false, visor = false } = {}) {
  if (!configurado()) return null;
  const [appMod, D, A] = await Promise.all([
    import(`${BASE}/firebase-app.js`),
    import(`${BASE}/firebase-database.js`),
    conAuth ? import(`${BASE}/firebase-auth.js`) : null,
  ]);
  const app = appMod.getApps().find(a => a.name === (visor ? 'visor' : '[DEFAULT]')) || appMod.initializeApp(FIREBASE_CONFIG, visor ? 'visor' : '[DEFAULT]');
  return { app, db: D.getDatabase(app), D, auth: A ? A.getAuth(app) : null, A };
}

/** Desfase entre el reloj local y el de Firebase, en ms. */
export function desfaseServidor(db, D) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(0), 5000);
    D.onValue(D.ref(db, '.info/serverTimeOffset'), s => { clearTimeout(timer); resolve(s.val() ?? 0); }, () => { clearTimeout(timer); resolve(0); }, { onlyOnce: true });
  });
}
