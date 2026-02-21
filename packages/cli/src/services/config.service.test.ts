import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getConfig, saveConfig, updateConfig } from './config.service';

vi.mock('@useai/shared/utils', () => ({
  readJson: vi.fn(),
  writeJson: vi.fn(),
}));

vi.mock('@useai/shared/constants', () => ({
  CONFIG_FILE: '/mock/path/config.json',
  DEFAULT_CONFIG: {
    enabled: true,
    api_url: 'https://api.useai.dev',
  },
  DEFAULT_SYNC_INTERVAL_HOURS: 24,
}));

import { readJson, writeJson } from '@useai/shared/utils';
import { CONFIG_FILE } from '@useai/shared/constants';

const mockedReadJson = vi.mocked(readJson);
const mockedWriteJson = vi.mocked(writeJson);

describe('config.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConfig', () => {
    it('returns default config when no config file exists', () => {
      const defaultConfig = {
        enabled: true,
        api_url: 'https://api.useai.dev',
        sync_interval_hours: 24,
      };
      mockedReadJson.mockReturnValue(defaultConfig);

      const result = getConfig();

      expect(mockedReadJson).toHaveBeenCalledWith(CONFIG_FILE, expect.objectContaining({
        enabled: true,
        api_url: 'https://api.useai.dev',
        sync_interval_hours: 24,
      }));
      expect(result).toEqual(defaultConfig);
    });

    it('returns stored config when config file exists with custom values', () => {
      const storedConfig = {
        enabled: false,
        api_url: 'https://custom.api.dev',
        sync_interval_hours: 12,
      };
      mockedReadJson.mockReturnValue(storedConfig);

      const result = getConfig();

      expect(result).toEqual(storedConfig);
      expect(result.sync_interval_hours).toBe(12);
      expect((result as any).enabled).toBe(false);
    });

    it('passes the CONFIG_FILE path and default config to readJson', () => {
      mockedReadJson.mockReturnValue({
        enabled: true,
        api_url: 'https://api.useai.dev',
        sync_interval_hours: 24,
      });

      getConfig();

      expect(mockedReadJson).toHaveBeenCalledTimes(1);
      expect(mockedReadJson.mock.calls[0]![0]).toBe('/mock/path/config.json');
      expect(mockedReadJson.mock.calls[0]![1]).toEqual(expect.objectContaining({
        sync_interval_hours: 24,
      }));
    });
  });

  describe('saveConfig', () => {
    it('writes config to the CONFIG_FILE path', () => {
      const config = {
        enabled: true,
        api_url: 'https://api.useai.dev',
        sync_interval_hours: 24,
      };

      saveConfig(config as any);

      expect(mockedWriteJson).toHaveBeenCalledTimes(1);
      expect(mockedWriteJson).toHaveBeenCalledWith('/mock/path/config.json', config);
    });

    it('writes config with custom values', () => {
      const customConfig = {
        enabled: false,
        api_url: 'https://staging.api.dev',
        sync_interval_hours: 6,
        extra_field: 'custom_value',
      };

      saveConfig(customConfig as any);

      expect(mockedWriteJson).toHaveBeenCalledWith('/mock/path/config.json', customConfig);
    });

    it('calls writeJson exactly once per invocation', () => {
      const config = {
        enabled: true,
        api_url: 'https://api.useai.dev',
        sync_interval_hours: 48,
      };

      saveConfig(config as any);
      saveConfig(config as any);

      expect(mockedWriteJson).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateConfig', () => {
    it('merges partial updates with existing config', () => {
      const existingConfig = {
        enabled: true,
        api_url: 'https://api.useai.dev',
        sync_interval_hours: 24,
      };
      mockedReadJson.mockReturnValue(existingConfig);

      const result = updateConfig({ sync_interval_hours: 12 } as any);

      expect(result).toEqual({
        enabled: true,
        api_url: 'https://api.useai.dev',
        sync_interval_hours: 12,
      });
    });

    it('saves the merged config to disk', () => {
      const existingConfig = {
        enabled: true,
        api_url: 'https://api.useai.dev',
        sync_interval_hours: 24,
      };
      mockedReadJson.mockReturnValue(existingConfig);

      updateConfig({ enabled: false } as any);

      expect(mockedWriteJson).toHaveBeenCalledWith('/mock/path/config.json', {
        enabled: false,
        api_url: 'https://api.useai.dev',
        sync_interval_hours: 24,
      });
    });

    it('returns the fully merged config object', () => {
      const existingConfig = {
        enabled: true,
        api_url: 'https://api.useai.dev',
        sync_interval_hours: 24,
      };
      mockedReadJson.mockReturnValue(existingConfig);

      const result = updateConfig({
        api_url: 'https://new-api.useai.dev',
        sync_interval_hours: 48,
      } as any);

      expect((result as any).api_url).toBe('https://new-api.useai.dev');
      expect(result.sync_interval_hours).toBe(48);
      expect((result as any).enabled).toBe(true);
    });

    it('overrides existing values when updates contain the same keys', () => {
      const existingConfig = {
        enabled: true,
        api_url: 'https://api.useai.dev',
        sync_interval_hours: 24,
      };
      mockedReadJson.mockReturnValue(existingConfig);

      const result = updateConfig({
        enabled: false,
        api_url: 'https://override.api.dev',
        sync_interval_hours: 1,
      } as any);

      expect(result).toEqual({
        enabled: false,
        api_url: 'https://override.api.dev',
        sync_interval_hours: 1,
      });
    });

    it('handles empty updates object by returning existing config unchanged', () => {
      const existingConfig = {
        enabled: true,
        api_url: 'https://api.useai.dev',
        sync_interval_hours: 24,
      };
      mockedReadJson.mockReturnValue(existingConfig);

      const result = updateConfig({});

      expect(result).toEqual(existingConfig);
      expect(mockedWriteJson).toHaveBeenCalledWith('/mock/path/config.json', existingConfig);
    });

    it('reads the current config before applying updates', () => {
      mockedReadJson.mockReturnValue({
        enabled: true,
        api_url: 'https://api.useai.dev',
        sync_interval_hours: 24,
      });

      updateConfig({ sync_interval_hours: 6 } as any);

      expect(mockedReadJson).toHaveBeenCalledBefore(mockedWriteJson);
    });

    it('preserves fields not included in the partial update', () => {
      const existingConfig = {
        enabled: true,
        api_url: 'https://api.useai.dev',
        sync_interval_hours: 24,
        custom_setting: 'preserved_value',
      };
      mockedReadJson.mockReturnValue(existingConfig);

      const result = updateConfig({ enabled: false } as any);

      expect(result).toEqual({
        enabled: false,
        api_url: 'https://api.useai.dev',
        sync_interval_hours: 24,
        custom_setting: 'preserved_value',
      });
    });
  });
});