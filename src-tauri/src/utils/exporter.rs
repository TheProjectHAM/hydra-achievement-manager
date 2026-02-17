use crate::api::HydraAPI;
use crate::models::ExportProgress;
use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

pub struct AchievementExporter;

impl AchievementExporter {
    /// Exporta achievements para um diretório
    pub async fn export_achievements(
        game_id: &str,
        export_dir: PathBuf,
        language: &str,
        app_handle: &AppHandle,
    ) -> Result<()> {
        let images_dir = export_dir.join("images");
        fs::create_dir_all(&images_dir).context("Failed to create images directory")?;

        // Mapeia linguagem
        let hydra_language = match language {
            "en-US" => "en",
            "es-ES" => "es",
            "ru-RU" => "ru",
            "pt-BR" => "pt",
            _ => "en",
        };

        // Busca achievements
        let game_achievements = HydraAPI::get_game_achievements(game_id, Some(hydra_language))
            .await
            .context("Failed to fetch achievements from Hydra API")?;

        for (index, ach) in game_achievements.achievements.iter().enumerate() {
            let index_num = index + 1;

            // Emite progresso
            let progress = ExportProgress {
                current: index_num,
                total: game_achievements.achievements.len(),
                name: ach.display_name.clone(),
                icon: ach.icon.clone(),
            };

            if let Err(e) = app_handle.emit("export-progress", progress) {
                log::error!("Failed to emit export progress: {}", e);
            }

            // Download ícone normal usando reqwest
            let icon_url = ach.icon.clone();
            let gray_icon_url = ach.icongray.clone();

            let client = crate::utils::http::get_client()
                .map_err(|e| anyhow::anyhow!("Failed to create HTTP client: {}", e))?;

            let response = client
                .get(&icon_url)
                .send()
                .await
                .map_err(|e| anyhow::anyhow!("Failed to download icon: {}", e))?;

            let normal_bytes = response
                .bytes()
                .await
                .map_err(|e| anyhow::anyhow!("Failed to read icon bytes: {}", e))?;

            let normal_path = images_dir.join(format!("{}.jpg", index_num));
            fs::write(&normal_path, &normal_bytes).context("Failed to write normal icon")?;

            // Gera ícone gray usando image crate
            let gray_path = images_dir.join(format!("{}_gray.jpg", index_num));

            match image::load_from_memory(&normal_bytes) {
                Ok(img) => {
                    let gray_img = img.grayscale();
                    gray_img
                        .save(&gray_path)
                        .context("Failed to save gray icon")?;
                }
                Err(e) => {
                    log::error!("Failed to generate gray icon: {}", e);
                    // Fallback: tenta baixar ícone gray
                    let fallback_client = crate::utils::http::get_client().ok();
                    if let Some(fb_client) = fallback_client {
                        if let Ok(gray_response) = fb_client.get(&gray_icon_url).send().await {
                            if let Ok(gray_bytes) = gray_response.bytes().await {
                                let _ = fs::write(&gray_path, &gray_bytes);
                            }
                        }
                    }
                }
            }

            // Adiciona ao JSON (isso é feito pelo chamador no comandos/mod.rs se estivéssemos coletando,
            // mas aqui estamos construindo uma lista local json_data para salvar no final da função)
        }

        // Reconstruindo a lógica de json_data que estava no loop
        let mut json_data = Vec::new();
        for (index, ach) in game_achievements.achievements.iter().enumerate() {
            let index_num = index + 1;
            json_data.push(serde_json::json!({
                "name": ach.name,
                "displayName": ach.display_name,
                "description": ach.description,
                "hidden": if ach.hidden { 1 } else { 0 },
                "icon": format!("images/{}.jpg", index_num),
                "icongray": format!("images/{}_gray.jpg", index_num)
            }));
        }

        // Salva JSON
        let json_path = export_dir.join("achievements.json");
        let json_string =
            serde_json::to_string_pretty(&json_data).context("Failed to serialize JSON")?;
        fs::write(&json_path, json_string).context("Failed to write JSON file")?;

        log::info!(
            "Achievements exported successfully to: {}",
            export_dir.display()
        );
        Ok(())
    }
}
