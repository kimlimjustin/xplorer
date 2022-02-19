use crate::extensions::{install_extensions, uninstall_extensions};
use crate::files_api;
use crate::storage;
use crate::util::read_to_serde_json;
use crate::ARGS_STRUCT;
use notify::{raw_watcher, RawEvent, RecursiveMode, Watcher};
use path_absolutize::*;
use std::env;
use std::path::{Path, PathBuf};
use std::sync::mpsc::channel;
use url::Url;

#[derive(Debug, serde::Serialize)]
pub struct ThemeExtensionInformation {
  pub identifier: String,
  pub name: String,
  pub value: serde_json::Value,
}

#[derive(serde::Serialize)]
pub struct ArgsStruct {
  dirs: Vec<String>,
  is_reveal: bool,
  custom_style_sheet: serde_json::Value,
}

pub fn get_custom_stylesheet_filepath() -> String {
  let custom_style_sheet = ARGS_STRUCT.value_of("theme").unwrap_or("").to_string();
  let custom_style_sheet = match custom_style_sheet.as_str() {
    "" => "".to_string(),
    _ => match files_api::file_exist(custom_style_sheet.clone()) {
      true => custom_style_sheet.clone(),
      false => {
        let package_json_path = Path::new(&env::current_dir().unwrap()).join("package.json");
        let package_json_file: Result<serde_json::Value, serde_json::Error> =
          serde_json::from_str(std::fs::read_to_string(package_json_path).unwrap().as_str());
        let package_json_file = match package_json_file {
          Ok(file) => file,
          Err(_) => {
            return "".to_string();
          }
        };
        let package_json_file = package_json_file.as_object().unwrap();
        let extension_field = package_json_file.get("xplorerExtensionConfig");
        let extension_field = match extension_field {
          Some(field) => field,
          None => {
            return "".to_string();
          }
        };
        let extension_field = extension_field.as_object().unwrap();
        let themes_field = extension_field.get("themes");
        let themes_field = match themes_field {
          Some(field) => field,
          None => {
            return "".to_string();
          }
        };
        let themes_field = themes_field.as_array().unwrap();
        let theme_field = themes_field
          .iter()
          .find(|theme| {
            theme
              .as_object()
              .unwrap()
              .get("identifier")
              .unwrap()
              .as_str()
              .unwrap()
              == custom_style_sheet.as_str()
          })
          .unwrap();
        theme_field
          .get("path")
          .unwrap()
          .as_str()
          .unwrap()
          .to_string()
      }
    },
  };
  custom_style_sheet
}

#[tauri::command]
pub async fn listen_stylesheet_change(window: tauri::Window) {
  if ARGS_STRUCT.value_of("theme").is_some() {
    // listen to file_path file changes
    let (tx, rx) = channel();
    let mut watcher = raw_watcher(tx).unwrap();
    watcher
      .watch(
        Path::new(&get_custom_stylesheet_filepath()),
        RecursiveMode::NonRecursive,
      )
      .unwrap();
    loop {
      match rx.recv() {
        Ok(RawEvent { .. }) => {
          let value = get_custom_stylesheet_filepath();
          let value = match value.as_str() {
            "" => serde_json::Value::Null,
            _ => serde_json::from_str(std::fs::read_to_string(value).unwrap().as_str())
              .unwrap_or(serde_json::Value::Null),
          };
          window.emit("stylesheet_changes", value).unwrap();
        }
        Err(e) => println!("watch error: {:?}", e),
      }
    }
  }
}
pub fn build_themes(package_json_path: PathBuf) {
  let package_json_file: Result<serde_json::Value, serde_json::Error> = serde_json::from_str(
    std::fs::read_to_string(package_json_path.clone())
      .unwrap()
      .as_str(),
  );
  let package_json_file = match package_json_file {
    Ok(file) => file,
    Err(_) => {
      panic!("Error parsing package.json");
    }
  };
  let package_json_file = package_json_file.as_object().unwrap();
  let extension_field = package_json_file.get("xplorerExtensionConfig");
  let extension_field = match extension_field {
    Some(field) => field,
    None => panic!("There is no xplorerExtensionConfig field in package.json file"),
  };
  let extension_field = extension_field.as_object().unwrap();
  let themes_field = extension_field.get("themes");
  let themes_field = match themes_field {
    Some(field) => field,
    None => panic!("There is no themes field in package.json file"),
  };
  let themes_field = themes_field.as_array().unwrap();
  let mut theme_extension_informations: Vec<ThemeExtensionInformation> = Vec::new();
  for theme in themes_field {
    let theme = theme.as_object().unwrap();
    let identifier = theme.get("identifier");
    let identifier = match identifier {
      Some(field) => field.as_str().unwrap(),
      None => panic!("There is no identifier field in your theme"),
    };
    let name = theme.get("name");
    let name = match name {
      Some(field) => field.as_str().unwrap(),
      None => panic!("There is no name field in your theme"),
    };
    let relative_path = theme.get("path");
    let relative_path = match relative_path {
      Some(field) => field.as_str().unwrap(),
      None => panic!("There is no path field in your theme"),
    };
    let path = Path::new(relative_path.clone()).absolutize().unwrap();
    let path = match path.exists() {
      true => path.to_str().unwrap().to_string(),
      false => package_json_path
        .clone()
        .parent()
        .unwrap()
        .join(relative_path)
        .to_str()
        .unwrap()
        .to_string(),
    };
    let theme_value = serde_json::from_str(std::fs::read_to_string(path).unwrap().as_str())
      .unwrap_or(serde_json::Value::Null);
    theme_extension_informations.push(ThemeExtensionInformation {
      identifier: identifier.to_string(),
      name: name.to_string(),
      value: theme_value,
    });
  }
  let extension_name = package_json_file
    .get("extensionName")
    .unwrap_or(&serde_json::Value::Null);
  let description = package_json_file
    .get("description")
    .unwrap_or(&serde_json::Value::Null);
  let author = package_json_file
    .get("author")
    .unwrap_or(&serde_json::Value::Null);
  let homepage = package_json_file
    .get("homepage")
    .unwrap_or(&serde_json::Value::Null);
  let license = package_json_file
    .get("license")
    .unwrap_or(&serde_json::Value::Null);
  let repository = package_json_file
    .get("repository")
    .unwrap_or(&serde_json::Value::Null);
  let identifier = package_json_file.get("name").unwrap().as_str().unwrap();
  let version = package_json_file
    .get("version")
    .unwrap_or(&serde_json::Value::Null);
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
  std::fs::create_dir_all(dist_folder.clone()).unwrap();
  std::fs::write(dist_folder.join("themes.xtension"), extension_information).unwrap();
}

