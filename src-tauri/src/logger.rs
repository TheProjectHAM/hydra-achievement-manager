use chrono::Local;
use tauri_plugin_log::{Builder, Target, TargetKind};

fn supports_color() -> bool {
    std::env::var_os("NO_COLOR").is_none()
        && matches!(std::env::var("TERM"), Ok(term) if term != "dumb")
}

fn level_badge(level: log::Level) -> &'static str {
    match level {
        log::Level::Error => "ERROR",
        log::Level::Warn => "WARN",
        log::Level::Info => "INFO",
        log::Level::Debug => "DEBUG",
        log::Level::Trace => "TRACE",
    }
}

fn level_color(level: log::Level) -> &'static str {
    match level {
        log::Level::Error => "\x1b[31m",
        log::Level::Warn => "\x1b[33m",
        log::Level::Info => "\x1b[32m",
        log::Level::Debug => "\x1b[36m",
        log::Level::Trace => "\x1b[90m",
    }
}

fn level_style(level: log::Level) -> &'static str {
    match level {
        log::Level::Error => "\x1b[1;31m",
        log::Level::Warn => "\x1b[1;33m",
        log::Level::Info => "\x1b[1;32m",
        log::Level::Debug => "\x1b[1;36m",
        log::Level::Trace => "\x1b[1;90m",
    }
}

fn display_target(target: &str) -> String {
    let leaf = target.rsplit("::").next().unwrap_or(target);
    leaf.split('_')
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn build() -> Builder {
    Builder::new()
        .targets([
            Target::new(TargetKind::Stdout),
            Target::new(TargetKind::LogDir { file_name: None }),
            Target::new(TargetKind::Webview),
        ])
        .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
        .level(log::LevelFilter::Info)
        .format(|out, message, record| {
            let timestamp = Local::now().format("%d/%m/%Y %H:%M:%S");
            let target = display_target(record.target());
            let reset = if supports_color() { "\x1b[0m" } else { "" };
            let color = if supports_color() { level_color(record.level()) } else { "" };
            let style = if supports_color() { level_style(record.level()) } else { "" };

            let line = format!(
                "{color}{timestamp}{reset} {sep} {style}[{badge}]{reset} {sep} {target:<20} {sep} {message}{reset}",
                timestamp = timestamp,
                badge = level_badge(record.level()),
                target = target,
                message = message,
                color = color,
                style = style,
                sep = if supports_color() { "\x1b[90m|\x1b[0m" } else { "|" },
                reset = reset,
            );

            out.finish(format_args!("{line}"));
        })
}
