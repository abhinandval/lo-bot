import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

import type { IToolAdapter, ToolDefinition, ToolResult } from '../../core/interfaces/tool-adapters.js';
import type { HealthStatus } from '../../core/types.js';

export interface DockerSandboxConfig {
  image?: string;
  timeout?: number;
  allowNetwork?: boolean;
}

/**
 * Docker-based sandbox adapter.
 * Executes commands in isolated containers with resource limits.
 */
export class DockerSandboxAdapter implements IToolAdapter {
  readonly id = 'docker-sandbox';
  readonly name = 'Docker Sandbox';
  readonly version = '1.0.0';
  readonly capabilities = ['execute', 'file'];
  readonly isDestructive = true;

  tools: ToolDefinition[] = [
    {
      name: 'sandbox_exec',
      description: 'Execute command in sandboxed container',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          timeout: { type: 'number' }
        },
        required: ['command']
      }
    },
    {
      name: 'sandbox_read_file',
      description: 'Read file from sandbox workspace',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path']
      }
    },
    {
      name: 'sandbox_write_file',
      description: 'Write file to sandbox workspace',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content']
      }
    }
  ];

  private config: DockerSandboxConfig = {
    image: 'alpine:latest',
    timeout: 30000,
    allowNetwork: false
  };

  private workspaceDir = '/tmp/lo-bot-sandbox';

  async init(config?: DockerSandboxConfig): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    try {
      await execAsync(`mkdir -p ${this.workspaceDir}`);
      await execAsync('docker version'); // Verify Docker available
    } catch (error) {
      console.warn('[DockerSandboxAdapter] Docker not available:', error);
    }
  }

  async destroy(): Promise<void> {
    try {
      await execAsync(`docker rm -f $(docker ps -q --filter "label=lo-bot-sandbox") 2>/dev/null || true`);
    } catch {
      // Ignore cleanup errors
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      const start = Date.now();
      await execAsync('docker version');
      return {
        status: 'healthy',
        lastCheck: new Date(),
        latency: Date.now() - start,
        capabilities: this.capabilities
      };
    } catch {
      return {
        status: 'error',
        lastCheck: new Date(),
        capabilities: this.capabilities,
        error: 'Docker not available'
      };
    }
  }

  async execute(toolName: string, params: unknown): Promise<ToolResult> {
    try {
      switch (toolName) {
        case 'sandbox_exec':
          return await this.execCommand(params as { command: string; timeout?: number });
        
        case 'sandbox_read_file':
          return await this.readFile(params as { path: string });
        
        case 'sandbox_write_file':
          return await this.writeFile(params as { path: string; content: string });
        
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed'
      };
    }
  }

  private async execCommand({ command, timeout }: { command: string; timeout?: number }): Promise<ToolResult> {
    const containerName = `lo-bot-${Date.now()}`;
    const execTimeout = timeout ?? this.config.timeout ?? 30000;

    return new Promise((resolve) => {
      const dockerArgs = [
        'run', '--rm',
        '--name', containerName,
        '--label', 'lo-bot-sandbox=true',
        '-v', `${this.workspaceDir}:/workspace`,
        '-w', '/workspace',
        '--net', this.config.allowNetwork ? 'bridge' : 'none',
        '--cpus', '1',
        '--memory', '512m',
        this.config.image ?? 'alpine:latest',
        'sh', '-c', command
      ];

      const proc = spawn('docker', dockerArgs);
      const timeoutHandle = setTimeout(() => {
        proc.kill('SIGKILL');
        resolve({ success: false, error: 'Command timeout' });
      }, execTimeout);

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        clearTimeout(timeoutHandle);
        resolve({
          success: code === 0,
          data: stdout.slice(0, 10000),
          error: stderr || (code !== 0 ? `Exit code: ${code}` : undefined)
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutHandle);
        resolve({ success: false, error: err.message });
      });
    });
  }

  private async readFile({ path }: { path: string }): Promise<ToolResult> {
    const sanitizedPath = path.replace(/\.\.\/|~\//g, '');
    const fullPath = `${this.workspaceDir}/${sanitizedPath}`;
    
    try {
      const { stdout } = await execAsync(`cat "${fullPath}"`, { encoding: 'utf8' });
      return { success: true, data: stdout };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Read failed' };
    }
  }

  private async writeFile({ path, content }: { path: string; content: string }): Promise<ToolResult> {
    const sanitizedPath = path.replace(/\.\.\/|~\//g, '');
    const fullPath = `${this.workspaceDir}/${sanitizedPath}`;
    
    try {
      await execAsync(`mkdir -p $(dirname "${fullPath}")`);
      await execAsync(`printf '%s' "${content.replace(/"/g, '\\"')}" > "${fullPath}"`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Write failed' };
    }
  }
}