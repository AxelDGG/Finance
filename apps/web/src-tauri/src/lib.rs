use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // Si ya está abierta, volver a abrirla solo trae la ventana al frente.
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      if let Some(ventana) = app.get_webview_window("main") {
        let _ = ventana.unminimize();
        let _ = ventana.set_focus();
      }
    }))
    .run(tauri::generate_context!())
    .expect("no se pudo iniciar Finanzas");
}
