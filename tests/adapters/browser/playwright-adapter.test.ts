import { describe, it, expect, beforeEach } from 'vitest';
import { PlaywrightBrowserAdapter } from '../../../src/adapters/browser/playwright-adapter.js';

describe('PlaywrightBrowserAdapter', () => {
  let adapter: PlaywrightBrowserAdapter;

  beforeEach(() => {
    adapter = new PlaywrightBrowserAdapter();
  });

  it('should have correct metadata', () => {
    expect(adapter.id).toBe('playwright');
    expect(adapter.name).toBe('Playwright Browser');
    expect(adapter.isDestructive).toBe(false);
  });

  it('should list browser tools', () => {
    expect(adapter.tools.map(t => t.name)).toContain('browser_navigate');
    expect(adapter.tools.map(t => t.name)).toContain('browser_read');
  });
});