#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

mod drives;
mod file_lib;
mod files_api;
mod storage;
use clap::{App, Arg, ArgMatches};
use font_loader::system_fonts;
use lazy_static::lazy_static;
use std::env;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::Command;

extern crate path_absolutize;
use path_absolutize::*;

#[derive(serde::Serialize)]
struct ArgsStruct {
  dirs: Vec<String>,
  is_reveal: bool,
  custom_style_sheet: serde_json::Value,
}
lazy_static! {
  static ref ARGS_STRUCT: ArgMatches = {
    const VERSION: &'static str = env!("CARGO_PKG_VERSION");
    App::new("Xplorer")
      .version(VERSION)
      .about("Xplorer, customizable, modern file manager")
      .arg(
        Arg::new("reveal")
          .short('r')
          .long("reveal")
          .about("Reveal file in Xplorer")
          .takes_value(true),
      )
      .arg(
        Arg::new("dir")
          .about("Directories to open in Xplorer")
          .multiple_values(true)
          .takes_value(true),
      )
      .arg(
        Arg::new("theme")
          .short('t')
          .long("theme")
          .about("Custom color theme")
          .takes_value(true),
      )
      .get_matches()
  };
}
use notify::{raw_watcher, RawEvent, RecursiveMode, Watcher};
use std::sync::mpsc::channel;
#[tauri::command]
async fn listen_stylesheet_change(window: tauri::Window) {
  if ARGS_STRUCT.value_of("theme").is_some() {
    // listen to file_path file changes
    let (tx, rx) = channel();
    let mut watcher = raw_watcher(tx).unwrap();
    watcher
      .watch(
        Path::new(&ARGS_STRUCT.value_of("theme").unwrap()),
        RecursiveMode::NonRecursive,
      )
      .unwrap();
    loop {
      match rx.recv() {
        Ok(RawEvent {
          path: Some(path),
          op: Ok(op),
          ..
        }) => {
          println!("{:?} {:?}", path, op);
          let value = serde_json::from_str(
            std::fs::read(path)
              .map_err(|e| format!("{}", e))
              .map(|v| String::from_utf8(v).unwrap())
              .unwrap_or("".to_string())
              .as_str(),
          );
          window
            .emit(
              "stylesheet_changes",
              value.unwrap_or(serde_json::Value::Null),
            )
            .unwrap();
        }
        Ok(event) => println!("broken event: {:?}", event),
        Err(e) => println!("watch error: {:?}", e),
      }
    }
  }
}

#[tauri::command]
fn get_cli_args() -> Result<ArgsStruct, String> {
  let is_reveal = ARGS_STRUCT
    .value_of("reveal")
    .unwrap_or("false")
    .to_string();
  let custom_style_sheet = ARGS_STRUCT.value_of("theme").unwrap_or("").to_string();
  let custom_style_sheet = match custom_style_sheet.as_str() {
    "" => serde_json::Value::Null,
    _ => serde_json::from_str(
      std::fs::read(custom_style_sheet.as_str())
        .map_err(|e| format!("{}", e))
        .map(|v| String::from_utf8(v).unwrap())
        .unwrap_or("".to_string())
        .as_str(),
    )
    .unwrap_or(serde_json::Value::Null),
  };
  if let Some(dirs_arg) = ARGS_STRUCT.values_of("dir") {
    let dirs = dirs_arg
      .map(|s| {
        let dir = Path::new(s).absolutize();
        if dir.is_err() {
          return dir.unwrap_err().to_string();
        }
        return dir.unwrap().to_str().unwrap().to_string();
      })
      .collect();
    Ok(ArgsStruct {
      dirs,
      is_reveal: is_reveal == "true",
      custom_style_sheet,
    })
  } else {
    Ok(ArgsStruct {
      dirs: vec![],
      is_reveal: is_reveal == "true",
      custom_style_sheet,
    })
  }
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
      files_api::calculate_files_total_size,
      files_api::search_in_dir,
      drives::get_drives,
      storage::write_data,
      storage::read_data,
      storage::delete_storage_data,
      get_cli_args,
      check_vscode_installed,
      get_available_fonts,
      listen_stylesheet_change
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
