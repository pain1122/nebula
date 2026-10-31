# Patient/doctor experience follow-up - October 17, 2026

User-authorized scope: own patient/doctor dashboards, livelier retained Velzon booking/questionnaire widgets, a published questionnaire grid with placeholder thumbnails, modal display-name editing, multi-category medical requests without doctor size controls, accurate pending-file language and the demonstrated Farsi attachment layout correction. No dependency, schema or canonical URL addition.

## Before and after

| Before | Current implementation |
| --- | --- |
| Patient login opens Booking; doctor login opens a reservation table. | Existing `/panel/` dispatches to the authenticated role's own dashboard, with owner-only summary counts, bounded recent appointments/activity and quick links. Administrative reports remain admin/root only. |
| Booking is an isolated form. | Retained Bootstrap hero, three-step selection widgets and a live appointment summary surround the existing server-owned booking flow. |
| The patient questionnaire URL only opens one fixed fixture. | The same URL lists published definitions in a responsive card grid; `?slug=` selects a real published definition. Form progress/choice cards/results retain fresh-definition and uncertain-delivery protection. |
| Profile editing appears below all profile cards. | The existing names-only form opens in the shared accessible modal; password confirmation replaces that modal temporarily and cancellation restores the draft. |
| Doctor request is fixed to PDF and exposes a byte-limit field. | Server-scoped document/image multi-selection, with exact limits issued by operator policy. Archive/audio/video are visibly unavailable until validator/content/transport acceptance. No doctor size input. |
| Patient upload UI hard-codes PDF and a 1 MiB ceiling. | Issued PDF/JPEG/PNG MIME-specific bounds are followed exactly; ownership, freshness, immutable policy, quarantine and receipt binding remain enforced. |
| Mixed Persian text and technical MIME/byte values reorder. | Attachment requirements use separate responsive blocks and isolated LTR MIME labels, with native-direction limit text. |

## Runtime and deliberately separate gates

Read-only sanity found app/Nginx/MySQL/Redis running. Parser, scanner, checker and dedicated worker are stopped; last accepted definitions are stale. Continuous automatic medical processing is therefore future hardening, not activated in this slice. No generic worker, unrelated job consumption, updater retry, manual clean verdict or clinical replay is authorized or performed. Patient copy states that safety checks have not finished and provides refresh guidance without promising an active scanner or approval.

Document currently means PDF; media means JPEG/PNG. Both can be selected together. Archive means ZIP and multimedia means audio/video; they remain disabled and requests for them are refused server-side. A format registry entry alone does not establish a safe content validator. Complete archive/video/audio validation, large-file transport/publication and continuous isolated worker recovery before enabling these options.

Thumbnails intentionally remain inert icon placeholders. The database/admin editor already have `cover_image_url`; a secure thumbnail upload/selection, processing/publication and preview workflow remains future hardening. No remote thumbnail URL is fetched. Patient signup/closure, public SEO pages and the page builder are outside this request. Size policy remains in operator/admin-owned settings and future form/page-builder rules.

Legacy attachment-rule API narrowing is retained for rollback compatibility. New category requests reject simultaneous client attachment rules and issue their immutable limits from current server policy. Previously issued snapshots/files/report histories are not rewritten. Existing home and questionnaire URLs remain canonical; no repeated URL/design approval is required for the user's explicit requested composition.

## Verification and rollback

Isolated www-data SQLite tests use `DB_DATABASE=:memory:`, array cache/session and unique `/tmp/checkupino-clinical-ui-*` storage. No live reset, seed, migration or storage-permission change. Initial storage-permission and unsupported-validator-rule failures were diagnosed, then the corrected gate passes 37 tests/242 assertions. Earlier failed frontend reports remain immutable. Dependency manifests/lock match the prior accepted source gate; a mistaken root-directory formatter invocation attempted a transient npm fetch, created no repository dependency change, and was replaced by the already installed frontend binary.

Full frontend quality, static artifact and native EN/FA desktop/mobile acceptance are recorded separately in this slice's evidence. Browser guards permit only local reads and ordinary synthetic login/logout; saves, password confirmations, downloads and worker/provider actions are blocked. Before/after clinical/financial/catalog/schedule/protected fingerprints must match. Successful live profile saving remains personally deferred.

The prior `checkupino-admin:panel-release-accepted-2026-10-17` image is retained. Presentation rollback restores the changed role-home/booking/questionnaire/modal/category fragments while keeping the previously accepted session-history privacy guard. The additive category-options API can remain deployed; legacy request clients and immutable policies stay compatible. No data/schema rollback or credential change is needed.

