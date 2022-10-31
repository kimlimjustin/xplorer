#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod drives;
mod extensions;
mod file_lib;
mod files_api;
mod storage;
mod utils;

use clap::{Arg, ArgMatches, Command as ClapCommand};

mod tests;

use font_loader::system_fonts;
use lazy_static::lazy_static;
use std::env;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::process::Command;
use tauri::Manager;
#[cfg(not(target_os = "linux"))]
use window_shadows::set_shadow;
#[cfg(not(target_os = "linux"))]
use window_vibrancy::{
    apply_acrylic, apply_blur, clear_acrylic, clear_blur
};

lazy_static! {
    pub static ref ARGS_STRUCT: ArgMatches = {
        const VERSION: &str = env!("CARGO_PKG_VERSION");
        ClapCommand::new("Xplorer")
            .version(VERSION)
            .about("Xplorer, customizable, modern file manager")
            .arg(
                Arg::new("reveal")
                    .short('r')
                    .long("reveal")
                    .help("Reveal file in Xplorer")
                    .takes_value(false),
            )
            .subcommand(
                ClapCommand::new("extensions")
                    .alias("ext")
                    .about("Manage Xplorer extensions")
                    .subcommand(
                        ClapCommand::new("theme")
                            .about("Manage themes")
                            .subcommand(
                                ClapCommand::new("build")
                                    .about("Package app into json file")
                                    .arg(
                                        Arg::new("configuration")
                                            .help("Path to package.json")
                                            .takes_value(true)
                                            .multiple_values(false),
                                    ),
                            )
                            .subcommand(
                                ClapCommand::new("install")
                                    .about("Install theme from json file")
                                    .arg(
                                        Arg::new("theme")
                                            .help("Packaged theme file")
                                            .takes_value(true)
                                            .multiple_values(false),
                                    ),
                            ),
                    )
                    .subcommand(
                        ClapCommand::new("install")
                            .about("Install extension from packaged json file")
                            .arg(
                                Arg::new("extension")
                                    .help("Packaged extension file")
                                    .takes_value(true)
                                    .multiple_values(false),
                            ),
                    )
                    .subcommand(
                        ClapCommand::new("uninstall")
                            .about("Uninstall extension")
                            .arg(
                                Arg::new("extension")
                                    .help("Extension identifier")
                                    .takes_value(true)
                                    .multiple_values(true),
                            ),
                    ),
            )
            .arg(
                Arg::new("xtension")
                    .short('x')
                    .long("xtension")
                    .help("Install .xtension file")
                    .takes_value(true),
            )
            .arg(
                Arg::new("dir")
                    .help("Directories to open in Xplorer")
                    .multiple_values(true)
                    .takes_value(true),
            )
            .arg(
                Arg::new("theme")
                    .short('t')
                    .long("theme")
                    .help("Custom color theme")
                    .takes_value(true),
            )
            .get_matches()
    };
}

#[cfg(target_os = "windows")]
#[tauri::command]
#[inline]
async fn check_vscode_installed() -> Result<bool, String> {
    let output = Command::new("cmd")
        .args(["/C", "code -v"])
        .creation_flags(0x08000000)
        .output()
        .expect("failed to execute process");

    Ok(output.status.success())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
#[inline]
async fn check_vscode_installed() -> Result<bool, String> {
    let output = Command::new("sh")
        .arg("-c")
        .arg("code -v")
        .output()
        .expect("failed to execute process");

    Ok(output.status.success())
}

#[tauri::command]
#[inline]
fn get_available_fonts() -> Result<Vec<String>, String> {
    let fonts = system_fonts::query_all();

    Ok(fonts)
}

#[cfg(target_os = "windows")]
#[tauri::command]
#[inline]
fn change_transparent_effect(effect: String, window: tauri::Window) {
    use utils::is_win_11;

    clear_blur(&window).unwrap();
    clear_acrylic(&window).unwrap();
    if is_win_11(){ 
        use window_vibrancy::clear_mica;
        clear_mica(&window).unwrap(); 
    }
    match effect.as_str() {
        "blur" => apply_blur(&window, Some((18, 18, 18, 125))).unwrap(),
        "acrylic" => apply_acrylic(&window, Some((18, 18, 18, 125))).unwrap(),
        "mica" => {
            use window_vibrancy::apply_mica;
            if is_win_11(){ 
                apply_mica(&window).unwrap()
            }
        },
        _ => (),
    }
}

#[cfg(target_os = "macos")]
#[tauri::command]
#[inline]
fn change_transparent_effect(effect: String, window: tauri::Window) {
    if effect.as_str() == "vibrancy" {
        use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
        apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None).unwrap()
    }
}

#[cfg(target_os = "linux")]
#[tauri::command]
#[inline]
fn change_transparent_effect(_effect: String, _window: tauri::Window) {
    return;
}

#[cfg(not(target_os = "linux"))]
#[tauri::command]
#[inline]
fn enable_shadow_effect(effect: bool, window: tauri::Window) {
    set_shadow(&window, effect).unwrap();
}

#[cfg(target_os = "linux")]
#[tauri::command]
#[inline]
fn enable_shadow_effect(_effect: bool, _window: tauri::Window) {
    return;
}

#[tokio::main]
async fn main() {
    extensions::init_extension().await;
    tauri::async_runtime::set(tokio::runtime::Handle::current());
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
            files_api::rename,
            files_api::copy,
            files_api::remove_dir,
            files_api::remove_file,
            files_api::compress_to_zip,
            files_api::decompress_from_zip,
            drives::get_drives,
            storage::write_data,
            storage::read_data,
            storage::delete_storage_data,
            extensions::listen_stylesheet_change,
            extensions::get_cli_args,
            check_vscode_installed,
            get_available_fonts,
            enable_shadow_effect,
            change_transparent_effect
        ])
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            let appearance = storage::read_data("appearance").unwrap();
            let transparent_effect = if appearance.status {
                appearance.data["transparentEffect"]
                .as_str()
                .unwrap_or("none")
                .to_string()
            } else {
                "none".to_string()
            };
            let shadow_effect_enabled = if appearance.status {
                appearance.data["shadowEffect"].as_bool().unwrap_or(true)
            } else {
                true
            };
            enable_shadow_effect(shadow_effect_enabled, window.clone());
            change_transparent_effect(transparent_effect, window);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
