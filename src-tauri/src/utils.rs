use std::path::PathBuf;

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

// TODO: Any way to export macro without this lane?
pub(crate) use json_value_or_null;
