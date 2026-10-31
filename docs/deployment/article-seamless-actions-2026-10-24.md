# Direct article and File Manager actions

Later October24: [live media activation and real single-image acceptance are complete](article-media-real-acceptance-2026-10-24.md). The earlier unapplied/pending statements below preserve this UX checkpoint; current scanner/parser and real upload/publication/recovery now pass. Automatic scheduling and folder ACL remain deferred.

October24, Asia/Tehran. The user explicitly requested seamless File Manager operations and then extended that direction to article Save/Publish. This supersedes the earlier reason/password/reconfirmation UX for these named operations only.

## Behavior

- File selection/upload starts quarantine admission and bounded image preparation automatically. There is one File Manager dialog, with quiet inline progress and availability. Selecting an existing image, retrying preparation and retiring an image do not open another dialog or request a reason/password.
- Article Save/Publish act directly from the existing editor. The workspace Publish action is also direct. The action click supplies intent; the application does not invent a user review attestation. Archive, version recovery, standalone review/submission, taxonomy management and standalone schedule administration retain their existing controls.
- Failures stay inline. Duplicate clicks are blocked synchronously. Account/role changes abort pending client work; fresh authority and signed revisions still govern every server mutation. An ambiguous dispatched action locks further writes until an explicit fresh read; there is no automatic replay or silent retry.

## Retained safeguards and compatibility

Authentication, active-account/role authorization, session/CSRF transport, request bounds/throttles, current server policy and signed actor/content revisions remain. Images stay private and unavailable until checksum/current scanner/isolated-parser eligibility passes. Validation rechecks authority and current evidence after the external scan. Immutable references, version history, content validation and atomic audits remain mandatory.

The composer calls the ordinary submit/review/publication services inside its writer transaction; it never manually sets publication pointers. Only trusted in-process composition skips the standalone review password gate, and it requires an existing transaction. HTTP payloads cannot request that internal path. Direct Publish still checks the exact reviewed version/hash. Default audit reasons are server action descriptions, not fabricated human reasons. Optional legacy reason/confirmation fields remain strictly validated when present so the retained previous panel remains compatible.

There is no schema, dependency, new URL, environment flag, clinical access, general worker or queue-consumption change in this slice.

## Verification and boundary

Isolated UID33/network-none/read-only-source SQLite tests: media16/147 and retained article238/1823, total254 tests/1970 assertions. Focused UI78 tests cover automatic two-request upload/preparation, direct bilingual Save/Publish, no reason/password/attestation payload, revision refusal, double-click exclusion, session changes and ambiguous delivery. TypeScript, governed lint, supplemental changed-page lint (existing control-regex rule excluded), format, unchanged quality ratchets and PHP style10 pass.

Native browser/static acceptance and immutable source/runtime receipts are linked in the final checkpoint. Browser mutation fixtures are intercepted before reaching the server; they prove interaction behavior, not persisted-media or engine acceptance. Existing six article tables, health state, business/protected hashes and both pending medical jobs must remain unchanged.

The exact media extension migration/presentation/media flags remain unapplied and require their existing separate live authorization. Scanner/parser recovery and a separately authorized ordinary synthetic upload/version/publication/recovery remain open. Automatic scheduling stays disabled. Do not mistake this UX delivery for activation of the library.

## Future File Manager folder permissions

Deferred, requested October24: add a server-issued File Manager context binding the authenticated actor, purpose, allowed roots/folders, denied folder IDs, operations, policy revision and expiry. Use signed opaque identifiers or server-side context; encoding a client parameter alone is not authorization. Deny takes precedence, and a user bound to folders cannot escape those roots.

Enforce the context on File Manager listing/search/counts, folder navigation, selection/preview, upload and later move/copy/delete operations, including source and destination. Reject tampering, traversal, stale contexts and permission revocation without exposing forbidden folder existence. Audit administrative policy changes. Keep this policy confined to File Manager entrypoints; existing medical ownership, download and publication/reference checks continue independently. No folder schema, browser-only ACL or new administrative UI is implemented now.

## Rollback

Return only the static admin to the retained `checkupino-admin:article-media-ui-accepted-2026-10-24` image. The new optional fields accept its older requests; stricter existing archive/recovery/taxonomy controls remain. Reverting server source must use the full compatible source checkpoint; never restore password middleware alone underneath the new direct-action client. Retain all versions, audits, objects and populated schemas. No migration down/reset is part of this rollback.
