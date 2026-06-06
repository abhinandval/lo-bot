import type { IToolAdapter, ToolDefinition, ToolResult } from '../../core/interfaces/tool-adapters.js';
import type { HealthStatus } from '../../core/types.js';

// Note: Playwright is imported dynamically to allow tests to run without browser
let chromium: typeof import('playwright') | null = null;

async function getChromium() {
  if (!chromium) {
    chromium = await import('playwright');
  }
  return chromium;
}

export interface PlaywrightConfig {
  headless?: boolean;
}

/**
 * Playwright browser tool adapter.
 * Provides browser automation: navigate, click, type, read, screenshot.
 */
export class PlaywrightBrowserAdapter implements IToolAdapter {
  readonly id = 'playwright';
  readonly name = 'Playwright Browser';
  readonly version = '1.0.0';
  readonly capabilities = ['browse'];
  readonly isDestructive = false;

  tools: ToolDefinition[] = [
    {
      name: 'browser_navigate',
      description: 'Navigate to a URL',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to navigate to' }
        },
        required: ['url']
      }
    },
    {
      name: 'browser_click',
      description: 'Click an element by selector',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector' }
        },
        required: ['selector']
      }
    },
    {
      name: 'browser_type',
      description: 'Type text into an input',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string' },
          text: { type: 'string' }
        },
        required: ['selector', 'text']
      }
    },
    {
      name: 'browser_read',
      description: 'Extract readable text from page',
      parameters: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'browser_screenshot',
      description: 'Take a screenshot of the current page',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Optional path to save screenshot' }
        }
      }
    }
  ];

  private browser: Awaited<ReturnType<typeof import('playwright')['chromium']['launch']>> | null = null;
  private page: Awaited<ReturnType<Awaited<ReturnType<typeof import('playwright')['chromium']>>['newPage']>> | null = null;
  private config: PlaywrightConfig = { headless: true };

  async init(config?: PlaywrightConfig): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    try {
      const chrome = await getChromium();
      this.browser = await chrome.chromium.launch({ 
        headless: this.config.headless 
      });
      this.page = await this.browser.newPage();
    } catch (error) {
      console.warn('[PlaywrightBrowserAdapter] Failed to initialize browser:', error);
    }
  }

  async destroy(): Promise<void> {
    await this.page?.close();
    await this.browser?.close();
    this.page = null;
    this.browser = null;
  }

  async healthCheck(): Promise<HealthStatus> {
    if (!this.browser || !this.page) {
      return {
        status: 'offline',
        lastCheck: new Date(),
        capabilities: this.capabilities,
        error: 'Browser not initialized'
      };
    }

    try {
      const start = Date.now();
      await this.page.evaluate(() => document.title);
      return {
        status: 'healthy',
        lastCheck: new Date(),
        latency: Date.now() - start,
        capabilities: this.capabilities
      };
    } catch (error) {
      return {
        status: 'error',
        lastCheck: new Date(),
        capabilities: this.capabilities,
        error: error instanceof Error ? error.message : 'Browser check failed'
      };
    }
  }

  async execute(toolName: string, params: unknown): Promise<ToolResult> {
    if (!this.page) {
      return { success: false, error: 'Browser not initialized' };
    }

    try {
      switch (toolName) {
        case 'browser_navigate': {
          const { url } = params as { url: string };
          await this.page.goto(url, { waitUntil: 'networkidle' });
          return {
            success: true,
            data: { url: this.page.url(), title: await this.page.title() }
          };
        }

        case 'browser_click': {
          const { selector } = params as { selector: string };
          await this.page.click(selector);
          return { success: true };
        }

        case 'browser_type': {
          const { selector, text } = params as { selector: string; text: string };
          await this.page.fill(selector, text);
          return { success: true };
        }

        case 'browser_read': {
          const text = await this.page.evaluate(() => {
            const article = document.querySelector('article, main, [role="main"]');
            if (article) return article.textContent;
            return document.body?.textContent?.slice(0, 5000);
          });
          return { success: true, data: { text } };
        }

        case 'browser_screenshot': {
          const { path } = params as { path?: string };
          const screenshot = await this.page.screenshot();
          if (path) {
            const fs = await import('fs');
            await fs.promises.writeFile(path, screenshot);
            return { success: true, data: { path } };
          }
          return { success: true, data: { base64: screenshot.toString('base64') } };
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
}