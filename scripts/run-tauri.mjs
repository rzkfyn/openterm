import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

// Inject Strawberry Perl if present
const strawberryPaths = [
  'C:\\Strawberry\\c\\bin',
  'C:\\Strawberry\\perl\\site\\bin',
  'C:\\Strawberry\\perl\\bin',
];

for (const p of strawberryPaths) {
  if (existsSync(p) && !process.env.PATH?.includes(p)) {
    process.env.PATH = `${p};${process.env.PATH}`;
  }
}

const args = process.argv.slice(2);
const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const proc = spawn(cmd, ['tauri', ...args], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

proc.on('exit', (code) => {
  process.exit(code ?? 0);
});
