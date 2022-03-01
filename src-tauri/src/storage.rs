use std::fs;
use std::path::Path;
use std::str;
use tauri::api::path::local_data_dir;

#[derive(serde::Serialize, Debug)]
pub struct StorageData {
    pub data: serde_json::Value,
    pub status: bool,
}

#[tauri::command]
pub fn write_data(key: &str, value: serde_json::Value) {
    let storage_dir = Path::new(&local_data_dir().unwrap()).join("Xplorer");
    if let Err(e) = fs::create_dir_all(&storage_dir) {
        eprintln!("Failed to create dirs: {:?}", e);
    }
    let value = bincode::serialize(&serde_json::to_vec(&value).unwrap()).unwrap();

    if let Err(e) = fs::write(storage_dir.join(key), value) {
        eprintln!("Failed to write data: {:?}", e);
    }
}

#[tauri::command]
pub fn read_data(key: &str) -> Result<StorageData, String> {
    let storage_dir = Path::new(&local_data_dir().unwrap()).join("Xplorer");
    let mut status = true;
    let data: String;
    match fs::read(storage_dir.join(key)) {
        Ok(result) => match bincode::deserialize(&result) {
            Ok(deserialized_bincode) => data = deserialized_bincode,
            Err(_) => data = str::from_utf8(&result).unwrap().to_string(),
        },
        Err(e) => {
            status = false;
            data = e.to_string();
        }
    }

    let serde_value: Result<serde_json::Value, serde_json::Error> = serde_json::from_str(&data);
    let data = match serde_value {
        Ok(result) => result,
        Err(_) => {
            status = false;
            serde_json::Value::Null
        }
    };

    Ok(StorageData { data, status })
}

#[tauri::command]
pub fn delete_storage_data(key: String) {
    let storage_dir = Path::new(&local_data_dir().unwrap()).join("Xplorer");

    if let Ok(_) = fs::remove_file(storage_dir.join(key)) {}
}
