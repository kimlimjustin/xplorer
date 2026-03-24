use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use std::fs;
use std::path::{Path, PathBuf};
use std::collections::VecDeque;
use tempfile::TempDir;

// ============================================================
// 1. Directory sort: sort_by vs sort_by_cached_key
// ============================================================

fn make_file_names(n: usize) -> Vec<String> {
    (0..n)
        .map(|i| format!("File_{:05}_Document_With_Mixed_CASE.txt", i))
        .collect()
}

fn bench_sort_by_lowercase(c: &mut Criterion) {
    let mut group = c.benchmark_group("directory_sort");
    for size in [100, 1_000, 5_000, 10_000] {
        group.bench_with_input(BenchmarkId::new("sort_by", size), &size, |b, &n| {
            let names = make_file_names(n);
            b.iter(|| {
                let mut v: Vec<(bool, String)> = names
                    .iter()
                    .enumerate()
                    .map(|(i, name)| (i % 5 == 0, name.clone()))
                    .collect();
                v.sort_by(|a, b| {
                    match (a.0, b.0) {
                        (true, false) => std::cmp::Ordering::Less,
                        (false, true) => std::cmp::Ordering::Greater,
                        _ => a.1.to_lowercase().cmp(&b.1.to_lowercase()),
                    }
                });
                black_box(&v);
            });
        });
        group.bench_with_input(BenchmarkId::new("sort_by_cached_key", size), &size, |b, &n| {
            let names = make_file_names(n);
            b.iter(|| {
                let mut v: Vec<(bool, String)> = names
                    .iter()
                    .enumerate()
                    .map(|(i, name)| (i % 5 == 0, name.clone()))
                    .collect();
                v.sort_by_cached_key(|f| (!f.0, f.1.to_lowercase()));
                black_box(&v);
            });
        });
    }
    group.finish();
}

// ============================================================
// 2. get_dir_size: recursive vs iterative
// ============================================================

fn create_nested_dirs(root: &Path, depth: usize, files_per_dir: usize) {
    let mut current = root.to_path_buf();
    for d in 0..depth {
        current = current.join(format!("dir_{}", d));
        fs::create_dir_all(&current).unwrap();
        for f in 0..files_per_dir {
            fs::write(current.join(format!("file_{}.txt", f)), "x".repeat(100)).unwrap();
        }
    }
}

fn recursive_dir_size(dir: &Path) -> (u64, usize, usize) {
    let mut total_size = 0u64;
    let mut file_count = 0usize;
    let mut dir_count = 0usize;

    fn calc(dir: &Path, ts: &mut u64, fc: &mut usize, dc: &mut usize) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    *dc += 1;
                    calc(&path, ts, fc, dc);
                } else {
                    *fc += 1;
                    if let Ok(m) = entry.metadata() {
                        *ts += m.len();
                    }
                }
            }
        }
    }

    calc(dir, &mut total_size, &mut file_count, &mut dir_count);
    (total_size, file_count, dir_count)
}

fn iterative_dir_size(dir: &Path) -> (u64, usize, usize) {
    let mut stack = VecDeque::new();
    stack.push_back(dir.to_path_buf());
    let mut total_size: u64 = 0;
    let mut file_count: usize = 0;
    let mut dir_count: usize = 0;

    while let Some(d) = stack.pop_front() {
        if let Ok(entries) = fs::read_dir(&d) {
            for entry in entries.flatten() {
                if let Ok(ft) = entry.file_type() {
                    if ft.is_dir() {
                        dir_count += 1;
                        stack.push_back(entry.path());
                    } else {
                        file_count += 1;
                        if let Ok(m) = entry.metadata() {
                            total_size += m.len();
                        }
                    }
                }
            }
        }
    }

    (total_size, file_count, dir_count)
}

fn bench_dir_size(c: &mut Criterion) {
    let mut group = c.benchmark_group("dir_size");

    let temp = TempDir::new().unwrap();
    create_nested_dirs(temp.path(), 50, 10);

    group.bench_function("recursive", |b| {
        b.iter(|| black_box(recursive_dir_size(temp.path())));
    });
    group.bench_function("iterative_file_type", |b| {
        b.iter(|| black_box(iterative_dir_size(temp.path())));
    });
    group.finish();
}

// ============================================================
// 3. Cosine similarity: f64-fold vs f32-indexed
// ============================================================

