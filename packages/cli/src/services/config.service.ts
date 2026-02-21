import { readJson, writeJson } from '@useai/shared/utils';
import { CONFIG_FILE } from '@useai/shared/constants';
import { DEFAULT_CONFIG, DEFAULT_SYNC_INTERVAL_HOURS } from '@useai/shared/constants';
import type { UseaiConfig } from '@useai/shared/types';

const DEFAULT_USEAI_CONFIG: UseaiConfig = {
  ...DEFAULT_CONFIG,
  sync_interval_hours: DEFAULT_SYNC_INTERVAL_HOURS,
};

export function getConfig(): UseaiConfig {
  return readJson<UseaiConfig>(CONFIG_FILE, DEFAULT_USEAI_CONFIG);
}

export function saveConfig(config: UseaiConfig): void {
  writeJson(CONFIG_FILE, config);
}

export function updateConfig(updates: Partial<UseaiConfig>): UseaiConfig {
  const config = getConfig();
  const updated = { ...config, ...updates };
  saveConfig(updated);
  return updated;
}
