# Perf Artifacts

This directory stores generated runtime perf capture artifacts consumed by:

- `pnpm run perf:check-artifacts`
- `pnpm run ci:perf`

Capture inputs:

- `captures/*.json` contains runtime-exported perf artifacts (for example from demo and framework-demo).

Default generated file:

- `ci-aggregated.json` created by `pnpm run perf:generate-artifact`

Expected artifact format:

- JSON payload with `schemaVersion: 1`
- `samples` array entries with:
  - `mode`: `main-thread` or `worker`
  - `frameCpuMs`: non-negative number
  - `transferredBytes`: non-negative integer
  - `atMs`: non-negative number

Notes:

- Commit runtime capture fixtures under `captures/`.
- Top-level generated `artifacts/perf/*.json` files are git-ignored.
