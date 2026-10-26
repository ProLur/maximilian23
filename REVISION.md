# Revisión de Maximilian — 23 de octubre de 2026

Esta carpeta contiene la versión revisada y publicada el 23 de octubre de 2026, tras tu autorización para crear Firebase y subir Maximilian. El proyecto original del Escritorio permanece intacto.

Sitio: https://maximilian23-visor.web.app/

Panel: https://maximilian23-visor.web.app/admin

Proyecto dedicado: maximilian23-visor. Base de datos: europe-west1. La cuenta de Google mmartinezf001@educarex.es tiene el permiso de administrador por UID; no se ha creado una contraseña nueva ni se ha guardado ninguna clave privada en la web.

## Modelo y referencia

Se ha revisado la imagen `max.png` recuperada de la conversación y los renders locales. La identidad está en la cabeza ancha, visor oscuro con borde naranja, ojos y sonrisa cian, orejeras, antena y núcleo del pecho. Se conservan esos elementos, colores, nombres de objetos, jerarquía de articulaciones, expresiones y dedos.

Las palmas originales eran elipsoides. Ahora tienen superficies más planas, contorno de placa redondeada y estrechamiento hacia la muñeca. Su grosor máximo pasa de 0,28 a 0,184 unidades (−34,3 %); anchura y altura máximas se conservan para mantener el contacto con dedos y pulgar. Se ha regenerado `blender/maximilian23.blend` y `lives/models/maximilian23.glb` con Blender 5.2.2. El modelo mantiene 90 objetos y 33.884 triángulos.

Comparativas: `blender/renders/palma_antes.png`, `palma_despues.png` y `cuerpo_revisado.png`. Los demás renders son los originales, anteriores a esta revisión.

Otras mejoras aconsejadas para una siguiente revisión artística: cintura y cadera menos abultadas, antebrazos algo más robustos y rodilleras con volumen circular como la referencia. Son cambios más visibles en la silueta y no se han aplicado automáticamente. Este GLB se prepara para animación: no se certifica como malla estanca ni como archivo listo para impresión 3D.

## Control remoto preparado

- `/admin` abre el panel (reescritura para Firebase Hosting y acceso alternativo mediante `admin/index.html` en un servidor estático). `admin.html` sigue funcionando.
- Inicio de sesión de administrador con Google o correo y contraseña; sesión limitada a la sesión del navegador. Un usuario autenticado solo puede controlar al robot si su UID tiene el booleano `true` en `maximilian/admins`. El navegador no puede conceder ese permiso. La revocación oculta el panel y las reglas bloquean nuevos envíos.
- Cada visor usa autenticación anónima en memoria y una aplicación Firebase separada: abrir el visor no cambia la sesión del panel.
- Envío atómico del último comando y una copia al historial privado. Tipos permitidos: decir, gesto y detener. Autor obligatorio, timestamp del servidor, caducidad de hasta 30 segundos, rangos y campos limitados; no se permiten campos arbitrarios. El historial es de solo creación desde el cliente; la limpieza requiere acceso de consola o servidor.
- El visor rechaza comandos caducados, anteriores a su arranque, duplicados o con parámetros no válidos. Los textos se presentan como texto, sin ejecutar HTML ni código.
- Presencia por UID y conexión, con borrado al desconectar, latidos y limpieza de listeners. Cada cliente solo puede escribir su propia presencia; solo administradores pueden leer el conjunto.

El nodo `maximilian/comando` es público por diseño: contiene el último contenido destinado a la pantalla y el UID del emisor. Aunque caduque su ejecución, el contenido sigue almacenado y legible hasta el siguiente comando o limpieza administrativa. No enviar datos personales ni secretos. El historial completo y la lista de pantallas son privados.

El mecanismo es un buzón del último comando, no una cola durable: una pantalla desconectada puede perder comandos intermedios. La presencia acredita conexión, no confirma reproducción ni que el audio esté desbloqueado. Envíos sucesivos muy rápidos también pueden reemplazarse antes de ser observados. Si se requiere entrega garantizada, hay que añadir cola por pantalla y acuses con un servicio de confianza.

Las reglas restringen acceso, pero no limitan cuotas ni impiden por sí solas abuso de altas anónimas. Antes de abrir a tráfico real, valorar App Check, alertas de uso y política de limpieza. No se ha añadido una clave de servicio a la web. La configuración pública apunta únicamente al proyecto dedicado.

