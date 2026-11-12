-- Migración aplicada: track_progress_revision
create trigger card_progress_touch before update on public.card_progress for each row execute function public.touch_updated_at();
