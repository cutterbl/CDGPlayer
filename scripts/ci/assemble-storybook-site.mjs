#!/usr/bin/env node

import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

const hubDist = resolve(root, 'apps/storybook-hub/.dist');
const webDist = resolve(root, 'apps/storybook-web/.dist');
const reactDist = resolve(root, 'apps/storybook-react/.dist');

/**
 * Ensures a required file or directory exists before continuing site assembly.
 */
const ensureExists = async (path, label) => {
  try {
    await access(path, constants.F_OK);
  } catch {
    console.error(
      `Storybook site assembly failed: missing ${label} at ${path}`,
    );
    process.exit(1);
  }
};

await ensureExists(hubDist, 'hub build output');
await ensureExists(webDist, 'web build output');
await ensureExists(reactDist, 'react build output');

/**
 * Replaces one embedded Storybook ref directory under the hub output.
 */
const copyIntoHub = async (sourcePath, targetName) => {
  const targetPath = resolve(hubDist, targetName);
  await rm(targetPath, { recursive: true, force: true });
  await mkdir(targetPath, { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true });

  await ensureRefCompatibilityManifests(targetPath);
};

/**
 * Storybook 10 emits `index.json` for refs, but some static composition clients
 * still request `stories.json` and `metadata.json`. Mirror the generated index
 * so composed hubs avoid 404 requests on static hosts.
 */
const ensureRefCompatibilityManifests = async (refDistPath) => {
  const indexPath = resolve(refDistPath, 'index.json');
  await ensureExists(indexPath, 'ref index.json');

  const indexContent = await readFile(indexPath, 'utf8');

  // Storybook 10 writes index.json; some static-composition flows still request
  // stories.json and metadata.json. Mirror index.json to avoid 404 churn.
  const legacyManifestNames = ['stories.json', 'metadata.json'];
  await Promise.all(
    legacyManifestNames.map(async (name) => {
      const manifestPath = resolve(refDistPath, name);
      await writeFile(manifestPath, indexContent, 'utf8');
    }),
  );
};

await copyIntoHub(webDist, 'storybook-web');
await copyIntoHub(reactDist, 'storybook-react');

console.log(
  'Storybook site assembled at apps/storybook-hub/.dist with embedded refs.',
);
