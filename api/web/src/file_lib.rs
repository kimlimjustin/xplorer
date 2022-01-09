use lazy_static::lazy_static;
use std::collections::HashMap;

lazy_static! {
  static ref FILES_JSON: String = {
    let files_json = include_str!("../../../lib/files.json");
    files_json.to_string()
  };
}
lazy_static! {
  static ref FILE_TYPES: HashMap<String, String> = {
    let files_json = FILES_JSON.clone();
    let files_lib: serde_json::Value = files_json.parse().unwrap();
    let mut file_types = HashMap::new();
    for category in files_lib.as_array().unwrap() {
      let obj = category.as_object().unwrap();
      if obj.contains_key("extensions") {
        let extensions = obj["extensions"].as_array();
        let extensions = match extensions {
          Some(extensions) => extensions,
          None => continue,
        };
        for extension in extensions {
          let ext = extension.as_str().unwrap().to_string();
          let file_type = obj["type"].as_str().unwrap().to_string();
          file_types.insert(ext, file_type);
        }
      }
    }
    file_types
  };
}

lazy_static! {
  static ref FILE_NAMES: HashMap<String, String> = {
    let files_json = FILES_JSON.clone();
    let files_lib: serde_json::Value = files_json.parse().unwrap();
    let mut file_types = HashMap::new();
    for category in files_lib.as_array().unwrap() {
      let obj = category.as_object().unwrap();
      if obj.contains_key("fileNames") {
        let file_names = obj["fileNames"].as_array();
        let file_names = match file_names {
          Some(file_names) => file_names,
          None => continue,
        };
        for file_name in file_names {
          let file_type = obj["type"].as_str().unwrap().to_string();
          file_types.insert(file_name.as_str().unwrap().to_string(), file_type);
        }
      }
    }
    file_types
  };
}
lazy_static! {
  static ref FOLDER_NAMES: HashMap<String, String> = {
    let folder_json = include_str!("../../../lib/folder.json");

    let folder_lib: serde_json::Value = folder_json.parse().unwrap();
    let mut folder_types = HashMap::new();
    for category in folder_lib.as_array().unwrap() {
      let obj = category.as_object().unwrap();
      if obj.contains_key("folderNames") {
        let folder_names = obj["folderNames"].as_array();
        let folder_names = match folder_names {
          Some(folder_names) => folder_names,
          None => continue,
        };
        let folder_type = obj["type"].as_str();
        let folder_type = match folder_type {
          Some(folder_type) => folder_type.to_string(),
          None => continue,
        };
        for folder_name in folder_names {
          let folder_type = folder_type.clone();
          folder_types.insert(folder_name.as_str().unwrap().to_string(), folder_type);
        }
      }
    }
    folder_types
  };
}
pub fn get_type(file_basename: String, is_dir: bool) -> String {
  if is_dir {
    let folder_type_according_to_name = FILE_NAMES.get(&file_basename);
    match folder_type_according_to_name {
      Some(folder_type) => folder_type.to_string(),
      None => "File Folder".to_string(),
    }
  } else {
    let file_type_according_to_name = FILE_NAMES.get(&file_basename);
    if file_type_according_to_name.is_some() {
      return file_type_according_to_name.unwrap().to_string();
    } else {
      let file_extension = file_basename.split(".").last().unwrap();
      let file_type_according_to_extension = FILE_TYPES.get(file_extension);
      match file_type_according_to_extension {
        Some(file_type) => file_type.to_string(),
        None => {
          let file_type = file_extension.to_string();
          file_type
            .chars()
            .next()
            .unwrap()
            .to_uppercase()
            .collect::<String>()
            + &file_type[1..]
            + &" File".to_string()
        }
      }
    }
  }
}
