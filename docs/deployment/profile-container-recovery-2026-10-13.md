# Profile checkpoint container recovery — October 13

The user requested container restarts. Read-only inspection found seven required backend/parser/check/idle-worker containers stopped, while the accepted static admin and four SeaweedFS containers were running. The stopped worker/check/parser had exit131, without recorded OOM. The scanner and successful permission initializers were already stopped.

Only exact existing Checkupino containers were operated on. Started `checkupino_db`, `checkupino_redis`, `checkupino_content-content-parser-1`, `checkupino_app`, `checkupino_nginx`, `checkupino_scan-scan-check-1` and `checkupino_scan-scan-worker-1`. Restarted the existing SeaweedFS master, volume, filer and S3 containers in that order, then `checkupino_prod-admin-1`. No build, pull, recreation, initializer rerun, migration, environment change, credential replacement or unrelated project operation occurred. Existing app/worker read-only socket mounts and image pins remain.

## Verification

`node scripts/media/verify-panel-profile-readonly.mjs` passed as UID33 using a read-only MySQL transaction. Shared owner/support metadata, private-field exclusions, root-subject refusal, related administration contact masking and zero jobs remain. Patient4 has five reservations, two published-report previews, one questionnaire submission and two attachment activity entries; doctor5 has two reservations. No successful profile save was attempted.

The initial readiness check refused while admin health was still starting. After Docker reported healthy, `node scripts/media/check-demo-readiness.mjs` passed at **2026-10-13 17:28:00 UTC / 20:58:00 Tehran**:

- Twelve required services run; actual medical worker remains `sleep infinity`.
- Accepted admin `f6a0de92` and all 50 served assets match.
- UID33 MySQL/Redis/parser, both read-only sockets and recorded completed/protected fingerprints pass.
- Two requests, two files, two reports, one questionnaire submission and zero jobs remain.
- Existing history is ready. Fresh pipeline/upload readiness stays false: scanner stopped and a current real scanner probe is required. The latest recorded cooldown has elapsed; no scanner contact, start or definition download occurred.

## JSON theme-preference storage assessment

Source/model/migration searches and a UID33 read-only live schema inspection agree: there is no `user_meta` table, `users.user_meta` column or `user_profiles.meta` column. Existing `user_profiles` stores clinical/emergency-contact fields and must not be reused as an unrestricted admin support payload.

The user clarified that `user_meta` meant theme preferences. The existing layout reducer already saves validated layout/theme JSON in browser localStorage under `nebula.layout.settings`; language is stored separately under `checkupino.locale.v1`. These settings currently belong to the browser/origin, rather than a server-owned user record.

A versioned, bounded user-owned JSON object is suitable for cross-device theme/layout preferences. The authenticated owner must be derived from the session, allowed values validated, and other users' preferences kept out of administrative profile edits. Retain browser/default fallback when metadata is absent or the server is unavailable; language continues to own direction. This proposal concerns non-sensitive appearance settings, with no clinical/profile-name changes. A source migration and synchronization implementation have not been prepared or applied; there is no existing `user_meta` schema to reuse. The separate guarded live profile-save/audit acceptance gate remains open.

No schema or application source was changed. Prior accepted evidence and rollback images remain intact.
