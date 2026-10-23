# Estado actual: publicado

Proyecto dedicado creado: maximilian23-visor. Visor: https://maximilian23-visor.web.app/. Panel: https://maximilian23-visor.web.app/admin. Entrar con Google usando mmartinezf001@educarex.es. La configuración canónica está en firebase.json y .firebaserc en la raíz de esta copia; las reglas están en firebase/database.rules.json. La publicación fue autorizada por el usuario y se ejecutó. Ver REVISION.md para pruebas y límites.

Los pasos siguientes se conservan como referencia para preparar otro entorno; ya se completaron en este proyecto.

# Preparar el proyecto dedicado de Maximilian

Guía de referencia. Para futuras publicaciones, utilizar únicamente el proyecto dedicado y obtener autorización del usuario.

1. Crear un proyecto Firebase dedicado (nombre propuesto: Maximilian Visor; el ID definitivo lo asigna la consola). No reutilizar los proyectos de crónica, estadísticas o reservas. No hace falta activar Analytics ni facturación para preparar este sistema; revisar siempre las condiciones y cuotas mostradas por Firebase.
2. Crear Realtime Database en la región europea elegida, inicialmente bloqueada. No usar modo de prueba. Mantenerla bloqueada hasta aprobar y comprobar las reglas de esta carpeta.
3. En Authentication, activar correo/contraseña para administradores y acceso anónimo para visores. Crear las cuentas del profesorado desde consola, con contraseñas que nunca se guardan en el proyecto ni se comparten en el chat.
4. Registrar una app web y copiar únicamente su configuración pública en lives/js/firebase-config.js. No incluir cuentas de servicio, claves privadas ni contraseñas. Añadir los dominios reales a Authentication cuando se conozca el alojamiento.
5. En los datos de la base, autorizar cada UID docente en maximilian/admins/UID con el booleano true. El código web no puede modificar esta lista. La autenticación anónima no concede permiso de administrador.
6. Ejecutar las pruebas de reglas en emuladores aislados (PRUEBAS.md). Probar también el panel y el visor, permisos revocados, desconexión y reintentos. Una comprobación visual del login no prueba las reglas.
7. Pedir confirmación del proyecto, reglas y sitio concretos antes de publicar. Solo tras ella, aplicar database.rules.json a la base dedicada y desplegar exclusivamente lives/. La configuración firebase.json ya define /admin y las cabeceras básicas para Firebase Hosting. No subir blender/, tests/ ni documentos de trabajo al sitio.
8. Probar dos dispositivos: iniciar sesión en /admin, abrir el visor, comprobar presencia, enviar un gesto, un texto y detener. Recargar el visor: no debe repetir el último comando. Verificar que un usuario no autorizado no puede escribir aunque llame directamente a la API.

## Datos y límites

El último comando es público y permanece legible hasta sustituirlo o limpiarlo. El historial solo es accesible a administradores. No incluir datos personales de alumnado en mensajes. El buzón entrega el último comando disponible, sin garantía de conservar todos los envíos durante una desconexión; presencia no equivale a acuse de reproducción.

Los nodos mensajes y admins pertenecen únicamente a este sistema. No aplicar estas reglas a una base compartida: las demás rutas quedarían bloqueadas. La limpieza de historial debe hacerse desde un entorno de confianza; los clientes no pueden borrar registros del historial. Definir retención antes de usarlo con datos reales.

La lista de administradores es la autorización efectiva. Deshabilitar el formulario de registro en la web o ocultar /admin no sustituye las reglas. No se incluye registro público en el panel. Valorar App Check y alertas de consumo antes de abrir el sitio al público.

## Prueba visual local sin Firebase

Abrir probar-en-local.bat y visitar http://localhost:8023/. /admin abre el panel; con la configuración vacía mostrará que falta configurarlo. Esto permite revisar el modelo sin enviar datos a Firebase.

Documentación: https://firebase.google.com/docs/database/security/rules-conditions y https://firebase.google.com/docs/emulator-suite/install_and_configure
