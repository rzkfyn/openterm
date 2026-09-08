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

#[test]
fn test_saved_connection_with_folder_and_bookmarks() {
    let conn = openterm_lib::storage::SavedConnection {
        id: "test-id".into(),
        name: "Web Server".into(),
        host: "10.0.0.1".into(),
        port: 22,
        username: "admin".into(),
        auth_type: openterm_lib::models::AuthType::Password,
        private_key_path: None,
        password: Some("secret".into()),
        passphrase: None,
        folder: Some("Production/Web".into()),
        bookmarks: vec![
            openterm_lib::storage::ConnectionBookmark {
                id: "bm-1".into(),
                name: "Nginx logs".into(),
                local_path: Some("C:\\logs".into()),
                remote_path: Some("/var/log/nginx".into()),
            }
        ],
        created_at: 1000,
        updated_at: 2000,
    };

    let json = serde_json::to_string(&conn).expect("serialize");
    assert!(json.contains("\"folder\":\"Production/Web\""));
    assert!(json.contains("\"bookmarks\":["));

    let deserialized: openterm_lib::storage::SavedConnection = serde_json::from_str(&json).expect("deserialize");
    assert_eq!(deserialized.folder, Some("Production/Web".into()));
    assert_eq!(deserialized.bookmarks.len(), 1);
    assert_eq!(deserialized.bookmarks[0].name, "Nginx logs");
}

#[test]
fn test_saved_connection_serde_defaults() {
    // Simulates an imported profile where id, createdAt, updatedAt are omitted
    let minimal_json = r#"{
        "name": "Imported Server",
        "host": "192.168.1.50",
        "port": 22,
        "username": "root",
        "authType": "password"
    }"#;

    let parsed: openterm_lib::storage::SavedConnection = serde_json::from_str(minimal_json).expect("should deserialize with defaults");
    assert!(!parsed.id.is_empty());
    assert_eq!(parsed.name, "Imported Server");
    assert_eq!(parsed.host, "192.168.1.50");
    assert_eq!(parsed.created_at, 0);
    assert_eq!(parsed.updated_at, 0);
    assert_eq!(parsed.bookmarks.len(), 0);
    assert!(parsed.folder.is_none());
}


