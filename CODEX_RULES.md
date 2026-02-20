# Codex Rules for Checkupino

## Primary Rule
- DO NOT modify any file automatically.
- Only inspect, report issues, and propose exact changes as patches/snippets.
- Wait for explicit confirmation before any edit.

## What to do
- Identify bugs, security issues, missing env/config, broken imports, case-sensitivity risks (Windows vs Linux).
- Provide step-by-step fix instructions.
- Provide minimal diffs (unified diff) or file snippets with exact locations.

## What NOT to do
- Do not rename files/folders automatically.
- Do not change routes/components silently.
- Do not generate large refactors without a plan.

## Output format
1) Problem summary
2) Where it happens (file paths + line hints)
3) Why it breaks (especially Linux deploy risks)
4) Proposed fix (snippets/diff)
5) Verification steps
