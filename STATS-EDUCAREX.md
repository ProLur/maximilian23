# STATS — uso del panel por cuenta Educarex

Publicado desde el 27/10/2026. Solo la propietaria mmartinezf001@educarex.es puede abrir STATS y leer los datos de todas las cuentas. Las reglas de Firebase exigen su UID y correo verificado, también ante llamadas directas al servidor.

Una ficha por cuenta con visitas al panel, fecha y hora del último acceso, conexión reciente, tiempo conectado acumulado, actividad aproximada, funciones y últimos accesos. Búsqueda por correo y periodos de 7 días, 30 días o todo el registro. Un acceso equivale a una apertura o recarga autenticada del panel, no a cada autenticación de Google. No se reconstruyen accesos anteriores a la actualización.

Se registra una visita por pestaña en maximilian/estadisticas/UID/visita. Cada usuario autorizado y con correo Educarex verificado solo puede escribir sus propios registros. Se validan identidad, campos, inicio inmutable, hora del servidor, duración coherente y contadores de funciones conocidos. Solo la propietaria puede leerlos; no se permite borrar registros desde el cliente. Las cuentas sin permiso no se registran como accesos del panel.

Tiempo conectado: segundos aproximados mientras la conexión al servidor está activa. Actividad: panel visible e interacción de teclado o puntero en los últimos 2 minutos. Se actualiza una vez por minuto y en cambios de visibilidad; el cierre intenta guardar y utiliza onDisconnect como respaldo. Los tiempos de varias pestañas se suman. Una suspensión brusca, pérdida de red o cierre puede dejar hasta aproximadamente un minuto sin registrar. Es telemetría del navegador, no una auditoría inviolable ni prueba de asistencia.

Uso: navegación por secciones, nuevas sesiones, órdenes enviadas correctamente (mensajes, gestos, emociones, cuentos, pausa, continuar y detener), apertura del visor y apertura del enlace de dibujos y fichas. El enlace no demuestra descarga ni impresión de un PDF. No se guardan textos de mensajes, contraseñas, direcciones IP ni información del alumnado.

Al entrar se informa del registro. STATS se descarga solo al abrir la sección o al pulsar Actualizar, sin escucha continua de todos los usuarios. El registro genera aproximadamente una actualización por minuto y pestaña conectada, además de aperturas, cierres y cambios de visibilidad. Los registros permanecen en Firebase; los filtros de fecha no borran datos.

Pruebas: cálculo con reloj simulado, visibilidad, desconexión y contadores; Chrome escritorio y móvil con datos simulados; reglas reales en emulador, escritura cruzada, suplantación, campos extra, tiempos imposibles, borrado y lectura ajena; integración del registrador con el SDK real. No se crean accesos ni cuentas simuladas en producción.

Código y recursos en GitHub Pages. En Firebase se publican únicamente las reglas necesarias. No se activa facturación ni servicios nuevos.
