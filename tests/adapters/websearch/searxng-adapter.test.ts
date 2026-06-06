import { describe, it, expect, beforeEach } from 'vitest';
import { SearXNGAdapter } from '../../../src/adapters/websearch/searxng-adapter.js';

describe('SearXNGAdapter', () => {
  let adapter: SearXNGAdapter;

  beforeEach(() => {
    adapter = new SearXNGAdapter();
  });

  it('should have correct metadata', () => {
    expect(adapter.id).toBe('searxng');
    expect(adapter.name).toBe('SearXNG Search');
    expect(adapter.isDestructive).toBe(false);
  });

  it('should list search tools', () => {
    expect(adapter.tools.map(t => t.name)).toContain('web_search');
    expect(adapter.tools.map(t => t.name)).toContain('web_fetch');
  });
});