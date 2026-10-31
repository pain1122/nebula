# LTR-derived panel mirror and questionnaire grids

User visual scope: mirror the original LTR styles for Farsi, including horizontal arrows, and use reservation-style boxes/grids for questionnaire details. Dependency steering: **use existing packages and log RTL compatibility gaps**. The proposed new build dependencies were declined; package and lock files were not changed by this slice.

Healthy final image **`sha256:12112aa91aa8b7f27b00309a90c979e99e29a06c2309f4caad575f2a9ce91ae9`**, retained as **`checkupino-admin:panel-mirror-accepted-2026-10-13`**. Only the previously delegated static-admin Compose config/build/recreation ran; cached dependency installation was reused. Backend, parser, media, scanner and worker services were not recreated.

## Changes

- Existing Sass/Vite/PostCSS compiles the original Velzon/Bootstrap LTR source through `frontend/scripts/direction-mirror.mjs`. Zero-specificity LTR/RTL branches preserve declaration order and cascade; physical offsets/spacing/borders/corners/positions/transforms and directional keyframes mirror.1773 directional rule groups and456 retained icon pairs are generated. Root layout selectors match the actual root. Old RTL compensations do not stack over the generated mirror; reference files remain recoverable.
- Breadcrumb fallback maps only its own Material Design Icons font. Carousel arrow artwork uses retained counterparts. Other images/logos/flags remain oriented normally.
- Existing Reactstrap/Swiper APIs adapt dynamic placement and language changes through72 DropdownMenu and17 Swiper imports, keeping menu/slider identity and caller refs/callbacks. Native Quill document formats, CKEditor vendor CSS, slider/calendar geometry and code direction are preserved.
- Questionnaire definitions group metadata, introduction, each question/choices and recommendations into retained cards. Saved submissions group owner, receipt/version, result and each saved answer. Ownership, retention, version/revision freshness, reasons, role gates, cancellation and uncertain-write safeguards remain. Natural-language fields use content direction; source/URL/slug fields use LTR. Saved HTML is escaped source, never executed.

## Verification

Final full frontend gate: **57 files /446 tests**, TypeScript, governed and supplemental component/page lint, fixtures, formatting and unchanged ratchets2515/10/40/0. **30 generator regressions** and **14 readiness safeguards** pass. No weakened timeout/assertion/role/data guard.

**45 served assets** match container bytes, compression/cache/deep-link/404 behavior and retained medical/questionnaire controls. Main CSS is1,265,685 minified bytes /176,447 gzip bytes,17,875 gzip bytes above the prior default-only bundle; lazy medical CSS is2,906 /771 bytes. [Static proof](evidence/panel-mirror-release-static-2026-10-13.json).

**27 real-pointer/keyboard groups**,66 API requests and16 exclusive screenshots pass for admin2/root1 EN/Farsi. Nine measured cases: detached, compact, small-sidebar, horizontal, two-column, semibox, boxed desktop,900px tablet and390px mobile. Shell/card positions mirror within the actual layout viewport excluding the vertical scrollbar, rather than browser outer/window width. Breadcrumb glyphs reverse; actual language-menu flags/labels stay separate and inside the viewport; logos stay unflipped. Questionnaire definition/submission and reservation mobile cards stay within390px. Mixed-language source/question direction, saved answer values, confirmation cancellation, refresh and portal/backdrop/Escape cleanup pass. [Pointer/geometry/screenshots](evidence/panel-mirror-release-pointer-2026-10-13.json).

**11 role/API groups**,161 requests verify admin/root reads, filters, ownership/history, EN/Farsi/refresh/cancel and patient4/doctor5 refusals. This separate contract helper uses DOM activation; mouse geometry acceptance comes from the pointer proof. [Role proof](evidence/panel-mirror-release-browser-2026-10-13.json).

Readiness recognizes only the fixed matching static/role evidence pair through its original candidate/asset/clinical gates. Twelve services, UID33 MySQL/Redis/parser, both read-only sockets, idle dedicated worker/jobs0 and original completed/protected fingerprints pass. [Source/runtime binding](evidence/panel-mirror-acceptance-2026-10-13.json). No business writes, clinical downloads, scanner/definition contact or unrelated job consumption occurred.

## Limits and rollback

The [installed compatibility log](rtl-compatibility-log-2026-10-13.md) distinguishes missing **automatic** RTL from native configuration. Optional vendor SVG/canvas/inline-coordinate interactions are not declared universally perfect. Chronological/data chart axes and document alignment are not reflected blindly. Real dashboard data and successful live admin actions/download audits remain later feature slices; fresh scanning still requires supported recovery/current proof. Earlier intermediate/failure proofs are retained; initial geometry checks used window width instead of layout width, and static startup correctly refused until healthy.

Prior verified tag: **`checkupino-admin:panel-rtl-accepted-2026-10-12`** (0b1fcd64), plus0e9/650/e375/8db retained. Use the existing [admin-only image rollback sequence](admin-reservation-panel-2026-10-11.md#source-and-rollback) with this prior tag. Image rollback preserves all medical/payment/audit/ownership/release safeguards and data; it returns the previous grid/RTL behavior. Source rollback must remove only this slice's plugin hookup/adapters/grid changes, never reset the dirty worktree. Never replay closed business writers or overwrite evidence.
