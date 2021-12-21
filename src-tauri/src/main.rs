#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

mod drives;
mod extensions;
mod file_lib;
mod files_api;
mod storage;
use clap::{App, Arg, ArgMatches};
use std::path::Path;
mod tests;
use font_loader::system_fonts;
use lazy_static::lazy_static;
use std::env;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::process::Command;
use tauri::Manager;
use tauri_plugin_vibrancy::Vibrancy;

lazy_static! {
  pub static ref ARGS_STRUCT: ArgMatches = {
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
      .subcommand(
        App::new("extensions")
          .alias("ext")
          .about("Manage Xplorer extensions")
          .subcommand(
            App::new("theme")
              .about("Manage themes")
              .subcommand(
                App::new("build").about("Package app into json file").arg(
                  Arg::new("configuration")
                    .about("Path to package.json")
                    .takes_value(true)
                    .multiple_values(false),
                ),
              )
              .subcommand(
                App::new("install")
                  .about("Install theme from json file")
                  .arg(
                    Arg::new("theme")
                      .about("Packaged theme file")
                      .takes_value(true)
                      .multiple_values(false),
                  ),
              ),
          )
          .subcommand(
            App::new("install")
              .about("Install extension from packaged json file")
              .arg(
                Arg::new("extension")
                  .about("Packaged extension file")
                  .takes_value(true)
                  .multiple_values(false),
              ),
          )
          .subcommand(
            App::new("uninstall").about("Uninstall extension").arg(
              Arg::new("extension")
                .about("Extension identifier")
                .takes_value(true)
                .multiple_values(true),
            ),
          ),
      )
      .arg(
        Arg::new("xtension")
          .short('x')
          .long("xtension")
          .about("Install .xtension file")
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
#[tauri::command]
fn change_transparent_effect(effect: String, window: tauri::Window) {
  if effect == "blur".to_string() {
    window.set_blur();
  } else if effect == "acrylic".to_string() {
    window.set_acrylic();
  }
}

fn main() {
  // Extensions stuff
  if ARGS_STRUCT.subcommand_matches("extensions").is_some() {
    let extension_cmd = ARGS_STRUCT.subcommand_matches("extensions").unwrap();
    match extension_cmd.subcommand_matches("theme") {
      Some(theme_command) => {
        match theme_command.subcommand_matches("build") {
          Some(theme_build_info) => {
            let configuration = theme_build_info.value_of("configuration");
            if configuration.is_some() {
              let configuration = configuration.unwrap();
              if configuration == "." {
                extensions::build_themes(
                  Path::new(&env::current_dir().unwrap().join("package.json")).to_path_buf(),
                )
              } else {
                let configuration = Path::new(configuration);
                if configuration.exists() && configuration.is_file() {
                  extensions::build_themes(configuration.to_path_buf())
                } else {
                  extensions::build_themes(configuration.join("package.json").to_path_buf())
                }
              }
            } else {
              extensions::build_themes(
                Path::new(&env::current_dir().unwrap().join("package.json")).to_path_buf(),
              );
            }
            std::process::exit(0);
          }
          None => {}
        };
        match theme_command.subcommand_matches("install") {
          Some(theme_install_info) => {
            let theme = theme_install_info.value_of("theme");
            if theme.is_some() {
              let theme = theme.unwrap();
              if theme == "." {
                extensions::install_themes(
                  Path::new(&env::current_dir().unwrap().join("dist/themes.xtension"))
                    .to_path_buf(),
                )
              } else {
                let theme = Path::new(theme);
                if theme.exists() && theme.is_file() {
                  extensions::install_themes(theme.to_path_buf())
                } else {
                  extensions::install_themes(theme.join("dist/themes.xtension").to_path_buf())
                }
              }
            } else {
              extensions::install_themes(
                Path::new(&env::current_dir().unwrap().join("dist/themes.xtension")).to_path_buf(),
              );
            }
            std::process::exit(0);
          }
          None => {}
        }
      }
      None => {}
    }
    match extension_cmd.subcommand_matches("install") {
      Some(extension_install_info) => {
        let extension = extension_install_info.value_of("extension");
        if extension.is_some() {
          let extension = extension.unwrap();
          let extension = Path::new(extension);
          if extension.exists() && extension.is_file() {
            extensions::install_extensions(extension.to_path_buf())
          } else {
            panic!("Extension file not found");
          }
        } else {
          panic!("No extension specified");
        }
        std::process::exit(0);
      }
      None => {}
    }
    match extension_cmd.subcommand_matches("uninstall") {
      Some(extension_uninstall_info) => {
        let extension = extension_uninstall_info.value_of("extension");
        if extension.is_some() {
          let extension = extension.unwrap();
          extensions::uninstall_extensions(extension.to_string());
        } else {
          panic!("No extension specified");
        }
        std::process::exit(0);
      }
      None => {}
    }
  }
  let xtension_arg = ARGS_STRUCT.value_of("xtension");
  if xtension_arg.is_some() {
    let xtension_arg = xtension_arg.unwrap();
    let xtension_arg = Path::new(xtension_arg);
    if xtension_arg.exists() && xtension_arg.is_file() {
      extensions::install_extensions(xtension_arg.to_path_buf());
    } else {
      panic!("Extension file not found");
    }
  }
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
      extensions::listen_stylesheet_change,
      extensions::get_cli_args,
      check_vscode_installed,
      get_available_fonts,
      change_transparent_effect
    ])
    .setup(|app| {
      let window = app.get_window("main").unwrap();
      let preference = storage::read_data("preference".to_string()).unwrap();
      let transparent_effect = match preference.status {
        true => preference.data["transparentEffect"].to_string(),
        false => "blur".to_string(),
      };
      if transparent_effect == "blur".to_string() || transparent_effect == "null".to_string() {
        window.set_blur();
      } else if transparent_effect == "acrylic".to_string() {
        window.set_acrylic();
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
