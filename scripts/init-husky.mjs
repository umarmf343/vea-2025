#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const commands = [
  {
    command: 'pnpm',
    args: ['dlx', 'husky', 'init']
  },
  {
    command: 'npx',
    args: ['--yes', 'husky', 'init']
  },
  {
    command: 'npm',
    args: ['exec', '--', 'husky', 'init']
  }
];

for (const { command, args } of commands) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (result.status === 0) {
    process.exit(0);
  }

  if (result.error && result.error.code === 'ENOENT') {
    continue;
  }
}

console.error(
  '\nHusky could not be initialized automatically. Please ensure that either pnpm or npx is available.'
);
process.exit(1);
