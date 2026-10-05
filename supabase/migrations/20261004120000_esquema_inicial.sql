-- =====================================================================
-- Finanzas · esquema inicial
-- Todo el dinero se guarda en centavos (bigint). Cada fila pertenece a
-- un usuario (user_id) y RLS garantiza que solo él la ve.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------

-- Debe coincidir con normalizarComercio() de packages/core/src/texto.ts
create or replace function public.normalizar_comercio(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(regexp_replace(
    lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p, ''))),
    '[^a-z ]', ' ', 'g'), '\s+', ' ', 'g'))
$$;

create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

create table public.cuentas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  banco text not null check (banco in ('BBVA', 'Santander', 'Otro')),
  alias text not null check (length(alias) between 1 and 60),
  -- Terminaciones (últimos 4 dígitos) de tarjetas y cuentas: sirven para
  -- reconocer notificaciones y transferencias entre tus propias cuentas.
  terminaciones text[] not null default '{}',
  es_principal boolean not null default false,
  creado_en timestamptz not null default now()
);

create table public.apartados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null check (length(nombre) between 1 and 60),
  tipo text not null check (tipo in ('gastos', 'meta')),
  descripcion text,
  cuenta_id uuid references public.cuentas on delete set null,
  destino text,
  meta_centavos bigint check (meta_centavos > 0),
  saldo_inicial_centavos bigint not null default 0 check (saldo_inicial_centavos >= 0),
  color text not null default '#9A8DF2',
  orden int not null default 0,
  archivado boolean not null default false,
  creado_en timestamptz not null default now()
);
-- Solo puede haber un apartado de "Gastos personales" por usuario.
create unique index apartados_un_gastos on public.apartados (user_id) where tipo = 'gastos';

create table public.fuentes_ingreso (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null check (length(nombre) between 1 and 60),
  cuenta_id uuid references public.cuentas on delete set null,
  monto_esperado_centavos bigint not null check (monto_esperado_centavos > 0),
  tolerancia_pct int not null default 20 check (tolerancia_pct between 0 and 100),
  palabras_clave text[] not null default '{}',
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Porcentaje de cada fuente que va a cada apartado (metas).
-- Gastos personales recibe automáticamente lo que sobra.
create table public.reglas_reparto (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  fuente_id uuid not null references public.fuentes_ingreso on delete cascade,
  apartado_id uuid not null references public.apartados on delete cascade,
  porcentaje numeric(5, 2) not null check (porcentaje >= 0 and porcentaje <= 100),
  unique (fuente_id, apartado_id)
);

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null check (length(nombre) between 1 and 40),
  color text not null default '#A7AAB2',
  orden int not null default 0,
  unique (user_id, nombre)
);

-- "OXXO siempre es Súper": se aprende cuando corriges una categoría.
create table public.reglas_categoria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  patron text not null,
  categoria_id uuid not null references public.categorias on delete cascade,
  creado_en timestamptz not null default now(),
  unique (user_id, patron)
);

-- Teléfonos que pueden mandar notificaciones (con una llave propia).
create table public.dispositivos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null default 'Teléfono',
  llave_hash text not null unique,
  revocado boolean not null default false,
  ultimo_uso timestamptz,
  creado_en timestamptz not null default now()
);

create table public.movimientos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  fecha timestamptz not null default now(),
  monto_centavos bigint not null check (monto_centavos > 0),
  tipo text not null check (tipo in ('gasto', 'ingreso', 'interno')),
  comercio text,
  descripcion text,
  cuenta_id uuid references public.cuentas on delete set null,
  categoria_id uuid references public.categorias on delete set null,
  apartado_id uuid references public.apartados on delete set null,
  fuente_id uuid references public.fuentes_ingreso on delete set null,
  origen text not null default 'manual' check (origen in ('notificacion', 'manual', 'importado')),
  estado text not null default 'confirmado' check (estado in ('confirmado', 'por_revisar', 'descartado')),
  -- Qué avisos formaron este movimiento: 'wallet', 'bbva', 'santander'.
  avisos text[] not null default '{}',
  terminacion text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index movimientos_usuario_fecha on public.movimientos (user_id, fecha desc);
create index movimientos_usuario_monto on public.movimientos (user_id, monto_centavos);

