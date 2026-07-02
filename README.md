# C295 · Inglés Técnico — Guía de mantenimiento

App de estudio de inglés técnico aeronáutico, instalable en el móvil como
una app nativa (PWA), con tarjetas, test, dictado, práctica de pronunciación,
repaso espaciado y examen mixto. Funciona sin conexión una vez instalada.

---

## 1. Qué hay en esta carpeta

| Archivo              | Qué es                                                    | ¿Lo tocarás normalmente? |
|-----------------------|------------------------------------------------------------|:---:|
| `index.html`          | Estructura de la app                                       | No |
| `style.css`            | Diseño visual                                              | Solo si quieres cambiar colores |
| `app.js`               | Toda la lógica (tarjetas, test, dictado, repaso, examen…)  | Solo para añadir funciones nuevas |
| **`data.js`**          | **Las frases y bloques de contenido**                       | **Sí, este es el que editarás más** |
| `manifest.json`        | Configuración de instalación (nombre, icono, colores)      | Rara vez |
| `service-worker.js`    | Hace que funcione sin conexión y avisa de actualizaciones  | Solo para cambiar el nº de versión |
| `icons/`               | Icono de la app en 192px y 512px                            | Solo si quieres cambiar el icono |

---

## 2. Cómo añadir más contenido (lo más habitual)

Abre `data.js` con cualquier editor de texto (incluso el Bloc de notas
sirve, aunque recomiendo algo como Visual Studio Code, que es gratis).

**Añadir una frase a un bloque que ya existe:** busca el bloque, y añade
una línea nueva dentro de `"pairs"`:

```js
["Frase nueva en español.","New sentence in English."],
```

**Añadir un bloque nuevo entero:** copia un bloque completo (desde `{`
hasta `}`), pégalo justo antes del `];` final, y cambia el título y las
frases.

No hace falta tocar nada más — la app cuenta las frases y bloques
automáticamente y los reparte en tarjetas, test, dictado, repaso y examen.

---

## 3. Cómo publicar la app (para tener una URL real)

Ahora mismo tienes una carpeta de archivos. Para que sea instalable de
verdad (con icono, funcionamiento sin conexión, etc.) necesita estar
servida por **https**, no basta con abrir el `index.html` con doble clic.
Dos opciones gratis, sin necesidad de saber programación:

### Opción A — Netlify Drop (la más rápida, 2 minutos)
1. Entra en **app.netlify.com/drop**.
2. Arrastra la carpeta `c295-app` completa a la web.
3. Te da una URL al momento (tipo `algo-random.netlify.app`).
4. Si quieres una URL fija y poder actualizarla más adelante, crea una
   cuenta gratuita (con tu email) y "reclama" ese sitio.

### Opción B — GitHub Pages (más "profesional", ideal si se lo enseñas a tu jefe)
1. Crea una cuenta gratuita en **github.com** (si no tienes).
2. Crea un repositorio nuevo, por ejemplo `c295-ingles`.
3. Sube todos los archivos de esta carpeta (botón "Add file → Upload files").
4. Ve a **Settings → Pages**, en "Source" elige la rama `main` y guarda.
5. En un par de minutos tendrás tu app en:
   `https://tu-usuario.github.io/c295-ingles/`

Con cualquiera de las dos opciones consigues una URL que puedes enseñar
a tu jefe o compañeros directamente desde el navegador.

---

## 4. Cómo instalarla en el móvil

1. Abre la URL de tu app en **Chrome** (Android) o **Safari** (iPhone).
2. Verás un aviso "📲 Puedes instalar esta app" dentro de la propia app
   (en Android), o puedes hacerlo manualmente:
   - **Android/Chrome:** menú (⋮) → "Instalar aplicación" / "Añadir a pantalla de inicio".
   - **iPhone/Safari:** botón compartir (□↑) → "Añadir a pantalla de inicio".
3. Aparece un icono como el de cualquier otra app. Al abrirla no se ve
   la barra del navegador — funciona como una app nativa, y sigue
   funcionando sin conexión a partir de la segunda vez que la abras.

---

## 5. Cómo publicar una actualización

Cuando cambies contenido (`data.js`) o cualquier otro archivo:

1. Abre `service-worker.js` y sube el número de versión, por ejemplo:
   ```js
   const CACHE_VERSION = 'v2';   // antes era 'v1'
   ```
2. Vuelve a subir **todos** los archivos a tu hosting (arrastrar de nuevo
   en Netlify, o subir de nuevo en GitHub).
3. Los usuarios que ya tengan la app instalada verán automáticamente el
   aviso "🔄 Nueva versión disponible" la próxima vez que la abran, con
   un botón para actualizar al instante.

También puedes subir el número de `APP_VERSION` al principio de `app.js`
(es solo un texto informativo, no afecta al funcionamiento).

---

## 6. El progreso de estudio (dónde se guarda)

El progreso (qué frases dominas, tu racha de días, etc.) se guarda **en
el propio navegador del dispositivo**, no en un servidor. Esto significa:

- Si usas siempre el mismo dispositivo instalado, tu progreso persiste.
- Si cambias de móvil, usa **⚙️ Ajustes → Exportar progreso** para
  descargar un archivo, y en el nuevo dispositivo **⚙️ Ajustes →
  Importar progreso** para recuperarlo.
- No hay cuentas de usuario ni servidor: es intencionadamente así, para
  no depender de infraestructura ni tener costes de mantenimiento.

---

## 7. Límites honestos de esta versión

Para que sepas hasta dónde llega esto tal cual está, y qué haría falta
para ir más allá:

- **Reconocimiento de voz (modo "Pronuncia")**: funciona en Chrome, Edge,
  Opera y Safari 14.5+ (Android, iPhone y ordenador). **En Firefox no
  funciona** — Mozilla tiene esa función implementada pero desactivada
  por defecto, porque depende de enviar el audio a un servidor externo
  y ellos no tienen uno propio en producción. El resto de la app
  (tarjetas, test, dictado, repaso, examen, instalación, funcionamiento
  sin conexión) funciona igual de bien en Firefox que en cualquier otro
  navegador.
- **Sin cuenta de usuario ni sincronización entre dispositivos**
  automática: se soluciona con exportar/importar (ver punto 6), o si en
  el futuro se quisiera sincronización automática, haría falta un
  backend real (servidor + base de datos), que ya es otro nivel de
  proyecto.
- **No está en la App Store / Google Play**: al ser una PWA no lo
  necesita para instalarse en el móvil, pero si algún día se quisiera
  publicar oficialmente en las tiendas, se puede empaquetar con
  herramientas como Capacitor o Bubblewrap a partir de esta misma base.

---

Cualquier duda sobre cómo tocar algo de esto, puedes volver a preguntarme
mostrándome qué archivo quieres cambiar y qué te gustaría que hiciera.
