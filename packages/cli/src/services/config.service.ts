import { readJson, writeJson, migrateConfig } from '@useai/shared/utils';
import { CONFIG_FILE } from '@useai/shared/constants';
import type { UseaiConfig } from '@useai/shared/types';

export function getConfig(): UseaiConfig {
  const raw = readJson<Record<string, unknown>>(CONFIG_FILE, {});
  return migrateConfig(raw) as UseaiConfig;
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
