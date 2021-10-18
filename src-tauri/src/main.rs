#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use std::fs;
use std::path::Path;


#[tauri::command]
fn read_directory(dir: &Path) -> String {
  let paths = fs::read_dir(dir).unwrap();

  //println!("Reading: {}", dir);
  for path in paths{
    println!("Name: {}", path.unwrap().path().display())
  }
  "Hello World".into()
}

fn main() {
  tauri::Builder::default()
  .invoke_handler(tauri::generate_handler![read_directory])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
