use serde::{Deserialize, Serialize};
use std::process::Command as StdCommand;
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerInfo {
    pub id: String,
    pub name: String,
    pub image: String,
    pub status: String,
    pub ports: String,
    pub created: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageInfo {
    pub id: String,
    pub repository: String,
    pub tag: String,
    pub size: String,
    pub created: String,
}

fn validate_docker_name(name: &str) -> Result<(), String> {
    let re = regex::Regex::new(r"^[a-zA-Z0-9][a-zA-Z0-9._/:@-]{0,127}$").unwrap();
    if !re.is_match(name) {
        return Err(format!("Invalid Docker name: {}", name));
    }
    if name.contains("--")
        && (name.contains("privileged")
            || name.contains("volume")
            || name.contains("-v "))
    {
        return Err("Docker name contains suspicious flag-like content".into());
    }
    Ok(())
}

fn run_docker_command(args: &[&str]) -> Result<String, String> {
    let output = StdCommand::new("docker").args(args).output().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            "Docker CLI not found. Please install Docker and ensure it is in your PATH.".to_string()
        } else {
            format!("Failed to execute docker command: {}", e)
        }
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("Docker command failed: {}", stderr.trim()));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn parse_container_json(line: &str) -> Option<ContainerInfo> {
    let v: serde_json::Value = serde_json::from_str(line).ok()?;
    Some(ContainerInfo {
        id: v
            .get("ID")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        name: v
            .get("Names")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        image: v
            .get("Image")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        status: v
            .get("Status")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        ports: v
            .get("Ports")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        created: v
            .get("CreatedAt")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
    })
}

fn parse_image_json(line: &str) -> Option<ImageInfo> {
    let v: serde_json::Value = serde_json::from_str(line).ok()?;
    Some(ImageInfo {
        id: v
            .get("ID")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        repository: v
            .get("Repository")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        tag: v
            .get("Tag")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        size: v
            .get("Size")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        created: v
            .get("CreatedSince")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
    })
}

