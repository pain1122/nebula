# LTR-derived RTL build and questionnaire grids

The user explicitly authorizes mirroring the original LTR styles, horizontal arrows and reservation-style questionnaire grids. This supersedes the prior default-desktop-only visual boundary; no repeated design approval is needed.

The original proposal suggested postcss-rtlcss6.0.0 and a direct PostCSS dependency. The user declined that option and instructed: **use the existing ones and log those with zero RTL compatibility**. Do not install the proposed dependencies.

The approved implementation uses the existing Sass1.103.1 and Vite8.0.16/PostCSS8.5.26 toolchain with the repository-owned `frontend/scripts/direction-mirror.mjs`. Package and lock files are unchanged by this slice. Zero-specificity direction branches preserve source specificity/cascade; original assets and native document formats remain intact. Existing Reactstrap/Swiper APIs handle physical runtime placement through adapters, without additional packages.

Questionnaire definition and submission details reuse the reservation card/grid design, preserving guarded editing, immutable saved answers/ownership/version, retention, escaped HTML source and EN/Farsi. Text direction follows saved content; URLs/source stay LTR.

The [compatibility log](rtl-compatibility-log-2026-10-13.md) distinguishes absent automatic support from native/configurable RTL. The [acceptance report](panel-mirror-acceptance-2026-10-13.md) records final source/artifact/browser/runtime evidence, tested layouts and rollback. Optional toolbox vendor interactions stay explicitly logged rather than being claimed perfect from CSS alone.

Only the previously delegated static-admin build/recreation is used. Backend services, medical/audit/policy/payment authority, environment, schemas, credentials, scanner and queues are unchanged.
