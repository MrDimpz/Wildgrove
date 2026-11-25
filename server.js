/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { startServer } from './server/app.js';

startServer().catch((err) => {
  console.error('Wildgrove Sanctuary server failed to start:', err);
  process.exit(1);
});
