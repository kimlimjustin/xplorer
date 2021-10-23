use std::fs;
use std::path::Path;
use tauri::api::path::local_data_dir;

#[derive(serde::Serialize)]
pub struct StorageData {
  data: String,
  status: bool,
}

#[tauri::command]
pub fn write_data(key: String, data: String) {
  let storage_dir = Path::new(&local_data_dir().unwrap()).join("Xplorer");
  match fs::create_dir_all(storage_dir.clone()) {
    Ok(..) => {}
    Err(..) => {}
  }
  match fs::write(storage_dir.join(key), data) {
    Ok(..) => {}
    Err(..) => {}
  };
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