#[command]
pub async fn docker_is_available() -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        match StdCommand::new("docker").arg("version").output() {
            Ok(output) => Ok(output.status.success()),
            Err(_) => Ok(false),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn docker_list_containers(all: bool) -> Result<Vec<ContainerInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let mut args = vec!["ps", "--format", "{{json .}}", "--no-trunc"];
        if all {
            args.insert(1, "-a");
        }
        let output = run_docker_command(&args)?;
        let containers: Vec<ContainerInfo> = output
            .lines()
            .filter(|line| !line.trim().is_empty())
            .filter_map(parse_container_json)
            .collect();
        Ok(containers)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn docker_list_images() -> Result<Vec<ImageInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let output = run_docker_command(&["images", "--format", "{{json .}}", "--no-trunc"])?;
        let images: Vec<ImageInfo> = output
            .lines()
            .filter(|line| !line.trim().is_empty())
            .filter_map(parse_image_json)
            .collect();
        Ok(images)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn docker_start_container(id: String) -> Result<(), String> {
    validate_docker_name(&id)?;
    tokio::task::spawn_blocking(move || {
        run_docker_command(&["start", &id])?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn docker_stop_container(id: String) -> Result<(), String> {
    validate_docker_name(&id)?;
    tokio::task::spawn_blocking(move || {
        run_docker_command(&["stop", &id])?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn docker_remove_container(id: String, force: bool) -> Result<(), String> {
    validate_docker_name(&id)?;
    tokio::task::spawn_blocking(move || {
        if force {
            run_docker_command(&["rm", "-f", &id])?;
        } else {
            run_docker_command(&["rm", &id])?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn docker_remove_image(id: String, force: bool) -> Result<(), String> {
    validate_docker_name(&id)?;
    tokio::task::spawn_blocking(move || {
        if force {
            run_docker_command(&["rmi", "-f", &id])?;
        } else {
            run_docker_command(&["rmi", &id])?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn docker_container_logs(id: String, lines: u32) -> Result<String, String> {
    validate_docker_name(&id)?;
    tokio::task::spawn_blocking(move || {
        let tail_arg = format!("{}", lines);
        run_docker_command(&["logs", "--tail", &tail_arg, &id])
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_container_json() {
        let json = r#"{"ID":"abc123","Names":"my-container","Image":"nginx:latest","Status":"Up 2 hours","Ports":"80/tcp","CreatedAt":"2026-03-15 10:00:00"}"#;
        let c = parse_container_json(json).unwrap();
        assert_eq!(c.id, "abc123");
        assert_eq!(c.name, "my-container");
        assert_eq!(c.image, "nginx:latest");
        assert_eq!(c.status, "Up 2 hours");
        assert_eq!(c.ports, "80/tcp");
        assert_eq!(c.created, "2026-03-15 10:00:00");
    }

    #[test]
    fn test_parse_image_json() {
        let json = r#"{"ID":"def456","Repository":"nginx","Tag":"latest","Size":"142MB","CreatedSince":"3 weeks ago"}"#;
        let i = parse_image_json(json).unwrap();
        assert_eq!(i.id, "def456");
        assert_eq!(i.repository, "nginx");
        assert_eq!(i.tag, "latest");
        assert_eq!(i.size, "142MB");
        assert_eq!(i.created, "3 weeks ago");
    }

    #[test]
    fn test_parse_container_json_missing_fields() {
        let json = r#"{"ID":"abc"}"#;
        let c = parse_container_json(json).unwrap();
        assert_eq!(c.id, "abc");
        assert_eq!(c.name, "");
        assert_eq!(c.image, "");
    }

    #[test]
    fn test_parse_image_json_missing_fields() {
        let json = r#"{"ID":"def"}"#;
        let i = parse_image_json(json).unwrap();
        assert_eq!(i.id, "def");
        assert_eq!(i.repository, "");
        assert_eq!(i.tag, "");
    }

    #[test]
    fn test_parse_container_json_invalid() {
        assert!(parse_container_json("not json").is_none());
    }

    #[test]
    fn test_parse_image_json_invalid() {
        assert!(parse_image_json("not json").is_none());
    }

    #[test]
    fn test_container_info_serialization() {
        let c = ContainerInfo {
            id: "abc".to_string(),
            name: "test".to_string(),
            image: "nginx".to_string(),
            status: "Up".to_string(),
            ports: "80/tcp".to_string(),
            created: "2026-03-15".to_string(),
        };
        let json = serde_json::to_string(&c).unwrap();
        let deserialized: ContainerInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, "abc");
        assert_eq!(deserialized.name, "test");
    }

    #[test]
    fn test_validate_docker_name_valid() {
        assert!(validate_docker_name("nginx").is_ok());
        assert!(validate_docker_name("nginx:latest").is_ok());
        assert!(validate_docker_name("my-container").is_ok());
        assert!(validate_docker_name("registry.example.com/image:v1.0").is_ok());
        assert!(validate_docker_name("abc123").is_ok());
        assert!(validate_docker_name("user/repo@sha256:abc123def456").is_ok());
    }

    #[test]
    fn test_validate_docker_name_invalid() {
        assert!(validate_docker_name("").is_err());
        assert!(validate_docker_name(" spaces").is_err());
        assert!(validate_docker_name("-leading-dash").is_err());
        assert!(validate_docker_name(".leading-dot").is_err());
        assert!(validate_docker_name("name with spaces").is_err());
    }

    #[test]
    fn test_validate_docker_name_suspicious_flags() {
        assert!(validate_docker_name("name--privileged").is_err());
        assert!(validate_docker_name("name--volume-test").is_err());
    }

    #[test]
    fn test_image_info_serialization() {
        let i = ImageInfo {
            id: "def".to_string(),
            repository: "nginx".to_string(),
            tag: "latest".to_string(),
            size: "142MB".to_string(),
            created: "3 weeks ago".to_string(),
        };
        let json = serde_json::to_string(&i).unwrap();
        let deserialized: ImageInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, "def");
        assert_eq!(deserialized.repository, "nginx");
    }
}
