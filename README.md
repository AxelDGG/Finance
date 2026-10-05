# Finanzas

Control personal de gastos para BBVA, Santander y Google Wallet. El teléfono lee los avisos de tus bancos y registra cada pago solo. Tus apartados (por ejemplo Viaje o Ahorro) se reparten con tus reglas, y tus metas se llenan mes a mes.

- **App Android** (`apps/mobile`): Expo + módulo nativo que lee las notificaciones.
- **Web y escritorio** (`apps/web`): React + Vite. Se instala como PWA o como programa de Windows (Tauri).
- **Servidor** (`supabase/`): Postgres con RLS y la función `ingesta`, que interpreta cada aviso.
- **Lógica compartida** (`packages/core`, `packages/api`): lectura de avisos, duplicados, reparto, metas, resúmenes y CSV.

El plan completo y el estado de cada fase están en [PLAN.md](PLAN.md).

---

## Instalar en tu teléfono Android

1. **Instala el APK.** Está en `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`. Cópialo al teléfono y ábrelo; Android te pedirá permitir "instalar apps desconocidas" para el explorador de archivos. Con cable USB y depuración activada también puedes usar:

   ```bash
   adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
   ```

2. **Entra** con tu correo y completa la configuración (cuentas, ingresos, metas y reparto).
3. **Activa la captura**: la app te lleva a "Acceso a notificaciones" para encender Finanzas.
4. **Batería (Samsung):** Ajustes → Batería → Límites de uso en segundo plano → *Apps que nunca se suspenden* → agrega Finanzas. Si no lo haces, One UI puede detener el lector.
5. **Avisos protegidos (Android 15):** Android oculta el texto de los avisos bancarios a las apps lectoras ("Sensitive notification content hidden"). Para que Finanzas pueda leer el monto, conecta el teléfono por USB una vez y corre:

   ```bash
   adb shell appops set mx.finanzas.app RECEIVE_SENSITIVE_NOTIFICATIONS allow
   ```

   Después cierra y vuelve a abrir la app. En *Ajustes → Captura automática* verás si quedó activo. Si un aviso llegó oculto, cae en "Por revisar" para que lo registres a mano.

> **Respaldo importante:** la llave con la que se firma el APK está en `apps/mobile/credenciales/` (no se sube a git). Guarda una copia segura: sin ella no podrás instalar actualizaciones encima de la app ya instalada (tendrías que desinstalarla primero).

## Web y escritorio

| Qué | Cómo |
|---|---|
| Usarla en el navegador (desarrollo) | `pnpm web` → http://localhost:5173 |
| Probarla sin cuenta | botón "Ver demostración" en la pantalla de acceso (datos de ejemplo, no toca tu cuenta) |
| Instalarla como app (PWA) | desde Chrome o Edge, ícono "Instalar" en la barra de direcciones (requiere publicarla, por ejemplo en Vercel) |
| Programa de Windows | `apps/web/src-tauri/target/release/bundle/nsis/Finanzas_1.0.0_x64-setup.exe` |

Atajos en la web y en el escritorio: **Ctrl N** registra un gasto y **Ctrl K** busca movimientos (escritorio).

En **Movimientos** puedes *Exportar CSV* (abre en Excel) e *Importar estado*: subes el CSV que descargas de la banca en línea y la app te muestra los pagos que no llegaron por notificación para agregarlos.

## Desarrollo

Requisitos: Node 22, pnpm 10, Android Studio (SDK 35) y Rust (solo para el instalador de Windows).

```bash
pnpm install
```

```bash
pnpm test
```

```bash
pnpm typecheck
```

| Tarea | Comando |
|---|---|
| App Android en el emulador o teléfono | `pnpm mobile` (requiere el *development build* instalado) |
| APK release firmado (arm64) | `pnpm apk` (necesita la unidad `W:` y el JDK de Android Studio; ver notas) |
| Web | `pnpm web` / `pnpm web:build` |
| Instalador de Windows | en `apps/web`: `npx tauri build` |
| Empaquetar la función `ingesta` | `pnpm build:functions` → `supabase/functions/ingesta/dist/index.js` (se publica con verify_jwt desactivado: la función valida la llave del dispositivo o tu sesión) |
| Prueba de punta a punta contra Supabase | `FINANZAS_PRUEBA_PASSWORD=... node scripts/prueba-integracion.mjs` (usuario `prueba@finanzas.test`; la contraseña vive en `.env.prueba`, fuera de git) |
| Regenerar íconos | `python scripts/generar-iconos.py` y luego, en `apps/web`, `npx tauri icon src-tauri/icono-fuente.png` |

**Notas de Windows para compilar Android:**

- Las rutas de compilación nativa pasan de 260 caracteres. Compila desde una unidad corta:

  ```bash
  subst W: "C:\ruta\a\Finanzas"
  ```

- Usa el JDK 21 de Android Studio: con el Java 24 que está en el PATH falla la configuración de CMake. Antes de `gradlew`, en Git Bash:

  ```bash
  export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
  ```

## Cómo se procesa un aviso

1. El lector (Kotlin) guarda cada aviso de BBVA, Santander o Wallet en una cola local y lo envía con WorkManager, con reintentos si no hay internet.
2. La función `ingesta` lo guarda crudo, lo interpreta (`packages/core/src/parsers`) y lo clasifica (gasto, ingreso, movimiento entre tus cuentas).
3. Si ya existe el mismo pago (Wallet + banco, aviso repetido, o algo que capturaste a mano), lo junta en vez de duplicarlo.
4. Si es un ingreso, lo reparte con tus reglas y crea los "por mover" (lo que debes pasar a cada apartado), y el teléfono te avisa.
5. Lo que no entiende queda en **Por revisar**; cuando mejora una regla, *Volver a intentar con todas* lo reprocesa.
