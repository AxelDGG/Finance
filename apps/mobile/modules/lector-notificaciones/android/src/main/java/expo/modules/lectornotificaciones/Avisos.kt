package expo.modules.lectornotificaciones

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/** Notificaciones propias de la app: "Llegó tu ingreso, te toca apartar…". */
object Avisos {
  private const val CANAL = "finanzas_avisos"

  fun puedePublicar(context: Context): Boolean =
    Build.VERSION.SDK_INT < 33 ||
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

  private fun asegurarCanal(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val canal = NotificationChannel(CANAL, "Avisos de Finanzas", NotificationManager.IMPORTANCE_DEFAULT).apply {
        description = "Ingresos recibidos y apartados por hacer"
      }
      context.getSystemService(NotificationManager::class.java).createNotificationChannel(canal)
    }
  }

  fun publicar(context: Context, titulo: String, texto: String) {
    if (!puedePublicar(context)) return
    asegurarCanal(context)
    val abrir = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    val notificacion = NotificationCompat.Builder(context, CANAL)
      .setSmallIcon(R.drawable.ic_finanzas_aviso)
      .setContentTitle(titulo)
      .setContentText(texto)
      .setStyle(NotificationCompat.BigTextStyle().bigText(texto))
      .setColor(0xFF9A8DF2.toInt())
      .setAutoCancel(true)
      .apply { if (abrir != null) setContentIntent(abrir) }
      .build()
    try {
      NotificationManagerCompat.from(context).notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notificacion)
    } catch (_: SecurityException) {
      // Sin permiso de notificaciones: el aviso igual aparece dentro de la app.
    }
  }
}