## Accepted deployment and evidence

Current healthy image: `sha256:4eba1012c993c0389e7edae6291e41de6937031dc0d99905f3b2e107eca21b9d`, retained as `checkupino-admin:clinical-experience-accepted-2026-10-17`. Open a fresh panel tab after deployment. Static-admin-only rebuild/recreation used the existing delegation; no backend/database/worker/scanner Compose operation occurred.

- Full frontend quality passes72 files/740 tests with default timeout/concurrency, typecheck/lint/fixtures/unchanged ratchets/format. Subsequent page-lint lifecycle/native-progress corrections pass83 affected behavior tests; final embedded questionnaire spacing passes19 tests. Changed-page lint/format/typecheck also pass. [Full gate](evidence/clinical-experience-quality-fixed-2026-10-17.log), [83-test delta](evidence/clinical-experience-final-delta-2026-10-17.json), [19-test layout delta](evidence/clinical-experience-layout-delta-2026-10-17.json). These are explicitly separate runs, not a claim of rerunning the full suite after every markup change.
- Isolated www-data PHP37 tests/242 assertions and scoped Pint4 pass. This covers current multi-category policy issuance, exact server limits, mixed/unsupported/duplicate category refusal, assigned-doctor access, legacy narrowing, immutable policy/integrity/quarantine/audit rollback and upload ownership. [PHP gate](evidence/clinical-experience-backend-2026-10-17.log).
- Final image passes65 exact served/container asset, compression/cache/deep-link/404 checks; all new widget icon glyphs are present. Existing medical CSS stays lazy and unchanged. [Final static proof](evidence/clinical-experience-static-accepted-2026-10-17.json).
- Complete four-role ENFA/1440-390px matrix on637bd360 passes49 groups/194 requests/52 screenshots. Only the embedded questionnaire wrapper/removal of duplicate breadcrumb changes afterward. Final4eba adds21 patient groups/73 requests/24 captures across all four language/width combinations. [Full role matrix](evidence/clinical-experience-browser-2026-10-17.json), [final-image patient delta](evidence/clinical-experience-browser-final-2026-10-17.json). Actual pointer interactions cover own home, modal/cancel, real offering selection, current unavailable-slot state, published grid/selected slug/answer progress and medical requirements/category previews. No business submission or clinical download is inferred.
- Zero unexpected browser JavaScript errors,500s, external requests or blocked write attempts. Pending jobs are not consumed. Existing privacy/history guard is unchanged; prior ordinary-admin/root boundaries and current clinical403 probes remain enforced.

## Current manual-rehearsal checkpoint

The user exercised the app after the preceding frozen release checkpoint. Before browser acceptance we explicitly captured [the current read-only state](evidence/clinical-experience-pre-browser-2026-10-17.json); we did not overwrite historical evidence or reset new records. Current totals are9 reservations/3 requests/4 files/2 reports/2 queued `medical-scan` jobs/2 questionnaire submissions/30 audits/8 outbox rows. All of these current business/financial/catalog/schedule/protected fingerprints match before/after both browser runs. Historical audit/outbox rows, published reports/settings/protected identities and the original completed reservation's stable facts also match. Old whole-table hashes differ where the user's newer records were added; old zero-job/count checks are not current runtime acceptance.

The previously recorded free October18 slot is now booked, and the current offering returns no free slot within its seven-day window. Browser acceptance verifies the actual empty state; it does not create slots, book another record or claim a new successful reservation. Source/previous ordinary booking proofs remain separate.

Failed native helper-expression/old-checkpoint assumptions and the initial missing new calendar glyph are retained in logs/intermediate evidence. Visual review also removed duplicate questionnaire page padding/breadcrumb. Intermediate637 witness is historical and is not claimed as a retained rollback image; an attempted tag could not resolve it after recreation. Both final4eba and priorc6 retained tags were explicitly inspected successfully. Earlier c6 rollback can read history; image-only requests require a UI capable of those uploads and must never be relabelled or rewritten to fit an old PDF-only control.

[Final source/context/artifact binding](evidence/clinical-experience-acceptance-2026-10-17.json). Future gates remain continuous fresh scanning/exact authorized pending-job delivery, safe archive/audio/video support, thumbnail processing/publication and separately attended successful live/profile saves.
