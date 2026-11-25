/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}
if (!process.env.UV_THREADPOOL_SIZE) {
  process.env.UV_THREADPOOL_SIZE = '2';
}

const { startServer } = await import('./server/app.js');

startServer().catch((err) => {
  console.error('Wildgrove Sanctuary server failed to start:', err);
  process.exit(1);
});
