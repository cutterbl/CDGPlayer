#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootPackagePath = resolve(process.cwd(), 'package.json');
const rootPackageRaw = await readFile(rootPackagePath, 'utf8');
const rootPackage = JSON.parse(rootPackageRaw);

if (
  typeof rootPackage.packageManager !== 'string' ||
  !rootPackage.packageManager.startsWith('pnpm@')
) {
  console.error(
    'Release-readiness check failed: root packageManager must be pinned to pnpm.',
  );
  process.exit(1);
}

const scopedPackages = ['cdg-core', 'cdg-loader', 'cdg-player', 'cdg-controls'];
const versions = new Map();

for (const packageName of scopedPackages) {
  const packagePath = resolve(
    process.cwd(),
    `packages/${packageName}/package.json`,
  );
  const packageRaw = await readFile(packagePath, 'utf8');
  const packageJson = JSON.parse(packageRaw);
  versions.set(packageName, packageJson.version);
}

const uniqueVersions = new Set(versions.values());
if (uniqueVersions.size !== 1) {
  console.error(
    'Release-readiness check failed: @cxing/cdg-* package versions are not synchronized.',
  );
  for (const [packageName, version] of versions.entries()) {
    console.error(`- ${packageName}: ${version}`);
  }
  process.exit(1);
}

console.log(
  'Release-readiness gate passed: pnpm is pinned and @cxing/cdg-* package versions are synchronized.',
);
