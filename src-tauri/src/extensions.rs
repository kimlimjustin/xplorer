use crate::files_api;
use crate::ARGS_STRUCT;
use notify::{raw_watcher, RawEvent, RecursiveMode, Watcher};
use std::env;
use std::path::Path;
use std::sync::mpsc::channel;
extern crate path_absolutize;
use path_absolutize::*;

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

#[tauri::command]
pub fn get_cli_args() -> Result<ArgsStruct, String> {
  let is_reveal = ARGS_STRUCT
    .value_of("reveal")
    .unwrap_or("false")
    .to_string();
  let custom_style_sheet = get_custom_stylesheet_filepath();
  let custom_style_sheet = match custom_style_sheet.as_str() {
    "" => serde_json::Value::Null,
    _ => serde_json::from_str(
      std::fs::read_to_string(custom_style_sheet)
        .unwrap()
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

#[derive(Debug, serde::Serialize)]
pub struct ThemeExtensionInformation {
  pub identifier: String,
  pub name: String,
  pub value: serde_json::Value,
}

pub fn build_themes() {
  let package_json_path = Path::new(&env::current_dir().unwrap()).join("package.json");
  let package_json_file: Result<serde_json::Value, serde_json::Error> =
    serde_json::from_str(std::fs::read_to_string(package_json_path).unwrap().as_str());
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
    let path = theme.get("path");
    let path = match path {
      Some(field) => field.as_str().unwrap(),
      None => panic!("There is no path field in your theme"),
    };
    let path = Path::new(path)
      .absolutize()
      .unwrap()
      .to_str()
      .unwrap()
      .to_string();
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
  let extension_information = serde_json::json!({
    "extensionType": "theme",
    "decoder": "json",
    "name": extension_name,
    "description": description,
    "author": author,
    "homepage": homepage,
    "license": license,
    "repository": repository,
    "themes": theme_extension_informations,
  })
  .to_string();
  let dist_folder = Path::new(&env::current_dir().unwrap()).join("dist");
  std::fs::create_dir_all(dist_folder.clone()).unwrap();
  std::fs::write(dist_folder.join("themes.xtension"), extension_information).unwrap();
}
