import type { IToolAdapter, ToolDefinition, ToolResult } from '../../core/interfaces/tool-adapters.js';
import type { HealthStatus } from '../../core/types.js';

export interface SearXNGConfig {
  baseUrl: string;
}

export interface SearchResult {
  title: string;
  url: string;
  content?: string;
}

/**
 * SearXNG web search adapter.
 * Provides web search and fetch via local SearXNG instance.
 */
export class SearXNGAdapter implements IToolAdapter {
  readonly id = 'searxng';
  readonly name = 'SearXNG Search';
  readonly version = '1.0.0';
  readonly capabilities = ['search', 'fetch'];
  readonly isDestructive = false;

  tools: ToolDefinition[] = [
    {
      name: 'web_search',
      description: 'Search the web using SearXNG',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          count: { type: 'number', default: 5 }
        },
        required: ['query']
      }
    },
    {
      name: 'web_fetch',
      description: 'Fetch page content from a URL',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' }
        },
        required: ['url']
      }
    }
  ];

  private config?: SearXNGConfig;

  async init(config: SearXNGConfig): Promise<void> {
    this.config = config;
  }

  async destroy(): Promise<void> {
    this.config = undefined;
  }

  async healthCheck(): Promise<HealthStatus> {
    if (!this.config) {
      return {
        status: 'offline',
        lastCheck: new Date(),
        capabilities: this.capabilities,
        error: 'Not initialized'
      };
    }

    try {
      const start = Date.now();
      const response = await fetch(`${this.config.baseUrl}/health`);
      const status = response.ok ? 'healthy' : 'error';
      return {
        status,
        lastCheck: new Date(),
        latency: Date.now() - start,
        capabilities: this.capabilities,
        error: response.ok ? undefined : `HTTP ${response.status}`
      };
    } catch (error) {
      return {
        status: 'error',
        lastCheck: new Date(),
        capabilities: this.capabilities,
        error: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }

  async execute(toolName: string, params: unknown): Promise<ToolResult> {
    if (!this.config) {
      return { success: false, error: 'Not initialized' };
    }

    try {
      switch (toolName) {
        case 'web_search': {
          const { query, count = 5 } = params as { query: string; count?: number };
          const results = await this.search(query, count);
          return { success: true, data: { results } };
        }

        case 'web_fetch': {
          const { url } = params as { url: string };
          const content = await this.fetch(url);
          return { success: true, data: { content } };
        }

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

  async search(query: string, count = 5): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      count: count.toString()
    });

    const response = await fetch(`${this.config!.baseUrl}/search?${params}`);
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const data = await response.json() as { results: Array<{ title: string; url: string; content?: string }> };
    
    return data.results.map(r => ({
      title: r.title,
      url: r.url,
      content: r.content
    }));
  }

  async fetch(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status}`);
    }
    return await response.text();
  }
}