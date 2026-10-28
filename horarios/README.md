# MaxHorarios

Generador y editor de horarios escolares. El nombre del programa es MAXHORARIO;
su nombre visible es **MaxHorarios**. Sitio estático, sin instalación ni compilación.

## Abrir

Abre `index.html` conservando los archivos vecinos. Para iniciar sesión con Google,
utiliza el sitio HTTPS autorizado. Opcionalmente, `node serve.cjs` ofrece una
vista local en `http://127.0.0.1:8765` con los tipos de archivo correctos.

## Archivos

- `index.html`: estructura de la página y orden de carga.
- `styles.css`: diseño adaptable, impresión y accesibilidad.
- `app.js`: entidades, índices, comprobaciones base y vistas.
- `validation.js`: esquema de datos, importación atómica, aforos, subgrupos,
  sustituciones y copias completas.
- `scheduler.js`: búsqueda reproducible con expulsiones y reparación parcial,
  ejecución en Web Worker, cancelación y conservación del mejor resultado.
- `persistence.js`: sincronización con Drive, escrituras condicionales y recuperación.
- `interface.js`: ayudas cerrables, acción permanente «Ver horario» y movimientos.
- `curriculum.js`: catálogo de áreas/materias por etapa y comunidad, con fuentes.
- `setup.js`: selección de centro/comunidad y asistente de plantillas.
- `tests.cjs`: pruebas de regresión sin dependencias.

## Uso

La barra superior incluye **Nuevo**, **Plantilla**, **Guardar**, **Abrir** y **Excel**.
«Nuevo» inicia un proyecto vacío; «Plantilla» prepara una estructura configurable.
Permite indicar docentes, clases, alumnos por clase, aulas adicionales, nombres
propios y materias o módulos adicionales. Crear una plantilla sobre un proyecto
existente requiere confirmar la sustitución; conserva una copia y permite deshacer.

Al elegir colegio o instituto se seleccionan debajo la comunidad o ciudad autónoma
y las etapas impartidas. Hay 17 comunidades y las ciudades de Ceuta y Melilla.
Se muestra una lista editable de materias antes de cargar; una recarga añade las
que falten sin eliminar las existentes ni duplicar nombres equivalentes.

El catálogo reúne áreas/materias de diferentes cursos, opciones y modalidades,
tomando la base estatal y variantes autonómicas contrastadas. No representa una
asignación obligatoria de todas esas materias a cada clase. Infantil carga sus tres
áreas globalizadas; Primaria adapta desdobles y lenguas; ESO incluye materias de
distintos cursos y opciones; Bachillerato permite elegir modalidades. Las optativas
autonómicas de ESO/Bachillerato no constituyen un inventario exhaustivo. FP exige
introducir los módulos del título concreto; no se inventan módulos genéricos.

Las fuentes oficiales están disponibles en el asistente y en Inicio → «Fuentes y
revisión». Se conserva la región, etapas y procedencia al guardar o exportar.
Después de cargar aparece un mensaje que exige revisar los datos porque pueden
contener errores. El aviso también aparece en Inicio y se puede cerrar con su X.
La carga semanal y asignación de profesorado se completan en Actividades: la
plantilla no presupone horas oficiales ni especialidades docentes.

Referencias estatales: [Infantil](https://www.boe.es/eli/es/rd/2022/02/01/95/con),
[Primaria](https://www.boe.es/eli/es/rd/2022/03/01/157/con),
[ESO](https://www.boe.es/eli/es/rd/2022/03/29/217/con),
[Bachillerato](https://www.boe.es/eli/es/rd/2022/04/05/243/con).
Cada perfil autonómico incluye además su referencia en `curriculum.js`.

Para probar sin tocar el proyecto habitual, abre el sitio con `?demo=1` al final
de la dirección. El modo demostración usa guardados, copias y ayudas separados y
no permite iniciar sesión en Google Drive. Se identifica con una banda visible.

1. Define días y tramos sin solapamientos. Una sesión doble necesita tramos
   contiguos y no puede atravesar un recreo.
2. Añade profesores, grupos, materias y aulas. Indica alumnos y capacidad para
   comprobar los aforos. Sin número de alumnos el aforo no puede verificarse.
3. Para optativas independientes, crea subgrupos e indica su grupo padre en
   «Subgrupo de». Dos subgrupos hermanos pueden coincidir; una clase del grupo
   completo ocupa a todos sus subgrupos. No selecciones padre e hijo en la misma
   actividad. Las partes simultáneas de una actividad comparten su duración.
4. Indica actividades y condiciones. Las cantidades de carga y duración se
   expresan en **tramos lectivos**, no en horas de 60 minutos.
5. Genera y revisa. El resultado solo se considera válido si todas las sesiones
   están colocadas y no existen conflictos obligatorios. Las fijadas incompatibles
   bloquean la búsqueda. Puedes detenerla conservando el mejor resultado.

Las indisponibilidades, máximos diarios, máximos consecutivos y recursos compartidos
son obligatorios para el generador. El editor permite incumplimientos manuales
solo tras confirmación y los marca como conflictos. Huecos, mínimo diario, día
libre, preferencias horarias y distribución entre días son objetivos blandos;
«Permitir huecos» cambia su penalización y no crea una prohibición absoluta.

La búsqueda es heurística: no demuestra que un horario sea imposible ni garantiza
el óptimo. La misma semilla reproduce la secuencia de búsqueda; un presupuesto
de tiempo puede detenerla en intentos distintos según el equipo. Las pruebas
usan un número fijo de intentos para verificar reproducción exacta.

## Guardado y recuperación

El navegador conserva el proyecto en su almacenamiento local; descarga también
copias con «Guardar». Las nuevas versiones internas guardan datos y condiciones,
además de posiciones. Las versiones antiguas siguen restaurando solo posiciones.

Crear un proyecto, importar y cargar ejemplos desvincula el archivo anterior de
Drive. Los cambios remotos nunca reemplazan silenciosamente la copia local.
Antes de una importación o escritura se conserva una copia de recuperación
(hasta tres), accesible desde Inicio → «Recuperar copia».

Las actualizaciones de Drive comparan la revisión remota y utilizan `If-Match`
cuando Google expone un ETag. Si no está disponible, se crea un archivo de revisión
nuevo para conservar el original. Ante un conflicto, se mantiene el trabajo local
y se solicita elegir una copia; no hay edición colaborativa en tiempo real.

La X cierra las ayudas sin borrar datos. El botón «Ayuda» vuelve a mostrarlas.
«Ver horario» permanece visible fuera de la bienvenida.

## Pruebas

Desde esta carpeta:

```sh
node --test tests.cjs
```

Al cambiar un archivo JavaScript o CSS, ejecuta `node version-assets.cjs` antes
de publicar. Los enlaces incluyen una versión calculada del contenido para que
el navegador no mezcle scripts o estilos antiguos con una página recién actualizada.

La revisión incluye pruebas de flujo completo (plantilla, actividades, generación,
exportación e importación), navegación por teclado y comprobaciones de que la
demostración no altera los guardados normales. El diagnóstico inicial limita su
trabajo a 60 actividades distintas para mantener ágil la apertura de Generar;
el motor examina todas las actividades durante la búsqueda.

Las pruebas ejecutan el código de producción y el código del worker en contextos
aislados. Cubren datos inválidos, conflictos fijados, reparación, aforos, aulas
alternativas, preferencias, subgrupos, sustituciones, calendario, sincronización
simulada, recuperación, versiones completas y generación de todas las vistas.
No realizan autenticación ni escrituras reales en Google Drive.
