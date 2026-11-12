# Flash Infinito — versión de prueba con Supabase

Esta rama conserva en `flashcards-infinito (9).html` la versión original. No se ha reemplazado la versión publicada.

Incluye inicio de sesión, espacios compartidos de hasta dos personas, lectura y guardado de materias, carpetas, mazos y tarjetas, imágenes en el bucket privado y progreso individual. Los cambios se guardan primero en IndexedDB y se suben al espacio. Un indicador muestra si están sincronizados o si ocurrió un error. Las ediciones de un mismo registro realizadas simultáneamente se detectan mediante su fecha de actualización. Se puede actualizar manualmente desde la nube en el menú de biblioteca.

## Importar un respaldo del navegador

1. En el navegador y perfil que tienen tus datos, abrí la versión original. Entrá en **Guardado → Copiar guardado** y pegá el texto en un archivo; mantené esa copia.
2. Abrí esta versión de prueba en un sitio web de prueba que sirva todos sus archivos por HTTPS. No alcanza con abrir solo el HTML: necesita los módulos JavaScript de esta rama. Registrate o iniciá sesión y creá un espacio.
3. Elegí el espacio y pulsá **Abrir biblioteca compartida**. El espacio debe estar vacío.
4. Abrí **Biblioteca compartida**, pegá el texto del respaldo en el cuadro y seleccioná **Importar respaldo**. Esperá a que el indicador diga **Sincronizado**; no cierres la página durante la carga.
5. En el menú del espacio obtené el código de invitación para la segunda persona. Su progreso comienza por separado.

Si una sincronización falla, los cambios pendientes quedan en IndexedDB de ese navegador. Al volver a abrir ese espacio la aplicación muestra el texto para recuperar esos cambios. Guardalo; todavía no hay una recuperación automática de la cola.

## Estado y límites

- Pruebas automáticas locales con un servicio simulado: importación y referencias, migración de imagen, guardado por objeto y conflictos. La pantalla de acceso se abrió en navegador. La base se probó con transacciones revertidas para membresía y aislamiento de progreso.
- **Faltan pruebas integrales con dos cuentas reales, dos navegadores, imágenes reales y desconexiones. No usar como único respaldo ni publicar como versión definitiva todavía.**
- Se bloqueó temporalmente la eliminación de carpetas y mazos compartidos para evitar una eliminación en cascada de cambios simultáneos.
- La versión actual requiere actualizar manualmente para ver cambios hechos por otra persona; no ofrece sincronización en tiempo real.
- La recuperación de conflictos todavía requiere copiar el respaldo local y resolverlos manualmente. La aplicación guarda el estado original en otra base IndexedDB.
- Las migraciones aplicadas en Supabase son `limit_workspace_members_and_isolate_hierarchy` y `track_progress_revision`. El asesor sigue advirtiendo sobre dos funciones SECURITY DEFINER expuestas a usuarios autenticados. La lógica de ambas requiere revisión frente a abuso.

Ejecutar pruebas: `node --test tests/sync.test.mjs`.
