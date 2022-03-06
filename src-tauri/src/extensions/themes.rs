use crate::ARGS_STRUCT;
use crate::{files_api, storage, utils::json_value_or_null, utils::read_to_serde_json};
use notify::{raw_watcher, RawEvent, RecursiveMode, Watcher};
use path_absolutize::*;
use std::env;
use std::path::Path;
use std::sync::mpsc::channel;
use url::Url;

#[derive(serde::Serialize)]
pub struct ArgsStruct {
    dirs: Vec<String>,
    is_reveal: bool,
    custom_style_sheet: serde_json::Value,
}

pub fn get_custom_stylesheet_filepath() -> Option<String> {
    let custom_style_sheet = ARGS_STRUCT.value_of("theme").unwrap_or_default();
    match custom_style_sheet.is_empty() {
        true => None,
        false => match files_api::file_exist(custom_style_sheet) {
            true => Some(custom_style_sheet.to_string()),
            false => {
                let package_json_path =
                    Path::new(&env::current_dir().unwrap()).join("package.json");
                let package_json_file: serde_json::Value = serde_json::from_str(
                    std::fs::read_to_string(package_json_path).unwrap().as_str(),
                )
                .ok()?;

                // FIXME: Should it panic when it's `None`?
                let package_json_file = package_json_file.as_object().unwrap();
                let extension_field = package_json_file
                    .get("xplorerExtensionConfig")?
                    .as_object()
                    .unwrap();

                let themes_field = extension_field.get("themes")?.as_array().unwrap();
                let theme_field: &serde_json::Value = themes_field
                    .iter()
                    .find(|theme| {
                        theme
                            .as_object()
                            .unwrap()
                            .get("identifier")
                            .unwrap()
                            .as_str()
                            .unwrap()
                            == custom_style_sheet
                    })
                    .unwrap();

                Some(theme_field.get("path").unwrap().to_string())
            }
        },
    }
}

#[tauri::command]
pub async fn listen_stylesheet_change(window: tauri::Window) {
    if ARGS_STRUCT.value_of("theme").is_some() {
        // listen to file_path file changes
        let (tx, rx) = channel();
        let mut watcher = raw_watcher(tx).unwrap();
        watcher
            .watch(
                Path::new(&get_custom_stylesheet_filepath().unwrap_or_default()),
                RecursiveMode::NonRecursive,
            )
            .unwrap();

        loop {
            match rx.recv() {
                Ok(RawEvent { .. }) => {
                    let value = match get_custom_stylesheet_filepath() {
                        None => serde_json::Value::default(),
                        Some(value) => {
                            serde_json::from_str(std::fs::read_to_string(value).unwrap().as_str())
                                .unwrap_or_default()
                        }
                    };

                    window.emit("stylesheet_changes", value).unwrap();
                }
                Err(e) => println!("watch error: {:?}", e),
            }
        }
    }
}

#[derive(Debug, serde::Serialize)]
pub struct ThemeExtensionInformation {
    pub identifier: String,
    pub name: String,
    pub value: serde_json::Value,
}

