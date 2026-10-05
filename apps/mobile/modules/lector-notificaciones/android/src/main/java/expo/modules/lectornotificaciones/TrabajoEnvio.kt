package expo.modules.lectornotificaciones

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/** Manda la cola local a la función "ingesta" de Supabase, con reintentos. */
class TrabajoEnvio(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

  companion object {
    private const val TAG = "FinanzasEnvio"
    private const val NOMBRE = "finanzas_envio"
    private const val POR_LOTE = 50
    private const val LOTES_MAX = 6

    fun programar(context: Context) {
      val pedido = OneTimeWorkRequestBuilder<TrabajoEnvio>()
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
        .build()
      WorkManager.getInstance(context).enqueueUniqueWork(NOMBRE, ExistingWorkPolicy.APPEND_OR_REPLACE, pedido)
    }
  }

  override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
    val ajustes = Ajustes(applicationContext)
    val url = ajustes.urlSupabase
    val llave = ajustes.llave
    if (url.isNullOrBlank() || llave.isNullOrBlank()) {
      // Aún no inicias sesión en la app: las capturas esperan en la cola.
      return@withContext Result.success()
    }
    val almacen = Almacen.de(applicationContext)
    var enviadas = 0
    try {
      repeat(LOTES_MAX) {
        val lote = almacen.pendientes(POR_LOTE)
        if (lote.isEmpty()) return@repeat
        val respuesta = enviar(url, llave, lote)
        when (respuesta.codigo) {
          200 -> {
            val resultados = respuesta.cuerpo?.optJSONArray("resultados") ?: JSONArray()
            lote.forEachIndexed { i, captura ->
              val estado = resultados.optJSONObject(i)?.optString("estado") ?: "procesada"
              almacen.marcar(captura.id, if (estado == "error") "error" else "enviada", estado)
            }
            enviadas += lote.size
            val avisos = respuesta.cuerpo?.optJSONArray("avisos") ?: JSONArray()
            for (j in 0 until avisos.length()) {
              val aviso = avisos.optJSONObject(j) ?: continue
              Avisos.publicar(applicationContext, aviso.optString("titulo"), aviso.optString("texto"))
            }
            ajustes.ultimoEnvio = System.currentTimeMillis()
            ajustes.ultimoError = null
          }
          401 -> {
            ajustes.ultimoError = "La llave de este teléfono ya no es válida. Vuelve a vincularlo en Ajustes."
            Bus.emitir("onEnvio", mapOf("ok" to false, "error" to ajustes.ultimoError))
            return@withContext Result.failure()
          }
          else -> {
            ajustes.ultimoError = "El servidor respondió ${respuesta.codigo}"
            Bus.emitir("onEnvio", mapOf("ok" to false, "error" to ajustes.ultimoError))
            return@withContext Result.retry()
          }
        }
      }
      almacen.purgar()
      Bus.emitir("onEnvio", mapOf("ok" to true, "enviadas" to enviadas))
      Result.success()
    } catch (e: Exception) {
      Log.w(TAG, "No se pudo enviar", e)
      ajustes.ultimoError = "Sin conexión con el servidor"
      Bus.emitir("onEnvio", mapOf("ok" to false, "error" to ajustes.ultimoError))
      Result.retry()
    }
  }

  private data class Respuesta(val codigo: Int, val cuerpo: JSONObject?)

  private fun enviar(url: String, llave: String, lote: List<Captura>): Respuesta {
    val notificaciones = JSONArray()
    lote.forEach { c ->
      notificaciones.put(
        JSONObject()
          .put("app", c.app)
          .put("titulo", c.titulo ?: JSONObject.NULL)
          .put("texto", c.texto ?: JSONObject.NULL)
          .put("texto_grande", c.textoGrande ?: JSONObject.NULL)
          .put("publicada_en", c.publicadaEn)
          .put("clave", c.clave ?: JSONObject.NULL),
      )
    }
    val cuerpo = JSONObject().put("notificaciones", notificaciones).toString().toByteArray(Charsets.UTF_8)
    val conexion = (URL("${url.trimEnd('/')}/functions/v1/ingesta").openConnection() as HttpURLConnection).apply {
      requestMethod = "POST"
      connectTimeout = 15_000
      readTimeout = 30_000
      doOutput = true
      setRequestProperty("Content-Type", "application/json; charset=utf-8")
      setRequestProperty("x-llave-dispositivo", llave)
    }
    try {
      conexion.outputStream.use { it.write(cuerpo) }
      val codigo = conexion.responseCode
      val flujo = if (codigo in 200..299) conexion.inputStream else conexion.errorStream
      val texto = flujo?.bufferedReader()?.use { it.readText() }
      return Respuesta(codigo, texto?.let { runCatching { JSONObject(it) }.getOrNull() })
    } finally {
      conexion.disconnect()
    }
  }
}