create table public.notificaciones_crudas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  dispositivo_id uuid references public.dispositivos on delete set null,
  app text not null,
  titulo text,
  texto text,
  texto_grande text,
  publicada_en timestamptz not null,
  recibida_en timestamptz not null default now(),
  clave text,
  huella text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'procesada', 'ignorada', 'por_revisar', 'error')),
  resultado jsonb,
  movimiento_id uuid references public.movimientos on delete set null,
  unique (user_id, huella)
);
create index notificaciones_usuario_fecha on public.notificaciones_crudas (user_id, publicada_en desc);
create index notificaciones_usuario_estado on public.notificaciones_crudas (user_id, estado);

-- Lista de "te toca apartar $X" que se genera cuando llega un ingreso.
create table public.por_mover (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  ingreso_id uuid references public.movimientos on delete cascade,
  apartado_id uuid not null references public.apartados on delete cascade,
  periodo text not null check (periodo ~ '^\d{4}-\d{2}$'),
  monto_centavos bigint not null check (monto_centavos > 0),
  descripcion text,
  hecho_en timestamptz,
  movimiento_id uuid references public.movimientos on delete set null,
  creado_en timestamptz not null default now()
);
create index por_mover_usuario_periodo on public.por_mover (user_id, periodo);

-- Índices para las llaves foráneas (recomendación de rendimiento).
create index on public.cuentas (user_id);
create index on public.apartados (cuenta_id);
create index on public.fuentes_ingreso (user_id);
create index on public.fuentes_ingreso (cuenta_id);
create index on public.reglas_reparto (user_id);
create index on public.reglas_reparto (apartado_id);
create index on public.reglas_categoria (categoria_id);
create index on public.dispositivos (user_id);
create index on public.movimientos (cuenta_id);
create index on public.movimientos (categoria_id);
create index on public.movimientos (apartado_id);
create index on public.movimientos (fuente_id);
create index on public.notificaciones_crudas (dispositivo_id);
create index on public.notificaciones_crudas (movimiento_id);
create index on public.por_mover (ingreso_id);
create index on public.por_mover (apartado_id);
create index on public.por_mover (movimiento_id);

create trigger movimientos_actualizado_en
  before update on public.movimientos
  for each row execute function public.tocar_actualizado_en();

-- La suma de reglas de una fuente no puede pasar de 100 %.
create or replace function public.validar_reglas_reparto()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_total numeric;
begin
  select coalesce(sum(porcentaje), 0) into v_total
  from public.reglas_reparto
  where fuente_id = new.fuente_id and id <> new.id;
  if v_total + new.porcentaje > 100 then
    raise exception 'Las reglas de esta fuente suman % %%; el máximo es 100 %%', v_total + new.porcentaje;
  end if;
  return new;
end $$;

create trigger reglas_reparto_validar
  before insert or update on public.reglas_reparto
  for each row execute function public.validar_reglas_reparto();

-- Cuando TÚ corriges la categoría de un gasto, se aprende para ese comercio.
create or replace function public.aprender_categoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and new.tipo = 'gasto'
     and new.comercio is not null
     and new.categoria_id is not null
     and new.categoria_id is distinct from old.categoria_id
     and public.normalizar_comercio(new.comercio) <> '' then
    insert into public.reglas_categoria (user_id, patron, categoria_id)
    values (new.user_id, public.normalizar_comercio(new.comercio), new.categoria_id)
    on conflict (user_id, patron) do update set categoria_id = excluded.categoria_id;
  end if;
  return new;
end $$;

create trigger movimientos_aprender_categoria
  after update of categoria_id on public.movimientos
  for each row execute function public.aprender_categoria();

-- ---------------------------------------------------------------------
-- Seguridad por usuario (RLS)
-- ---------------------------------------------------------------------

