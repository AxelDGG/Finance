package expo.modules.lectornotificaciones

import android.app.Notification
import android.content.ComponentName
import android.content.pm.ApplicationInfo
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

/**
 * Escucha las notificaciones del teléfono y guarda solo las de los bancos
 * y Google Wallet. Android lo mantiene corriendo aunque la app esté cerrada.
 */
class ServicioLector : NotificationListenerService() {

  companion object {
    private const val TAG = "FinanzasLector"

    /** Apps que nos interesan (nombre del paquete Android). */
    val PAQUETES = setOf(
      "com.bancomer.mbanking", // BBVA México
      "mx.bancosantander.supermovil", // Santander México
      "com.google.android.apps.walletnfcrel", // Google Wallet
    )

    /** Solo en builds de desarrollo: `adb shell cmd notification post` publica como com.android.shell. */
    private const val PAQUETE_PRUEBAS = "com.android.shell"
  }

  private val esDepurable: Boolean
    get() = (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

  /** Registros detallados solo en builds de desarrollo (nunca el contenido de la notificación). */
  private inline fun depurar(mensaje: () -> String) {
    if (esDepurable) Log.d(TAG, mensaje())
  }

  override fun onListenerConnected() {
    super.onListenerConnected()
    Log.i(TAG, "Lector conectado")
    // Al reconectarse (reinicio, actualización) enviamos lo que quedó pendiente.
    TrabajoEnvio.programar(this)
  }

  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    Log.w(TAG, "Lector desconectado; pidiendo reconexión")
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      requestRebind(ComponentName(this, ServicioLector::class.java))
    }
  }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    sbn ?: return
    val paquete = sbn.packageName ?: return
    val esPrueba = paquete == PAQUETE_PRUEBAS && esDepurable
    if (paquete !in PAQUETES && !esPrueba) return
    depurar { "Recibida de $paquete key=${sbn.key}" }

    val n = sbn.notification ?: return
    // Los resúmenes de grupo repiten el contenido de otras notificaciones.
    if ((n.flags and Notification.FLAG_GROUP_SUMMARY) != 0) return depurar { "Descartada: resumen de grupo" }

    val extras = n.extras
    val titulo = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim()
    val texto = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim()
    val textoGrande = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()?.trim()
      ?: extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.joinToString("\n") { it.toString() }?.trim()
    if (titulo.isNullOrBlank() && texto.isNullOrBlank() && textoGrande.isNullOrBlank()) return depurar { "Descartada: sin texto" }
    if (esPrueba && titulo?.trimStart()?.startsWith("[") != true) return depurar { "Descartada: prueba sin prefijo (titulo=$titulo, texto=$texto)" }

    val publicadaEn = if (sbn.postTime > 0) sbn.postTime else System.currentTimeMillis()
    val nueva = Almacen.de(this).guardar(paquete, titulo, texto, textoGrande?.takeIf { it != texto }, publicadaEn, sbn.key)
    if (!nueva) return depurar { "Descartada: repetida" }

    // Android 15+ oculta el contenido si cree que trae un código. Se guarda igual
    // (queda "por revisar" con su hora) y contamos cuántas van para avisarte.
    if (PermisoProtegidas.pareceOculta(texto)) Ajustes(this).sumarOculta(publicadaEn)

    Log.i(TAG, "Capturada notificación de $paquete")
    Bus.emitir("onCaptura", mapOf("app" to paquete, "titulo" to (titulo ?: ""), "publicadaEn" to publicadaEn.toDouble()))
    TrabajoEnvio.programar(this)
  }
}
