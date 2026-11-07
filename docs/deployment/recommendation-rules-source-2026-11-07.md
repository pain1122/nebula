# Recommendation rules: source delivery checkpoint

November7, 2026, Asia/Tehran. Original Windows/WSL laptop, `C:\Users\Pain\Desktop\work\checkupino`. Git baseline `ac57e6d`; this describes the source package before its November8 publication checkpoint. The imported other-PC installation/reset/worker permissions do not apply to this runtime.

## Authority and outcome

The user approved **“source package and proposed reviewer model”** for the [November5 proposal](recommendation-rules-proposal-2026-11-05.md). The six additive source tables, three canonical panel routes, retained controls and existing-role independent reviewer model are implemented. This approval excludes live migration, panel deployment, reviewer grants, actual clinical review and personal-rule activation. No dependency was added.

Two independent flags default false in config and environment examples:

- `RECOMMENDATION_RULES_ENABLED`: staff/reviewer authoring APIs.
- `PATIENT_RECOMMENDATIONS_ENABLED`: private owner matching; also requires authoring, health and content availability.

The real `.env` is unchanged. General patient article reading and its tag/category-based Recommended reading remain independent of either flag and health-profile availability.

## Delivered source

| Boundary | Implementation and behavior |
| --- | --- |
| Conditions | `app/Services/Recommendations/RuleCondition.php`, `RulePredicateEvaluator.php`, `PredicateOutcome.php`: bounded ALL/ANY trees, include/exclude, fixed catalog terms, explicit units/freshness, missing/none/unknown/declined/cleared handling, Tehran age/day arithmetic and exact integer-ratio BMI comparisons. No SQL, URL fetching, patient lookup or clinical thresholds in the pure evaluator. |
| Persistence | `database/migrations/2026_11_05_000001_create_recommendation_rule_tables.php` and four models: catalog coordination, reviewer grants, rules, immutable versions, exact article-version bindings and append-only reviews/withdrawals. Composite keys bind review owner and target versions. Empty-only rollback refuses populated, changed or partial schema before deleting tables. |
| Authority/lifecycle | `RecommendationAuthority`, `RecommendationContent`, `RecommendationAdministration`: fresh account/role/verified-doctor/designation/scope/expiry checks; independent version author/reviewer; separate working/publication pointers; complete-version canonical hashes; signed purpose/actor/subject/catalog revisions; idempotent action keys and atomic metadata-only audits. Root designation retains existing recent-password controls. Ordinary draft/publish actions have no extra password/confirmation sequence. |
| Clinical reading | `RecommendationTargetPreview`: assigned or own historical exact rule/article snapshots, including thumbnail, body, sources and scoped images. Doctors gain no staff File Manager inventory or patient-health access. Image delivery checks manifest, release/evidence policy and exact private bytes; approval also verifies referenced images. |
| Matching | `PatientRecommendationService`: current pure-patient owner projection only; no patient selector/client health input. Current exact review, grant and target publication/archive eligibility precede health decryption. Bound capacity, deterministic priority/deduplication and current-article exclusion. Private explanation/card-only output; no criteria, clinical review notes or qualification evidence. |
| Synthetic preview | `SyntheticRecommendationCases`: four fixed invented missing/unknown/recent/stale projections; GET preview is scoped to the visible rule version, accepts no patient ID/health values and creates no review. Outcomes are predicate results only. |
| HTTP/privacy | `RecommendationController`, `routes/api.php`, `AuditLogger`: bounded admin/doctor/patient surfaces, private/no-store middleware, generic errors and explicit audit metadata allowlists. No medical values, assessment text or qualification evidence in operational audit payloads. |
| Panel | `frontend/src/pages/Recommendations/` and `modules/checkupino/recommendations/api.ts`: retained Velzon main/sidebar cards, paired text tabs, structured term/condition controls, published target selection, review/publication actions, root designation controls, version/review metadata and synthetic previews. Save/Cancel remain in the same fieldset action row; existing stale/uncertain/session/abort handling is reused. |
| Patient sidebar | `pages/PatientArticles/PersonalSuggestions.tsx`: private current-language cards/explanations below the author, with general reading retained. Unavailable personal matching stays quiet. No persistence or analytics hook; zero unused cache retention, refetch on mount/focus and bounded foreground polling. Existing identity/role cache reset remains the owner boundary. |
| Shared rendering | Existing article allowlist was moved to `modules/checkupino/content/articleRichHtml.ts`; its original page path reexports it. Preview image URLs stay in the transport adapter and bind rule, rule version, article, language and asset. No new editor or sanitizer dependency. |

Approved panel URLs are `/panel/recommendation-rules`, `/panel/recommendation-rules/new`, `/panel/recommendation-rules/:ruleId`. List/detail support staff and assigned/historical doctor reading; creation is admin/root only. The existing Content submenu groups the entry. Patient integration adds no URL.

API prefixes are `/api/admin/recommendation-rules` and `/api/doctor/recommendation-rules`. They expose the bounded list/detail, exact-version synthetic preview and scoped image GETs; staff draft and action writers and root reviewer-grant writers remain role-specific. `/api/my/recommendations` accepts only language and optional current article ID. There is no real-health preview or staff patient-matching endpoint.

Source targets are articles only. Checkup/self-care adapters, broader media, rule recovery authoring UX and managed medical terms remain separate; do not infer support from reserved future names. Immutable rule/version/review records are retained, with bounded metadata history; this is not an editable clinical-history system.