pub fn build_themes(package_json_path: &Path) {
    let package_json_file: serde_json::Value = serde_json::from_str(
        std::fs::read_to_string(&package_json_path)
            .unwrap()
            .as_str(),
    )
    .expect("Error parsing package.json");
    let package_json_file = package_json_file.as_object().unwrap();

    let extension_field = package_json_file
        .get("xplorerExtensionConfig")
        .expect("There is no xplorerExtensionConfig field in package.json file")
        .as_object()
        .unwrap();

    let themes_field = extension_field
        .get("themes")
        .expect("There is no themes field in package.json file")
        .as_array()
        .unwrap();

    let theme_extension_informations = themes_field
        .iter()
        .map(|theme| {
            let theme = theme.as_object().unwrap();

            let identifier = theme
                .get("identifier")
                .expect("There is no identifier field in your theme")
                .to_string();

            let name = theme
                .get("name")
                .expect("There is no name field in your theme")
                .to_string();

            let relative_path = theme
                .get("path")
                .expect("There is no path field in your theme")
                .as_str()
                .unwrap();

            // FIXME: Should it be absolute path?
            let path = Path::new(relative_path).absolutize().unwrap();
            let path = match path.exists() {
                true => path.to_str().unwrap().to_string(),
                false => (*package_json_path)
                    .parent()
                    .unwrap()
                    .join(relative_path)
                    .to_str()
                    .unwrap()
                    .to_string(),
            };
            let value = serde_json::from_str(std::fs::read_to_string(path).unwrap().as_str())
                .unwrap_or_default();

            ThemeExtensionInformation {
                identifier,
                name,
                value,
            }
        })
        .collect::<Vec<_>>();

    let extension_name = json_value_or_null!(package_json_file, "extensionName");
    let description = json_value_or_null!(package_json_file, "description");
    let author = json_value_or_null!(package_json_file, "author");
    let homepage = json_value_or_null!(package_json_file, "homepage");
    let license = json_value_or_null!(package_json_file, "license");
    let repository = json_value_or_null!(package_json_file, "repository");
    let identifier = json_value_or_null!(package_json_file, "name");
    let version = json_value_or_null!(package_json_file, "version");

    let extension_information = serde_json::json!({
      "extensionType": "theme",
      "decoder": "json",
      "name": extension_name,
      "identifier": identifier,
      "version": version,
      "description": description,
      "author": author,
      "homepage": homepage,
      "license": license,
      "repository": repository,
      "themes": theme_extension_informations,
    })
    .to_string();

    let dist_folder = Path::new(package_json_path.parent().unwrap()).join("dist");
    std::fs::create_dir_all(&dist_folder).unwrap();
    std::fs::write(dist_folder.join("themes.xtension"), extension_information).unwrap();
}

pub fn install_themes(extension: serde_json::Value) {
    let extension_identifier = json_value_or_null!(&extension, "identifier");

    // Check the type of packaged extension
    if json_value_or_null!(&extension, "extensionType") != "theme" {
        panic!("Packaged extension is not a theme");
    }

    // Remove extensionType field from extension information
    let mut extension_information = extension.as_object().unwrap().clone();
    extension_information.remove("extensionType").unwrap();

    let mut current_extension_config = match storage::read_data("extensions") {
        Ok(config) => {
            if config.status && config.data.is_object() {
                config.data
            } else {
                serde_json::json!({})
            }
        }
        Err(_) => {
            serde_json::json!({})
        }
    };

    // Create themes key on current extension config if not existed
    current_extension_config = match current_extension_config.get("themes") {
        Some(_) => current_extension_config,
        None => {
            // Create themes key on current extension config
            current_extension_config
                .as_object_mut()
                .unwrap()
                .insert("themes".to_string(), serde_json::json!({}));

            current_extension_config
        }
    };

    let themes = current_extension_config.get("themes").unwrap();
    // Does exists a way to simplify this block of code?
    let empty_vec = Vec::new();
    let themes = themes.as_array().unwrap_or(&empty_vec);

    // Remove theme if already installed
    let mut themes = themes
        .iter()
        .filter(|theme| json_value_or_null!(theme, "identifier") == extension_identifier)
        .cloned()
        .collect::<Vec<_>>();
    // Add new theme to current theme config
    themes.push(serde_json::Value::Object(extension_information.clone()));

    // Set the new theme as active theme
    let first_theme_id = [
        extension_identifier.as_str().unwrap(),
        extension_information
            .get("themes")
            .unwrap()
            .as_array()
            .unwrap()
            .first()
            .unwrap()
            .get("identifier")
            .unwrap()
            .as_str()
            .unwrap(),
    ]
    .join("@");
    storage::write_data("theme", serde_json::json!({ "theme": first_theme_id }));

    // Push information from packaged extension to the themes key of current extension config array
    current_extension_config
        .as_object_mut()
        .unwrap()
        .insert("themes".to_string(), serde_json::json!(themes));

    storage::write_data("extensions", current_extension_config);
}

