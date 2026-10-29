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
- `compliance.js`: cargas curriculares en minutos, jornada individual, habilitaciones y estado de borrador.
- `privacy.js`: información de privacidad compartida, conexión opcional a Google y controles locales.
- `privacidad.html`: página pública de privacidad, sin JavaScript ni inicio de sesión.
- `tests.cjs`: pruebas de regresión sin dependencias.

## Uso

La barra superior incluye **Nuevo proyecto**, **Guardar**, **Abrir** y **Excel**.
«Nuevo proyecto» reúne la creación del proyecto y de su plantilla en un único asistente completo.
Permite indicar docentes, clases, duración de cada sesión, sesiones de mañana, hora de inicio, recreo, curso, titularidad, alumnos por clase, aulas adicionales, nombres
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

## Horas y normativa

La sección «Horas y normativa» compara por grupo los minutos exigidos, previstos y colocados por materia. Las sesiones se convierten con su duración real; una sesión de 45 minutos no se cuenta como una hora. Una distribución revisada con una cantidad incorrecta de sesiones impide iniciar la generación; los perfiles incompletos permiten trabajar como borrador. No se redondean horas para crear actividades.

Las bases automáticas de carga son Primaria de Murcia (Decreto 209/2022, anexo I) y Extremadura (Decreto 107/2022 consolidado, artículo 13 y anexo IV). Murcia usa cursos; Extremadura usa ciclos. El reparto extremeño por curso es una propuesta del centro que conserva los totales del ciclo y sitúa Valores en sexto: requiere revisión y ambos cursos del ciclo para comprobarlo. Las opciones y el reparto por alumnos, las adaptaciones autorizadas y el equilibrio pedagógico no pueden certificarse sumando áreas. Los perfiles automáticos no autorizan variaciones: las excepciones deben documentarse mediante distribución manual.

Para el resto de comunidades y etapas se introducen las cargas y la fuente oficial; no se presenta el catálogo nacional de nombres como una tabla de horas contrastada. Los desdobles, subgrupos y optativas simultáneas quedan pendientes de contraste del itinerario de cada alumno: no se suman como si cada alumno cursase todas las opciones.

Cada docente requiere fuente de normativa o convenio, mínimos/máximos individuales tras reducciones, unidad lectiva (minutos o periodos), permanencia en minutos, trabajo fuera de la rejilla, cómputo de actividades y materias para las que se ha comprobado habilitación. No se inventa un límite nacional uniforme ni se presume jornada completa. Un cambio de comunidad, curso, titularidad, nivel, catálogo o marco exige renovar la revisión. Los datos declarados deben contrastarse con documentación individual y la vigencia de la norma. «Comprobaciones configuradas superadas» no es una certificación jurídica universal.

Las exportaciones pendientes requieren elegir «Exportar borrador» y llevan la marca en el nombre y contenido. La impresión pendiente incluye una advertencia de borrador. «Guardar» sigue permitiendo descargar siempre el proyecto editable. No hay aprobación automática del horario sin completar las comprobaciones.

## Borrar de Drive

«Borrar» sustituye a «Ver en Drive». Muestra nombre y confirmación antes de mover el archivo a la papelera (no borrado permanente). No elimina el proyecto abierto en el navegador. Si se borra el archivo vinculado, la aplicación desconecta su sincronización; una operación en curso bloquea otra escritura o borrado. Los errores conservan el vínculo y la copia local. Las pruebas usan respuestas simuladas, sin borrar archivos de una cuenta real.

## Avisos con acceso directo

Cada revisión o diferencia en «Qué queda por resolver» incluye «Ver», una explicación en rojo y un destino explícito. Abre el formulario del grupo o docente, el horario correspondiente, el marco o las actividades filtradas por grupo/materia. Los ciclos muestran ambos cursos. La pantalla de destino conserva la explicación y permite volver a los pendientes; guardar una revisión vuelve a la lista. Los destinos usan identificadores, por lo que no confunden personas o grupos con nombres iguales, y comprueban que el dato siga existiendo.

Las actividades incluyen «Quitar filtros» y muestran tramos semanales en lugar de confundirlos con horas de reloj. Los desajustes por materia no se multiplican contra cero cuando aún falta definir el currículo. Con tramos variables, la previsión queda «Por calcular» mientras falten sesiones; una vez colocadas todas se usan sus minutos reales sin dejar un aviso permanente.

## Privacidad y cuentas educativas

La aplicación y el pie lateral ofrecen acceso a «Privacidad y cuentas educativas». `privacidad.html` es una página pública sin JavaScript; su contenido se genera desde la misma información de `privacy.js` al ejecutar `node version-assets.cjs`, que también actualiza las versiones de estilos de ambas páginas. La sección explica guardado local, versiones y recuperación, descargas, Drive opcional, almacenamiento de metadatos de cuenta y servicios externos. No afirma que no exista almacenamiento: el código no envía proyectos a un servidor propio de MaxHorarios. La configuración y retención de registros del alojamiento quedan fuera de la revisión de este código.

Google Identity solo se carga cuando se solicita conectar; un segundo botón explícito inicia la autorización. Se piden correo y `drive.file`, sin el permiso de perfil. El token solo se conserva en memoria. Desconectar cancela solicitudes de autorización pendientes y descarta respuestas tardías para que no reaparezca una sesión cerrada. El acceso de cuentas Educarex/Workspace depende de la autorización institucional y no acredita respaldo oficial. La política no sustituye la identificación y el contacto del titular real de la web: esos datos deben completarse por su responsable.

El borrado local requiere confirmación y elimina exclusivamente las claves de MaxHorarios del modo actual, las copias de recuperación y el historial en memoria. No borra Drive ni descargas. Se bloquea mientras haya búsqueda, escritura o borrado de Drive en curso. El botón «Guardar una copia antes» permite conservar un respaldo; no se prueba borrando datos reales de una cuenta.

## Cursos, ejemplos y avisos

El curso inicial usa el año natural actual en Europe/Madrid como primer año (por ejemplo, 2026/2027) y el desplegable ofrece cinco cursos futuros además del actual. Se conserva cualquier curso anterior de un proyecto abierto.

«Ejemplo», junto a «Nuevo proyecto», pregunta Primaria/ESO y comunidad. Prepara un centro ficticio con docentes, grupos, alumnos por clase, materias regionales, aulas con aforo, actividades, disponibilidades, jornadas ilustrativas y una ausencia. Confirma antes de sustituir el proyecto, conserva recuperación, desconecta Drive y genera el horario. El resultado incluye una versión completa y, cuando haya sustituto disponible, una sustitución de ejemplo. No marca sus jornadas ni cargas ficticias como normativa revisada.

La indicación de «Ver» tiene X, arrastre vertical y botones Subir/Bajar. Se recoloca dentro del documento, sin quedar fija ni superponerse a los controles. Cerrar no altera datos ni marca el problema como resuelto; vuelve a aparecer al pulsar «Ver». Se elimina la franja decorativa lateral.
