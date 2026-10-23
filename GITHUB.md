# Código y publicación de Maximilian

Repositorio: https://github.com/ProLur/maximilian23

La versión 3D vive en lives/. El sitio principal y las demás secciones del repositorio conservan su estructura. El visor está disponible en https://maximilian23.com/lives/ y su panel en https://maximilian23.com/lives/admin/ cuando el alojamiento haya publicado el commit.

El mismo visor ya está publicado en https://maximilian23-visor.web.app/ y el panel en https://maximilian23-visor.web.app/admin. Ambos usan el proyecto Firebase dedicado maximilian23-visor. El dominio maximilian23.com está autorizado para iniciar sesión con Google. Los permisos siguen restringidos al UID del administrador, con independencia del dominio desde el que se abra el panel.

## Archivos

- lives/: visor, panel, modelo GLB y dependencias de Three.js.
- blender/: generador, archivos Blender y renders de comprobación.
- referencia/: referencia de diseño.
- firebase/: reglas y documentación de configuración.
- firebase.json y .firebaserc: despliegue al proyecto Firebase dedicado.
- tests/: pruebas del receptor y de las reglas.
- REVISION.md y VERIFICACION-PUBLICACION.json: cambios y evidencia de publicación.

Solo lives/ se despliega con Firebase Hosting. La configuración pública de Firebase incluida en la web identifica el proyecto y no concede permisos administrativos. No se han incorporado contraseñas, tokens de acceso, perfiles de importación de usuarios ni claves de servicio.

## Comprobar y volver a desplegar

Con Node.js 24 o posterior: npm ci y npm test. Las pruebas de reglas requieren también Java 21 o posterior: npm run test:rules. El ID demo-maximilian-seguridad garantiza que estas pruebas se ejecutan en el emulador, no en la base real.

Para actualizar Firebase tras futuros cambios, iniciar sesión con una cuenta con acceso al proyecto y ejecutar npm run deploy:firebase desde la raíz del repositorio. Subir un commit a GitHub no reemplaza ese despliegue Firebase. No se ha creado una clave de servicio persistente ni un flujo automático que publique Firebase desde GitHub.

El acceso interactivo al panel se realiza con el botón Entrar con Google y la cuenta previamente autorizada. El visor muestra inicialmente el busto; la rueda del ratón permite llegar a cuerpo entero. La voz está desactivada por defecto y puede activarse con ?voz=1, sujeta a la interacción inicial que exige el navegador.