#[inline]
pub fn install_extensions(extension: serde_json::Value) {
    // Check the type of packaged extension
    if json_value_or_null!(&extension, "extensionType") != "theme" {
        panic!("Only theme extension is supported right now");
    }

    install_themes(extension);
}

pub async fn init_theme_extension() {
    // Extensions stuff
    if ARGS_STRUCT.subcommand_matches("extensions").is_some() {
        let extension_cmd = ARGS_STRUCT.subcommand_matches("extensions").unwrap();

        if let Some(theme_command) = extension_cmd.subcommand_matches("theme") {
            if let Some(theme_build_info) = theme_command.subcommand_matches("build") {
                match theme_build_info.value_of("configuration") {
                    Some(configuration) => {
                        if configuration == "." {
                            build_themes(Path::new(
                                &env::current_dir().unwrap().join("package.json"),
                            ))
                        } else {
                            let configuration = Path::new(configuration);

                            if configuration.exists() && configuration.is_file() {
                                build_themes(configuration)
                            } else {
                                build_themes(&configuration.join("package.json"))
                            }
                        }
                    }
                    None => {
                        build_themes(Path::new(&env::current_dir().unwrap().join("package.json")))
                    }
                }

                std::process::exit(0);
            }
            if let Some(theme_install_info) = theme_command.subcommand_matches("install") {
                match theme_install_info.value_of("theme") {
                    Some(theme) => {
                        if theme == "." {
                            install_themes(read_to_serde_json(
                                env::current_dir().unwrap().join("dist/themes.xtension"),
                            ))
                        } else {
                            let theme_path = Path::new(theme);
                            if theme_path.exists() && theme_path.is_file() {
                                install_themes(read_to_serde_json(theme_path.to_path_buf()))
                            } else if Url::parse(theme).is_ok() {
                                match reqwest::get(theme).await.unwrap().text().await {
                                    Ok(body) => {
                                        let extension = serde_json::from_str::<serde_json::Value>(
                                            body.as_str(),
                                        )
                                        .unwrap();

                                        install_themes(extension)
                                    }
                                    Err(e) => eprintln!("{:?}", e),
                                }
                            } else {
                                install_themes(read_to_serde_json(
                                    theme_path.join("dist/themes.xtension"),
                                ))
                            }
                        }
                    }
                    None => {
                        install_themes(read_to_serde_json(
                            env::current_dir().unwrap().join("dist/themes.xtension"),
                        ));
                    }
                }

                std::process::exit(0);
            }
        }
        if let Some(extension_install_info) = extension_cmd.subcommand_matches("install") {
            match extension_install_info.value_of("extension") {
                Some(extension) => {
                    let extension_path = Path::new(extension);
                    if extension_path.exists() && extension_path.is_file() {
                        install_extensions(read_to_serde_json(extension_path.to_path_buf()))
                    } else if Url::parse(extension).is_ok() {
                        let res = reqwest::get(extension).await.unwrap();
                        let body = res.text().await.unwrap();
                        let body =
                            serde_json::from_str::<serde_json::Value>(body.as_str()).unwrap();
                        install_themes(body)
                    } else {
                        panic!("Extension file not found");
                    }
                }
                None => panic!("No extension specified"),
            }

            std::process::exit(0);
        }
        if let Some(extension_uninstall_info) = extension_cmd.subcommand_matches("uninstall") {
            match extension_uninstall_info.value_of("extension") {
                Some(extension) => crate::extensions::uninstall_extensions(extension.to_string()),
                None => panic!("No extension specified"),
            }

            std::process::exit(0);
        }
    }

    if let Some(xtension_arg) = ARGS_STRUCT.value_of("xtension") {
        let xtension_arg = Path::new(xtension_arg);
        match xtension_arg.exists() && xtension_arg.is_file() {
            true => install_extensions(read_to_serde_json(xtension_arg.to_path_buf())),
            false => panic!("Extension file not found"),
        }
    }
}
