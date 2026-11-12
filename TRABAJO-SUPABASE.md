# Trabajo en curso: conexión con Supabase

La rama incluye una pantalla de prueba para crear cuenta, iniciar sesión, crear o unirse a un espacio y consultar el número de mazos y tarjetas remotos. No reemplaza la aplicación publicada.

**Pendiente:** la biblioteca, el progreso y las imágenes locales todavía no se sincronizan con Supabase. La restauración sigue siendo local. No utilizar esta rama como versión definitiva y conservar el respaldo.

## Seguridad

Se aplicó la migración `limit_workspace_members_and_isolate_hierarchy`: el ingreso se limita a dos personas, el código se regenera después de usarlo, las relaciones de la jerarquía deben pertenecer al mismo espacio y se revocó el UPDATE directo de membresías.

Con usuarios y datos temporales dentro de transacciones revertidas se verificó que un tercer usuario no puede ingresar a un espacio lleno, un miembro puede leer la tarjeta compartida y solo ve su propio progreso, y una persona ajena no ve ni la tarjeta ni el progreso. Falta probar autenticación real, almacenamiento de imágenes, concurrencia y la aplicación en navegador.

El asesor sigue advirtiendo que las funciones públicas `create_workspace` y `join_workspace` son SECURITY DEFINER y ejecutables por usuarios autenticados. Son puntos de entrada necesarios para crear y aceptar membresías con el diseño actual; siguen sujetos a revisión, especialmente frente a abuso.

## Respaldo de la versión actual

1. Abrí la aplicación original en el navegador y perfil donde están las tarjetas.
2. Entrá en **Guardado** → **Copiar guardado** y pegá el texto en un archivo. Incluye tarjetas, imágenes y progreso.
3. Para restaurarlo en la app original, entrá en **Guardado**, pegalo en el cuadro y elegí **Restaurar y reemplazar datos**. Esto reemplaza los datos locales del navegador; todavía no los importa a Supabase.

La biblioteca se guarda en IndexedDB del navegador, no dentro del HTML.
