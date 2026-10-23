# Pruebas pendientes antes de publicar reglas

El receptor puede comprobarse sin dependencias: desde la raíz de esta copia, ejecutar node tests/receptor.mjs. Utiliza Firebase simulado y no acredita las reglas.

Para reglas: instalar Java 21 o posterior y las herramientas oficiales Firebase CLI, firebase y @firebase/rules-unit-testing en un entorno local de pruebas. Usar únicamente el ID ficticio demo-maximilian-seguridad. Nunca ejecutar estas pruebas contra una base de producción.

Desde la raíz de esta copia, con las dependencias instaladas: npx -y firebase-tools@latest emulators:exec --project demo-maximilian-seguridad --config firebase.json --only database "node tests/reglas.mjs".

Casos cubiertos por el archivo: escritura administrativa válida; rechazo de visitante y usuario autenticado no administrador; autor falsificado; texto excesivo; gesto desconocido; caducidad inválida; campos adicionales; registros incompletos; lectura de historial privada; autoconcesión de admin; escritura de presencia ajena y sin autenticar; actualización/borrado de historial; revocación de permiso.

Estado actualizado: suite ejecutada con el emulador oficial, Java 21 y Firebase CLI 15.34.1; todos los casos superados. También se comprobaron permisos contra Firebase real y recepción en tiempo real del comando neutro reposo. La sesión interactiva de Google y el envío desde el formulario requieren la interacción del usuario. No se ha probado recuperación de contraseña; la cuenta propietaria entra con Google.
