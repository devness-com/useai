import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { detectClient } from './detect-client.js';
import { AI_CLIENT_ENV_VARS } from '../constants/clients.js';

describe('detectClient', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear all AI client env vars and MCP_CLIENT_NAME before each test
    for (const envVar of Object.keys(AI_CLIENT_ENV_VARS)) {
      delete process.env[envVar];
    }
    delete process.env.MCP_CLIENT_NAME;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('AI_CLIENT_ENV_VARS detection', () => {
    const entries = Object.entries(AI_CLIENT_ENV_VARS);

    it('should have at least one entry in AI_CLIENT_ENV_VARS', () => {
      expect(entries.length).toBeGreaterThan(0);
    });

    it.each(entries)(
      'returns "%s" client name when %s env var is set',
      (envVar, expectedClientName) => {
        // Clear all AI client env vars to ensure isolation
        for (const key of Object.keys(AI_CLIENT_ENV_VARS)) {
          delete process.env[key];
        }
        delete process.env.MCP_CLIENT_NAME;

        process.env[envVar] = '1';

        expect(detectClient()).toBe(expectedClientName);
      },
    );

    it('returns the first matching client when multiple AI client env vars are set', () => {
      // Set all env vars
      for (const envVar of Object.keys(AI_CLIENT_ENV_VARS)) {
        process.env[envVar] = '1';
      }

      const firstEntry = entries[0];
      expect(detectClient()).toBe(firstEntry[1]);
    });

    it('prioritizes AI_CLIENT_ENV_VARS over MCP_CLIENT_NAME', () => {
      const [firstEnvVar, firstClientName] = entries[0];
      process.env[firstEnvVar] = '1';
      process.env.MCP_CLIENT_NAME = 'custom-mcp-client';

      expect(detectClient()).toBe(firstClientName);
    });
  });

  describe('MCP_CLIENT_NAME fallback', () => {
    it('returns MCP_CLIENT_NAME when no AI client env vars are set', () => {
      process.env.MCP_CLIENT_NAME = 'windsurf';

      expect(detectClient()).toBe('windsurf');
    });

    it('returns MCP_CLIENT_NAME with arbitrary value', () => {
      process.env.MCP_CLIENT_NAME = 'my-custom-editor-plugin';

      expect(detectClient()).toBe('my-custom-editor-plugin');
    });
  });

  describe('unknown fallback', () => {
    it('returns "unknown" when no env vars are set at all', () => {
      expect(detectClient()).toBe('unknown');
    });

    it('returns "unknown" when AI client env vars are empty strings', () => {
      for (const envVar of Object.keys(AI_CLIENT_ENV_VARS)) {
        process.env[envVar] = '';
      }

      expect(detectClient()).toBe('unknown');
    });

    it('returns "unknown" when MCP_CLIENT_NAME is an empty string', () => {
      process.env.MCP_CLIENT_NAME = '';

      expect(detectClient()).toBe('unknown');
    });
  });
});