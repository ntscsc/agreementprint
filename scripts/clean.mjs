import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Resolve from this script, so invoking it from another directory is safe.
const buildDirectory = fileURLToPath(new URL('../.next/', import.meta.url));
await rm(buildDirectory, { recursive: true, force: true });
console.log('Removed Next.js build output (.next).');
