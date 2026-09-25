// Esta configuración se completará al registrar la aplicación web en Firebase.
export const firebaseConfig = {
  apiKey: "AIzaSyCRtxY6h4VFog7sdr-mI5mVsvEQrLiKYb8",
  authDomain: "cronica-escolar-maximilian23.firebaseapp.com",
  projectId: "cronica-escolar-maximilian23",
  storageBucket: "cronica-escolar-maximilian23.firebasestorage.app",
  messagingSenderId: "551952744262",
  appId: "1:551952744262:web:f845df2743b3b766e56f47"
};

export const isFirebaseConfigured = !Object.values(firebaseConfig).some(value => value === "REEMPLAZAR");
