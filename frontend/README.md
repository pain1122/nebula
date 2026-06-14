# Checkupino Frontend Workspace

This folder contains the parked Velzon React-TS admin template.

Current status:
- Migrated from Create React App/react-scripts to Vite.
- Uses React 18, TypeScript, Bootstrap 5, Reactstrap, Redux, Axios, Formik, and Yup.
- Intended admin direction is React + Bootstrap under the future `/panel/*` surface.
- Not yet the canonical production admin UI because route ownership, root-admin utilities, and product menus are still being separated.
- Active admin login/logout/current-user flow uses Laravel Sanctum session cookies.
- Still contains Velzon demo routes and fake demo data helpers that need root-admin/developer toolbox isolation.

## Commands

```bash
npm install
npm start
npm run build
npm run preview
```

Dev server:

```text
http://localhost:3000
```

`npm start` is kept as Vite muscle memory and runs the Vite dev server.

## Current Verification

As of 2026-06-14:
- `npm run build` succeeds.
- `npm start` renders the template and redirects to `/login`.
- Build warnings about large chunks are expected while the full Velzon demo inventory is still imported.
- Browserslist/baseline data warnings are maintenance noise, not current blockers.
- Tailwind content warning is not an admin blocker because this workspace is Bootstrap-oriented.
- Active frontend env usage has been converted from CRA-style `process.env.REACT_APP_*`/`PUBLIC_URL` to Vite-style `import.meta.env.VITE_*`/`BASE_URL`.
- The temporary CRA env compatibility bridge has been removed from `vite.config.ts`; `global: "globalThis"` remains for legacy template dependencies.
- Browser auth flow is tested with login, dashboard refresh, profile dropdown, `/profile`, logout, and logged-out dashboard redirect.
- `session_api.ts` uses credentialed Sanctum session requests and a lighter read-only client for `/api/auth/me`.
- Firebase auth helpers, fake JWT auth backend, JWT token-access helpers, and auth-specific browser bearer-token storage have been removed.

## Important Migration Notes

The Vite migration and first-party session auth cleanup are both complete for the active admin shell.

Still deferred:
- Decide canonical admin route namespace, currently planned as `/panel/*`.
- Trim or quarantine Velzon demo routes after the real admin surface is defined.
- Replace placeholder forgot-password/register/profile-update flows with Laravel-backed endpoints when those screens become product requirements.
- Keep bearer-token auth for mobile/external clients only.

Frontend env declarations:

```text
VITE_BACKEND_URL=http://localhost:8080
VITE_API_BASE_URL=http://localhost:8080/api
VITE_DEFAULT_AUTH=fake
```

`VITE_DEFAULT_AUTH=fake` remains temporary template compatibility for old demo assumptions. It is not the active browser-admin auth authority.

Backend target for local integration:

```text
http://localhost:8080
```

API base:

```text
http://localhost:8080/api
```

Active Sanctum browser login flow:

```text
GET  /sanctum/csrf-cookie
POST /login
GET  /api/auth/me
POST /logout
```

Use Axios with credentials enabled for browser SPA requests. Do not store bearer tokens in browser storage for the first-party admin UI.

Legacy boundary:
- `frontend/src/helpers/fakebackend_helper.ts` is still used by Velzon demo-data slices.
- It should move behind the future root-admin/developer toolbox split instead of being treated as product admin infrastructure.
