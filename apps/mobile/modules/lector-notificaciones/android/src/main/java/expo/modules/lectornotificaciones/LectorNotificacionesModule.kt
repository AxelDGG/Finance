package expo.modules.lectornotificaciones

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Puente entre la app (JavaScript) y el lector nativo de notificaciones. */
class LectorNotificacionesModule : Module() {

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("La app no está lista")

  override fun definition() = ModuleDefinition {
    Name("LectorNotificaciones")

    Events("onCaptura", "onEnvio")

    OnCreate {
      Bus.escucha = { evento, datos -> sendEvent(evento, datos) }
    }

    OnDestroy {
      Bus.escucha = null
    }

    /** ¿Tiene la app el permiso de "Acceso a notificaciones"? */
    Function("tienePermiso") {
      NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    }

    /** Abre la pantalla de Android para dar el permiso. */
    Function("abrirPermiso") {
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS).putExtra(
          Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
          ComponentName(context, ServicioLector::class.java).flattenToString(),
        )
      } else {
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
      }
      abrir(intent) || abrir(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
    }

    /** ¿Android deja correr la app en segundo plano sin restricciones de batería? */
    Function("sinRestriccionBateria") {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    Function("pedirSinRestriccionBateria") {
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}"))
      abrir(intent) || abrir(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }

    /** Ajustes de la app (en Samsung: Batería → "Sin restricciones"). */
    Function("abrirAjustesApp") {
      abrir(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")))
    }

    Function("puedeAvisar") {
      Avisos.puedePublicar(context)
    }

    Function("pedirPermisoAvisos") {
      val actividad = appContext.currentActivity
      if (Build.VERSION.SDK_INT >= 33 && actividad != null) {
        ActivityCompat.requestPermissions(actividad, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7301)
        true
      } else {
        Avisos.puedePublicar(context)
      }
    }

    /** Guarda a dónde mandar las capturas y con qué llave, y envía lo pendiente. */
    Function("configurar") { url: String, llave: String ->
      val ajustes = Ajustes(context)
      ajustes.urlSupabase = url
      ajustes.llave = llave
      ajustes.ultimoError = null
      TrabajoEnvio.programar(context)
    }

    /** La llave guardada, para revocarla en el servidor antes de cerrar sesión. */
    Function("llave") {
      Ajustes(context).llave
    }

    Function("olvidar") {
      Ajustes(context).borrar()
      Almacen.de(context).borrarTodo()
    }

    Function("enviarAhora") {
      TrabajoEnvio.programar(context)
    }

    Function("estado") {
      val ajustes = Ajustes(context)
      val almacen = Almacen.de(context)
      mapOf(
        "permiso" to NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName),
        "sinRestriccionBateria" to (context.getSystemService(Context.POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(context.packageName),
        "puedeAvisar" to Avisos.puedePublicar(context),
        "configurado" to ajustes.configurado,
        "pendientes" to (almacen.contar("pendiente") + almacen.contar("error")),
        "enviadas" to almacen.contar("enviada"),
        "ultimaCaptura" to almacen.ultimaCaptura()?.toDouble(),
        "ultimoEnvio" to ajustes.ultimoEnvio.takeIf { it > 0 }?.toDouble(),
        "ultimoError" to ajustes.ultimoError,
        "puedeLeerProtegidas" to PermisoProtegidas.permitido(context),
        "ocultas" to ajustes.ocultas,
        "ultimaOculta" to ajustes.ultimaOculta.takeIf { it > 0 }?.toDouble(),
        "paquete" to context.packageName,
        "fabricante" to Build.MANUFACTURER,
        "modelo" to Build.MODEL,
        "android" to Build.VERSION.SDK_INT,
      )
    }

    Function("recientes") { limite: Int ->
      Almacen.de(context).recientes(limite.coerceIn(1, 200)).map { c ->
        mapOf(
          "id" to c.id.toDouble(),
          "app" to c.app,
          "titulo" to c.titulo,
          "texto" to (c.textoGrande ?: c.texto),
          "publicadaEn" to c.publicadaEn.toDouble(),
          "estado" to c.estado,
          "resultado" to c.resultado,
        )
      }
    }

    /** Publica un aviso local (para probar que los avisos funcionan). */
    Function("avisoDePrueba") { titulo: String, texto: String ->
      Avisos.publicar(context, titulo, texto)
    }
  }

  private fun abrir(intent: Intent): Boolean = try {
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
    true
  } catch (_: Exception) {
    false
  }
}
