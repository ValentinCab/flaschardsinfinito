-- Migración aplicada: limit_workspace_members_and_isolate_hierarchy.
-- La función serializa los ingresos por espacio y limita a dos integrantes.
-- No modifica la versión publicada de la aplicación.
begin;

alter table public.workspaces
  alter column invite_code set default
    (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));

create or replace function public.join_workspace(p_invite_code text)
returns table(id uuid, name text)
language plpgsql security definer set search_path = ''
as $$
declare
  w public.workspaces;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Debés iniciar sesión.';
  end if;
  select * into w from public.workspaces
   where invite_code = lower(trim(p_invite_code))
   for update;
  if not found then
    raise exception 'Código de invitación inválido.';
  end if;
  if exists (select 1 from public.workspace_members m where m.workspace_id = w.id and m.user_id = uid) then
    return query select w.id, w.name;
    return;
  end if;
  if (select count(*) from public.workspace_members m where m.workspace_id = w.id) >= 2 then
    raise exception 'El espacio ya tiene dos integrantes.';
  end if;
  insert into public.workspace_members(workspace_id, user_id, role)
    values (w.id, uid, 'editor');
  -- Invalida el código utilizado. Un espacio lleno rechaza igualmente otro ingreso.
  update public.workspaces set invite_code =
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
    where public.workspaces.id = w.id;
  return query select w.id, w.name;
end;
$$;
revoke all on function public.join_workspace(text) from public, anon;
grant execute on function public.join_workspace(text) to authenticated;

-- Asegura que cada padre pertenezca al mismo espacio que su hijo.
alter table public.subjects add constraint subjects_id_workspace_unique unique(id, workspace_id);
alter table public.folders add constraint folders_id_workspace_unique unique(id, workspace_id);
alter table public.decks add constraint decks_id_workspace_unique unique(id, workspace_id);
alter table public.folders add constraint folders_subject_same_workspace
  foreign key(subject_id, workspace_id) references public.subjects(id, workspace_id);
alter table public.decks add constraint decks_folder_same_workspace
  foreign key(folder_id, workspace_id) references public.folders(id, workspace_id);
alter table public.cards add constraint cards_deck_same_workspace
  foreign key(deck_id, workspace_id) references public.decks(id, workspace_id);

revoke execute on function private.is_workspace_member(uuid) from public, anon;
revoke execute on function private.is_workspace_owner(uuid) from public, anon;
revoke update on public.workspace_members from authenticated;
commit;
