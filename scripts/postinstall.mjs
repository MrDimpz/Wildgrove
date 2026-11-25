/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distIndex = path.join(rootDir, 'dist', 'index.html');
const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');

// Automatically build dist/ during Hostinger's `npm install` (Express preset has no separate build command)
if (!fs.existsSync(distIndex) && fs.existsSync(viteBin)) {
  console.log('[postinstall] dist/index.html not found — building Wildgrove Sanctuary frontend...');
  const result = spawnSync(process.execPath, ['--v8-pool-size=1', viteBin, 'build'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      RAYON_NUM_THREADS: '1',
      TOKIO_WORKER_THREADS: '1',
      ROLLDOWN_MAX_BLOCKING_THREADS: '2',
      UV_THREADPOOL_SIZE: '2',
    },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
