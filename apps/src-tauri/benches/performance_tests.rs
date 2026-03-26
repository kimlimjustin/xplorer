// NOTE: These benchmarks require the `criterion` crate to be added as a
// dev-dependency in Cargo.toml with a [[bench]] section:
//
//   [dev-dependencies]
//   criterion = { version = "0.5", features = ["html_reports"] }
//
//   [[bench]]
//   name = "performance_tests"
//   harness = false
//
// They also require the CURRENT_SCAN_ID to be properly managed for
// DuplicateFinder benchmarks, which may need a public API addition.

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use std::{fs, path::Path};
use tempfile::TempDir;
use xplorer::duplicate_finder::DuplicateFinder;
use xplorer::shortcuts::{manager::*, types::*};

fn create_test_files(dir: &Path, count: usize) {
    for i in 0..count {
        let content = if i % 3 == 0 {
            format!("Duplicate content for group {}", i / 3)
        } else {
            format!("Unique content {}", i)
        };

        fs::write(dir.join(format!("file_{}.txt", i)), content).unwrap();
    }
}

fn benchmark_shortcut_manager_creation(c: &mut Criterion) {
    c.bench_function("shortcut_manager_creation", |b| {
        let temp_dir = TempDir::new().unwrap();
        let shortcuts_dir = temp_dir.path().join("shortcuts");
        fs::create_dir(&shortcuts_dir).unwrap();

        b.iter(|| {
            let _manager = ShortcutsManager::new(black_box(shortcuts_dir.to_str().unwrap()));
        })
    });
}

fn benchmark_shortcut_binding_serialization(c: &mut Criterion) {
    c.bench_function("shortcut_binding_serialization_100", |b| {
        let bindings: Vec<ShortcutBinding> = (0..100)
            .map(|i| ShortcutBinding {
                id: format!("shortcut_{}", i),
                keys: vec!["ctrl".to_string(), format!("f{}", i % 12 + 1)],
                action: ShortcutAction::Copy,
                context: Some("explorer".to_string()),
                enabled: true,
                profile: "default".to_string(),
                description: None,
                global: false,
                key_combination: format!("ctrl+f{}", i % 12 + 1),
            })
            .collect();

        b.iter(|| {
            let json = serde_json::to_string(black_box(&bindings)).unwrap();
            let _: Vec<ShortcutBinding> = serde_json::from_str(&json).unwrap();
        })
    });
}

fn benchmark_duplicate_finder_builder(c: &mut Criterion) {
    c.bench_function("duplicate_finder_builder", |b| {
        b.iter(|| {
            let _finder = DuplicateFinder::new()
                .min_file_size(black_box(1024))
                .max_file_size(black_box(10_000_000))
                .include_hidden(black_box(false))
                .file_extensions(black_box(vec!["txt".into(), "rs".into(), "json".into()]))
                .exclude_paths(black_box(vec![
                    std::path::PathBuf::from("node_modules"),
                    std::path::PathBuf::from(".git"),
                ]));
        })
    });
}

criterion_group!(
    benches,
    benchmark_shortcut_manager_creation,
    benchmark_shortcut_binding_serialization,
    benchmark_duplicate_finder_builder,
);
criterion_main!(benches);
