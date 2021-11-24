use std::fs;
use std::path::Path;
use tauri::api::path::local_data_dir;

#[derive(serde::Serialize)]
pub struct StorageData {
  pub data: String,
  pub status: bool,
}

#[tauri::command]
pub fn write_data(key: String, data: String) -> bool {
  let storage_dir = Path::new(&local_data_dir().unwrap()).join("Xplorer");
  let mut result = match fs::create_dir_all(storage_dir.clone()) {
    Ok(..) => true,
    Err(..) => false,
  };
  result = match fs::write(storage_dir.join(key), data) {
    Ok(..) => true && result,
    Err(..) => false,
  };
  result
}

#[tauri::command]
pub fn read_data(key: String) -> Result<StorageData, String> {
  let storage_dir = Path::new(&local_data_dir().unwrap()).join("Xplorer");
  let mut status = true;
  let data: String;
  match fs::read_to_string(storage_dir.join(key)) {
    Ok(result) => data = result,
    Err(e) => {
      status = false;
      data = e.to_string()
    }
  }
  Ok(StorageData { data, status })
}

#[tauri::command]
pub fn delete_storage_data(key: String) {
  let storage_dir = Path::new(&local_data_dir().unwrap()).join("Xplorer");

  match fs::remove_file(storage_dir.join(key)) {
    Ok(..) => {}
    Err(..) => {}
  }
}
