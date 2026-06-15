## Verification Status

Last verified against code: 2026-06-15
Verification method:
- repo inspection
- route list
- tests
- database check where relevant

If this file conflicts with source code, source code wins.
Update this module after verification.

# Admin Panel Context

Use this module for React admin shell, `/panel/*`, Velzon route/menu cleanup, root-admin developer toolbox isolation, RTL/localization, theme settings, and admin bundle optimization.

Do not load this module for backend-only auth role taxonomy unless frontend menus/routes are being changed.

## Current State

- Current production/runtime admin Blade panel still exists under `/admin/*`.
- Target admin UI is React + Bootstrap under `/panel/*`.
- `frontend/` is a Vite-powered Velzon React-TS workspace, not fully canonical yet.
- Active frontend session auth uses Sanctum cookies.
- Persian locale, RTL-first admin direction, local fonts, and persisted theme settings are in place.
- Velzon demo/template pages are still broadly present and inflate bundle size.
- `frontend/src/helpers/fakebackend_helper.ts` remains only for demo data slices and should move behind root-admin/developer toolbox boundaries before removal.

## Open First

Backend/admin surface:

- `routes/admin.php`
- `routes/api.php`
- `app/Http/Controllers/Admin/*`
- `app/Http/Controllers/Api/Admin/*`
- `resources/views/admin/*`

Frontend shell:

- `frontend/src/App.tsx`
- `frontend/src/Routes/AuthProtected.tsx`
- `frontend/src/Routes/allRoutes.tsx`
- `frontend/src/Layouts/index.tsx`
- `frontend/src/Layouts/VerticalLayouts/index.tsx`
- `frontend/src/Layouts/HorizontalLayout/index.tsx`
- `frontend/src/Layouts/TwoColumnLayout/index.tsx`
- `frontend/src/Layouts/Sidebar.tsx`
- `frontend/src/Layouts/Header.tsx`
- `frontend/src/Components/Common/ProfileDropdown.tsx`
- `frontend/src/Components/Common/LanguageDropdown.tsx`
- `frontend/src/slices/layouts/*`
- `frontend/src/helpers/session_api.ts`
- `frontend/src/helpers/fakebackend_helper.ts`
- `frontend/src/locales/fa.json`
- `frontend/src/i18n.ts`

## Heavy Paths

Avoid broad scans of:

- `frontend/src/pages/`
- `frontend/src/assets/`
- `frontend/public/assets/`

Open individual pages only when moving a specific route.

## Guardrails

- Do not treat the Velzon demo inventory as product admin functionality.
- Do not delete demo/fake helper code until the root-admin/devtool boundary is designed.
- Normal admin initial load should not pay for root-admin/demo utilities.
- Keep admin React styling Bootstrap-oriented.
- Keep public/client React styling Tailwind-oriented.
- Browser admin auth must remain session-cookie based.

## Verification

```bash
cd frontend
npm run build
```

If backend authority or routes change too:

```bash
docker compose exec app php artisan route:list --except-vendor
docker compose exec app php artisan test
```

## Update After Changes

- This module for durable admin shell/toolbox facts.
- `CURRENT_SPRINT.md` when sprint route/menu queue changes.
- `docs/architecture/boundaries.md` if UI ownership boundaries change.