alter table public.cuentas enable row level security;
alter table public.apartados enable row level security;
alter table public.fuentes_ingreso enable row level security;
alter table public.reglas_reparto enable row level security;
alter table public.categorias enable row level security;
alter table public.reglas_categoria enable row level security;
alter table public.dispositivos enable row level security;
alter table public.movimientos enable row level security;
alter table public.notificaciones_crudas enable row level security;
alter table public.por_mover enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'cuentas', 'apartados', 'fuentes_ingreso', 'reglas_reparto', 'categorias',
    'reglas_categoria', 'movimientos', 'por_mover'
  ] loop
    execute format(
      'create policy "dueño puede todo" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Dispositivos: se crean solo con registrar_dispositivo(); puedes verlos, renombrarlos o revocarlos.
create policy "dueño ve sus dispositivos" on public.dispositivos
  for select to authenticated using (user_id = (select auth.uid()));
create policy "dueño edita sus dispositivos" on public.dispositivos
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "dueño borra sus dispositivos" on public.dispositivos
  for delete to authenticated using (user_id = (select auth.uid()));

-- Notificaciones crudas: las inserta la función de ingesta (service role).
create policy "dueño ve sus notificaciones" on public.notificaciones_crudas
  for select to authenticated using (user_id = (select auth.uid()));
create policy "dueño actualiza sus notificaciones" on public.notificaciones_crudas
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "dueño borra sus notificaciones" on public.notificaciones_crudas
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Funciones que llaman las apps
-- ---------------------------------------------------------------------

-- Crea una llave para un teléfono. La llave solo se devuelve esta vez;
-- en la base se guarda únicamente su hash.
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
  values (v_uid, coalesce(nullif(btrim(p_nombre), ''), 'Teléfono'), encode(extensions.digest(v_llave, 'sha256'), 'hex'));
  return v_llave;
end $$;

revoke all on function public.registrar_dispositivo(text) from public, anon;
grant execute on function public.registrar_dispositivo(text) to authenticated;

-- Marca (o desmarca) un "por mover" como hecho. Al marcarlo crea el
-- movimiento interno correspondiente para que la meta sume la aportación.
create or replace function public.marcar_por_mover(p_id uuid, p_hecho boolean)
returns void
language plpgsql
set search_path = ''
as $$
declare
  r public.por_mover;
  v_mov uuid;
  v_nombre text;
begin
  select * into r from public.por_mover where id = p_id;
  if not found then
    raise exception 'No se encontró el movimiento por hacer';
  end if;

  if p_hecho and r.hecho_en is null then
    select nombre into v_nombre from public.apartados where id = r.apartado_id;
    insert into public.movimientos (user_id, fecha, monto_centavos, tipo, comercio, apartado_id, origen, estado)
    values (r.user_id, now(), r.monto_centavos, 'interno', 'Apartado ' || coalesce(v_nombre, ''), r.apartado_id, 'manual', 'confirmado')
    returning id into v_mov;
    update public.por_mover set hecho_en = now(), movimiento_id = v_mov where id = p_id;
  elsif not p_hecho and r.hecho_en is not null then
    update public.por_mover set hecho_en = null, movimiento_id = null where id = p_id;
    if r.movimiento_id is not null then
      delete from public.movimientos where id = r.movimiento_id and origen = 'manual' and avisos = '{}';
    end if;
  end if;
end $$;

revoke all on function public.marcar_por_mover(uuid, boolean) from public, anon;
grant execute on function public.marcar_por_mover(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Datos iniciales al registrarse
-- ---------------------------------------------------------------------

create or replace function public.crear_datos_iniciales()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categorias (user_id, nombre, color, orden) values
    (new.id, 'Comida',          '#9A8DF2', 1),
    (new.id, 'Súper',           '#E2E3E7', 2),
    (new.id, 'Transporte',      '#A7AAB2', 3),
    (new.id, 'Suscripciones',   '#6F737D', 4),
    (new.id, 'Entretenimiento', '#5E58A0', 5),
    (new.id, 'Salud',           '#C9C1FF', 6),
    (new.id, 'Servicios',       '#8B8F98', 7),
    (new.id, 'Compras',         '#B3A8FF', 8),
    (new.id, 'Hogar',           '#4B4E57', 9),
    (new.id, 'Transferencias',  '#7A6CE0', 10),
    (new.id, 'Otros',           '#34363D', 11);

  insert into public.apartados (user_id, nombre, tipo, descripcion, color, orden)
  values (new.id, 'Gastos personales', 'gastos', 'Tu dinero para gastar en el mes', '#E2E3E7', 0);

  return new;
end $$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_datos_iniciales();

-- ---------------------------------------------------------------------
-- Tiempo real (la web y la app se actualizan solas)
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table public.movimientos;
alter publication supabase_realtime add table public.por_mover;
alter publication supabase_realtime add table public.notificaciones_crudas;
