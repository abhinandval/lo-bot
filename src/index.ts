#!/usr/bin/env node

import { loadConfig } from './config/loader.js';
import { LoBotEngine } from './core/engine.js';

async function main() {
  try {
    const config = await loadConfig();
    const engine = new LoBotEngine(config);

    console.log('Initializing Lo-Bot...');
    await engine.initialize();

    console.log('\nLo-Bot ready! Type "exit" to quit.\n');

    // Simple CLI mode for testing
    const message = 'Hello! Can you tell me what capabilities you have?';
    console.log('User:', message);
    
    const response = await engine.chat(message);
    console.log('Bot:', response);

    // Cleanup
    await engine.destroy();
    
    console.log('\nLo-Bot shutdown complete.');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();