## Publicación y verificación

Se creó el proyecto nuevo maximilian23-visor, su aplicación web y la base de datos europea. Se activaron Google, correo/contraseña y autenticación anónima. Se registró la identidad Google ya autorizada del propietario y se concedió el permiso únicamente a su UID. Las cuentas anónimas o cualquier otra cuenta autenticada carecen de permiso administrativo.

La configuración de despliegue está ahora en firebase.json y .firebaserc, en la raíz de esta copia. Solo se publica lives/. Las reglas siguen en firebase/database.rules.json. No se modificaron dominios ni los otros tres proyectos Firebase del usuario. La URL publicada es nueva; no se ha sustituido el alojamiento existente de maximilian23.com.

Verificación realizada:

- Blender y GLB generados; revisión visual local en Chrome.
- Prueba del receptor con Firebase simulado superada.
- Pruebas de reglas con el emulador oficial y Java 21: administración, campos inválidos, historial privado, presencia propia, revocación y protección de la lista de administradores, superadas.
- Firebase real: autenticación anónima; lectura del último comando; bloqueo del historial, de órdenes anónimas, de autoconcesión de permisos y de presencia ajena, comprobados. La presencia propia se creó y retiró correctamente.
- Receptor original conectado al Firebase real: se envió el gesto neutro reposo y se verificó que fue recibido, validado y entregado al callback del visor. El envío de prueba se realizó desde la herramienta administrativa, no mediante el formulario /admin.
- HTTPS: raíz, /admin, /admin.html, configuración y módulos responden correctamente. /admin redirige al panel. Los recursos de autenticación reservados de Firebase responden correctamente.
- Modelo publicado: 749.936 bytes; su SHA-256 coincide exactamente con el GLB revisado local. El detalle está en VERIFICACION-PUBLICACION.json.

Para usarlo, abrir el visor en la pantalla pública y el panel en otro dispositivo; pulsar Entrar con Google y seleccionar mmartinezf001@educarex.es. La sesión interactiva de Google del usuario y el clic final de envío en el formulario no se automatizaron. No se ha configurado contraseña para esa cuenta; debe usar el botón de Google.

El buzón del último comando no garantiza entregar mensajes intermedios durante una desconexión. El último comando permanece legible aunque haya caducado su ejecución. No incluir datos personales. Definir retención del historial y valorar App Check si aumenta el tráfico público.

