use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HydraLibraryGame {
    pub object_id: String,
    pub title: String,
    pub shop: String,
    pub icon_url: Option<String>,
    pub library_hero_image_url: Option<String>,
    pub logo_image_url: Option<String>,
    pub last_time_played: Option<String>,
    pub play_time_in_milliseconds: Option<u64>,
    pub achievement_count: Option<u32>,
    pub unlocked_achievement_count: Option<u32>,
    pub is_deleted: bool,
    pub favorite: bool,
    pub is_pinned: bool,
    pub added_to_library_at: Option<String>,
}

const FOOTER_SIZE: usize = 48;
const BLOCK_TRAILER_SIZE: usize = 5; // 1 byte compress type + 4 bytes crc32

fn resolve_hydra_db_path(custom_path: Option<&str>) -> Option<PathBuf> {
    if let Some(path) = custom_path {
        let p = PathBuf::from(path);
        if p.exists() {
            return Some(p);
        }
    }
    dirs::config_dir().map(|dir| dir.join("hydralauncher").join("hydra-db"))
}

fn read_u32_le(data: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]])
}

fn decode_varint(data: &[u8], pos: &mut usize) -> Option<u64> {
    let mut result: u64 = 0;
    let mut shift = 0;
    loop {
        if *pos >= data.len() {
            return None;
        }
        let byte = data[*pos];
        *pos += 1;
        result |= ((byte & 0x7f) as u64) << shift;
        if byte & 0x80 == 0 {
            return Some(result);
        }
        shift += 7;
        if shift >= 64 {
            return None;
        }
    }
}

fn decompress_block(data: &[u8]) -> Result<Vec<u8>, String> {
    if data.is_empty() {
        return Ok(Vec::new());
    }
    let compress_type = data[data.len() - 5];
    let body = &data[..data.len() - 5];
    match compress_type {
        0 => Ok(body.to_vec()),
        1 => {
            let mut decoder = snap::raw::Decoder::new();
            let mut decompressed = vec![0u8; body.len() * 6];
            match decoder.decompress(body, &mut decompressed) {
                Ok(n) => { decompressed.truncate(n); Ok(decompressed) }
                Err(e) => Err(format!("Snappy decompress failed: {}", e)),
            }
        }
        t => Err(format!("Unknown compress type: {}", t)),
    }
}

fn read_data_block(block_data: &[u8]) -> Result<Vec<(Vec<u8>, Vec<u8>)>, String> {
    let decompressed = decompress_block(block_data)?;
    if decompressed.len() < 4 {
        return Ok(Vec::new());
    }

    let len = decompressed.len();
    let num_restarts = read_u32_le(&decompressed, len - 4) as usize;
    let restarts_size = num_restarts * 4;
    if len < 4 + restarts_size {
        return Ok(Vec::new());
    }

    let restarts_start = len - 4 - restarts_size;
    let entries_data = &decompressed[..restarts_start];

    let mut pos = 0;
    let mut entries = Vec::new();
    let mut prev_key = Vec::new();

    while pos < entries_data.len() {
        let shared = decode_varint(entries_data, &mut pos)
            .ok_or("Failed to read shared varint")? as usize;
        let non_shared = decode_varint(entries_data, &mut pos)
            .ok_or("Failed to read non_shared varint")? as usize;
        let value_len = decode_varint(entries_data, &mut pos)
            .ok_or("Failed to read value_len varint")? as usize;

        if pos + non_shared + value_len > entries_data.len() {
            break;
        }

        let key_suffix = &entries_data[pos..pos + non_shared];
        pos += non_shared;
        let value = &entries_data[pos..pos + value_len];
        pos += value_len;

        let mut key = Vec::with_capacity(shared + non_shared);
        key.extend_from_slice(&prev_key[..shared]);
        key.extend_from_slice(key_suffix);

        entries.push((key.clone(), value.to_vec()));
        prev_key = key;
    }

    Ok(entries)
}