fn cosine_f64_fold(a: &[f32], b: &[f32]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let (dot, mag_a, mag_b) = a.iter().zip(b.iter()).fold(
        (0.0_f64, 0.0_f64, 0.0_f64),
        |(dot, ma, mb), (&x, &y)| {
            let x = x as f64;
            let y = y as f64;
            (dot + x * y, ma + x * x, mb + y * y)
        },
    );
    let denom = mag_a.sqrt() * mag_b.sqrt();
    if denom == 0.0 { 0.0 } else { dot / denom }
}

fn cosine_f32_indexed(a: &[f32], b: &[f32]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let mut dot: f32 = 0.0;
    let mut mag_a: f32 = 0.0;
    let mut mag_b: f32 = 0.0;
    for i in 0..a.len() {
        let x = a[i];
        let y = b[i];
        dot += x * y;
        mag_a += x * x;
        mag_b += y * y;
    }
    let denom = (mag_a.sqrt() * mag_b.sqrt()) as f64;
    if denom == 0.0 { 0.0 } else { (dot as f64) / denom }
}

fn bench_cosine(c: &mut Criterion) {
    let mut group = c.benchmark_group("cosine_similarity");
    for dim in [128, 384, 768] {
        let a: Vec<f32> = (0..dim).map(|i| (i as f32 * 0.01).sin()).collect();
        let b: Vec<f32> = (0..dim).map(|i| (i as f32 * 0.02).cos()).collect();

        group.bench_with_input(BenchmarkId::new("f64_fold", dim), &dim, |bench, _| {
            bench.iter(|| black_box(cosine_f64_fold(&a, &b)));
        });
        group.bench_with_input(BenchmarkId::new("f32_indexed", dim), &dim, |bench, _| {
            bench.iter(|| black_box(cosine_f32_indexed(&a, &b)));
        });
    }
    group.finish();
}

// ============================================================
// 4. Cosine over N vectors (brute-force): measure if it's even slow
// ============================================================

fn bench_brute_force_search(c: &mut Criterion) {
    let mut group = c.benchmark_group("brute_force_vector_search");
    let dim = 384;
    let query: Vec<f32> = (0..dim).map(|i| (i as f32 * 0.01).sin()).collect();

    for n_vectors in [1_000, 10_000, 50_000] {
        let corpus: Vec<Vec<f32>> = (0..n_vectors)
            .map(|j| (0..dim).map(|i| ((i + j) as f32 * 0.003).cos()).collect())
            .collect();

        group.bench_with_input(
            BenchmarkId::new("sequential", n_vectors),
            &n_vectors,
            |b, _| {
                b.iter(|| {
                    let mut best = f64::NEG_INFINITY;
                    for vec in &corpus {
                        let sim = cosine_f64_fold(&query, vec);
                        if sim > best {
                            best = sim;
                        }
                    }
                    black_box(best)
                });
            },
        );
    }
    group.finish();
}

// ============================================================
// 5. walkdir vs jwalk (needs jwalk dep — skip if not available)
//    Instead, benchmark readdir + metadata to see if parallelism helps
// ============================================================

fn bench_readdir_metadata(c: &mut Criterion) {
    let mut group = c.benchmark_group("readdir_metadata");

    // Use the project's own src directory as a real-world test
    let test_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src");
    if !test_dir.exists() {
        return;
    }

    group.bench_function("sequential", |b| {
        b.iter(|| {
            let mut count = 0u64;
            if let Ok(entries) = fs::read_dir(&test_dir) {
                for entry in entries.flatten() {
                    if let Ok(m) = entry.metadata() {
                        count += m.len();
                    }
                }
            }
            black_box(count)
        });
    });
    group.finish();
}

// ============================================================
// 6. FxHashSet vs HashSet for small sets (synonym dedup)
// ============================================================

fn bench_small_set_contains(c: &mut Criterion) {
    use std::collections::HashSet;

    let mut group = c.benchmark_group("small_set_contains");

    let words: Vec<String> = (0..30).map(|i| format!("synonym_{}", i)).collect();
    let lookup = "synonym_15".to_string();

    let std_set: HashSet<String> = words.iter().cloned().collect();
    let vec: Vec<String> = words.clone();

    group.bench_function("vec_contains_30", |b| {
        b.iter(|| black_box(vec.contains(&lookup)));
    });
    group.bench_function("hashset_contains_30", |b| {
        b.iter(|| black_box(std_set.contains(&lookup)));
    });
    group.finish();
}

criterion_group!(
    benches,
    bench_sort_by_lowercase,
    bench_dir_size,
    bench_cosine,
    bench_brute_force_search,
    bench_readdir_metadata,
    bench_small_set_contains,
);
criterion_main!(benches);
