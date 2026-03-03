import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getConfig, saveConfig, updateConfig } from './config.service';

vi.mock('@useai/shared/utils', () => ({
  readJson: vi.fn(),
  writeJson: vi.fn(),
  migrateConfig: vi.fn((raw: Record<string, unknown>) => raw),
}));

vi.mock('@useai/shared/constants', () => ({
  CONFIG_FILE: '/mock/path/config.json',
}));

import { readJson, writeJson, migrateConfig } from '@useai/shared/utils';
import { CONFIG_FILE } from '@useai/shared/constants';

const mockedReadJson = vi.mocked(readJson);
const mockedWriteJson = vi.mocked(writeJson);
const mockedMigrateConfig = vi.mocked(migrateConfig);

describe('config.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: migrateConfig just passes through
    mockedMigrateConfig.mockImplementation((raw: any) => raw);
  });

  describe('getConfig', () => {
    it('returns migrated config from readJson', () => {
      const rawConfig = {
        capture: { milestones: true, prompt: true, evaluation: true, evaluation_reasons: 'all' },
        sync: { enabled: true, interval_hours: 6 },
      };
      mockedReadJson.mockReturnValue(rawConfig);
      mockedMigrateConfig.mockReturnValue(rawConfig);

      const result = getConfig();

      expect(mockedReadJson).toHaveBeenCalledWith(CONFIG_FILE, {});
      expect(mockedMigrateConfig).toHaveBeenCalledWith(rawConfig);
      expect(result).toEqual(rawConfig);
    });

    it('passes empty object as default to readJson', () => {
      mockedReadJson.mockReturnValue({});

      getConfig();

      expect(mockedReadJson).toHaveBeenCalledWith('/mock/path/config.json', {});
    });

    it('calls migrateConfig on the raw data from readJson', () => {
      const raw = { old_field: true };
      const migrated = {
        capture: { milestones: true },
        sync: { enabled: false },
      };
      mockedReadJson.mockReturnValue(raw);
      mockedMigrateConfig.mockReturnValue(migrated as any);

      const result = getConfig();

      expect(mockedMigrateConfig).toHaveBeenCalledWith(raw);
      expect(result).toEqual(migrated);
    });
  });

  describe('saveConfig', () => {
    it('writes config to the CONFIG_FILE path', () => {
      const config = {
        capture: { milestones: true, prompt: true, evaluation: true, evaluation_reasons: 'all' as const },
        sync: { enabled: true, interval_hours: 6 },
      };

      saveConfig(config as any);

      expect(mockedWriteJson).toHaveBeenCalledTimes(1);
      expect(mockedWriteJson).toHaveBeenCalledWith('/mock/path/config.json', config);
    });

    it('writes config with custom values', () => {
      const customConfig = {
        capture: { milestones: false, prompt: false, evaluation: true, evaluation_reasons: 'none' as const },
        sync: { enabled: false, interval_hours: 12 },
      };

      saveConfig(customConfig as any);

      expect(mockedWriteJson).toHaveBeenCalledWith('/mock/path/config.json', customConfig);
    });

    it('calls writeJson exactly once per invocation', () => {
      const config = {
        capture: { milestones: true, prompt: true, evaluation: true, evaluation_reasons: 'all' as const },
        sync: { enabled: true, interval_hours: 48 },
      };

      saveConfig(config as any);
      saveConfig(config as any);

      expect(mockedWriteJson).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateConfig', () => {
    it('merges partial updates with existing config', () => {
      const existingConfig = {
        capture: { milestones: true, prompt: true, evaluation: true, evaluation_reasons: 'all' },
        sync: { enabled: true, interval_hours: 24 },
      };
      mockedReadJson.mockReturnValue(existingConfig);
      mockedMigrateConfig.mockReturnValue(existingConfig as any);

      const result = updateConfig({ evaluation_framework: 'raw' } as any);

      expect(result).toEqual({
        ...existingConfig,
        evaluation_framework: 'raw',
      });
    });

    it('saves the merged config to disk', () => {
      const existingConfig = {
        capture: { milestones: true, prompt: true, evaluation: true, evaluation_reasons: 'all' },
        sync: { enabled: true, interval_hours: 24 },
      };
      mockedReadJson.mockReturnValue(existingConfig);
      mockedMigrateConfig.mockReturnValue(existingConfig as any);

      updateConfig({ evaluation_framework: 'space' } as any);

      expect(mockedWriteJson).toHaveBeenCalledWith('/mock/path/config.json', {
        ...existingConfig,
        evaluation_framework: 'space',
      });
    });

    it('returns the fully merged config object', () => {
      const existingConfig = {
        capture: { milestones: true, prompt: true, evaluation: true, evaluation_reasons: 'all' },
        sync: { enabled: true, interval_hours: 24 },
      };
      mockedReadJson.mockReturnValue(existingConfig);
      mockedMigrateConfig.mockReturnValue(existingConfig as any);

      const result = updateConfig({
        evaluation_framework: 'raw',
        last_sync_at: '2026-01-01',
      } as any);

      expect((result as any).evaluation_framework).toBe('raw');
      expect((result as any).last_sync_at).toBe('2026-01-01');
      expect((result as any).capture.milestones).toBe(true);
    });

    it('overrides existing values when updates contain the same keys', () => {
      const existingConfig = {
        capture: { milestones: true, prompt: true, evaluation: true, evaluation_reasons: 'all' },
        sync: { enabled: true, interval_hours: 24 },
        evaluation_framework: 'space',
      };
      mockedReadJson.mockReturnValue(existingConfig);
      mockedMigrateConfig.mockReturnValue(existingConfig as any);

      const result = updateConfig({
        evaluation_framework: 'raw',
      } as any);

      expect((result as any).evaluation_framework).toBe('raw');
    });

    it('handles empty updates object by returning existing config unchanged', () => {
      const existingConfig = {
        capture: { milestones: true, prompt: true, evaluation: true, evaluation_reasons: 'all' },
        sync: { enabled: true, interval_hours: 24 },
      };
      mockedReadJson.mockReturnValue(existingConfig);
      mockedMigrateConfig.mockReturnValue(existingConfig as any);

      const result = updateConfig({});

      expect(result).toEqual(existingConfig);
      expect(mockedWriteJson).toHaveBeenCalledWith('/mock/path/config.json', existingConfig);
    });

    it('reads the current config before applying updates', () => {
      const existingConfig = {
        capture: { milestones: true, prompt: true, evaluation: true, evaluation_reasons: 'all' },
        sync: { enabled: true, interval_hours: 24 },
      };
      mockedReadJson.mockReturnValue(existingConfig);
      mockedMigrateConfig.mockReturnValue(existingConfig as any);

      updateConfig({ evaluation_framework: 'raw' } as any);

      expect(mockedReadJson).toHaveBeenCalledBefore(mockedWriteJson);
    });

    it('preserves fields not included in the partial update', () => {
      const existingConfig = {
        capture: { milestones: true, prompt: true, evaluation: true, evaluation_reasons: 'all' },
        sync: { enabled: true, interval_hours: 24 },
        last_sync_at: '2026-01-01',
      };
      mockedReadJson.mockReturnValue(existingConfig);
      mockedMigrateConfig.mockReturnValue(existingConfig as any);

      const result = updateConfig({ evaluation_framework: 'raw' } as any);

      expect(result).toEqual({
        ...existingConfig,
        evaluation_framework: 'raw',
      });
    });
  });
});