Referencias: [reglas Firebase](https://firebase.google.com/docs/database/security/rules-conditions), [importación de identidades Google](https://firebase.google.com/docs/cli/auth), [alojamiento Firebase](https://firebase.google.com/docs/hosting).

## Sincronización con GitHub

Se integró esta versión en ProLur/maximilian23, actualizando lives/ y añadiendo el proyecto Blender, reglas, pruebas y documentación. El resto del sitio conserva su contenido. Se autorizó maximilian23.com para el inicio de sesión de Google. No se incluyeron credenciales, cachés ni herramientas temporales.

## Gestos y emociones independientes

El panel muestra primero Saludar, Guiñar el ojo, Atención, Parpadeo y Reposo, seguidos de Alegría, Sorpresa, Tristeza y Serio sin necesidad de texto. Los envíos directos muestran confirmación o error. Saludar vuelve a reposo tras su animación de 2,6 segundos y el guiño tras 0,8 segundos, con transición suave; las emociones remotas duran 4 segundos. Se ha probado este retorno con el GLB real en tests/gestos.mjs. Se versionaron los recursos del panel para evitar conservar la interfaz anterior en caché.

## Cuentos · 26 de octubre de 2026
Cinco cuentos originales, 25 escenas, texto grande a la izquierda, expresiones y gestos coordinados. Fin y detención devuelven a reposo. Los cuentos funcionan en lectura animada sin voz del navegador; la API de voz queda pendiente de escuchar muestras y elegir proveedor. No se han incorporado claves privadas ni activado pagos.
Validación: receptor, modelo GLB real, cuentos y cancelación; reglas probadas con emulador antes de publicar. Se añade comando cuento restringido a cinco identificadores para administradores.

## Sesiones independientes · 26 de octubre de 2026

Cada apertura de ADMIN, tras iniciar sesión con una cuenta autorizada, reserva mediante transacción un código aleatorio de cinco cifras. El código caduca a las cuatro horas. Cada pestaña tiene una sesión independiente, sin usar localStorage para compartir código entre pestañas. Nueva sesión cierra la anterior; Salir también la cierra. Cerrar solo la pestaña deja el código activo hasta su caducidad.

El visor solicita el código después de cargar. Hasta conectarlo no escucha ningún canal remoto. Para cinco Maximilian independientes: abrir cinco pestañas ADMIN y vincular cada visor con uno de sus códigos. Varias pantallas con el mismo código reciben las mismas órdenes. Si se recarga ADMIN, muestra un código nuevo: hay que volver a vincular el visor.

Se han retirado del index los botones y los atajos de gestos y emociones, la prueba de voz y el botón local de detener cuento. Las órdenes se envían exclusivamente desde ADMIN. El visor mantiene la conexión por código y pantalla completa.

Datos: maximilian/sesiones/{codigo}/meta y canales/{nonce}/{comando,mensajes,miembros,presencia}. Una generación aleatoria de 128 bits aísla las reutilizaciones del mismo código e impide leer historiales anteriores. Las reglas impiden listar sesiones, bloquean el canal global anterior y reservan la creación de sesiones y el envío de órdenes al administrador propietario. El visor autenticado anónimamente solo puede vincularse, leer el comando de su sesión y registrar su propia presencia. Conocer un código permite ver esa sesión durante su vigencia; no concede permisos de administrador. No utilizar los mensajes para datos personales.

La caducidad bloquea el acceso automáticamente mediante reglas, pero no borra físicamente los datos históricos. No se ha añadido un servicio de limpieza con facturación.

Pruebas: cinco receptores simulados sin cruce de órdenes; emulador real de Realtime Database con cinco sesiones, permisos, colisiones, caducidad, cierre, reutilización con nueva generación, revocación y rechazo de comandos inválidos; modelo GLB y cuentos.

## Panel plegable · 26 de octubre de 2026
Todas las tarjetas del panel son acordeones con botones +/−, aria-expanded y control de teclado. Sesión empieza abierta y se pliega una sola vez al detectar el primer visor conectado; se puede volver a abrir manualmente. Nueva sesión vuelve a abrirla. El resto recuerda su estado en localStorage, por UID de usuario y navegador; las preferencias no se escriben en Firebase ni se comparten entre cuentas. Si el almacenamiento está bloqueado, los acordeones siguen funcionando sin persistencia.

Los mensajes del panel aparecen a la derecha con letra grande, contraste alto y área de lectura desplazable para mensajes largos. El visor reserva la izquierda al personaje mientras se muestra el texto. Los cuentos conservan su presentación a la izquierda.

Ajuste posterior: mostrar u ocultar mensajes no modifica las dimensiones del lienzo ni recalcula la cámara. Maximilian conserva su posición y tamaño; el texto aparece a la derecha sobre el mismo encuadre.

A petición del usuario, los mensajes vuelven a la parte inferior centrada, como subtítulos. Se mantiene fijo el encuadre de Maximilian.

## Voz local Piper · 26 de octubre de 2026
Se añaden 25 MP3 (unos 1,46 MB en total) para los cinco cuentos, generados localmente con la voz española davefx y un efecto electrónico suave. La reproducción espera un gesto del usuario en el visor; mueve la boca y coordina las expresiones y los gestos por escena. Detener cancela audio y cola. Si un MP3 falla, la escena continúa como lectura animada sin recurrir a voces del navegador.
Los mensajes de texto libre siguen sin audio automático. Se entrega un generador local de MP3 para textos nuevos, que necesita este ordenador y su instalación local. No se ha configurado un servidor de síntesis ni una API comercial. Firebase transporta órdenes y el alojamiento sirve los MP3; se mantiene su consumo normal de cuota de transferencia.

Perfil final elegido por el usuario: juvenil y más sintético, con procesamiento espectral. Sustituye el ajuste grave anterior. Se incorpora bloqueo de mensajes y cuentos sin presencia reciente de un visor en esa sesión: no se guarda ni se encola la orden; el texto se conserva y se muestra error. La comprobación requiere conexión del panel con el servidor. La presencia indica conexión, no acredita que el audio ya haya sonado; una desconexión abrupta puede tardar en ser detectada por Firebase.
