package expo.modules.lectornotificaciones

/**
 * Puente sencillo entre el servicio/trabajo en segundo plano y el módulo de
 * JavaScript: si la app está abierta, la pantalla se entera al instante.
 */
object Bus {
  @Volatile var escucha: ((String, Map<String, Any?>) -> Unit)? = null

  fun emitir(evento: String, datos: Map<String, Any?>) {
    try {
      escucha?.invoke(evento, datos)
    } catch (_: Throwable) {
      // La app pudo cerrarse mientras tanto; no pasa nada.
    }
  }
}
