# Trabajo en curso: Flash Infinito con Supabase

Esta rama conserva el HTML de `main`. La sincronización, autenticación, importación y pruebas con dos cuentas todavía no están implementadas. No desplegar esta rama ni aplicar el SQL sin probarlo primero.

## Revisión inicial (12 de noviembre de 2026)

- Las siete tablas públicas tienen RLS habilitada. El bucket `flashcards-images` es privado y las políticas consultan la membresía del espacio.
- `card_progress` limita las operaciones a `auth.uid()` y exige pertenecer al espacio de la tarjeta.
- `join_workspace` permite actualmente incorporar más de dos personas con un mismo código. Su función es SECURITY DEFINER y está accesible al rol autenticado.
- Las claves foráneas de carpeta → materia, mazo → carpeta y tarjeta → mazo no obligan a que el padre tenga el mismo `workspace_id`. Esto puede producir referencias entre espacios.
- El asesor de Supabase marca las dos funciones públicas SECURITY DEFINER; son puntos de entrada deliberados, pero necesitan revisión y pruebas de autorización.
- El proyecto no tenía usuarios ni registros en las tablas al momento de la inspección. No se ha modificado la base.

El archivo `propuestas/seguridad.sql` es una propuesta no aplicada: debe probarse transaccionalmente, con cuentas reales separadas, concurrencia y almacenamiento, antes de convertirse en una migración. Aún falta resolver la gestión de invitaciones, registro de cuentas, operaciones fuera de línea, conflictos, recuperación y el manejo de errores.

## Respaldo de la versión actual

1. Abrí la aplicación original en el navegador y perfil donde están las tarjetas.
2. Entrá en **Guardado** → **Copiar guardado**. El texto empieza con `FLASH_INFINITO_V2` e incluye los datos, imágenes y progreso guardados.
3. Pegalo en un archivo de texto y conservá una copia. Si falla el portapapeles, la aplicación muestra el texto para copiarlo manualmente.
4. Para restaurarlo en esa versión: **Guardado**, pegá el contenido en el cuadro de restauración y elegí **Restaurar y reemplazar datos**. La restauración reemplaza los datos de ese navegador; no importa datos a Supabase.

El archivo HTML no contiene automáticamente los datos guardados: la app los guarda en IndexedDB del navegador. Abrir el mismo HTML en otro navegador, perfil u origen puede mostrar una biblioteca diferente.