fn read_ldb_file(path: &Path) -> Result<BTreeMap<Vec<u8>, Vec<u8>>, String> {
    let data = std::fs::read(path)
        .map_err(|e| format!("Failed to read {:?}: {}", path, e))?;

    if data.len() < FOOTER_SIZE {
        return Ok(BTreeMap::new());
    }

    // Parse footer: LevelDB stores metaindex and index handles as varint pairs
    // starting from byte 0, padded to 40 bytes, followed by 8-byte magic number
    let footer = &data[data.len() - FOOTER_SIZE..];

    let mut fpos = 0;
    let _meta_offset = decode_varint(footer, &mut fpos).unwrap_or(0) as usize;
    let _meta_size = decode_varint(footer, &mut fpos).unwrap_or(0) as usize;
    let index_offset = decode_varint(footer, &mut fpos).unwrap_or(0) as usize;
    let index_size = decode_varint(footer, &mut fpos).unwrap_or(0) as usize;

    if index_offset + index_size + BLOCK_TRAILER_SIZE > data.len() {
        return Ok(BTreeMap::new());
    }

    // Read index block (including 5-byte trailer)
    let index_end = (index_offset + index_size + BLOCK_TRAILER_SIZE).min(data.len());
    let index_block = &data[index_offset..index_end];
    let decompressed_index = decompress_block(index_block).unwrap_or_else(|_| index_block.to_vec());

    // Parse index entries to get data block offsets/sizes
    // Index block uses the same format as data blocks
    let mut block_handles: Vec<(usize, usize)> = Vec::new();

    if decompressed_index.len() >= 4 {
        let num_restarts_idx = read_u32_le(&decompressed_index, decompressed_index.len() - 4) as usize;
        let restarts_size_idx = num_restarts_idx * 4;
        if decompressed_index.len() >= 4 + restarts_size_idx {
            let entries_data = &decompressed_index[..decompressed_index.len() - 4 - restarts_size_idx];

            let mut idx_pos = 0;
            let mut prev_key = Vec::new();

            while idx_pos < entries_data.len() {
                let shared = decode_varint(entries_data, &mut idx_pos).unwrap_or(0) as usize;
                let non_shared = decode_varint(entries_data, &mut idx_pos)
                    .ok_or("Failed to read index non_shared")? as usize;
                let value_len = decode_varint(entries_data, &mut idx_pos)
                    .ok_or("Failed to read index value_len")? as usize;

                if idx_pos + non_shared + value_len > entries_data.len() {
                    break;
                }

                let key_suffix = &entries_data[idx_pos..idx_pos + non_shared];
                idx_pos += non_shared;
                let handle_data = &entries_data[idx_pos..idx_pos + value_len];
                idx_pos += value_len;

                let mut key = Vec::with_capacity(shared + non_shared);
                key.extend_from_slice(&prev_key[..shared.min(prev_key.len())]);
                key.extend_from_slice(key_suffix);
                prev_key = key;

                // Handle is encoded as: block_offset varint, block_size varint
                let mut hpos = 0;
                let block_offset = decode_varint(handle_data, &mut hpos)
                    .ok_or("Failed to read block offset")? as usize;
                let block_size = decode_varint(handle_data, &mut hpos)
                    .ok_or("Failed to read block size")? as usize;

                block_handles.push((block_offset, block_size));
            }
        }
    }

    // Read data blocks
    let mut result = BTreeMap::new();
    for (offset, size) in block_handles {
        let end = offset + size + BLOCK_TRAILER_SIZE;
        if end > data.len() {
            continue;
        }
        let block_data = &data[offset..end.min(data.len())];
        if let Ok(entries) = read_data_block(block_data) {
            for (key, value) in entries {
                result.insert(key, value);
            }
        }
    }

    Ok(result)
}

fn read_log_file(path: &Path) -> Result<Vec<(Vec<u8>, Vec<u8>)>, String> {
    let data = std::fs::read(path)
        .map_err(|e| format!("Failed to read {:?}: {}", path, e))?;

    let mut pairs = Vec::new();
    let mut pos = 0;

    while pos + 7 <= data.len() {
        let record_type = data[pos + 6];
        let size = u16::from_le_bytes([data[pos + 4], data[pos + 5]]) as usize;

        if size == 0 || pos + 7 + size > data.len() {
            break;
        }

        let payload = &data[pos + 7..pos + 7 + size];

        if record_type == 1 {
            // Full record: klen(4) + vlen(4) + key + value
            if payload.len() >= 8 {
                let klen = u32::from_le_bytes([payload[0], payload[1], payload[2], payload[3]]) as usize;
                let vlen = u32::from_le_bytes([payload[4], payload[5], payload[6], payload[7]]) as usize;
                if klen + 8 + vlen <= payload.len() && klen > 0 {
                    let key = payload[8..8 + klen].to_vec();
                    let value = payload[8 + klen..8 + klen + vlen].to_vec();
                    pairs.push((key, value));
                }
            }
        }

        pos += 7 + size;
    }

    Ok(pairs)
}

