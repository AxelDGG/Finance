-- Ingresos quincenales: el monto esperado sigue siendo el total del mes; con
-- "quincenal" cada depósito se compara contra la mitad.
alter table public.fuentes_ingreso
  add column frecuencia text not null default 'mensual'
  check (frecuencia in ('mensual', 'quincenal'));

comment on column public.fuentes_ingreso.frecuencia is 'mensual: un depósito al mes; quincenal: dos depósitos de la mitad del monto';
