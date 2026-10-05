# Finanzas — Plan del proyecto

App personal para ver en qué se va tu dinero, repartir cada ingreso en apartados y seguir tus metas.
Los datos se capturan solos a partir de las notificaciones de BBVA, Santander y Google Wallet en tu teléfono Android.

Diseño aprobado (prototipo interactivo): https://claude.ai/artifact/K3nhEWbRQ1YXa4nfgKr5Rs

---

## 1. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Plataformas | App Android (principal) + web + escritorio Windows |
| App Android | React Native con Expo (TypeScript) |
| Web y escritorio | React + Vite. El escritorio es la misma web instalada como app (PWA); más adelante, si se quiere instalador, se envuelve con Tauri |
| Backend | Supabase: base de datos Postgres, inicio de sesión, seguridad por usuario (RLS) y Edge Functions |
| Captura de datos | Notificaciones de BBVA, Santander y Google Wallet leídas en el teléfono. Sin correo (no llegan) y sin Belvo (es para empresas y caro) |
| Tarjetas | Solo débito |
| Apartados | Reales: el dinero se mueve de verdad a otra cuenta o apartado. La app avisa qué mover y lleva el registro |
| Fondo principal | "Gastos personales" (en la cuenta que elijas; también puede haber gastos desde otra). Todo gasto detectado se descuenta de aquí |
| Ingresos | Uno o más ingresos al mes, cada uno a su cuenta. Se configuran en la app y se guardan en tu cuenta (Supabase), no en el código |
| Reglas de reparto | Se configuran dentro de la app, por fuente de ingreso. Gastos personales recibe "lo que sobra" |

**Cambio respecto a lo que propuse al inicio:** la web pasa de Next.js a React + Vite. La app solo la usas tú y va detrás de un inicio de sesión, así que no aprovechamos lo que Next.js ofrece de más (páginas generadas en el servidor, SEO). Además, una app de una sola página con Vite se convierte en PWA o se mete en Tauri sin adaptaciones.

---

## 2. Arquitectura

```
  TELÉFONO ANDROID                         SUPABASE                         WEB / ESCRITORIO
┌─────────────────────────┐          ┌──────────────────────────────┐    ┌───────────────────┐
│ Apps BBVA · Santander · │          │ Edge Function "ingesta"       │    │ React + Vite      │
│ Google Wallet           │          │  · interpreta el texto        │    │  · navegador      │
│        │ notificación   │  texto   │  · junta duplicados           │    │  · PWA (Windows)  │
│        ▼                │  crudo   │  · detecta internos/ingresos  │    │  · Tauri (después)│
│ Lector nativo (Kotlin)  │ ───────▶ │  · crea movimientos           │    └─────────▲─────────┘
│  · cola local + reintento│          │              │               │              │
│                         │          │              ▼               │   tiempo     │
│ App Expo (pantallas)    │ ◀──────▶ │ Postgres + RLS + Auth         │ ◀────────────┘
└─────────────────────────┘  datos   └──────────────────────────────┘    real
```

**Por qué la interpretación va en el servidor y no en el teléfono:**
- El lector de Android funciona aunque la app esté cerrada, pero en ese momento no hay JavaScript corriendo. Lo más simple y confiable es que el lector solo guarde y reenvíe el texto crudo.
- Las reglas para leer cada notificación están escritas una sola vez, en TypeScript, con pruebas. Si un banco cambia su mensaje, se corrige ahí y se vuelven a procesar las notificaciones guardadas.
- La web y el escritorio ven el movimiento al instante.

**Lo que nunca se guarda:** contraseñas ni accesos al banco. Solo el texto de las notificaciones que el banco ya te muestra.

---

## 3. Estructura del repositorio

```
finanzas/
├─ apps/
│  ├─ mobile/                 Expo (Android)
│  │  └─ modules/notification-listener/   módulo nativo en Kotlin
│  └─ web/                    React + Vite (web, PWA y luego Tauri)
├─ packages/
│  └─ core/                   lógica compartida y con pruebas:
│                             tipos, parsers, duplicados, reparto, metas, formatos de dinero
├─ supabase/
│  ├─ migrations/             esquema SQL versionado
│  └─ functions/ingesta/      Edge Function (usa packages/core)
└─ PLAN.md
```

Herramientas: pnpm workspaces, TypeScript estricto y Vitest para las pruebas de `core`.

---

## 4. Modelo de datos (primera versión)

