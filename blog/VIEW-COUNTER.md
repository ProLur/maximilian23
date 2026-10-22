# Contador de visitas de los cuatro blogs

## Diagnóstico comprobado el 22 de octubre de 2026

La consola de Firebase muestra reglas publicadas el 16 de octubre que permiten modificar `citePosts`, `aulaBlogPosts`, `meteoBlogPosts` y `huertoBlogPosts` únicamente a sus editores. Al abrir una entrada pública de CITE, Chrome registra `No se ha podido registrar la visita: permission-denied`. El anterior archivo de reglas del repositorio permitía incrementos públicos y no coincidía con producción.

La solución mantiene las reglas reales de los cuatro blogs. No hace falta publicarlas de nuevo ni abrir escrituras públicas. `_blogViewReceipts` queda denegada por defecto para clientes; solo accede el servidor mediante IAM. La regla preexistente de `articles` pertenece al periódico y se conserva.

## Funcionamiento

Los cuatro `post.js` llaman a `blog/view-counter.js`. Después de comprobar que la entrada está publicada, este envía únicamente `{blog,id,visitorId}` a `/blog-views` del Worker existente `aula-del-futuro-reservas`. Se conserva el contador blanco seleccionable de las listas.

El Worker acepta exclusivamente los cuatro blogs, identificadores sin rutas, UUID válidos y cuerpos de hasta 1 KiB. Comprueba en el proyecto **cronica-escolar-maximilian23** que el documento existe y sigue publicado. Un commit atómico incrementa exclusivamente `views` y guarda un comprobante privado. Las precondiciones de versión evitan duplicados entre pestañas, reintentos y cambios simultáneos del artículo. No crea artículos ni acepta valores de contador del cliente.

Se cuenta como máximo una visita por navegador y entrada cada 30 minutos. El navegador guarda un UUID aleatorio; el servidor almacena solo un identificador HMAC por entrada y navegador y las fechas del comprobante, sin IP ni UUID en claro. El UUID no es una credencial. La clave HMAC utiliza la credencial que ya está guardada en el Worker, con un mensaje separado por prefijo. No se publica ni se envía al cliente ningún secreto.

La deduplicación de cliente solo se guarda tras confirmación del servidor. Si falla la red, la próxima apertura vuelve a intentarlo. Web Locks evita solicitudes duplicadas entre pestañas cuando está disponible. Si el navegador bloquea todo almacenamiento, el UUID solo dura mientras está abierta la página y las recargas pueden volver a contar. Borrar el almacenamiento, cambiar de navegador o generar UUID deliberadamente también permite nuevas visitas: esto limita recargas normales, no sustituye un sistema contra bots. CORS limita navegadores de otros sitios, pero no autentica clientes HTTP.

## Activación pendiente

1. En Cloudflare, abrir **Workers & Pages → aula-del-futuro-reservas → Edit code** y desplegar el `aula/worker.js` completo de esta rama, conservando los secretos y ajustes existentes. La versión activa observada antes del cambio era `ae29a193`. El editor quedó cargando durante esta sesión; no se confirmó ningún despliegue nuevo.
2. No copiar ni mostrar `FIREBASE_SA_KEY`. El Worker reutiliza esa credencial existente. Hay que verificar que su cuenta de servicio ya puede leer y actualizar documentos en **cronica-escolar-maximilian23**, aunque la credencial proceda de otro proyecto. Si devuelve 403, un administrador debe proporcionar acceso de servidor adecuado o una credencial dedicada mediante secretos de Cloudflare; nunca resolverlo abriendo las reglas de Firestore. La autorización IAM todavía no se ha podido comprobar en producción.
3. Probar POST `/blog-views` desde el origen autorizado con una entrada publicada real y un UUID de prueba. Primera respuesta: `ok:true,counted:true`; repetir el mismo cuerpo: `ok:true,counted:false`. Confirmar en Firestore que `views` aumentó una sola vez. Probar ID inexistente (404), blog/ruta/campos arbitrarios (400), origen ajeno (403) y GET (405).
4. Solo después de verificar el servidor, integrar esta rama en `main`, esperar a GitHub Pages y abrir una entrada real desde cada blog con publicaciones. Volver a la lista y comprobar el incremento; recargar y comprobar que no aumenta otra vez en 30 minutos. El huerto puede verificarse cuando exista una entrada publicada; no crear publicaciones artificiales para probarlo.

Render mostró su pantalla de inicio de sesión; no se inspeccionaron servicios autenticados ni se necesita Render para esta solución.

## Mantenimiento

Los comprobantes sobrescriben el registro del mismo navegador y entrada. `expireAt` marca un día para limpieza, pero **no elimina documentos automáticamente** sin configurar TTL en `_blogViewReceipts`. Se puede activar TTL si el plan y la facturación lo permiten, o programar una limpieza administrativa. Esto es opcional para que funcione el contador, pero evita acumulación indefinida de navegadores antiguos. No se activó facturación, TTL ni ningún servicio de pago.

Rotar la credencial del Worker cambia los HMAC y puede permitir contar de nuevo durante la primera ventana de 30 minutos. Los valores históricos de `views` se conservan; no se inventan visitas perdidas durante el fallo anterior.

Pruebas locales: `node --test tests/blog-views.test.cjs tests/view-counter.test.cjs`. Incluyen concurrencia, contadores sin inicializar, caducidad, entradas ausentes/borradores, campos y rutas ajenos, origen, fallo de persistencia, reintento del cliente y almacenamiento bloqueado. Son pruebas con Firestore simulado; no acreditan un despliegue ni acceso IAM real.
