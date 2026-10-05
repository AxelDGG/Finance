package expo.modules.lectornotificaciones

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.security.MessageDigest

/** Una notificación capturada en el teléfono, en espera de enviarse. */
data class Captura(
  val id: Long,
  val app: String,
  val titulo: String?,
  val texto: String?,
  val textoGrande: String?,
  val publicadaEn: Long,
  val clave: String?,
  val estado: String,
  val resultado: String?,
  val creadaEn: Long,
)

/**
 * Cola local (SQLite). Si no hay internet o el servidor falla, las
 * notificaciones esperan aquí y se reintentan después.
 */
class Almacen private constructor(context: Context) :
  SQLiteOpenHelper(context.applicationContext, "finanzas_lector.db", null, 1) {

  companion object {
    @Volatile private var instancia: Almacen? = null
    fun de(context: Context): Almacen =
      instancia ?: synchronized(this) { instancia ?: Almacen(context).also { instancia = it } }

    private const val CONSERVAR_ENVIADAS = 300

    fun huella(app: String, titulo: String?, texto: String?, textoGrande: String?, publicadaEn: Long): String {
      val base = listOf(app, titulo ?: "", texto ?: "", textoGrande ?: "", (publicadaEn / 60_000L).toString()).joinToString("|")
      return MessageDigest.getInstance("SHA-256").digest(base.toByteArray()).joinToString("") { "%02x".format(it) }
    }
  }

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL(
      """
      CREATE TABLE capturas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app TEXT NOT NULL,
        titulo TEXT,
        texto TEXT,
        texto_grande TEXT,
        publicada_en INTEGER NOT NULL,
        clave TEXT,
        huella TEXT NOT NULL UNIQUE,
        estado TEXT NOT NULL DEFAULT 'pendiente',
        resultado TEXT,
        creada_en INTEGER NOT NULL
      )
      """.trimIndent(),
    )
    db.execSQL("CREATE INDEX capturas_estado ON capturas(estado, publicada_en)")
  }

  override fun onUpgrade(db: SQLiteDatabase, anterior: Int, nueva: Int) = Unit

  /** Guarda la captura. Devuelve false si ya existía (Android a veces repite avisos). */
  fun guardar(app: String, titulo: String?, texto: String?, textoGrande: String?, publicadaEn: Long, clave: String?): Boolean {
    val valores = ContentValues().apply {
      put("app", app)
      put("titulo", titulo)
      put("texto", texto)
      put("texto_grande", textoGrande)
      put("publicada_en", publicadaEn)
      put("clave", clave)
      put("huella", huella(app, titulo, texto, textoGrande, publicadaEn))
      put("estado", "pendiente")
      put("creada_en", System.currentTimeMillis())
    }
    return writableDatabase.insertWithOnConflict("capturas", null, valores, SQLiteDatabase.CONFLICT_IGNORE) != -1L
  }

  fun pendientes(limite: Int): List<Captura> =
    consultar("estado IN ('pendiente','error')", "publicada_en ASC", limite)

  fun recientes(limite: Int): List<Captura> = consultar(null, "publicada_en DESC", limite)

  fun contar(estado: String): Int =
    readableDatabase.rawQuery("SELECT COUNT(*) FROM capturas WHERE estado = ?", arrayOf(estado)).use { c ->
      if (c.moveToFirst()) c.getInt(0) else 0
    }

  fun ultimaCaptura(): Long? =
    readableDatabase.rawQuery("SELECT MAX(creada_en) FROM capturas", null).use { c ->
      if (c.moveToFirst() && !c.isNull(0)) c.getLong(0) else null
    }

  fun marcar(id: Long, estado: String, resultado: String?) {
    val valores = ContentValues().apply {
      put("estado", estado)
      put("resultado", resultado)
    }
    writableDatabase.update("capturas", valores, "id = ?", arrayOf(id.toString()))
  }

  /** Borra las enviadas más viejas; el servidor ya tiene la copia. */
  fun purgar() {
    writableDatabase.execSQL(
      "DELETE FROM capturas WHERE estado = 'enviada' AND id NOT IN (SELECT id FROM capturas WHERE estado = 'enviada' ORDER BY id DESC LIMIT $CONSERVAR_ENVIADAS)",
    )
  }

  fun borrarTodo() {
    writableDatabase.delete("capturas", null, null)
  }

  private fun consultar(donde: String?, orden: String, limite: Int): List<Captura> =
    readableDatabase.query("capturas", null, donde, null, null, null, orden, limite.toString()).use { c ->
      val lista = mutableListOf<Captura>()
      while (c.moveToNext()) {
        lista += Captura(
          id = c.getLong(c.getColumnIndexOrThrow("id")),
          app = c.getString(c.getColumnIndexOrThrow("app")),
          titulo = c.getString(c.getColumnIndexOrThrow("titulo")),
          texto = c.getString(c.getColumnIndexOrThrow("texto")),
          textoGrande = c.getString(c.getColumnIndexOrThrow("texto_grande")),
          publicadaEn = c.getLong(c.getColumnIndexOrThrow("publicada_en")),
          clave = c.getString(c.getColumnIndexOrThrow("clave")),
          estado = c.getString(c.getColumnIndexOrThrow("estado")),
          resultado = c.getString(c.getColumnIndexOrThrow("resultado")),
          creadaEn = c.getLong(c.getColumnIndexOrThrow("creada_en")),
        )
      }
      lista
    }
}
