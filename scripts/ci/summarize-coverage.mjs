#!/usr/bin/env node

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';

const rootDir = process.cwd();
const coverageRoot = resolve(rootDir, 'coverage');
const outputFlag = '--out';

const parseOutputPath = (argv) => {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === outputFlag) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        console.error(
          'Coverage summary failed: --out requires a file path value.',
        );
        process.exit(1);
      }
      return value;
    }

    if (arg.startsWith(`${outputFlag}=`)) {
      const value = arg.slice(`${outputFlag}=`.length);
      if (!value) {
        console.error(
          'Coverage summary failed: --out requires a file path value.',
        );
        process.exit(1);
      }
      return value;
    }
  }

  return 'coverage/summary.md';
};

const walk = async (dir) => {
  const results = [];
  let entries = [];

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await walk(fullPath);
      results.push(...nested);
      continue;
    }

    if (entry.isFile() && entry.name === 'coverage-summary.json') {
      results.push(fullPath);
    }
  }

  return results;
};

const pct = (covered, total) =>
  total > 0 ? Number(((covered / total) * 100).toFixed(2)) : 100;

const formatPct = (value) => `${value.toFixed(2)}%`;

const summaryFiles = await walk(coverageRoot);
if (summaryFiles.length === 0) {
  console.error(
    'Coverage summary failed: no coverage-summary.json files were found under coverage/.',
  );
  process.exit(1);
}

const rows = [];
const aggregate = {
  statements: { covered: 0, total: 0 },
  branches: { covered: 0, total: 0 },
  functions: { covered: 0, total: 0 },
  lines: { covered: 0, total: 0 },
};

for (const filePath of summaryFiles) {
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  const total = parsed?.total;

  if (!total) {
    console.error(
      `Coverage summary failed: invalid summary file ${relative(rootDir, filePath)}.`,
    );
    process.exit(1);
  }

  const rel = relative(coverageRoot, dirname(filePath)).replace(/\\/g, '/');

  const row = {
    project: rel || '.',
    statements: pct(total.statements.covered, total.statements.total),
    branches: pct(total.branches.covered, total.branches.total),
    functions: pct(total.functions.covered, total.functions.total),
    lines: pct(total.lines.covered, total.lines.total),
  };

  rows.push(row);

  aggregate.statements.covered += total.statements.covered;
  aggregate.statements.total += total.statements.total;
  aggregate.branches.covered += total.branches.covered;
  aggregate.branches.total += total.branches.total;
  aggregate.functions.covered += total.functions.covered;
  aggregate.functions.total += total.functions.total;
  aggregate.lines.covered += total.lines.covered;
  aggregate.lines.total += total.lines.total;
}

rows.sort((left, right) => left.project.localeCompare(right.project));

const overall = {
  statements: pct(aggregate.statements.covered, aggregate.statements.total),
  branches: pct(aggregate.branches.covered, aggregate.branches.total),
  functions: pct(aggregate.functions.covered, aggregate.functions.total),
  lines: pct(aggregate.lines.covered, aggregate.lines.total),
};

const markdownLines = [
  '## Coverage Summary',
  '',
  '| Project | Statements | Branches | Functions | Lines |',
  '| --- | ---: | ---: | ---: | ---: |',
  ...rows.map(
    (row) =>
      `| ${row.project} | ${formatPct(row.statements)} | ${formatPct(row.branches)} | ${formatPct(row.functions)} | ${formatPct(row.lines)} |`,
  ),
  `| **Overall** | **${formatPct(overall.statements)}** | **${formatPct(overall.branches)}** | **${formatPct(overall.functions)}** | **${formatPct(overall.lines)}** |`,
  '',
  `_Generated from ${summaryFiles.length} coverage-summary.json files._`,
  '',
];

const outputPath = parseOutputPath(process.argv.slice(2));
const absoluteOutputPath = resolve(rootDir, outputPath);
await mkdir(dirname(absoluteOutputPath), { recursive: true });
await writeFile(absoluteOutputPath, markdownLines.join('\n'), 'utf8');

console.log(`Coverage summary written to ${outputPath}`);
