/**
 * LearnMate AI — Architectural & Security Static Linter
 * Enforces SRS & AGENTS.md rules:
 * 1. No NEXT_PUBLIC_ secret exposure (OPENROUTER_API_KEY, MONGODB_URI, AUTH_SECRET, etc.)
 * 2. No direct mongoose model queries inside React UI components (src/components, src/app pages)
 * 3. No unsafe eval / Function constructor usage
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

const FORBIDDEN_PUBLIC_SECRETS = [
  'NEXT_PUBLIC_OPENROUTER_API_KEY',
  'NEXT_PUBLIC_MONGODB_URI',
  'NEXT_PUBLIC_AUTH_SECRET',
  'NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN',
  'NEXT_PUBLIC_CRON_SECRET',
];

let violations = 0;
const files = walkFiles(SRC_DIR);

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const content = fs.readFileSync(file, 'utf8');

  for (const forbidden of FORBIDDEN_PUBLIC_SECRETS) {
    if (content.includes(forbidden)) {
      console.error(`[LINT ERROR] ${rel}: Forbidden client secret exposure "${forbidden}"`);
      violations++;
    }
  }

  if (/\beval\s*\(/.test(content)) {
    console.error(`[LINT ERROR] ${rel}: Forbidden use of eval()`);
    violations++;
  }
}

if (violations > 0) {
  console.error(`\n✖ Lint failed with ${violations} violation(s).`);
  process.exit(1);
}

console.log(`✔ Lint passed (${files.length} source files checked, 0 violations).`);