El dinero se guarda en **centavos enteros**, nunca como decimales, para evitar errores de redondeo. La zona horaria es `America/Mexico_City`.

| Tabla | Para qué sirve | Campos clave |
|---|---|---|
| `cuentas` | Tus cuentas reales | banco, alias, últimos 4 dígitos, es_principal |
| `fuentes_ingreso` | Tus ingresos esperados | nombre, monto_esperado, cuenta_id |
| `apartados` | Gastos personales y tus metas (p. ej. Viaje, Ahorro) | nombre, tipo (gastos / meta), meta_monto, saldo_inicial, cuenta_destino, color |
| `reglas_reparto` | Qué % de cada ingreso va a cada apartado | fuente_id, apartado_id, porcentaje |
| `categorias` | Comida, Súper, Transporte… | nombre, color |
| `reglas_categoria` | "OXXO siempre es Súper" (aprende de tus correcciones) | patrón de comercio, categoria_id |
| `notificaciones_crudas` | Todo lo que llega del teléfono, tal cual | app, título, texto, recibida_en, estado, movimiento_id |
| `movimientos` | Gastos, ingresos y movimientos internos | fecha, monto, tipo, comercio, cuenta, categoría, apartado, origen (notificación / manual), estado (confirmado / por revisar) |
| `por_mover` | La lista de "te toca apartar $X" de cada mes | periodo, apartado_id, monto, hecho_en |

**Cómo se calculan los saldos:**
- **Gastos personales** = lo que le toca según las reglas − los gastos del mes.
- **Saldo de una meta** = saldo inicial + aportaciones (movimientos internos hacia ese apartado).
- **Fecha estimada para llegar a la meta** = lo que falta ÷ lo que aportas al mes (sale de las reglas).

---

## 5. Cómo se procesa una notificación

1. **Captura:** el lector (Kotlin) solo escucha las apps de BBVA, Santander y Google Wallet. Guarda la notificación en una cola local y la envía cuando hay internet.
2. **Interpretación:** la Edge Function saca de cada notificación:
   - el monto,
   - el comercio,
   - la cuenta o tarjeta,
   - el tipo: compra, transferencia enviada o transferencia recibida.
3. **Duplicados:**
   - Un pago con Wallet manda dos avisos (Wallet + banco) con el mismo monto y separados por unos minutos. Se juntan en un solo movimiento: el comercio se toma de Wallet y la cuenta, del banco.
   - Un aviso repetido idéntico (Android a veces lo reenvía) se ignora.
4. **Clasificación:**
   - **Interno:** una transferencia hacia una de tus cuentas (BBVA ↔ Santander o a un apartado). No cuenta como gasto.
   - **Ingreso:** dinero recibido con un monto parecido al de una de tus fuentes. Se reparte con tus reglas y genera la lista "Por mover".
   - **Gasto:** se descuenta de Gastos personales y se categoriza por comercio.
5. **Lo que no se entiende:** va a una bandeja "Por revisar" en la app. Lo corriges con dos toques y queda como ejemplo para mejorar las reglas.

---

## 6. Fases

### Fase 0 — Cimientos (chica)
- Crear el repositorio git y subirlo a un repo privado en GitHub.
- Crear el monorepo vacío con las carpetas de arriba.
- Crear el proyecto en Supabase y el inicio de sesión (solo tu cuenta).

**Lista cuando:** el repo está en GitHub, compila vacío y Supabase está creado.

### Fase 1 — Capturador (mediana) · *lo más riesgoso va primero*
- Hacer la app de Expo como *development build*. El lector nativo no corre en Expo Go.
- Escribir el módulo de Kotlin con `NotificationListenerService`, con su cola local y reintentos.
- Hacer una pantalla para dar el permiso de "Acceso a notificaciones" y desactivar el ahorro de batería para la app.
- Enviar los textos a la tabla `notificaciones_crudas`.
- Hacer una pantalla de bitácora para ver lo que se ha capturado.
- **Usarla en tu teléfono 1–2 semanas.** Así juntamos ejemplos reales de cada tipo de notificación sin que tengas que tomar capturas.

**Lista cuando:** cada pago, transferencia e ingreso aparece en la tabla cruda, aunque la app esté cerrada y después de reiniciar el teléfono.

### Fase 2 — Núcleo: datos y lógica (mediana)
- Escribir el esquema SQL completo con seguridad por usuario (RLS).
- Escribir en `packages/core`:
  - las reglas para leer cada tipo de notificación, usando los ejemplos reales de la Fase 1 como pruebas;
  - la detección de duplicados, internos e ingresos;
  - el cálculo del reparto y de las metas.
