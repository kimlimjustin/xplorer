use std::process::Command;
use sysinfo::{DiskExt, System, SystemExt};

#[derive(serde::Serialize, Debug)]
pub struct DriveInformation {
    name: String,
    mount_point: String,
    total_space: u64,
    available_space: u64,
    is_removable: bool,
    disk_type: String,
    file_system: String,
}

#[derive(serde::Serialize)]
pub struct Drives {
    array_of_drives: Vec<DriveInformation>,
}

#[tauri::command]
pub fn get_drives() -> Result<Drives, String> {
    let array_of_drives = System::new_all()
        .disks()
        .iter()
        .map(|disk| {
            let mut total_space = disk.total_space();
            let available_space = disk.available_space();
            let mount_point = disk.mount_point().to_str().unwrap_or("/").to_string();
            let name = disk.name().to_str().unwrap_or("Disk").to_string();
            let is_removable = disk.is_removable();
            let mut caption = mount_point.clone();
            caption.pop();
            let file_system = String::from_utf8(disk.file_system().to_vec())
                .unwrap_or_else(|_| "Err".to_string());
            let disk_type = match disk.type_() {
                sysinfo::DiskType::SSD => "SSD".to_string(),
                sysinfo::DiskType::HDD => "HDD".to_string(),
                _ => "Removable Disk".to_string(),
            };

            if total_space < available_space && cfg!(target_os = "windows") {
                let wmic_process = Command::new("cmd")
                    .args([
                        "/C",
                        &format!("wmic logical disk where Caption='{caption}' get Size"),
                    ])
                    .output()
                    .expect("failed to execute process");
                let wmic_process_output = String::from_utf8(wmic_process.stdout).unwrap();
                let parsed_size =
                    wmic_process_output.split("\r\r\n").collect::<Vec<&str>>()[1].to_string();

                if let Ok(n) = parsed_size.trim().parse::<u64>() {
                    total_space = n;
                }
            }

            DriveInformation {
                name,
                mount_point,
                total_space,
                available_space,
                is_removable,
                disk_type,
                file_system,
            }
        })
        .collect();

    Ok(Drives { array_of_drives })
}