pub fn install_themes(extension: serde_json::Value) {
  let extension_identifier = extension
    .get("identifier")
    .unwrap_or(&serde_json::Value::Null);

  // Check the type of packaged extension
  if extension
    .get("extensionType")
    .unwrap_or(&serde_json::Value::Null)
    != "theme"
  {
    panic!("Packaged extension is not a theme");
  }

  // Remove extensionType field from extension information
  let mut extension_information = extension.as_object().unwrap().clone();
  extension_information.remove("extensionType").unwrap();

  let current_extension_config = storage::read_data("extensions".to_string());
  let current_extension_config = match current_extension_config {
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
  let mut current_extension_config = match current_extension_config.get("themes") {
    Some(_) => current_extension_config,
    None => {
      let mut current_extension_config = current_extension_config.clone();
      // Create themes key on current extension config
      current_extension_config
        .as_object_mut()
        .unwrap()
        .insert("themes".to_string(), serde_json::json!({}));
      current_extension_config
    }
  };

  let themes = current_extension_config.get("themes").unwrap();
  let empty_vec = Vec::new();
  let themes = themes.as_array().unwrap_or(&empty_vec);
  // Remove theme if already installed
  let mut themes = themes
    .iter()
    .filter(|theme| {
      let installed_theme_identifier = theme.get("identifier").unwrap_or(&serde_json::Value::Null);
      installed_theme_identifier != extension_identifier
    })
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
      .unwrap()[0]
      .get("identifier")
      .unwrap()
      .as_str()
      .unwrap(),
  ]
  .join("@");
  storage::write_data(
    "theme".to_string(),
    serde_json::json!({ "theme": first_theme_id }),
  );
  // Push information from packaged extension to the themes key of current extension config array
  current_extension_config
    .as_object_mut()
    .unwrap()
    .insert("themes".to_string(), serde_json::json!(themes));
  storage::write_data("extensions".to_string(), current_extension_config);
}

pub async fn init_theme_extensions() {
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
                build_themes(
                  Path::new(&env::current_dir().unwrap().join("package.json")).to_path_buf(),
                )
              } else {
                let configuration = Path::new(configuration);
                if configuration.exists() && configuration.is_file() {
                  build_themes(configuration.to_path_buf())
                } else {
                  build_themes(configuration.join("package.json").to_path_buf())
                }
              }
            } else {
              build_themes(
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
                install_themes(read_to_serde_json(
                  Path::new(&env::current_dir().unwrap().join("dist/themes.xtension"))
                    .to_path_buf(),
                ))
              } else {
                let theme_path = Path::new(theme.clone());
                if theme_path.exists() && theme_path.is_file() {
                  install_themes(read_to_serde_json(theme_path.to_path_buf()))
                } else if Url::parse(theme).is_ok() {
                  let res = reqwest::get(theme).await.unwrap();
                  let body = res.text().await.unwrap();
                  let body = serde_json::from_str::<serde_json::Value>(body.as_str()).unwrap();
                  install_themes(body)
                } else {
                  install_themes(read_to_serde_json(
                    theme_path.join("dist/themes.xtension").to_path_buf(),
                  ))
                }
              }
            } else {
              install_themes(read_to_serde_json(
                Path::new(&env::current_dir().unwrap().join("dist/themes.xtension")).to_path_buf(),
              ));
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
          let extension_path = Path::new(extension);
          if extension_path.exists() && extension_path.is_file() {
            install_extensions(read_to_serde_json(extension_path.to_path_buf()))
          } else if Url::parse(extension).is_ok() {
            let res = reqwest::get(extension).await.unwrap();
            let body = res.text().await.unwrap();
            let body = serde_json::from_str::<serde_json::Value>(body.as_str()).unwrap();
            install_themes(body)
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
          uninstall_extensions(extension.to_string());
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
      install_extensions(read_to_serde_json(xtension_arg.to_path_buf()));
    } else {
      panic!("Extension file not found");
    }
  };
}