- Hacer la Edge Function `ingesta` y reprocesar con ella todo lo capturado en la Fase 1.

**Lista cuando:** todas las notificaciones reales se convierten en movimientos correctos (las pruebas pasan) y lo que no se entiende cae en "Por revisar".

### Fase 3 — App Android usable (grande)
- **Pantallas del diseño:**
  - Inicio,
  - Movimientos (con detalle y cambio de categoría),
  - Apartados y metas.
- **Funciones:**
  - registrar gastos a mano (botón +),
  - la bandeja "Por revisar",
  - la lista "Por mover" con su confirmación.
- **Configuración:** cuentas, fuentes de ingreso, reglas de reparto, metas y categorías.
- **Animaciones:** Reanimated y gráficas con react-native-svg.

**Lista cuando:** puedes pasar un mes completo usando solo la app.

### Fase 4 — Web y escritorio (grande)
- Hacer React + Vite con el sidebar y las vistas del diseño:
  - Resumen,
  - Movimientos (con filtro por cuenta),
  - Apartados (con reglas que se editan con controles deslizables).
- Gráficas interactivas y animaciones con Motion (Framer Motion).
- Actualización en tiempo real con Supabase Realtime.
- Hacerla PWA para instalarla en Windows desde Edge o Chrome.
- Publicarla en Vercel.

**Lista cuando:** la instalas en Windows y ves los mismos datos que en el teléfono, al momento.

### Fase 5 — Pulido y extras (abierta)
- Recordatorios: "Llegó tu ingreso, te toca apartar $2,000".
- Cierre de mes: decidir qué hacer con lo que sobró (¿pasarlo a Ahorro?).
- Conciliación con el estado de cuenta, para encontrar lo que no llegó por notificación.
- Exportar a CSV y respaldos.
- Instalador de Windows con Tauri, si lo quieres.

---

## 7. Riesgos y cómo los cubrimos

| Riesgo | Plan |
|---|---|
| El banco cambia el texto de sus notificaciones | Se guarda el texto crudo, se corrige la regla y se reprocesa. Mientras tanto, lo nuevo cae en "Por revisar" |
| Android "mata" el lector para ahorrar batería (común en Xiaomi, Samsung, Huawei) | Pantalla que guía a desactivar el ahorro de batería y aviso si pasan días sin capturar nada |
| Notificaciones perdidas (teléfono apagado, notificaciones del banco desactivadas) | Captura manual desde el día uno y conciliación con el estado de cuenta en la Fase 5 |
| Datos sensibles | RLS en Supabase, una llave por dispositivo para la ingesta y nunca guardar accesos al banco |
| Publicar en Play Store | No hace falta: el APK se instala directo en tu teléfono |

---

## 8. Pendientes por definir

- [x] Teléfono: Samsung con Android 15 (ver "Avisos protegidos" en el README).
- [ ] Montos reales de tus metas: se capturan en la app al configurarla.
- [ ] Nombres reales de tus fuentes de ingreso y en qué días llegan.
- [ ] Tu lista de categorías (por ahora: Comida, Súper, Transporte, Suscripciones, Entretenimiento, Otros).
- [ ] Nombres de los paquetes Android de las apps de BBVA, Santander y Wallet (se confirman en tu teléfono durante la Fase 1).

---

## 9. Estado (4 de octubre de 2026)

| Fase | Estado | Notas |
|---|---|---|
| 0 · Cimientos | ✅ | Monorepo pnpm, Supabase con RLS, código en github.com/AxelDGG/Finance. |
| 1 · Capturador | ✅ | Módulo Kotlin con cola SQLite y WorkManager. Probado en emulador; la prueba con tus avisos reales empieza al instalar el APK. |
| 2 · Núcleo | ✅ | `packages/core` con 66 pruebas; función `ingesta` v2 publicada; prueba de integración de 25 puntos en verde. |
| 3 · App Android | ✅ | Todas las pantallas del diseño, captura manual, Por revisar, Por mover, cierre de mes. APK release firmado con `pnpm apk`. |
| 4 · Web y escritorio | ✅ | React + Vite con el diseño aprobado, PWA, tiempo real, modo demostración, cabeceras de seguridad (CSP) listas para Vercel. |
| 5 · Pulido | ✅ | Recordatorios (avisos al llegar un ingreso), cierre de mes, exportar CSV, conciliación con estado de cuenta e instalador de Windows (Tauri). |

