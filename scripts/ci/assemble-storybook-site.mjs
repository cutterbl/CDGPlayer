#!/usr/bin/env node

import { access, cp, mkdir, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

const hubDist = resolve(root, 'apps/storybook-hub/.dist');
const webDist = resolve(root, 'apps/storybook-web/.dist');
const reactDist = resolve(root, 'apps/storybook-react/.dist');

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

const copyIntoHub = async (sourcePath, targetName) => {
  const targetPath = resolve(hubDist, targetName);
  await rm(targetPath, { recursive: true, force: true });
  await mkdir(targetPath, { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true });
};

await copyIntoHub(webDist, 'storybook-web');
await copyIntoHub(reactDist, 'storybook-react');

console.log(
  'Storybook site assembled at apps/storybook-hub/.dist with embedded refs.',
);
