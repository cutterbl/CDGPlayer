#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const defaultOutputPath = 'artifacts/perf/ci-aggregated.json';
const defaultInputDirs = ['artifacts/perf/captures', '.dist/perf/captures'];
const minSourceArtifacts = 2;

const parseOutputPath = (argv) => {
  const outFlag = '--out';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === outFlag) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        console.error(
          'Perf artifact generation failed: --out requires a file path value.',
        );
        process.exit(1);
      }

      return value;
    }

    if (arg.startsWith(`${outFlag}=`)) {
      const value = arg.slice(`${outFlag}=`.length);
      if (!value) {
        console.error(
          'Perf artifact generation failed: --out requires a file path value.',
        );
        process.exit(1);
      }

      return value;
    }
  }

  return defaultOutputPath;
};

const parseInputDirs = (argv) => {
  const inputDirFlag = '--input-dir';
  const dirs = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === inputDirFlag) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        console.error(
          'Perf artifact aggregation failed: --input-dir requires a directory path value.',
        );
        process.exit(1);
      }

      dirs.push(value);
      index += 1;
      continue;
    }

    if (arg.startsWith(`${inputDirFlag}=`)) {
      const value = arg.slice(`${inputDirFlag}=`.length);
      if (!value) {
        console.error(
          'Perf artifact aggregation failed: --input-dir requires a directory path value.',
        );
        process.exit(1);
      }

      dirs.push(value);
    }
  }

  return dirs.length > 0 ? dirs : defaultInputDirs;
};

const isFiniteNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value);

const validateSample = (sample, artifactPath) => {
  if (
    (sample?.mode !== 'main-thread' && sample?.mode !== 'worker') ||
    !isFiniteNumber(sample?.frameCpuMs) ||
    sample.frameCpuMs < 0 ||
    !Number.isInteger(sample?.transferredBytes) ||
    sample.transferredBytes < 0 ||
    !isFiniteNumber(sample?.atMs) ||
    sample.atMs < 0
  ) {
    console.error(
      `Perf artifact aggregation failed: invalid sample entry in ${artifactPath}.`,
    );
    process.exit(1);
  }
};

const argv = process.argv.slice(2);
const artifactOutputPath = parseOutputPath(argv);
const inputDirs = parseInputDirs(argv);
const artifactAbsolutePath = resolve(process.cwd(), artifactOutputPath);

const artifactInputs = [];

for (const inputDir of inputDirs) {
  const absoluteInputDir = resolve(process.cwd(), inputDir);
  let entries;
  try {
    entries = await readdir(absoluteInputDir, { withFileTypes: true });
  } catch {
    continue;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    artifactInputs.push({
      relativePath: `${inputDir}/${entry.name}`,
      absolutePath: resolve(absoluteInputDir, entry.name),
    });
  }
}

if (artifactInputs.length < minSourceArtifacts) {
  console.error(
    `Perf artifact aggregation failed: expected at least ${minSourceArtifacts} source artifacts across ${inputDirs.join(', ')} but found ${artifactInputs.length}.`,
  );
  process.exit(1);
}

const samples = [];
const sourceArtifacts = [];

for (const artifactInput of artifactInputs) {
  let artifactRaw;
  try {
    artifactRaw = await readFile(artifactInput.absolutePath, 'utf8');
  } catch {
    console.error(
      `Perf artifact aggregation failed: unable to read ${artifactInput.relativePath}.`,
    );
    process.exit(1);
  }

  let artifact;
  try {
    artifact = JSON.parse(artifactRaw);
  } catch {
    console.error(
      `Perf artifact aggregation failed: invalid JSON in ${artifactInput.relativePath}.`,
    );
    process.exit(1);
  }

  if (artifact?.schemaVersion !== 1 || !Array.isArray(artifact?.samples)) {
    console.error(
      `Perf artifact aggregation failed: ${artifactInput.relativePath} must include schemaVersion=1 and a samples array.`,
    );
    process.exit(1);
  }

  for (const sample of artifact.samples) {
    validateSample(sample, artifactInput.relativePath);
    samples.push(sample);
  }

  sourceArtifacts.push(artifactInput.relativePath);
}

if (samples.length === 0) {
  console.error(
    'Perf artifact aggregation failed: no samples found in source artifacts.',
  );
  process.exit(1);
}

samples.sort((left, right) => left.atMs - right.atMs);

const artifactPayload = {
  schemaVersion: 1,
  source: 'ci-aggregated',
  generatedAt: new Date().toISOString(),
  generatedFrom: 'runtime-captures',
  sourceArtifacts,
  totalSourceArtifacts: sourceArtifacts.length,
  totalSamples: samples.length,
  samples,
};

await mkdir(dirname(artifactAbsolutePath), { recursive: true });
await writeFile(
  artifactAbsolutePath,
  `${JSON.stringify(artifactPayload, null, 2)}\n`,
  'utf8',
);

console.log(
  `Aggregated perf artifact: ${artifactOutputPath} from ${sourceArtifacts.length} capture files and ${samples.length} samples.`,
);
