// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json;
use tauri::{Emitter, Manager, WindowEvent};
use tracing::warn;

// All modules are declared in lib.rs (the `xplorer` library crate).
// Import them here so the binary can register Tauri commands.
use xplorer::agent;
use xplorer::ai;
use xplorer::api;
use xplorer::duplicate_finder;
use xplorer::extensions;
use xplorer::file_organizer;
use xplorer::file_watcher;
use xplorer::git_history;
use xplorer::google_drive;
use xplorer::operations;
use xplorer::shortcuts;
use xplorer::storage;
use xplorer::watcher;
// git_integration is consolidated into git_history
use xplorer::audit_log;
use xplorer::backup;
use xplorer::file_versions;
use xplorer::sync;

fn main() {
    // Load environment variables from .env file
    dotenvy::dotenv().ok();

    // Initialize structured logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("xplorer=info,warn")),
        )
        .with_target(true)
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_drag::init())
        .setup(|app| {
            // Initialize progress manager
            let progress_manager =
                operations::ProgressManager::new().with_app_handle(app.handle().clone());
            app.manage(std::sync::Arc::new(progress_manager));

            // Initialize shortcuts manager
            shortcuts::init_shortcuts_manager("shortcuts");

            // Initialize extension manager using app data directory
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("./data"));
            std::fs::create_dir_all(&app_data_dir).unwrap_or_default();
            let extensions_dir = app_data_dir.join("extensions");
            std::fs::create_dir_all(&extensions_dir).unwrap_or_default();

            // Migration: rename old-style seeded directories whose directory name
            // differs from their manifest.id (e.g. "code-editor-extension" → "code-editor").
            // If a correctly-named copy already exists, remove the old-named duplicate.
            if let Ok(entries) = std::fs::read_dir(&extensions_dir) {
                let mut actions: Vec<(std::path::PathBuf, String)> = Vec::new(); // (old_path, manifest_id)
                for entry in entries.flatten() {
                    let path = entry.path();
                    if !path.is_dir() {
                        continue;
                    }
                    let dir_name = entry.file_name().to_string_lossy().to_string();
                    let pkg_path = path.join("package.json");
                    if let Ok(raw) = std::fs::read_to_string(&pkg_path) {
                        if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&raw) {
                            if let Some(id) = pkg
                                .get("xplorer")
                                .and_then(|x| x.get("id"))
                                .and_then(|v| v.as_str())
                            {
                                if dir_name != id {
                                    actions.push((path.clone(), id.to_string()));
                                }
                            }
                        }
                    }
                }
                for (old_path, manifest_id) in actions {
                    let correct_path = extensions_dir.join(&manifest_id);
                    if correct_path.exists() {
                        // Correctly-named copy already exists — remove the misnamed duplicate
                        let _ = std::fs::remove_dir_all(&old_path);
                    } else {
                        // Rename the misnamed directory to use manifest.id
                        let _ = std::fs::rename(&old_path, &correct_path);
                    }
                }
            }

            extensions::init_extension_manager(app_data_dir.to_str().unwrap_or("./data"));

            // Check CLI args for .xtension file association opens
            let handle = app.handle().clone();
            let args: Vec<String> = std::env::args().collect();
            for arg in &args[1..] {
                if arg.ends_with(".xtension") && std::path::Path::new(arg).exists() {
                    let xtension_path = arg.to_string();
                    let handle_clone = handle.clone();
                    // Emit event to frontend after window is ready
                    tauri::async_runtime::spawn(async move {
                        // Small delay to ensure the frontend is ready to listen
                        tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
                        let _ = handle_clone.emit("xtension-file-opened", &xtension_path);
                    });
                    break; // Only handle the first .xtension file
                }
            }

            // Check CLI args for folder path (opened via "Open with Xplorer" or set-as-default)
            for arg in &args[1..] {
                let path = std::path::Path::new(arg);
                if path.is_dir() {
                    let folder_path = arg.to_string();
                    let handle_clone2 = handle.clone();
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
                        let _ = handle_clone2.emit("folder-opened", &folder_path);
                    });
                    break;
                }
            }

            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                } else {
                    warn!("[Xplorer] could not find 'main' webview window to open devtools");
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // File system operations (modular)
            operations::read_directory,
            operations::read_text_file,
            operations::read_binary_file,
            operations::get_file_properties,
            operations::get_file_meta_data,
            operations::copy,
            operations::copy_with_progress,
            operations::accelerated_copy_file,
            operations::accelerated_copy_directory,
            operations::move_file,
            operations::move_with_progress,
            operations::rename,
            operations::remove_dir,
            operations::remove_file,
            operations::move_to_trash,
            operations::open_recycle_bin,
            operations::get_trash_items,
            operations::restore_trash_item,
            operations::empty_recycle_bin,
            operations::permanently_delete_trash_item,
            // Properties operations
            operations::get_detailed_file_properties,
            operations::get_directory_size,
            operations::get_directory_item_count,
            operations::set_file_permissions,
            // AI Agent operations
            operations::agent_read_file_tree,
            operations::agent_request_write_permission,
            operations::agent_write_file_with_permission,
            operations::is_dir,
            operations::get_files_in_directory,
            operations::open_file,
            operations::file_exist,
            operations::create_dir_recursive,
            operations::create_file,
            operations::create_file_with_content,
            operations::bulk_rename,
            operations::open_in_terminal,
            operations::execute_command,
            operations::execute_command_stream,
            operations::get_current_shell,
            operations::find_files,
            operations::search_in_files,
            operations::get_app_version,
            operations::show_in_folder,
            operations::list_drives,
            operations::eject_volume,
            operations::get_dir_size,
            // AI operations
            ai::get_ai_models,
            ai::check_ollama_status,
            ai::chat_with_ai,
            ai::analyze_file_with_ai,
            ai::get_file_help,
            ai::calculate_folder_size,
            ai::get_cached_folder_sizes,
            ai::clear_folder_size_cache,
            ai::get_user_directories,
            ai::get_recent_folders,
            ai::add_to_recent_folders,
            ai::get_system_info,
            // AI-powered rename & auto-tag
            ai::suggest_filename,
            ai::auto_tag_files,
            // Undo/Redo
            operations::undo_redo_ops::undo_operation,
            operations::undo_redo_ops::redo_operation,
            operations::undo_redo_ops::get_undo_history,
            operations::undo_redo_ops::clear_undo_history,
            // File templates
            operations::file_ops::get_file_templates,
            operations::file_ops::create_from_template,
            // Conflict resolution
            operations::file_ops::check_conflicts,
            operations::file_ops::get_rename_destination,
            // Disk usage treemap
            operations::file_ops::get_directory_sizes,
            // Symlink creation
            operations::file_ops::create_symlink,
            // API operations (migrated from server)
            api::get_files,
            api::get_file_tree,
            api::get_file_by_id,
            api::get_file_content,
            api::create_file_record,
            api::delete_file_record,
            api::get_all_tags,
            api::get_files_by_tag,
            api::update_file_tags,
            api::update_file_color,
            api::get_extensions,
            api::get_active_extensions,
            api::create_extension,
            api::install_extension,
            api::uninstall_extension,
            api::delete_extension,
            api::get_chat_messages,
            api::create_chat_message,
            api::get_user_settings,
            api::update_user_settings,
            // Native plugin invoke (for extensions with native code)
            extensions::native_plugin_invoke,
            // Search engine v2 (replaces old tokenizer commands)
            xplorer::search::compat::set_tokenizer_settings,
            xplorer::search::compat::get_tokenizer_settings,
            xplorer::search::compat::rebuild_token_index,
            xplorer::search::compat::search_tokens,
            xplorer::search::compat::natural_language_search,
            xplorer::search::compat::get_tokenizer_stats,
            xplorer::search::compat::is_tokenizer_indexing,
            xplorer::search::compat::get_file_tokens,
            xplorer::search::compat::add_path_to_tokenizer,
            xplorer::search::compat::get_file_recommendations,
            xplorer::search::compat::parse_search_query,
            xplorer::search::compat::enhanced_search,
            // Auto-index and context-aware search
            xplorer::search::compat::index_directory,
            xplorer::search::compat::set_search_context,
            xplorer::search::compat::add_whitelisted_path,
            xplorer::search::compat::ai_search,
            // AI indexing (new search engine v2 pipeline)
            xplorer::search::compat::get_ai_index_status,
            xplorer::search::compat::trigger_ai_indexing,
            xplorer::search::compat::get_ai_index_entry,
            // Semantic / hybrid search (new search engine v2 pipeline)
            xplorer::search::compat::semantic_search,
            xplorer::search::compat::find_similar_files,
            xplorer::search::compat::hybrid_search,
            // Shortcut operations
            shortcuts::get_shortcuts,
            shortcuts::get_shortcuts_by_category,
            shortcuts::add_shortcut,
            shortcuts::update_shortcut,
            shortcuts::remove_shortcut,
            shortcuts::get_shortcut_profiles,
            shortcuts::switch_shortcut_profile,
            shortcuts::get_shortcut_settings,
            shortcuts::update_shortcut_settings,
            shortcuts::execute_shortcut_action,
            shortcuts::register_extension_shortcut,
            shortcuts::unregister_extension_shortcuts,
            shortcuts::register_global_shortcuts,
            shortcuts::unregister_global_shortcuts,
            shortcuts::toggle_global_shortcuts,
            shortcuts::reset_shortcuts,
            shortcuts::reset_single_shortcut,
            // Duplicate finder operations
            duplicate_finder::find_duplicates,
            duplicate_finder::cancel_duplicate_scan,
            duplicate_finder::delete_duplicate_files,
            duplicate_finder::move_duplicate_files_to_trash,
            // Extension operations (from extensions module)
            extensions::get_installed_extensions,
            extensions::install_extension_from_path,
            extensions::uninstall_extension_by_id,
            extensions::activate_extension,
            extensions::deactivate_extension,
            extensions::get_extension_permissions,
            extensions::get_active_extension_ids,
            extensions::validate_extension_path,
            extensions::download_and_install_extension,
            extensions::check_for_extension_updates,
            extensions::download_extension,
            extensions::check_extension_updates,
            extensions::pack_extension,
            extensions::install_xtension_file,
            extensions::inspect_xtension_file,
            // WASM backend operations
            extensions::extension_backend_call,
            extensions::extension_backend_status,
            // Git history operations
            git_history::find_git_repository,
            git_history::get_repository_info,
            git_history::get_file_history,
            git_history::get_file_blame,
            git_history::get_file_diff,
            git_history::get_commit_diff,
            git_history::get_file_status,
            git_history::get_branches,
            git_history::create_branch,
            git_history::switch_branch,
            git_history::delete_branch,
            git_history::stage_file,
            git_history::unstage_file,
            git_history::commit_changes,
            git_history::get_stashes,
            git_history::create_stash,
            git_history::apply_stash,
            git_history::drop_stash,
            git_history::get_all_commits,
            // File comparison operations
            operations::compute_file_hash,
            operations::compare_files,
            // File association operations
            operations::get_file_associations,
            operations::open_file_with_application,
            operations::get_system_applications,
            operations::set_default_application,
            // Compression operations
            operations::compress_files,
            operations::get_compression_info,
            // Extraction operations
            operations::extract_archive,
            operations::extract_selected_entries,
            operations::get_archive_info,
            operations::is_archive,
            // File organizer operations
            file_organizer::analyze_directory,
            file_organizer::preview_organization,
            file_organizer::execute_organization,
            // Claude Agent operations
            agent::agent_chat,
            agent::agent_respond_approval,
            agent::agent_cancel_session,
            agent::get_agent_settings,
            agent::update_agent_settings,
            agent::update_agent_api_keys,
            agent::agent_approve_plan,
            agent::agent_get_plan,
            agent::get_agent_memory,
            agent::clear_agent_memory,
            agent::delete_agent_memory,
            agent::get_agent_permissions,
            agent::update_agent_permissions,
            // Recent files operations
            storage::add_recent_file,
            storage::get_recent_files,
            storage::clear_recent_files,
            storage::remove_recent_file,
            // Bookmark operations
            storage::get_bookmarks,
            storage::add_bookmark,
            storage::remove_bookmark,
            storage::update_bookmark_name,
            // File tags operations
            storage::get_file_tags,
            storage::set_file_tags,
            storage::get_all_file_tags,
            storage::get_file_tags_batch,
            storage::remove_all_tags_from_file,
            storage::remove_tag_globally,
            // Batch tag operations
            storage::batch_add_tags,
            storage::batch_remove_tags,
            // Notes operations
            storage::get_file_notes,
            storage::add_file_note,
            storage::update_file_note,
            storage::delete_file_note,
            storage::get_all_notes,
            storage::search_notes,
            // Batch notes operations
            storage::batch_set_notes,
            // Annotation operations
            storage::get_file_annotations,
            storage::add_file_annotation,
            storage::toggle_annotation_resolved,
            storage::delete_file_annotation,
            storage::get_all_annotations,
            // Tag category operations
            storage::get_tag_categories,
            storage::add_tag_category,
            storage::update_tag_category,
            storage::delete_tag_category,
            // Custom metadata operations
            storage::get_file_metadata,
            storage::set_file_metadata,
            storage::get_all_metadata_keys,
            // Chat history operations
            storage::get_chat_sessions,
            storage::get_chat_session,
            storage::save_chat_session,
            storage::delete_chat_session,
            storage::clear_chat_history,
            // Extension-scoped storage operations
            storage::get_extension_storage,
            storage::set_extension_storage,
            storage::delete_extension_storage,
            // Chat-as-Files operations
            storage::chat_files::get_chats_directory,
            storage::chat_files::create_chat_file,
            storage::chat_files::read_chat_file,
            storage::chat_files::save_chat_file,
            storage::chat_files::get_chat_file_summary,
            // Storage analytics operations
            operations::analyze_storage,
            // Directory diagnostics
            operations::diagnose_directory,
            // Encryption operations
            operations::encrypt_file,
            operations::decrypt_file,
            operations::is_encrypted_file,
            // Secure delete operations
            operations::secure_delete,
            // Image processing operations
            operations::resize_image,
            operations::convert_image,
            operations::get_image_info,
            operations::batch_process_images,
            operations::rotate_image,
            operations::flip_image,
            operations::crop_image,
            operations::adjust_brightness,
            operations::adjust_contrast,
            operations::grayscale_image,
            // Google Drive operations
            google_drive::gdrive_authenticate,
            google_drive::gdrive_disconnect,
            google_drive::gdrive_list_accounts,
            google_drive::gdrive_list_files,
            google_drive::gdrive_download_file,
            google_drive::gdrive_upload_file,
            google_drive::gdrive_delete_file,
            google_drive::gdrive_rename_file,
            google_drive::gdrive_move_file,
            google_drive::gdrive_create_folder,
            google_drive::gdrive_get_file_content,
            google_drive::get_gdrive_settings,
            google_drive::update_gdrive_settings,
            // File watcher operations
            watcher::start_watching,
            watcher::stop_watching,
            // File watcher operations (multi-watcher)
            file_watcher::watch_directory,
            file_watcher::unwatch_directory,
            file_watcher::get_active_watchers,
            // SQLite database operations
            operations::database_ops::list_sqlite_tables,
            operations::database_ops::get_sqlite_table_columns,
            operations::database_ops::query_sqlite_table,
            operations::database_ops::execute_sqlite_query,
            // Git integration (consolidated into git_history)
            git_history::get_git_status,
            git_history::get_git_repo_info,
            // Audit log operations
            audit_log::get_audit_log,
            audit_log::clear_audit_log,
            audit_log::export_audit_log,
            // Backup operations
            backup::create_backup,
            backup::list_backups,
            backup::restore_backup,
            backup::delete_backup,
            // Docker operations
            operations::docker_ops::docker_is_available,
            operations::docker_ops::docker_list_containers,
            operations::docker_ops::docker_list_images,
            operations::docker_ops::docker_start_container,
            operations::docker_ops::docker_stop_container,
            operations::docker_ops::docker_remove_container,
            operations::docker_ops::docker_remove_image,
            operations::docker_ops::docker_container_logs,
            // Shell integration operations (Windows registry)
            operations::set_default_folder_handler,
            operations::add_context_menu_entry,
            operations::remove_context_menu_entry,
            operations::get_shell_integration_status,
            // File versioning operations
            file_versions::enable_versioning,
            file_versions::disable_versioning,
            file_versions::create_version,
            file_versions::list_versions,
            file_versions::restore_version,
            file_versions::delete_version,
            file_versions::get_versioning_config,
            file_versions::update_versioning_config,
            file_versions::is_versioning_enabled,
            file_versions::get_version_count,
            file_versions::delete_all_versions,
            file_versions::read_version_content,
            // Cloud sync operations
            sync::sync_bookmarks_to_cloud,
            sync::sync_tags_to_cloud,
            sync::fetch_cloud_bookmarks,
            sync::fetch_cloud_tags,
            sync::set_last_sync_time,
            sync::get_last_sync_time,
            sync::sync_all,
            sync::auto_sync_on_startup,
            sync::start_auto_sync,
            sync::stop_auto_sync,
            sync::get_auto_sync_status,
        ])
        .on_window_event(|_window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                duplicate_finder::cancel_current_scan();
                watcher::stop_watcher();
                file_watcher::stop_all_watchers();
                sync::stop_auto_sync_blocking();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
