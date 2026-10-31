import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const oxlintBin = path.join(root, "node_modules", "oxlint", "bin", "oxlint");

const runOxlint = (fixture) =>
  spawnSync(
    process.execPath,
    [oxlintBin, "--no-ignore", "--deny-warnings", "--format=unix", fixture],
    { cwd: root, encoding: "utf8" },
  );

const valid = runOxlint("quality-fixtures/valid/governed.tsx");
if (valid.status !== 0) {
  throw new Error(`valid lint fixture failed:\n${valid.stdout}${valid.stderr}`);
}

const invalidFixtures = [
  ["quality-fixtures/invalid/hooks.tsx", "rules-of-hooks"],
  ["quality-fixtures/invalid/accessibility.tsx", "alt-text"],
  ["quality-fixtures/invalid/restricted-import.ts", "no-restricted-imports"],
  ["quality-fixtures/invalid/render-effect.tsx", "set-state-in-effect"],
  ["quality-fixtures/invalid/unused.ts", "no-unused-vars"],
  ["quality-fixtures/invalid/vitest.ts", "expect-expect"],
];

for (const [fixture, expectedRule] of invalidFixtures) {
  const result = runOxlint(fixture);
  const output = `${result.stdout}${result.stderr}`;
  if (result.status === 0 || !output.includes(expectedRule)) {
    throw new Error(`invalid lint fixture ${fixture} did not prove ${expectedRule}:\n${output}`);
  }
}

console.log(`Lint fixtures pass: 1 valid and ${invalidFixtures.length} rejected cases.`);
