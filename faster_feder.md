# Faster Feder: Diagnóstico y Optimización de Rendimiento

Feder es una aplicación de escritorio basada en React, Vite y Electron. Al escribir documentos largos o trabajar con múltiples elementos interactivos, es común experimentar lentitud o retraso en la escritura (typing lag). Este documento detalla por qué ocurría esto, cómo se comportaban la compilación y la memoria, qué optimizaciones hemos implementado para solucionarlo y algunas recomendaciones para mantener el rendimiento al máximo.

---

## 1. ¿Cómo se comporta la Compilación e indirectamente la Memoria en Feder?

### Compilación y Previsualización (Markdown & KaTeX)
En aplicaciones web basadas en React, "compilar" se refiere a:
1. **Análisis y Renderizado de Markdown**: Convertir el texto crudo en un árbol de componentes React estructurados utilizando `react-markdown` y plugins (`remark-math`, `remark-gfm`, `rehype-katex`, `rehype-raw`).
2. **Pre-renderizado de KaTeX**: Transformar todas las fórmulas matemáticas complejas ($$...$$) a HTML nativo con estilos y fuentes vectoriales.
3. **Reconciliación de React (Virtual DOM)**: Comparar el árbol HTML resultante con el DOM actual y aplicar los cambios.

Este proceso es muy costoso a nivel de CPU. Si se realiza en un documento largo (de decenas de páginas, tablas complejas o múltiples fórmulas matemáticas) en cada pulsación de tecla, el navegador se satura y se produce el **typing lag**.

### ¿Están los elementos ocultos activos en Memoria y CPU?

*   **Pestañas no visibles (Gráficos, Sugerencias de IA)**: 
    *   Tanto el gráfico de notas (`NotesGraph`), el gráfico de ideas (`IdeasGraph`) como el panel de sugerencias (`ImprovementPanel`) están **renderizados de forma condicional** (`currentTab === '...' && <Component />`). Esto significa que cuando estás en la pestaña de vista previa, estos componentes **no están montados** en el DOM. No consumen ciclos de renderizado de React ni memoria de elementos activos. Solo se montan y se inicializan cuando haces clic para verlos.
*   **Vista Previa de Markdown (`MarkdownPreview`)**: 
    *   **Antes de las optimizaciones**: El componente de vista previa se mantenía en el DOM oculto con `display: none` cuando cambiabas a otras pestañas (como Comentarios o Sugerencias). Esto se hace para mantener la posición de desplazamiento (scroll) al alternar pestañas. Sin embargo, debido a que no estaba optimizado, **seguía re-renderizándose y re-compilando todo el Markdown en cada pulsación de tecla**, incluso estando completamente oculto a la vista del usuario.
    *   **Después de las optimizaciones**: Ahora la vista previa está completamente memoizada. Aunque permanezca montada en el DOM en segundo plano, **no realiza ningún cálculo, renderizado ni compilación** mientras escribes si tienes activado "Update on Save".
*   **Comentarios y Líneas de Comentarios**:
    *   Los comentarios se guardan como metadatos del archivo. Se leen en memoria al cargar el archivo y se recalculan sus posiciones en el editor de forma dinámica.

---

## 2. Los Problemas de Rendimiento Detectados (Cuellos de Botella)

Durante nuestra investigación, descubrimos cuatro causas principales por las que Feder se volvía tan lento al añadir mucho texto:

1.  **Re-renderizado incondicional de la Vista Previa (MarkdownPreview) al escribir**:
    *   Incluso con la opción "Update on Save" activa (donde la variable `previewContent` solo cambia al guardar), el componente `<Preview />` recibía referencias de funciones y datos cambiantes (`currentFileContent={content}`, `editorSelection`, y callbacks no memoizados) de forma directa en cada renderizado de la aplicación.
    *   Esto invalidaba la memoización de `<Preview />` y obligaba a toda la vista previa a ejecutarse de nuevo en cada pulsación de tecla.
2.  **Layout Thrashing (Saturación de Diseño) en el Editor**:
    *   En el archivo `Editor.jsx`, la función `updateCaretPosition` medía las propiedades de estilo del elemento (`window.getComputedStyle`) y escribía en el DOM para reposicionar el widget de comentarios e mejoras. Esto ocurría en **cada pulsación de tecla**, incluso cuando el usuario no tenía seleccionado ningún texto (y el widget estaba oculto).
    *   La función `computeCommentPositions` leía y escribía en el DOM repetidamente en un bucle por cada comentario del documento para calcular su altura vertical en píxeles. Hacer esto de forma síncrona en cada carácter escrito causaba múltiples recálculos de diseño forzados en el navegador, congelando el hilo de ejecución de la interfaz de usuario.
