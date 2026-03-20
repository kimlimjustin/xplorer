use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ShellIntegrationStatus {
    pub is_default_handler: bool,
    pub context_menu_installed: bool,
}

// ── Windows implementation ──────────────────────────────────────────────

#[cfg(target_os = "windows")]
mod windows_impl {
    use super::ShellIntegrationStatus;
    use winreg::enums::*;
    use winreg::RegKey;

    const VERB: &str = "OpenWithXplorer";
    const DISPLAY_NAME: &str = "Open with Xplorer";

    fn get_exe_path() -> Result<String, String> {
        std::env::current_exe()
            .map(|p| p.to_string_lossy().into_owned())
            .map_err(|e| format!("Failed to get executable path: {}", e))
    }

    fn notify_shell() {
        unsafe {
            // SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, NULL, NULL)
            #[link(name = "shell32")]
            extern "system" {
                fn SHChangeNotify(wEventId: i32, uFlags: u32, dwItem1: *const std::ffi::c_void, dwItem2: *const std::ffi::c_void);
            }
            SHChangeNotify(0x08000000, 0x0000, std::ptr::null(), std::ptr::null());
        }
    }

    pub fn set_default_folder_handler(enable: bool) -> Result<(), String> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let exe_path = get_exe_path()?;

        if enable {
            // Register the verb for Directory
            let (dir_verb, _) = hkcu
                .create_subkey(&format!("Software\\Classes\\Directory\\shell\\{}", VERB))
                .map_err(|e| e.to_string())?;
            dir_verb.set_value("", &DISPLAY_NAME).map_err(|e| e.to_string())?;
            dir_verb.set_value("Icon", &exe_path).map_err(|e| e.to_string())?;

            let (dir_cmd, _) = hkcu
                .create_subkey(&format!("Software\\Classes\\Directory\\shell\\{}\\command", VERB))
                .map_err(|e| e.to_string())?;
            dir_cmd.set_value("", &format!("\"{}\" \"%1\"", exe_path)).map_err(|e| e.to_string())?;

            // Set as default verb for Directory
            let (dir_shell, _) = hkcu
                .create_subkey("Software\\Classes\\Directory\\shell")
                .map_err(|e| e.to_string())?;
            dir_shell.set_value("", &VERB).map_err(|e| e.to_string())?;

            // Register for Drive
            let (drive_verb, _) = hkcu
                .create_subkey(&format!("Software\\Classes\\Drive\\shell\\{}", VERB))
                .map_err(|e| e.to_string())?;
            drive_verb.set_value("", &DISPLAY_NAME).map_err(|e| e.to_string())?;
            drive_verb.set_value("Icon", &exe_path).map_err(|e| e.to_string())?;

            let (drive_cmd, _) = hkcu
                .create_subkey(&format!("Software\\Classes\\Drive\\shell\\{}\\command", VERB))
                .map_err(|e| e.to_string())?;
            drive_cmd.set_value("", &format!("\"{}\" \"%1\"", exe_path)).map_err(|e| e.to_string())?;

            // Set as default verb for Drive
            let (drive_shell, _) = hkcu
                .create_subkey("Software\\Classes\\Drive\\shell")
                .map_err(|e| e.to_string())?;
            drive_shell.set_value("", &VERB).map_err(|e| e.to_string())?;

            // Also register background context menu
            let (bg_verb, _) = hkcu
                .create_subkey(&format!("Software\\Classes\\Directory\\Background\\shell\\{}", VERB))
                .map_err(|e| e.to_string())?;
            bg_verb.set_value("", &DISPLAY_NAME).map_err(|e| e.to_string())?;
            bg_verb.set_value("Icon", &exe_path).map_err(|e| e.to_string())?;

            let (bg_cmd, _) = hkcu
                .create_subkey(&format!("Software\\Classes\\Directory\\Background\\shell\\{}\\command", VERB))
                .map_err(|e| e.to_string())?;
            bg_cmd.set_value("", &format!("\"{}\" \"%V\"", exe_path)).map_err(|e| e.to_string())?;
        } else {
            // Remove verb registrations
            let _ = hkcu.delete_subkey_all(&format!("Software\\Classes\\Directory\\shell\\{}", VERB));
            let _ = hkcu.delete_subkey_all(&format!("Software\\Classes\\Drive\\shell\\{}", VERB));
            let _ = hkcu.delete_subkey_all(&format!("Software\\Classes\\Directory\\Background\\shell\\{}", VERB));

            // Reset default verb for Directory
            if let Ok(dir_shell) = hkcu.open_subkey_with_flags("Software\\Classes\\Directory\\shell", KEY_READ | KEY_WRITE) {
                let current: String = dir_shell.get_value("").unwrap_or_default();
                if current == VERB {
                    let _ = dir_shell.delete_value("");
                }
            }

            // Reset default verb for Drive
            if let Ok(drive_shell) = hkcu.open_subkey_with_flags("Software\\Classes\\Drive\\shell", KEY_READ | KEY_WRITE) {
                let current: String = drive_shell.get_value("").unwrap_or_default();
                if current == VERB {
                    let _ = drive_shell.delete_value("");
                }
            }
        }