## Verification actually performed

- Combined isolated recommendation plus affected patient article/staff reader/media regression: **158 tests / 1,118 assertions**, PHP8.3.35, PHPUnit11.5.56. `scripts/recommendations/test-source.ps1 -WithArticleRegression` uses the installed explicit `18eb9257...` PHP image, UID33, no network, read-only source, private tmpfs, empty environment, no project caches and memory SQLite with FK enforcement. No live schema or private database/storage is connected.
- Focused frontend recommendation/library/registry/article/media regression: **5 files / 117 tests**, including EN/Farsi author and reviewer controls, exact scoped image rendering, predicate bounds, role refusal, private result parsing and uncertain delivery. TypeScript passes. These are source/JSDOM checks, not served browser or native pointer acceptance.
- PHP Pint: **21 affected files pass**. Affected frontend type-aware lint and formatting pass; unchanged repository quality ratchets pass (any-token2527, ambient10, legacyApex40, undeclared0).
- Tests cover positive/no-match/insufficient predicates, unknown exclusions, birthdays/leap dates, exact BMI boundaries, source/freshness/unit/catalog refusal, disabled no-health reads, author/reviewer separation, review/grant/profile expiry/revocation, draft-versus-publication, target version changes, immutable withdrawal, canonical JSON key order, exact idempotent replay/payload substitution and late audit rollback.
- Reviewer image tests use **scanner/decoder doubles only** and ordinary synthetic isolated article/media writers. They prove scoped exact-version authorization and byte-integrity refusal, including approval failure on altered bytes. They are not current real ClamAV/parser/S3 acceptance.
- Review replacement regression proves that withdrawing an old approval supersedes only that exact review. It cannot cancel another reviewer's later publication. Withdrawing the current approval disqualifies matching without falling back to an older approval.

The November5 final process was interrupted and had no recoverable final result; it was rerun. On November7 the first resumed gate failed in the new image fixture: a fixed November5 application clock made its mocked definition evidence stale against the deliberately native 48-hour editorial guard. The fixture now aligns its application/evidence clocks for that test and uses relative future designation/review dates. Production freshness checks were not changed. The corrected combined run passes as above; prior smaller pass totals are superseded, not additional tests.

Read-only original-laptop recovery acceptance on November7:

- Operator started existing `db redis app nginx`; assistant performed no Compose startup/recreate/build.
- Nine intended services run: static admin, four SeaweedFS services and four backend services. Scanner/parser/checker/worker remain stopped for this slice.
- Backend `/up` and static panel `/healthz` return HTTP200. Laravel MySQL `SELECT 1` and Redis ping succeed as UID33.
- Effective authoring/matching flags are false; `recommendation_rules` is absent; queue count is two. No job bodies were read or consumed.
- No current schema, seed, health/profile/content save, credential/key replacement, reviewer grant, scanner/worker execution, definition download or served-admin build was performed. No new protected-data fingerprint comparison is claimed; the checks above are the actual read-only evidence.

## Concurrency and remaining release gates

Recommendation catalog coordination precedes article catalog coordination. Staff/reviewer/attribution user reads use shared locks; rule writes serialize through the recommendation catalog. Patient owner reads acquire the owner user exclusively before entering the existing health/article readers, avoiding concurrent shared-to-exclusive owner upgrades. Grant qualification reads do not take an unnecessary exclusive user lock. External account/profile/content writers retain their existing protocols. SQLite and source review do **not** establish real MySQL lock-order or interleaving acceptance.

1. Completed November8: both guarded disposable MySQL packages pass, including all8 catalog and16 cross-module interleavings plus integrity/expiry/replacement checks. Operator cleanup and exact absence/source verification pass. Retain receipts and do not replay accepted writers. See [cross-module closeout](recommendation-mysql-cross-module-2026-11-08.md).
2. Obtain actual qualified independent clinical review of intended rules, sources, freshness, exclusions, population/limitations and target versions. No synthetic account, designation or test attestation qualifies as real clinical review.
3. Prepare separately authorized exact migration/flags/static-admin activation and rollback. Authoring and matching can be accepted separately; leave matching unavailable without actual review.
4. Accept served EN/Farsi desktop/mobile author/reviewer/patient behavior and one specifically authorized synthetic lifecycle, then the combined four-role rehearsal. Source tests do not close these gates.

Future application rollback disables the two flags and retains populated tables/history; restore the prior static candidate if deployed. Never invoke a destructive down migration against populated rule/review history. Existing general articles remain usable. No migration/activation/rollback command is being requested or executed by this source closeout.

## Final closeout

Source, affected integration, type-aware lint, formatting, TypeScript and unchanged quality-ratchet gates pass. The ordered checklist, proposal, boot/continuation, TODO and affected context modules are synchronized; TASK_LOG retains exactly150 split lines. The November8 publication checkpoint groups source, tests and handoffs for the user-requested push; no runtime activation is included. The first guarded [MySQL catalog package](recommendation-mysql-catalog-2026-11-07.md) now passes all8 real contention cases; operator cleanup and exact absence/source verification are complete; the16-case cross-module/FK-negative gate and its operator cleanup are also complete. Actual clinical review and separate activation/served gates remain open; no further source-schema/route/reviewer-model approval is needed. See the [current resume handoff](recommendation-handoff-2026-11-08.md).
