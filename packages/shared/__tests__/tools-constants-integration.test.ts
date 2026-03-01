import { describe, it, expect } from 'vitest';
import {
  TOOL_COLORS,
  TOOL_DISPLAY_NAMES,
  TOOL_INITIALS,
  TOOL_ICONS,
  SUPPORTED_AI_TOOLS,
  CATEGORY_COLORS,
  resolveClient,
} from '../src/constants/tools';
import { AI_CLIENT_ENV_VARS } from '../src/constants/clients';

/**
 * Integration: Verifies consistency across TOOL_COLORS, TOOL_DISPLAY_NAMES,
 * TOOL_INITIALS, TOOL_ICONS, SUPPORTED_AI_TOOLS, and resolveClient.
 * Also verifies AI_CLIENT_ENV_VARS map to known tools.
 */

describe('Tool constants consistency integration', () => {
  it('every SUPPORTED_AI_TOOL has a color', () => {
    for (const tool of SUPPORTED_AI_TOOLS) {
      expect(TOOL_COLORS[tool.key], `Missing color for ${tool.key}`).toBeDefined();
    }
  });

  it('every SUPPORTED_AI_TOOL has a display name', () => {
    for (const tool of SUPPORTED_AI_TOOLS) {
      expect(TOOL_DISPLAY_NAMES[tool.key], `Missing display name for ${tool.key}`).toBeDefined();
    }
  });

  it('every SUPPORTED_AI_TOOL has initials', () => {
    for (const tool of SUPPORTED_AI_TOOLS) {
      expect(TOOL_INITIALS[tool.key], `Missing initials for ${tool.key}`).toBeDefined();
    }
  });

  it('every SUPPORTED_AI_TOOL has an icon', () => {
    for (const tool of SUPPORTED_AI_TOOLS) {
      expect(TOOL_ICONS[tool.key], `Missing icon for ${tool.key}`).toBeDefined();
    }
  });

  it('SUPPORTED_AI_TOOLS name matches TOOL_DISPLAY_NAMES', () => {
    for (const tool of SUPPORTED_AI_TOOLS) {
      expect(tool.name).toBe(TOOL_DISPLAY_NAMES[tool.key]);
    }
  });

  it('all AI_CLIENT_ENV_VARS values map to known tool colors', () => {
    for (const [envVar, clientKey] of Object.entries(AI_CLIENT_ENV_VARS)) {
      expect(TOOL_COLORS[clientKey], `${envVar} -> ${clientKey} has no color`).toBeDefined();
    }
  });

  it('CATEGORY_COLORS has entries for common categories', () => {
    const expected = ['feature', 'bugfix', 'refactor', 'test', 'docs', 'setup', 'deployment', 'other'];
    for (const cat of expected) {
      expect(CATEGORY_COLORS[cat], `Missing color for category: ${cat}`).toBeDefined();
      expect(CATEGORY_COLORS[cat]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('TOOL_ICONS contain valid data URIs', () => {
    for (const [key, icon] of Object.entries(TOOL_ICONS)) {
      expect(icon, `${key} icon should start with data:`).toMatch(/^data:image\/svg\+xml,/);
    }
  });

  it('TOOL_COLORS contain valid hex color values', () => {
    for (const [key, color] of Object.entries(TOOL_COLORS)) {
      expect(color, `${key} color should be hex`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('resolveClient integration', () => {
  it('returns exact match for known clients', () => {
    expect(resolveClient('claude-code')).toBe('claude-code');
    expect(resolveClient('cursor')).toBe('cursor');
    expect(resolveClient('windsurf')).toBe('windsurf');
  });

  it('matches longest prefix for client variants', () => {
    expect(resolveClient('gemini-cli-mcp-client')).toBe('gemini-cli');
  });

  it('returns raw string for completely unknown clients', () => {
    expect(resolveClient('totally-unknown-client')).toBe('totally-unknown-client');
  });

  it('resolves all AI_CLIENT_ENV_VARS values correctly', () => {
    for (const clientKey of Object.values(AI_CLIENT_ENV_VARS)) {
      const resolved = resolveClient(clientKey);
      expect(resolved).toBe(clientKey);
    }
  });
});
