# Checkupino Frontend Workspace

This folder contains the parked Velzon React-TS admin template.

Current status:
- Migrated from Create React App/react-scripts to Vite.
- Uses React 18, TypeScript, Bootstrap 5, Reactstrap, Redux, Axios, Formik, and Yup.
- Intended admin direction is React + Bootstrap under the future `/panel/*` surface.
- Not yet the canonical production admin UI.
- Still contains Velzon demo routes, fake backend data, and token-style auth assumptions.

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

## Important Migration Notes

The Vite migration is intentionally not the frontend auth migration.

Still deferred:
- Replace sessionStorage/bearer-token auth with Sanctum session-cookie auth.
- Decide canonical admin route namespace, currently planned as `/panel/*`.
- Trim or quarantine Velzon demo routes after the real admin surface is defined.

Frontend env declarations:

```text
VITE_BACKEND_URL=http://localhost:8080
VITE_API_BASE_URL=http://localhost:8080/api
VITE_DEFAULT_AUTH=fake
```

`VITE_DEFAULT_AUTH=fake` is temporary template compatibility. It should disappear when the admin auth flow is replaced with Sanctum session-cookie auth.

Backend target for local integration:

```text
http://localhost:8080
```

API base:

```text
http://localhost:8080/api
```

Sanctum browser login flow to wire next:

```text
GET  /sanctum/csrf-cookie
POST /login
GET  /api/auth/me
POST /logout
```

Use Axios with credentials enabled for browser SPA requests. Do not store bearer tokens in browser storage for the first-party admin UI.
