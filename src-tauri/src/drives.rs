use sysinfo::{DiskExt, System, SystemExt};

#[derive(serde::Serialize, Debug)]
pub struct DriveInformation {
  name: String,
  mount_point: String,
  total_space: u64,
  available_space: u64,
  is_removable: bool,
}
#[derive(serde::Serialize)]
pub struct Drives {
  array_of_drives: Vec<DriveInformation>,
}

#[tauri::command]
pub fn get_drives() -> Result<Drives, String> {
  let sys = System::new_all();
  let mut array_of_drives = Vec::new();
  for disk in sys.disks() {
    array_of_drives.push(DriveInformation {
      name: disk.name().to_str().unwrap_or("Disk").to_string(), //name: format!("{:?}", disk.name()),
      mount_point: disk.mount_point().to_str().unwrap_or("/").to_string(),
      total_space: disk.total_space(),
      available_space: disk.available_space(),
      is_removable: disk.is_removable(),
    });
  }
  Ok(Drives {
    array_of_drives: array_of_drives,
  })
}
