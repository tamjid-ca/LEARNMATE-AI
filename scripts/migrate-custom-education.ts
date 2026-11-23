/**
 * CLI runner for Phase 01 idempotent custom education backfill & index migration.
 * Usage: node --experimental-strip-types scripts/migrate-custom-education.ts [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { runCustomEducationMigration } from '../src/lib/database/migrations/custom-education-migration.ts';

function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes('--dry-run');
  const result = await runCustomEducationMigration({ dryRun });
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