3.  **Re-renderizado recursivo del Explorador de Archivos (FileExplorer)**:
    *   Al no estar memoizado, el explorador de archivos escaneaba y re-renderizaba recursivamente todo el árbol de carpetas y archivos en cada carácter escrito en el editor, consumiendo memoria y CPU de forma innecesaria.
4.  **Parsing completo del Markdown en cambios de sección**:
    *   Cuando se habilitaba el "Live Update" (previsualización en vivo con debounce de 500ms), cualquier cambio obligaba a re-parsear las fórmulas y markdown de **todo el documento**, en lugar de actualizar únicamente la sección en la que se estaba escribiendo.

---

## 3. Optimizaciones Implementadas

Hemos reescrito y optimizado la estructura de Feder para corregir estos problemas de raíz:

### A. Aislamiento Completo de la Vista Previa durante la Escritura
*   En `App.jsx`, ahora solo pasamos estados cambiantes a la vista previa cuando realmente se necesitan:
    *   `editorSelection`, `commentPositions` y `editorScrollTop` se configuran como `null`, `[]` y `0` respectivamente a menos que la pestaña `'comments'` esté activa.
    *   `currentFileContent` solo pasa el texto en vivo del editor si la pestaña `'ideas-graph'` está activa.
*   Con esto, las propiedades de `<Preview />` son **100% idénticas** en cada pulsación de tecla cuando editas un documento. Al estar envuelto en `React.memo`, React descarta por completo el renderizado del panel derecho, logrando un rendimiento de escritura inmediato y fluido.

### B. Memoización a Nivel de Componente y Secciones
*   **MarkdownPreview** ahora está envuelto en `React.memo`.
*   **MarkdownSection** (las secciones individuales de nivel H1) ahora también están memoizadas. Para evitar que la propiedad `fullContent` (que cambia en cada carácter) invalide esta memoización, modificamos el callback `onUpdateContent` para que acepte una función de actualización de estado de React (`prev => ...`). De este modo, los checkboxes del documento pueden alternar su estado sin necesidad de recibir el texto completo como propiedad en el componente de sección.
*   **Resultado**: Cuando el panel de previsualización se actualiza (por ejemplo, en un Guardado o en "Live Update"), **solo se vuelve a parsear y renderizar la sección de cabecera que ha sido modificada**. El resto del documento se sirve directamente de la caché de React.

### C. Eliminación del Layout Thrashing en el Editor
*   **updateCaretPosition** ahora tiene un cortocircuito: si el widget de comentarios/mejoras no está visible (`showWidget === false`), la función retorna inmediatamente, evitando consultas costosas de estilo en el DOM durante el tipeo continuo.
*   **computeCommentPositions** ahora está **debounceado con un retraso de 400ms**. Las posiciones verticales de los comentarios ya no se calculan de manera síncrona en cada carácter; se retrasan hasta que el usuario hace una breve pausa en la escritura.

### D. Memoización del Explorador de Archivos (FileExplorer)
*   Envolvimos `FileExplorer` en `React.memo` y eliminamos todas las referencias in-line de objetos literales (`{}`) y funciones anónimas en sus propiedades en `App.jsx`. El explorador de archivos permanece inerte e increíblemente rápido mientras escribes en el documento activo.

### E. Callback Stability (useRef Callback Pattern)
*   Implementamos el patrón `latestStateRef` en `App.jsx` para almacenar el estado dinámico actual en un objeto de referencia mutable (`useRef`). Esto nos permitió definir todos los callbacks de eventos importantes (`handleAddComment`, `handleRename`, `handleFileSelect`, etc.) con un array de dependencias vacío `[]`, garantizando que sus referencias en memoria sean permanentes y no causen re-renderizados en cascada hacia los componentes memoizados de abajo.

---

## 4. Consejos para mantener a Feder Rápido

Si notas lentitud en proyectos extremadamente masivos en el futuro, te recomendamos seguir estas pautas:

1.  **Mantén activo "Update on Save" (Actualizar al Guardar)**:
    *   Puedes alternar esta opción haciendo clic en el icono del rayo/guardar de la barra de estado inferior. En "Update on Save", el preview derecho solo procesará el Markdown cuando guardes con `Ctrl + S`, manteniendo la edición en vivo totalmente ágil.
2.  **Utiliza Cabeceras de Nivel 1 (`#`) para dividir tus documentos**:
    *   Feder divide automáticamente el documento en secciones basadas en los encabezados principales (`#`). Si mantienes tus documentos estructurados con encabezados de nivel 1, la optimización por secciones memoizadas funcionará de manera óptima, renderizando solo la sección bajo la que estás editando.
3.  **Evita un número excesivo de comentarios abiertos en un solo archivo**:
    *   Aunque el posicionamiento dinámico de comentarios ahora está debounceado y optimizado, mantener más de 50 o 100 comentarios activos en un único documento de gran tamaño requiere cálculos geométricos adicionales del DOM. Intenta resolver o limpiar los comentarios una vez finalizada la revisión de texto.
