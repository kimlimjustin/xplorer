#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]
mod drives;
mod files_api;
mod storage;
use std::env;
use std::path::Path;

extern crate path_absolutize;
use path_absolutize::*;

#[derive(serde::Serialize)]
struct ArgsStruct {
  args: Vec<String>,
  flags: Vec<String>,
}
#[tauri::command]
fn get_cli_args() -> Result<ArgsStruct, String> {
  let mut args = Vec::new();
  let mut flags = Vec::new();
  for arg in env::args().skip(1) {
    if arg.starts_with("-") {
      flags.push(arg)
    } else {
      let dir = Path::new(&arg);
      let absolute_path = dir.absolutize();
      if absolute_path.is_err() {
        println!("{:?}", absolute_path.err());
      } else {
        args.push(
          absolute_path
            .unwrap()
            .into_owned()
            .into_os_string()
            .into_string()
            .unwrap(),
        )
      }
    }
  }
  Ok(ArgsStruct { args, flags })
}
fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      files_api::read_directory,
      files_api::is_dir,
      files_api::get_file_meta_data,
      files_api::open_file,
      files_api::file_exist,
      files_api::create_file,
      files_api::create_dir_recursive,
      files_api::open_in_terminal,
      files_api::open_in_vscode,
      files_api::get_trashed_items,
      files_api::delete_file,
      drives::get_drives,
      storage::write_data,
      storage::read_data,
      storage::delete_storage_data,
      get_cli_args
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
