use openterm_lib::local_fs::read_local_dir;

#[test]
fn test_read_local_dir() {
    let result = read_local_dir(".", 0, 10).expect("should read current directory");
    assert!(result.total > 0);
    assert!(!result.entries.is_empty());
    assert!(result.entries.iter().any(|e| e.name == "Cargo.toml"));
}

#[test]
fn test_pagination_boundary() {
    let result = read_local_dir(".", 0, 1).expect("should read 1 item");
    assert_eq!(result.entries.len(), 1);
    if result.total > 1 {
        assert!(result.has_more);
    }
}
