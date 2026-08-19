/**
 * Config entrypoint. Importing this module loads and validates configuration
 * from `process.env` **once**, at import time — so a misconfigured production
 * process fails fast on boot with a clear message.
 *
 * Tests should import {@link loadConfig} from `./config.js` directly to inject a
 * custom env without triggering this process-wide load.
 */

// Load a local `.env` (git-ignored) before reading process.env. No-op when the
// file is absent, e.g. in production where env comes from k8s. Runs before the
// singleton below because ESM evaluates imports in source order.
import 'dotenv/config';

import { loadConfig } from './config.js';

export * from './config.js';
export * from './env.js';

/** The validated, process-wide configuration singleton. */
export const config = loadConfig();
