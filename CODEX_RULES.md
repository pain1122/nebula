# Codex Rules for Checkupino

## Primary Rule (Non-Negotiable)
- DO NOT modify any file automatically.
- Only inspect, report issues, and propose exact changes as patches/snippets.
- Wait for explicit confirmation before any edit.

## Project Reality (So you don’t assume wrong things)
- Backend: Laravel (runs in Docker)
- Frontend assets: Blade + Vite (Laravel Vite)
- A separate React app may exist under `frontend/`, but the current UI also relies on Laravel Vite assets.
- Local environment uses Docker (nginx + php-fpm + mysql + redis).

## What to do
- Identify bugs, security issues, missing env/config, broken imports, and Windows→Linux case-sensitivity risks.
- Provide step-by-step fix instructions.
- Provide minimal diffs (unified diff) or file snippets with exact file paths and where to paste them.
- When suggesting commands, assume Docker:
  - `docker compose exec app bash`
  - `php artisan ...`

## What NOT to do
- Do not rename files/folders automatically.
- Do not change routes/components silently.
- Do not generate large refactors without a plan and approval.
- Do not invent credentials, API keys, or production settings.

## Required output format
1) Problem summary
2) Where it happens (file paths + line hints)
3) Why it breaks (especially Linux deploy risks)
4) Proposed fix (snippets/diff + exact commands)
5) Verification steps (how to confirm the fix)

## Known setup pitfalls (mention these when relevant)
- Missing Vite manifest: `public/build/manifest.json` (fixed by `npm run dev` or `npm run build`)
- Laravel cache path issues on fresh clones (ensure `storage/framework/*` exists and is writable)
- Database is empty until seeding is run (`php artisan db:seed` or `php artisan migrate:fresh --seed`)