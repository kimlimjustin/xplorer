use std::path::PathBuf;
use rand::Rng;

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

pub fn generate_string(length: usize) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ\
                            abcdefghijklmnopqrstuvwxyz\
                            0123456789)(*&^%$#@!~";
    let mut rng = rand::thread_rng();
    let s: String = (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect();
    s
}

#[macro_export]
macro_rules! json_value_or_null {
    ($json:expr, $get:expr) => {
        $json.get($get).unwrap_or(&serde_json::Value::Null)
    };
}

// TODO: Any way to export macro without this lane?
pub(crate) use json_value_or_null;
