#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const log = (message) => process.stdout.write(`${message}\n`);

async function installHusky() {
  let huskyBinUrl;
  try {
    huskyBinUrl = await import.meta.resolve('husky/lib/bin.js');
  } catch (error) {
    log('[husky] Skipping Git hooks installation because Husky is not installed.');
    log('[husky] Run "npm install husky --save-dev" to enable Git hooks.');
    return;
  }

  const huskyBinPath = fileURLToPath(huskyBinUrl);

  try {
    execSync(`node "${huskyBinPath}" install`, { stdio: 'inherit' });
  } catch (error) {
    log('[husky] Failed to run Husky install command.');
    log(error.message);
  }
}

installHusky().catch((error) => {
  log('[husky] Unexpected error while running the Husky installer script.');
  log(error.message);
});
