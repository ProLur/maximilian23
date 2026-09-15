# Crónica Escolar

Periódico digital de Maximilian 23.

## Servicios de Firebase

- Cloud Firestore: colección `articles`, incluyendo las imágenes optimizadas.
- Authentication: acceso de la redacción mediante la cuenta educativa autorizada de Google.

La configuración pública de la aplicación web se guarda en `firebase-config.js`. Las reglas publicadas en Firebase están versionadas en `firestore.rules`.

La portada solo muestra documentos de `articles` cuyo campo `status` sea `published`.
