fn main() {
    #[cfg(target_os = "windows")]
    {
        let strawberry_paths = [
            r"C:\Strawberry\c\bin",
            r"C:\Strawberry\perl\site\bin",
            r"C:\Strawberry\perl\bin",
        ];
        if let Ok(current_path) = std::env::var("PATH") {
            let mut new_path = current_path;
            for p in &strawberry_paths {
                if std::path::Path::new(p).exists() && !new_path.contains(p) {
                    new_path = format!("{};{}", p, new_path);
                }
            }
            std::env::set_var("PATH", new_path);
        }
    }

    tauri_build::build()
}
