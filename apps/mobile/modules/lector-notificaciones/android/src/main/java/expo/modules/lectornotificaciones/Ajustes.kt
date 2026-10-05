package expo.modules.lectornotificaciones

import android.content.Context

/** Configuración del lector guardada en el teléfono (privada a la app). */
class Ajustes(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences("finanzas_lector", Context.MODE_PRIVATE)

  var urlSupabase: String?
    get() = prefs.getString("url", null)
    set(v) = prefs.edit().putString("url", v).apply()

  var llave: String?
    get() = prefs.getString("llave", null)
    set(v) = prefs.edit().putString("llave", v).apply()

  var ultimoEnvio: Long
    get() = prefs.getLong("ultimo_envio", 0L)
    set(v) = prefs.edit().putLong("ultimo_envio", v).apply()

  var ultimoError: String?
    get() = prefs.getString("ultimo_error", null)
    set(v) = prefs.edit().putString("ultimo_error", v).apply()

  /** Avisos de banco que Android ocultó (texto protegido). */
  val ocultas: Int
    get() = prefs.getInt("ocultas", 0)

  val ultimaOculta: Long
    get() = prefs.getLong("ultima_oculta", 0L)

  fun sumarOculta(cuando: Long) {
    prefs.edit().putInt("ocultas", ocultas + 1).putLong("ultima_oculta", cuando).apply()
  }

  val configurado: Boolean
    get() = !urlSupabase.isNullOrBlank() && !llave.isNullOrBlank()

  fun borrar() {
    prefs.edit().clear().apply()
  }
}
