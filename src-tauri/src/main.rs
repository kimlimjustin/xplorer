#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]
mod drives;
mod file_lib;
mod files_api;
mod storage;
use font_loader::system_fonts;
use std::env;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::Command;

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

#[cfg(target_os = "windows")]
#[tauri::command]
async fn check_vscode_installed() -> Result<bool, String> {
  let output = Command::new("cmd")
    .args(["/C", "code -v"])
    .creation_flags(0x08000000)
    .output()
    .expect("failed to execute process");
  if output.status.success() {
    Ok(true)
  } else {
    Ok(false)
  }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
async fn check_vscode_installed() -> Result<bool, String> {
  let output = Command::new("sh")
    .arg("-c")
    .arg("code -v")
    .output()
    .expect("failed to execute process");
  if output.status.success() {
    Ok(true)
  } else {
    Ok(false)
  }
}

#[tauri::command]
fn get_available_fonts() -> Result<Vec<String>, String> {
  let fonts = system_fonts::query_all();
  Ok(fonts)
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
      files_api::get_files_in_directory,
      files_api::listen_dir,
      files_api::restore_files,
      files_api::purge_trashes,
      files_api::restore_trash,
      files_api::get_dir_size,
      files_api::get_file_properties,
      files_api::extract_icon,
      drives::get_drives,
      storage::write_data,
      storage::read_data,
      storage::delete_storage_data,
      get_cli_args,
      check_vscode_installed,
      get_available_fonts
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
