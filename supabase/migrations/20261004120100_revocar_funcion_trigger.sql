-- crear_datos_iniciales() solo debe correr como trigger, nunca por la API.
revoke all on function public.crear_datos_iniciales() from public, anon, authenticated;
