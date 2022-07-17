use std::path::PathBuf;
use sysinfo::{System, SystemExt};

pub fn read_to_serde_json(path: PathBuf) -> serde_json::Value {
    let file: Result<serde_json::Value, serde_json::Error> =
        serde_json::from_str(std::fs::read_to_string(path).unwrap().as_str());

    match file {
        Ok(file) => file,
        Err(_) => {
            panic!("Error parsing file");
        }
    }
}

#[macro_export]
macro_rules! json_value_or_null {
    ($json:expr, $get:expr) => {
        $json.get($get).unwrap_or(&serde_json::Value::Null)
    };
}


pub fn is_win_11() -> bool {
    let sys = System::new_all();
    let version = sys.os_version().unwrap();
    let version = version.split('(').collect::<Vec<&str>>()[1].split(')').collect::<Vec<&str>>()[0];
    let version: u32 = version.split('.').collect::<Vec<&str>>()[0].parse().unwrap();
    version >= 22000
}

// TODO: Any way to export macro without this lane?
pub(crate) use json_value_or_null;
