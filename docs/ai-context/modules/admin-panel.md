## Verification Status

Last verified against code: 2026-06-28
Verification method:
- repo inspection
- frontend route/menu source inspection
- `cd frontend && npm run build`
- user browser review of normal admin and root-admin views

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
- React route/menu ownership is split for the first admin shell slice.
- Product admin shell routes currently remain `/dashboard`, `/index`, `/profile`, and `/`.
- Root-admin developer/toolbox/demo routes are under `/panel/dev/*`.
- Former public Velzon demo/auth-inner/landing/maintenance routes are no longer public; they are root-admin protected under `/panel/dev/*`.
- Normal admin menu output shows product admin/profile links only. Root-admin menu output also includes the Developer Toolbox.
- Product-admin route definitions live in `frontend/src/panel/routes.tsx`; product-admin menu definitions live in `frontend/src/panel/menu.ts`.
- Root-admin toolbox/demo route definitions live in `frontend/src/devtools/toolboxRoutes.tsx`; root-admin toolbox menu behavior lives in `frontend/src/devtools/toolboxMenu.tsx`.
- `frontend/src/Routes/allRoutes.tsx` and `frontend/src/Layouts/LayoutMenuData.tsx` are now small composer files.
- Velzon demo/template page components are lazy-loaded from the devtools toolbox route module instead of statically imported into the main route module.
- Route rendering uses a lightweight `Suspense` fallback in `frontend/src/Routes/index.tsx`.
- Main JS bundle changed from 13,716,961 bytes before Stage D to about 594 KB after Stage D/E in the 2026-06-28 Vite builds.
- Remaining large build chunks are lazy toolbox/vendor chunks such as editors, maps, icon packs, and charts, plus a shared shell chunk just over Vite's warning threshold.
- Shell assets for logos, profile avatar, and layout customizer previews are grouped in `frontend/src/Layouts/shellAssets.ts`.
- Header profile/search dropdowns no longer expose old Velzon demo links.
- User browser review confirmed normal admin and root-admin views behave correctly after the split.
- `frontend/src/helpers/fakebackend_helper.ts` remains only for demo data slices behind the root-admin toolbox boundary.

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
- `frontend/src/Routes/routeHelpers.tsx`
- `frontend/src/Routes/routeTypes.ts`
- `frontend/src/panel/routes.tsx`
- `frontend/src/panel/menu.ts`
- `frontend/src/devtools/toolboxRoutes.tsx`
- `frontend/src/devtools/toolboxMenu.tsx`
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
- `CURRENT_TASK.md` when the active route/menu implementation queue changes.
- `docs/architecture/boundaries.md` if UI ownership boundaries change.