pub fn read_all_kv_pairs(db_path: &Path) -> Result<BTreeMap<Vec<u8>, Vec<u8>>, String> {
    let mut all_pairs: BTreeMap<Vec<u8>, Vec<u8>> = BTreeMap::new();
    let entries = std::fs::read_dir(db_path).map_err(|e| e.to_string())?;

    let mut ldb_count = 0u32;
    let mut log_count = 0u32;
    let mut ldb_entries = 0usize;
    let mut log_entries = 0usize;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path.file_name().unwrap().to_string_lossy().to_string();

        if name.ends_with(".ldb") {
            ldb_count += 1;
            match read_ldb_file(&path) {
                Ok(pairs) => {
                    ldb_entries += pairs.len();
                    all_pairs.extend(pairs);
                }
                Err(e) => {
                    log::warn!("[Hydra DB] Failed to read {}: {}", name, e);
                }
            }
        } else if name.ends_with(".log") {
            log_count += 1;
            match read_log_file(&path) {
                Ok(pairs) => {
                    log_entries += pairs.len();
                    for (k, v) in pairs {
                        all_pairs.insert(k, v);
                    }
                }
                Err(e) => {
                    log::warn!("[Hydra DB] Failed to read {}: {}", name, e);
                }
            }
        }
    }

    log::info!("[Hydra DB] Read {} .ldb files ({} entries) and {} .log files ({} entries) - total {} unique KV pairs",
        ldb_count, ldb_entries, log_count, log_entries, all_pairs.len());

    Ok(all_pairs)
}

pub fn get_hydra_library_games(custom_path: Option<&str>) -> Result<Vec<HydraLibraryGame>, String> {
    let db_path = resolve_hydra_db_path(custom_path)
        .ok_or_else(|| "Hydra database path not found".to_string())?;

    log::info!("[Hydra DB] Reading from: {}", db_path.display());

    if !db_path.exists() {
        return Err(format!("Hydra database not found at: {}", db_path.display()));
    }

    let all_pairs = read_all_kv_pairs(&db_path)?;

    log::info!("[Hydra DB] Total {} key-value pairs", all_pairs.len());

    let mut games = Vec::new();
    let mut games_key_count = 0u32;
    let mut json_fail_count = 0u32;

    for (key, value) in &all_pairs {
        let key_str = String::from_utf8_lossy(key);
        if !key_str.starts_with("!games!") {
            continue;
        }
        games_key_count += 1;

        if let Ok(game_data) = serde_json::from_slice::<serde_json::Value>(value) {
            let shop = game_data.get("shop")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            games.push(HydraLibraryGame {
                object_id: game_data.get("objectId")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                title: game_data.get("title")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                shop,
                icon_url: game_data.get("iconUrl")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                library_hero_image_url: game_data.get("libraryHeroImageUrl")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                logo_image_url: game_data.get("logoImageUrl")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                last_time_played: game_data.get("lastTimePlayed")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                play_time_in_milliseconds: game_data.get("playTimeInMilliseconds")
                    .and_then(|v| v.as_u64()),
                achievement_count: game_data.get("achievementCount")
                    .and_then(|v| v.as_u64())
                    .map(|n| n as u32),
                unlocked_achievement_count: game_data.get("unlockedAchievementCount")
                    .and_then(|v| v.as_u64())
                    .map(|n| n as u32),
                is_deleted: game_data.get("isDeleted")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false),
                favorite: game_data.get("favorite")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false),
                is_pinned: game_data.get("isPinned")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false),
                added_to_library_at: game_data.get("addedToLibraryAt")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
            });
        } else {
            json_fail_count += 1;
        }
    }

    log::info!("[Hydra DB] Found {} !games! keys, {} parsed successfully, {} JSON parse failures", games_key_count, games.len(), json_fail_count);

    if !games.is_empty() {
        let sample_titles: Vec<&str> = games.iter().take(5).map(|g| g.title.as_str()).collect();
        log::info!("[Hydra DB] Sample games: {:?}", sample_titles);
    }

    Ok(games)
}
