// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    dotenv::dotenv().ok();

    // Linux: define env vars para compatibilidade com Wayland/WebKit
    #[cfg(target_os = "linux")]
    {
        if std::env::var("GDK_BACKEND").is_err() {
            std::env::set_var("GDK_BACKEND", "x11");
        }
        if std::env::var("WEBKIT_DISABLE_COMPOSITING_MODE").is_err() {
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        }
    }

    project_ham_lib::run();
}