        notify_shell();
        Ok(())
    }

    pub fn add_context_menu_entry() -> Result<(), String> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let exe_path = get_exe_path()?;

        // Directory context menu
        let (dir_verb, _) = hkcu
            .create_subkey(&format!("Software\\Classes\\Directory\\shell\\{}", VERB))
            .map_err(|e| e.to_string())?;
        dir_verb.set_value("", &DISPLAY_NAME).map_err(|e| e.to_string())?;
        dir_verb.set_value("Icon", &exe_path).map_err(|e| e.to_string())?;

        let (dir_cmd, _) = hkcu
            .create_subkey(&format!("Software\\Classes\\Directory\\shell\\{}\\command", VERB))
            .map_err(|e| e.to_string())?;
        dir_cmd.set_value("", &format!("\"{}\" \"%1\"", exe_path)).map_err(|e| e.to_string())?;

        // Drive context menu
        let (drive_verb, _) = hkcu
            .create_subkey(&format!("Software\\Classes\\Drive\\shell\\{}", VERB))
            .map_err(|e| e.to_string())?;
        drive_verb.set_value("", &DISPLAY_NAME).map_err(|e| e.to_string())?;
        drive_verb.set_value("Icon", &exe_path).map_err(|e| e.to_string())?;

        let (drive_cmd, _) = hkcu
            .create_subkey(&format!("Software\\Classes\\Drive\\shell\\{}\\command", VERB))
            .map_err(|e| e.to_string())?;
        drive_cmd.set_value("", &format!("\"{}\" \"%1\"", exe_path)).map_err(|e| e.to_string())?;

        // Background (right-click empty space inside a folder)
        let (bg_verb, _) = hkcu
            .create_subkey(&format!("Software\\Classes\\Directory\\Background\\shell\\{}", VERB))
            .map_err(|e| e.to_string())?;
        bg_verb.set_value("", &DISPLAY_NAME).map_err(|e| e.to_string())?;
        bg_verb.set_value("Icon", &exe_path).map_err(|e| e.to_string())?;

        let (bg_cmd, _) = hkcu
            .create_subkey(&format!("Software\\Classes\\Directory\\Background\\shell\\{}\\command", VERB))
            .map_err(|e| e.to_string())?;
        bg_cmd.set_value("", &format!("\"{}\" \"%V\"", exe_path)).map_err(|e| e.to_string())?;

        notify_shell();
        Ok(())
    }

    pub fn remove_context_menu_entry() -> Result<(), String> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);

        let _ = hkcu.delete_subkey_all(&format!("Software\\Classes\\Directory\\shell\\{}", VERB));
        let _ = hkcu.delete_subkey_all(&format!("Software\\Classes\\Drive\\shell\\{}", VERB));
        let _ = hkcu.delete_subkey_all(&format!("Software\\Classes\\Directory\\Background\\shell\\{}", VERB));

        notify_shell();
        Ok(())
    }

    pub fn get_shell_integration_status() -> Result<ShellIntegrationStatus, String> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);

        // Check if we're the default handler
        let is_default = hkcu
            .open_subkey("Software\\Classes\\Directory\\shell")
            .and_then(|key| key.get_value::<String, _>(""))
            .map(|v| v == VERB)
            .unwrap_or(false);

        // Check if context menu entry exists
        let context_menu = hkcu
            .open_subkey(&format!("Software\\Classes\\Directory\\shell\\{}\\command", VERB))
            .is_ok();

        Ok(ShellIntegrationStatus {
            is_default_handler: is_default,
            context_menu_installed: context_menu,
        })
    }
}

// ── Tauri commands ──────────────────────────────────────────────────────

#[tauri::command]
pub fn set_default_folder_handler(enable: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        windows_impl::set_default_folder_handler(enable)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = enable;
        Err("Setting default folder handler is only supported on Windows".to_string())
    }
}

#[tauri::command]
pub fn add_context_menu_entry() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        windows_impl::add_context_menu_entry()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Context menu integration is only supported on Windows".to_string())
    }
}

#[tauri::command]
pub fn remove_context_menu_entry() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        windows_impl::remove_context_menu_entry()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Context menu integration is only supported on Windows".to_string())
    }
}

#[tauri::command]
pub fn get_shell_integration_status() -> Result<ShellIntegrationStatus, String> {
    #[cfg(target_os = "windows")]
    {
        windows_impl::get_shell_integration_status()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(ShellIntegrationStatus {
            is_default_handler: false,
            context_menu_installed: false,
        })
    }
}
