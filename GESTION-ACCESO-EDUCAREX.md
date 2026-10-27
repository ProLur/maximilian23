# Gestión de acceso Educarex — 27/10/2026

Cuenta propietaria confirmada: mmartinezf001@educarex.es. El menú Admin aparece únicamente para su UID y correo verificado. Permite añadir correos Educarex sin compartir contraseñas; los nuevos docentes entran con Google aunque no hubieran accedido antes a Maximilian.

Firebase RTDB conserva los permisos anteriores por UID y admite también los correos autorizados en maximilian/correosAutorizados. Solo la identidad propietaria confirmada puede añadir valores true. Se validan dominio, longitud y forma de la clave. La lista completa es privada para la propietaria; cada docente solo puede consultar su propia autorización. No se concede gestión a los docentes añadidos. No se incluyen operaciones de eliminar permisos.

Los permisos nuevos exigen correo verificado en el token de Firebase y se comprueban en las reglas al crear sesiones y emitir órdenes. La comprobación visual del panel no sustituye a las reglas del servidor. Las suscripciones del panel observan ambas vías de autorización sin invalidar las cuentas anteriores.

Validación: emulador real de Firebase (identidad propietaria, intentos de suplantación, correo sin verificar, dominio externo, lista privada, nuevas sesiones y comandos, aislamiento de cinco sesiones, renovación y revocación). Pruebas de navegador de menú y formulario, normalización de correo y rechazo de dominios ajenos. No se añaden cuentas de prueba a producción.

Recursos y código en GitHub Pages; en Firebase solo se actualizan reglas de la base de datos. Sin facturación ni servicios de pago nuevos.
