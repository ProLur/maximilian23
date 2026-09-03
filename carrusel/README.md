# Carrusel

Teclado: flecha derecha para avanzar y flecha izquierda para retroceder,
incluyendo las pantallas del juez. El tiempo se reinicia en cada diapositiva.
La izquierda anima la salida hacia la izquierda; la derecha y el avance
automático mantienen la salida hacia la derecha. El juez se muestra como panel
informativo sin interacción para que el iframe no capture las flechas.

Sube las imágenes a `carrusel/fotos/`. Se aceptan AVIF, GIF, JPG/JPEG, PNG y WebP.
El carrusel consulta la API pública de GitHub al abrirse y vuelve a comprobar la
carpeta cada cinco minutos. No hace falta editar una lista de archivos.

La página alterna bloques de hasta tres fotos (diez segundos cada una) con la
página del juez (quince segundos). Cada pantalla sale deslizándose hacia la
derecha antes de mostrar la siguiente. Para verla en producción:

https://www.maximilian23.com/carrusel/

## Nota sobre el juez dentro del carrusel

`https://www.maximilian23.com/juez` debe permitir que el navegador la incluya en
un `iframe`. Si el servidor envía `X-Frame-Options: DENY`/`SAMEORIGIN` o una regla
`Content-Security-Policy` `frame-ancestors` incompatible, el navegador la bloqueará.
Al estar ambas páginas bajo `www.maximilian23.com`, `SAMEORIGIN` sí es compatible.

Si la página no puede admitir un `iframe`, la alternativa fiable es incorporar su
vista directamente en este repositorio o exponer sus datos mediante JSON y dibujar
el tiempo/veredicto dentro de `carrusel/index.html`. Abrirla mediante redirección no
permite volver automáticamente al carrusel de forma robusta.
