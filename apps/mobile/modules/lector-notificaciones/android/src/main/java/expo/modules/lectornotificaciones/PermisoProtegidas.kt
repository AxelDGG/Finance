package expo.modules.lectornotificaciones

import android.app.AppOpsManager
import android.content.Context
import android.os.Build
import android.os.Process

/**
 * Android 15+ oculta a las apps lectoras el texto de las notificaciones que
 * su clasificador cree que traen un código (y a veces confunde los avisos de
 * compra que mencionan la terminación de la tarjeta).
 *
 * Se permite una sola vez desde la computadora:
 *   adb shell appops set mx.finanzas.app RECEIVE_SENSITIVE_NOTIFICATIONS allow
 */
object PermisoProtegidas {
  private const val OP = "android:receive_sensitive_notifications"
  private val OCULTA = Regex("(?i)(sensitive notification content hidden|contenido.{0,30}(sensible|confidencial).{0,20}ocult|contenido oculto)")

  fun pareceOculta(texto: String?): Boolean = texto != null && OCULTA.containsMatchIn(texto)

  /** true si este Android no oculta nada o si ya se dio el permiso. */
  fun permitido(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < 35) return true
    return try {
      val ops = context.getSystemService(AppOpsManager::class.java)
      ops.unsafeCheckOpNoThrow(OP, Process.myUid(), context.packageName) == AppOpsManager.MODE_ALLOWED
    } catch (_: Exception) {
      false
    }
  }
}
