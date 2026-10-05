-- Endurece permisos tras la revisión de seguridad.

-- ---------------------------------------------------------------------
-- Dispositivos: desde las apps solo se pueden renombrar. Revocar pasa por
-- funciones que solo van de activo a revocado: con una sesión robada ya no
-- se puede reactivar un teléfono ni cambiarle la llave por otra.
-- ---------------------------------------------------------------------
revoke update on public.dispositivos from authenticated;
grant update (nombre) on public.dispositivos to authenticated;
alter table public.dispositivos
  add constraint dispositivos_nombre_largo check (char_length(nombre) <= 80) not valid;

create or replace function public.revocar_dispositivo(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.dispositivos set revocado = true
  where id = p_id and user_id = (select auth.uid());
$$;

-- El teléfono revoca su propia llave al cerrar sesión (no conoce su id).
create or replace function public.revocar_mi_llave(p_llave text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.dispositivos set revocado = true
  where user_id = (select auth.uid())
    and llave_hash = encode(extensions.digest(p_llave, 'sha256'), 'hex');
$$;

revoke all on function public.revocar_dispositivo(uuid) from public, anon;
grant execute on function public.revocar_dispositivo(uuid) to authenticated;
revoke all on function public.revocar_mi_llave(text) from public, anon;
grant execute on function public.revocar_mi_llave(text) to authenticated;

-- Mismo registro, con el nombre acotado.
create or replace function public.registrar_dispositivo(p_nombre text default 'Teléfono')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_llave text;
begin
  if v_uid is null then
    raise exception 'Necesitas iniciar sesión';
  end if;
  v_llave := 'fz_' || encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.dispositivos (user_id, nombre, llave_hash)
  values (v_uid, left(coalesce(nullif(btrim(p_nombre), ''), 'Teléfono'), 80), encode(extensions.digest(v_llave, 'sha256'), 'hex'));
  return v_llave;
end $$;

revoke all on function public.registrar_dispositivo(text) from public, anon;
grant execute on function public.registrar_dispositivo(text) to authenticated;

-- ---------------------------------------------------------------------
-- Notificaciones crudas: las escribe la función de ingesta. Desde las apps
-- solo se marcan (ignorada / procesada con su movimiento), sin tocar el texto.
-- ---------------------------------------------------------------------
revoke update on public.notificaciones_crudas from authenticated;
grant update (estado, movimiento_id) on public.notificaciones_crudas to authenticated;

-- ---------------------------------------------------------------------
-- Sin sesión no se toca ninguna tabla (antes lo impedía solo RLS).
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
