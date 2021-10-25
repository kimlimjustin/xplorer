#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]
mod drives;
mod files_api;
mod storage;

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      files_api::read_directory,
      files_api::is_dir,
      files_api::get_file_meta_data,
      files_api::open_file,
      drives::get_drives,
      storage::write_data,
      storage::read_data
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
