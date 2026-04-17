#!/usr/bin/env node

import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const requiredFiles = [
  'apps/storybook-hub/docs/README.mdx',
  'apps/storybook-hub/docs/overview.mdx',
  'apps/storybook-hub/docs/getting-started.mdx',
  'apps/storybook-hub/docs/migration-guide.mdx',
  'apps/storybook-hub/docs/architecture.mdx',
  'apps/storybook-hub/docs/contracts-loader.mdx',
  'apps/storybook-hub/docs/contracts-player.mdx',
  'apps/storybook-hub/docs/contracts-controls.mdx',
  'apps/storybook-hub/docs/workers-and-audio.mdx',
  'apps/storybook-web/stories/framework-agnostic-example.mdx',
  'apps/storybook-react/stories/react-example.mdx',
  'apps/storybook-hub/docs/contribution.mdx',
];

const missing = [];

for (const relativePath of requiredFiles) {
  const absolutePath = resolve(process.cwd(), relativePath);
  try {
    await access(absolutePath, constants.F_OK);
  } catch {
    missing.push(relativePath);
  }
}

if (missing.length > 0) {
  console.error('Missing required documentation files:');
  for (const filePath of missing) {
    console.error(`- ${filePath}`);
  }
  process.exit(1);
}

console.log('Docs gate passed: all required documentation files exist.');
