#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]
mod drives;
mod file_lib;
mod files_api;
mod storage;
use std::env;
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
#[tauri::command]
fn check_vscode_installed() -> Result<bool, String> {
  let output = if cfg!(target_os = "windows") {
    Command::new("cmd")
      .args(["/C", "code -v"])
      .output()
      .expect("failed to execute process")
  } else {
    Command::new("sh")
      .arg("-c")
      .arg("code -v")
      .output()
      .expect("failed to execute process")
  };
  if output.status.success() {
    Ok(true)
  } else {
    Ok(false)
  }
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
      drives::get_drives,
      storage::write_data,
      storage::read_data,
      storage::delete_storage_data,
      //file_lib::get_type,
      get_cli_args,
      check_vscode_installed
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
