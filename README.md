# maximilian23

Sitio web oficial del agente Maximilian 23 — CEIP Juan XXIII.

[Visor en maximilian23.com](https://maximilian23.com/lives/) · [Visor en Firebase](https://maximilian23-visor.web.app/) · [Panel de control](https://maximilian23.com/lives/admin/)

Consulta [GITHUB.md](GITHUB.md) para la estructura, pruebas y despliegue; [REVISION.md](REVISION.md) documenta el modelo y la seguridad.

---

# Versión revisada publicada — leer REVISION.md

# Maximilian 23

Mascota virtual 3D del CEIP Juan XXIII de Zafra: un robot de cuerpo entero que mira, gesticula,
"habla" (boca animada y subtítulos) y recibe mensajes desde otro dispositivo.

## Qué se publica

**Solo la carpeta `lives/`.** Todo lo demás son archivos de trabajo.

```
lives/                     ← se sube al alojamiento (p. ej. maximilian23.com/lives/)
├── index.html             pantalla pública (pizarra, proyector, móvil)
├── admin.html             panel de control remoto (con inicio de sesión)
├── favicon.png, apple-touch-icon.png
├── css/                   estilos
├── js/
│   ├── main.js            escena 3D, encuadre, calidad automática, botones
│   ├── maximilian.js      animación del personaje (cara, cabeza, cuerpo, brazos)
│   ├── voz.js             voz (desactivada: boca + subtítulos) y cola de mensajes
│   ├── remoto.js          recibe mensajes de Firebase
│   ├── admin.js           lógica del panel
│   ├── firebase.js        carga de Firebase
│   └── firebase-config.js datos públicos del proyecto Firebase (rellenar)
├── data/expresiones.json  expresiones de cara, cabeza y brazos (editable)
├── models/maximilian23.glb  modelo 3D
└── vendor/three/          motor 3D (Three.js r170), incluido para no depender de internet

blender/                   scripts que generan el modelo y renders de comprobación
firebase/                  reglas de la base de datos y guía de configuración
referencia/                imágenes originales del personaje
probar-en-local.bat        abre la web en este ordenador sin subirla
```

## Probar en este ordenador

Doble clic en `probar-en-local.bat`. (Abrir `index.html` con doble clic no funciona: el navegador
bloquea la carga del modelo desde el disco.)

## Opciones de la dirección

Se añaden a la URL, por ejemplo `index.html?botones=0&calidad=baja`.

| Opción | Efecto |
| --- | --- |
| `botones=0` | oculta el cuadro de gestos de la derecha |
| `calidad=baja` / `calidad=alta` | fija la calidad gráfica (por defecto se ajusta sola) |
| `brillo=0` | quita el resplandor de ojos y luces |
| `voz=1` | activa la voz sintetizada del navegador |
| `subtitulos=0` | sin subtítulos (solo con `voz=1`) |
| `prueba=1` | panel para probar textos, emociones y voces |

Teclas: `1`–`5` expresiones, `G` guiño, `S` saludar, `B` parpadeo, `A` atención, `H` hablar,
`F` pantalla completa.

## Control remoto

Sigue `firebase/GUIA-FIREBASE.md`. No desplegar sin confirmación. Después, el panel está en
`lives/admin.html`.

## Regenerar el modelo

```
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python blender\maximilian_head.py -- --out blender --glb lives\models\maximilian23.glb --render
```

Las medidas están al principio de `blender/maximilian_head.py`. Las vistas de comprobación se
guardan en `blender/renders/`.

## Problemas al publicar

- **Se queda en "Despertando a Maximilian…"**: falta subir `vendor/`, o el servidor modifica los
  scripts. En Cloudflare, desactiva *Rocket Loader*.
- **Va lento**: la página reduce la calidad sola; se puede forzar con `?calidad=baja`.
