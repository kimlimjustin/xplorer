#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]
mod files_api;
//mod drives;


fn main() {
  tauri::Builder::default()
  .invoke_handler(tauri::generate_handler![files_api::read_directory])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
