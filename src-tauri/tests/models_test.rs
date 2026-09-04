use openterm_lib::models::*;

#[test]
fn test_models_serialization() {
    let file = FileEntry {
        name: "test.txt".to_string(),
        path: "/var/log/test.txt".to_string(),
        size: 1024,
        is_dir: false,
        is_symlink: false,
        modified: Some(1725450000),
        permissions: Some(0o644),
    };

    let serialized = serde_json::to_string(&file).expect("should serialize");
    assert!(serialized.contains("\"isDir\":false"));
    assert!(serialized.contains("\"size\":1024"));

    let deserialized: FileEntry = serde_json::from_str(&serialized).expect("should deserialize");
    assert_eq!(deserialized, file);
}

#[test]
fn test_paginated_entries() {
    let page = PaginatedEntries {
        path: "/etc".to_string(),
        entries: vec![],
        total: 50,
        offset: 0,
        limit: 20,
        has_more: true,
    };

    let serialized = serde_json::to_string(&page).unwrap();
    assert!(serialized.contains("\"hasMore\":true"));
}
