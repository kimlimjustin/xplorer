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

pub fn get_drives() -> Result<Drives, String> {
    let sys = System::new_all();
    let mut array_of_drives = Vec::new();
    for disk in sys.disks() {
        let mut total_space: u64 = disk.total_space();
        let available_space: u64 = disk.available_space();
        let mount_point: String = disk.mount_point().to_str().unwrap_or("/").to_string();
        let name: String = disk.name().to_str().unwrap_or("Disk").to_string();
        let is_removable: bool = disk.is_removable();
        let mut caption = mount_point.clone();
        let file_system =
            String::from_utf8(disk.file_system().to_vec()).unwrap_or("Err".to_string());
        let disk_type: String;
        if disk.type_() == sysinfo::DiskType::SSD {
            disk_type = "SSD".to_string()
        } else if disk.type_() == sysinfo::DiskType::HDD {
            disk_type = "HDD".to_string()
        } else {
            disk_type = "Removable Disk".to_string()
        }
        caption.pop();
        if total_space < available_space {
            if cfg!(target_os = "windows") {
                let wmic_process = Command::new("cmd")
                    .args([
                        "/C",
                        &format!(
                            "wmic logicaldisk where Caption='{caption}' get Size",
                            caption = caption
                        ),
                    ])
                    .output()
                    .expect("failed to execute process");
                let wmic_process_output = String::from_utf8(wmic_process.stdout).unwrap();
                let parsed_size =
                    wmic_process_output.split("\r\r\n").collect::<Vec<&str>>()[1].to_string();
                match parsed_size.trim().parse::<u64>() {
                    Ok(n) => total_space = n,
                    Err(_) => {}
                }
            }
        }
        array_of_drives.push(DriveInformation {
            name,
            mount_point,
            total_space,
            available_space,
            is_removable,
            disk_type,
            file_system,
        });
    }
    Ok(Drives {
        array_of_drives: array_of_drives,
    })
}
