# Codex Rules for Checkupino

## Primary Rule
- Default mode is inspect, explain, and propose exact changes without editing files.
- Modify files only when the user explicitly asks for edits or approves a proposed change.
- When edits are approved, keep them limited to the requested scope and verify them.

## Project Reality
- Backend: Laravel 12 running in Docker.
- Root frontend assets: Blade + Laravel Vite.
- Separate frontend workspace: `frontend/` currently holds a parked Velzon React-TS Create React App template.
- Local environment: Docker with Nginx, PHP-FPM, MySQL, and Redis.
- Local app URL: `http://localhost:8080`.
- Local API base: `http://localhost:8080/api`.
- Production Docker skeleton: `docker-compose.prod.yml` plus `docker/prod/`, with no whole-project bind mount.

## What To Do
- Identify bugs, security issues, missing env/config, broken imports, stale docs, and Windows-to-Linux case-sensitivity risks.
- Explain why a change is needed before broad edits.
- Prefer small, verifiable changes.
- When suggesting backend commands, assume Docker by default:
  - `docker compose exec app php artisan ...`
  - `docker compose exec app bash`
- Remember that `DB_HOST=db` works inside Docker, not from host-side PHP.

## What Not To Do
- Do not rename files/folders automatically without explicit approval.
- Do not change routes/components silently.
- Do not generate large refactors without a plan and approval.
- Do not invent credentials, API keys, or production settings.
- Do not treat `frontend/` as production-ready until the frontend rebuild phase wires routing, auth, and API clients intentionally.
- Do not use local bind-mount Docker patterns as production deployment patterns.

## Preferred Report Format For Reviews
1. Problem summary.
2. Where it happens, with file paths and line hints.
3. Why it breaks, especially Linux deploy or runtime risks.
4. Proposed fix, using snippets or diffs.
5. Verification steps.

## Known Setup Pitfalls
- Missing Vite manifest: `public/build/manifest.json`, fixed by running root `npm run dev` or `npm run build`.
- Laravel cache path issues on fresh clones: ensure `storage/framework/*` and `bootstrap/cache` exist and are writable.
- Database is empty until migrations/seeders run: use `docker compose exec app php artisan migrate --seed`.
- Host PHP cannot resolve Docker hostname `db`; run Artisan inside Docker or use host MySQL port `3307`.
