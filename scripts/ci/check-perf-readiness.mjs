#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { readdir } from 'node:fs/promises';

const perfSignals = [
  'packages/cdg-player/src/lib/render.worker.ts',
  'packages/cdg-player/src/lib/renderer.ts',
];

const perfBudgetConfigPath = 'configs/perf-budgets.json';
const artifactFlag = '--artifact';
const requireArtifactsFlag = '--require-artifacts';
const defaultArtifactDirs = ['artifacts/perf', '.dist/perf'];

const instrumentationChecks = [
  {
    path: 'packages/cdg-player/src/lib/player.ts',
    requiredSnippets: ["'rendermetrics'", 'renderMetrics', 'atMs'],
  },
  {
    path: 'packages/cdg-player/src/lib/renderer.ts',
    requiredSnippets: [
      'frameCpuMs',
      'transferredBytes',
      "readonly mode = 'worker'",
    ],
  },
];

const missing = [];

const parseArtifactArgs = (argv) => {
  const artifactPaths = [];
  let requireArtifacts = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === requireArtifactsFlag) {
      requireArtifacts = true;
      continue;
    }

    if (arg === artifactFlag) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        console.error(
          'Perf-readiness check failed: --artifact requires a file path value.',
        );
        process.exit(1);
      }

      artifactPaths.push(value);
      index += 1;
      continue;
    }

    if (arg.startsWith(`${artifactFlag}=`)) {
      const value = arg.slice(`${artifactFlag}=`.length);
      if (!value) {
        console.error(
          'Perf-readiness check failed: --artifact requires a file path value.',
        );
        process.exit(1);
      }

      artifactPaths.push(value);
    }
  }

  return {
    artifactPaths,
    requireArtifacts,
  };
};

const discoverArtifactPaths = async () => {
  const discovered = [];

  for (const dir of defaultArtifactDirs) {
    const absoluteDir = resolve(process.cwd(), dir);
    let entries;
    try {
      entries = await readdir(absoluteDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }

      discovered.push(`${dir}/${entry.name}`);
    }
  }

  return discovered;
};

const isFiniteNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value);

const summarizeSamples = (samples) => {
  if (samples.length === 0) {
    return null;
  }

  const sortedCpu = samples
    .map((sample) => sample.frameCpuMs)
    .sort((a, b) => a - b);
  const p95Index = Math.min(
    sortedCpu.length - 1,
    Math.floor(sortedCpu.length * 0.95),
  );
  const totalCpu = samples.reduce((sum, sample) => sum + sample.frameCpuMs, 0);
  const totalTransferred = samples.reduce(
    (sum, sample) => sum + sample.transferredBytes,
    0,
  );

  return {
    sampleCount: samples.length,
    avgFrameCpuMs: totalCpu / samples.length,
    p95FrameCpuMs: sortedCpu[p95Index] ?? 0,
    avgTransferredBytes: totalTransferred / samples.length,
    maxTransferredBytes: Math.max(
      ...samples.map((sample) => sample.transferredBytes),
    ),
  };
};

for (const relativePath of perfSignals) {
  const absolutePath = resolve(process.cwd(), relativePath);
  try {
    await access(absolutePath, constants.F_OK);
  } catch {
    missing.push(relativePath);
  }
}

const configAbsolutePath = resolve(process.cwd(), perfBudgetConfigPath);
try {
  await access(configAbsolutePath, constants.F_OK);
} catch {
  missing.push(perfBudgetConfigPath);
}

if (missing.length > 0) {
  console.error(
    'Perf-readiness check failed: missing required perf artifacts:',
  );
  for (const relativePath of missing) {
    console.error(`- ${relativePath}`);
  }
  process.exit(1);
}

const perfBudgetRaw = await readFile(configAbsolutePath, 'utf8');
const perfBudgets = JSON.parse(perfBudgetRaw);

const isPositiveNumber = (value) => isFiniteNumber(value) && value > 0;

if (
  !perfBudgets ||
  typeof perfBudgets !== 'object' ||
  !isPositiveNumber(perfBudgets.renderDispatch?.mainThread?.maxFrameCpuMs) ||
  !isPositiveNumber(perfBudgets.renderDispatch?.worker?.maxFrameCpuMs) ||
  !isPositiveNumber(perfBudgets.renderDispatch?.worker?.maxTransferredBytes)
) {
  console.error(
    'Perf-readiness check failed: configs/perf-budgets.json is missing required positive numeric thresholds.',
  );
  process.exit(1);
}

