import { describe, it, expect } from 'vitest';
import { migrateConfig } from '../src/utils/config-migrate';
import {
  DEFAULT_CAPTURE_CONFIG,
  DEFAULT_SYNC_CONFIG,
  DEFAULT_SYNC_INCLUDE_CONFIG,
} from '../src/constants/defaults';

/**
 * Integration: migrateConfig uses constants/defaults to fill in missing fields.
 * These tests verify real defaults are applied correctly for various legacy formats.
 */

describe('Config migration integration', () => {
  it('produces a full config from an empty input using real defaults', () => {
    const result = migrateConfig({});

    expect(result.capture).toEqual(DEFAULT_CAPTURE_CONFIG);
    expect(result.sync.enabled).toBe(DEFAULT_SYNC_CONFIG.enabled);
    expect(result.sync.interval_hours).toBe(DEFAULT_SYNC_CONFIG.interval_hours);
    expect(result.sync.include).toEqual(DEFAULT_SYNC_INCLUDE_CONFIG);
    expect(result.evaluation_framework).toBe('space');
  });

  it('migrates legacy milestone_tracking to capture.milestones', () => {
    const result = migrateConfig({ milestone_tracking: false });

    expect(result.capture.milestones).toBe(false);
    // Other capture fields should still be defaults
    expect(result.capture.prompt).toBe(DEFAULT_CAPTURE_CONFIG.prompt);
    expect(result.capture.evaluation).toBe(DEFAULT_CAPTURE_CONFIG.evaluation);
  });

  it('migrates legacy auto_sync to sync.enabled', () => {
    const result = migrateConfig({ auto_sync: true });

    expect(result.sync.enabled).toBe(true);
    expect(result.sync.interval_hours).toBe(DEFAULT_SYNC_CONFIG.interval_hours);
  });

  it('migrates legacy sync_interval_hours to sync.interval_hours', () => {
    const result = migrateConfig({ sync_interval_hours: 12 });

    expect(result.sync.interval_hours).toBe(12);
    expect(result.sync.enabled).toBe(false); // default
  });

  it('migrates all legacy fields together', () => {
    const result = migrateConfig({
      milestone_tracking: false,
      auto_sync: true,
      sync_interval_hours: 6,
    });

    expect(result.capture.milestones).toBe(false);
    expect(result.sync.enabled).toBe(true);
    expect(result.sync.interval_hours).toBe(6);
    expect(result.evaluation_framework).toBe('space');
  });

  it('fills missing nested capture fields with defaults', () => {
    const result = migrateConfig({
      capture: { prompt: false },
    });

    expect(result.capture.prompt).toBe(false);
    expect(result.capture.prompt_images).toBe(DEFAULT_CAPTURE_CONFIG.prompt_images);
    expect(result.capture.evaluation).toBe(DEFAULT_CAPTURE_CONFIG.evaluation);
    expect(result.capture.evaluation_reasons).toBe(DEFAULT_CAPTURE_CONFIG.evaluation_reasons);
    expect(result.capture.milestones).toBe(DEFAULT_CAPTURE_CONFIG.milestones);
  });

  it('fills missing nested sync.include fields with defaults', () => {
    const result = migrateConfig({
      sync: {
        enabled: true,
        interval_hours: 1,
        include: { sessions: true },
      },
    });

    expect(result.sync.enabled).toBe(true);
    expect(result.sync.interval_hours).toBe(1);
    expect(result.sync.include.sessions).toBe(true);
    expect(result.sync.include.prompts).toBe(DEFAULT_SYNC_INCLUDE_CONFIG.prompts);
    expect(result.sync.include.private_titles).toBe(DEFAULT_SYNC_INCLUDE_CONFIG.private_titles);
    expect(result.sync.include.projects).toBe(DEFAULT_SYNC_INCLUDE_CONFIG.projects);
  });

  it('preserves existing evaluation_framework', () => {
    const result = migrateConfig({ evaluation_framework: 'raw' });
    expect(result.evaluation_framework).toBe('raw');
  });

  it('defaults evaluation_framework to space when not set', () => {
    const result = migrateConfig({ capture: DEFAULT_CAPTURE_CONFIG });
    expect(result.evaluation_framework).toBe('space');
  });

  it('preserves a complete modern config without modification', () => {
    const fullConfig = {
      capture: { ...DEFAULT_CAPTURE_CONFIG },
      sync: { ...DEFAULT_SYNC_CONFIG, include: { ...DEFAULT_SYNC_INCLUDE_CONFIG } },
      evaluation_framework: 'raw',
    };

    const result = migrateConfig(fullConfig as Record<string, unknown>);

    expect(result.capture).toEqual(DEFAULT_CAPTURE_CONFIG);
    expect(result.sync.include).toEqual(DEFAULT_SYNC_INCLUDE_CONFIG);
    expect(result.evaluation_framework).toBe('raw');
  });
});
