use serde::{Deserialize, Serialize};

// Permission definitions
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ExtensionPermission {
    // File system permissions
    FileRead,
    FileWrite,
    FileDelete,
    FileExecute,
    DirectoryCreate,
    DirectoryDelete,
    DirectoryList,
    
    // UI permissions
    ShowNotifications,
    CreatePanels,
    ModifyUI,
    AccessClipboard,
    
    // System permissions
    ExecuteCommands,
    NetworkAccess,
    SystemInfo,
    
    // Native plugin permissions
    NativeInvoke,

    // Storage permissions
    StorageRead,
    StorageWrite,

    // Search permissions
    SearchRead,
    SearchDuplicates,

    // AI permissions
    AIRead,
    AIChat,

    // Git permissions
    GitRead,
    GitWrite,

    // Google Drive permissions
    GDriveAccess,

    // Xplorer-specific permissions
    AccessSettings,
    ModifyThemes,
    AccessHistory,
    AccessExtensions,
}

impl ExtensionPermission {
    pub fn from_string(s: &str) -> Option<Self> {
        match s {
            "file:read" => Some(Self::FileRead),
            "file:write" => Some(Self::FileWrite),
            "file:delete" => Some(Self::FileDelete),
            "file:execute" => Some(Self::FileExecute),
            "directory:create" => Some(Self::DirectoryCreate),
            "directory:delete" => Some(Self::DirectoryDelete),
            "directory:list" => Some(Self::DirectoryList),
            "ui:notifications" => Some(Self::ShowNotifications),
            "ui:panels" => Some(Self::CreatePanels),
            "ui:modify" => Some(Self::ModifyUI),
            "ui:clipboard" => Some(Self::AccessClipboard),
            "system:commands" => Some(Self::ExecuteCommands),
            "system:network" => Some(Self::NetworkAccess),
            "system:info" => Some(Self::SystemInfo),
            "native:invoke" => Some(Self::NativeInvoke),
            "storage:read" => Some(Self::StorageRead),
            "storage:write" => Some(Self::StorageWrite),
            "search:read" => Some(Self::SearchRead),
            "search:duplicates" => Some(Self::SearchDuplicates),
            "ai:read" => Some(Self::AIRead),
            "ai:chat" => Some(Self::AIChat),
            "git:read" => Some(Self::GitRead),
            "git:write" => Some(Self::GitWrite),
            "gdrive:access" => Some(Self::GDriveAccess),
            "xplorer:settings" => Some(Self::AccessSettings),
            "xplorer:themes" => Some(Self::ModifyThemes),
            "xplorer:history" => Some(Self::AccessHistory),
            "xplorer:extensions" => Some(Self::AccessExtensions),
            _ => None,
        }
    }
}