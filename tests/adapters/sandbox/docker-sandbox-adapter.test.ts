import { describe, it, expect, beforeEach } from 'vitest';
import { DockerSandboxAdapter } from '../../../src/adapters/sandbox/docker-sandbox-adapter.js';

describe('DockerSandboxAdapter', () => {
  let adapter: DockerSandboxAdapter;

  beforeEach(() => {
    adapter = new DockerSandboxAdapter();
  });

  it('should have correct metadata', () => {
    expect(adapter.id).toBe('docker-sandbox');
    expect(adapter.name).toBe('Docker Sandbox');
    expect(adapter.isDestructive).toBe(true);
  });

  it('should list sandbox tools', () => {
    expect(adapter.tools.map(t => t.name)).toContain('sandbox_exec');
    expect(adapter.tools.map(t => t.name)).toContain('sandbox_read_file');
  });
});