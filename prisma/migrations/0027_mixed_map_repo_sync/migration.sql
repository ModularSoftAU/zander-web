-- Mixed Map Repository Sync: adds repo/XML-sourced + admin-override columns to
-- mixed_maps, plus sync run/error tracking tables. Existing description /
-- thumbnail_url / tags / objectives columns are left untouched since they are
-- still written by plugin ingestion (mixed.upsertMap).

ALTER TABLE mixed_maps
  ADD COLUMN gamemodes JSON NULL AFTER gamemode,
  ADD COLUMN contributors JSON NULL AFTER authors,
  ADD COLUMN description_from_xml TEXT NULL AFTER description,
  ADD COLUMN custom_description TEXT NULL AFTER description_from_xml,
  ADD COLUMN teams_from_xml JSON NULL AFTER objectives,
  ADD COLUMN objectives_from_xml JSON NULL AFTER teams_from_xml,
  ADD COLUMN rules_from_xml JSON NULL AFTER objectives_from_xml,
  ADD COLUMN thumbnail_from_repo VARCHAR(500) NULL AFTER thumbnail_url,
  ADD COLUMN custom_thumbnail_url VARCHAR(500) NULL AFTER thumbnail_from_repo,
  ADD COLUMN screenshots_from_repo JSON NULL AFTER custom_thumbnail_url,
  ADD COLUMN inferred_tags JSON NULL AFTER tags,
  ADD COLUMN custom_tags JSON NULL AFTER inferred_tags,
  ADD COLUMN source_key VARCHAR(80) NULL,
  ADD COLUMN source_display_name VARCHAR(160) NULL,
  ADD COLUMN source_org VARCHAR(160) NULL,
  ADD COLUMN source_repo VARCHAR(160) NULL,
  ADD COLUMN source_branch VARCHAR(160) NULL,
  ADD COLUMN source_path VARCHAR(400) NULL,
  ADD COLUMN source_commit VARCHAR(64) NULL,
  ADD COLUMN last_synced_at DATETIME NULL,
  ADD COLUMN last_sync_status ENUM('ok', 'conflict', 'error') NULL,
  ADD COLUMN last_sync_error TEXT NULL,
  ADD COLUMN discovered_from_server TINYINT(1) NOT NULL DEFAULT 0;

CREATE INDEX idx_mixed_maps_source_key ON mixed_maps (source_key);
CREATE INDEX idx_mixed_maps_source_repo ON mixed_maps (source_repo);
CREATE INDEX idx_mixed_maps_gamemode ON mixed_maps (gamemode);
CREATE INDEX idx_mixed_maps_public_visible ON mixed_maps (public_visible);
CREATE INDEX idx_mixed_maps_voting_enabled ON mixed_maps (voting_enabled);
CREATE INDEX idx_mixed_maps_token_enabled ON mixed_maps (token_enabled);
CREATE INDEX idx_mixed_maps_last_synced_at ON mixed_maps (last_synced_at);

CREATE TABLE mixed_map_sync_runs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  source_key VARCHAR(80) NULL,
  source_display_name VARCHAR(160) NULL,
  source_org VARCHAR(160) NULL,
  source_repo VARCHAR(160) NULL,
  source_branch VARCHAR(160) NULL,
  source_commit VARCHAR(64) NULL,
  status ENUM('running', 'success', 'partial_success', 'failed') NOT NULL DEFAULT 'running',
  maps_found INT NOT NULL DEFAULT 0,
  maps_created INT NOT NULL DEFAULT 0,
  maps_updated INT NOT NULL DEFAULT 0,
  maps_skipped INT NOT NULL DEFAULT 0,
  conflicts_found INT NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  triggered_by VARCHAR(80) NULL,
  started_at DATETIME NOT NULL,
  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mixed_map_sync_runs_source_key (source_key),
  INDEX idx_mixed_map_sync_runs_status (status),
  INDEX idx_mixed_map_sync_runs_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE mixed_map_sync_errors (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sync_run_id BIGINT NOT NULL,
  source_key VARCHAR(80) NULL,
  source_org VARCHAR(160) NULL,
  source_repo VARCHAR(160) NULL,
  map_key VARCHAR(160) NULL,
  source_path VARCHAR(400) NULL,
  error_type ENUM(
    'INVALID_XML', 'MISSING_MAP_XML', 'DUPLICATE_MAP_KEY',
    'GITHUB_FETCH_FAILED', 'ASSET_FETCH_FAILED', 'CONFIG_INVALID', 'UNKNOWN_ERROR'
  ) NOT NULL,
  error_message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mixed_map_sync_errors_run
    FOREIGN KEY (sync_run_id) REFERENCES mixed_map_sync_runs (id) ON DELETE CASCADE,
  INDEX idx_mixed_map_sync_errors_run_id (sync_run_id),
  INDEX idx_mixed_map_sync_errors_map_key (map_key),
  INDEX idx_mixed_map_sync_errors_error_type (error_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