for (const check of instrumentationChecks) {
  const absolutePath = resolve(process.cwd(), check.path);
  const source = await readFile(absolutePath, 'utf8');
  const missingSnippets = check.requiredSnippets.filter(
    (snippet) => !source.includes(snippet),
  );

  if (missingSnippets.length > 0) {
    console.error(
      `Perf-readiness check failed: ${check.path} is missing instrumentation markers:`,
    );
    for (const snippet of missingSnippets) {
      console.error(`- ${snippet}`);
    }
    process.exit(1);
  }
}

const cliArgs = parseArtifactArgs(process.argv.slice(2));
const autoDiscoveredArtifacts =
  cliArgs.artifactPaths.length > 0 ? [] : await discoverArtifactPaths();
const artifactPaths =
  cliArgs.artifactPaths.length > 0
    ? cliArgs.artifactPaths
    : autoDiscoveredArtifacts;

if (cliArgs.requireArtifacts && artifactPaths.length === 0) {
  console.error(
    'Perf-readiness check failed: artifact validation is required but no artifact files were provided or discovered.',
  );
  process.exit(1);
}

if (artifactPaths.length > 0) {
  const collectedSamples = {
    'main-thread': [],
    worker: [],
  };

  for (const artifactPath of artifactPaths) {
    const absoluteArtifactPath = resolve(process.cwd(), artifactPath);
    let artifactRaw;
    try {
      artifactRaw = await readFile(absoluteArtifactPath, 'utf8');
    } catch {
      console.error(
        `Perf-readiness check failed: unable to read perf artifact ${artifactPath}.`,
      );
      process.exit(1);
    }

    let artifact;
    try {
      artifact = JSON.parse(artifactRaw);
    } catch {
      console.error(
        `Perf-readiness check failed: invalid JSON in perf artifact ${artifactPath}.`,
      );
      process.exit(1);
    }

    if (artifact?.schemaVersion !== 1 || !Array.isArray(artifact?.samples)) {
      console.error(
        `Perf-readiness check failed: perf artifact ${artifactPath} must include schemaVersion=1 and a samples array.`,
      );
      process.exit(1);
    }

    for (const sample of artifact.samples) {
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
          `Perf-readiness check failed: perf artifact ${artifactPath} contains invalid sample entries.`,
        );
        process.exit(1);
      }

      collectedSamples[sample.mode].push(sample);
    }
  }

  const mainSummary = summarizeSamples(collectedSamples['main-thread']);
  const workerSummary = summarizeSamples(collectedSamples.worker);

  if (!mainSummary || !workerSummary) {
    console.error(
      'Perf-readiness check failed: provided artifact set must include both main-thread and worker render samples.',
    );
    process.exit(1);
  }

  const maxMainThreadCpu = perfBudgets.renderDispatch.mainThread.maxFrameCpuMs;
  const maxWorkerCpu = perfBudgets.renderDispatch.worker.maxFrameCpuMs;
  const maxWorkerTransferred =
    perfBudgets.renderDispatch.worker.maxTransferredBytes;

  if (mainSummary.p95FrameCpuMs > maxMainThreadCpu) {
    console.error(
      `Perf-readiness check failed: main-thread p95 frame CPU (${mainSummary.p95FrameCpuMs.toFixed(2)} ms) exceeds budget (${maxMainThreadCpu} ms).`,
    );
    process.exit(1);
  }

  if (workerSummary.p95FrameCpuMs > maxWorkerCpu) {
    console.error(
      `Perf-readiness check failed: worker p95 frame CPU (${workerSummary.p95FrameCpuMs.toFixed(2)} ms) exceeds budget (${maxWorkerCpu} ms).`,
    );
    process.exit(1);
  }

  if (workerSummary.maxTransferredBytes > maxWorkerTransferred) {
    console.error(
      `Perf-readiness check failed: worker max transferred bytes (${workerSummary.maxTransferredBytes}) exceeds budget (${maxWorkerTransferred}).`,
    );
    process.exit(1);
  }

  console.log(
    `Perf-readiness gate passed with artifacts: main-thread p95 ${mainSummary.p95FrameCpuMs.toFixed(2)} ms, worker p95 ${workerSummary.p95FrameCpuMs.toFixed(2)} ms, worker max bytes ${workerSummary.maxTransferredBytes}.`,
  );

  if (cliArgs.artifactPaths.length === 0) {
    console.log(`Auto-discovered artifact inputs: ${artifactPaths.join(', ')}`);
  }

  process.exit(0);
}

console.log(
  'Perf-readiness gate passed: worker paths, render metrics instrumentation, and perf budget thresholds are in place. Add --artifact <path> to validate captured runtime samples.',
);
