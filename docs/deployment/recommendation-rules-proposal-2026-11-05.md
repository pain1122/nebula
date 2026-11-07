# Reviewed recommendation rules: first delivery contract

November 5, 2026, Asia/Tehran. Baseline: `ac57e6d`, imported from the other PC. The user agreed that rules mean the conditions for showing suggestions, requested the execution sketch, then instructed development to start while they may be AFK.

Status, updated November7: the user explicitly approved **“source package and proposed reviewer model”** after reviewing this proposal. This authorizes the six additive source tables, three canonical panel routes/retained controls and designated verified-doctor independent review model below. Backend/editor/sidebar source implementation and scoped regression gates pass; see [November7 source delivery](recommendation-rules-source-2026-11-07.md). This is not live migration, deployment, reviewer designation, actual clinical approval or personal-matching activation authority. Both new flags default false; the current private environment is unchanged.

## Outcome and execution order

Create one reusable recommendation layer: staff author a bounded condition tree and link reviewed content; a designated clinician reviews the exact rule/content versions; an admin/root publishes them; a patient-only service evaluates the patient's own current facts and displays eligible suggestions with reviewed explanations. General library reading and existing tag/category-based Recommended reading stay available independently.

1. Prepare this contract, permission matrix, screen sketches, exact source/schema list and acceptance plan.
2. Build/test the pure condition validator/evaluator with invented inputs only. It returns predicate outcomes, never publication/clinical eligibility. It has no database, HTTP, logging, user lookup or deployment dependency.
3. After source-schema/design authority is confirmed, implement additive persistence, current-authority checks and immutable review/publication/revocation history, then source/SQLite and isolated MySQL tests.
4. Wire the existing-role staff author/reviewer controls and patient-only API/sidebar. Verify both languages, session/privacy/refusal paths and target publication integrity.
5. Obtain actual clinical review of the intended criteria/content. Separately accept activation/rollback and one bounded synthetic attended flow. If review is unavailable, personal suggestions remain unavailable and the general library continues to work.

First active targets are **articles**. The contract reserves `checkup` and `self_care` kinds; their adapters remain rejected until their content/version/availability semantics are implemented and reviewed. Self-care initially means an explicitly classified published article, not a new free-text treatment/order type. Checkup suggestions must eventually open the existing booking flow without ordering, charging or reserving anything automatically.

## Inspected integration points

- `app/Services/Health/PatientHealthService.php`: already verifies active owner/pure patient role, decrypts one patient's snapshot, resolves same-owner observations, and returns facts/provenance/dates/revision. Use the latest version and current authorization; do not read legacy identity birth dates or public-directory fields as medical facts.
- `app/Services/Health/HealthCatalog.php` and `HealthInput.php`: fixed catalog `health-2026-10-22.1`, stable condition/allergen IDs, male/female patient-reported gender, explicit no/unknown/declined/cleared states and exact height/weight representations.
- `app/Services/Content/PatientArticleRead.php`, `ArticleSnapshots.php`, `ArticleMediaEligibility.php`: reuse current published-version visibility, complete-language fallback, archive behavior and purpose-bound image release/integrity. A match grants no staff-media or clinical-file permission.
- `frontend/src/pages/PatientArticles/ArticleDetail.tsx`: retain the accepted author/body layout and existing general reading widget. Add a separate, unobtrusive personal section below the author after source/design approval; general suggestions do not become clinical matches.
- `app/Services/QuestionnaireSubmissionService.php`: existing questionnaire-score outcomes remain their own versioned feature. A submitted questionnaire does not automatically populate/verify the health profile or authorize a recommendation rule.
- `app/Models/Checkup.php`: current services have mutable catalog fields, activity and doctor-location eligibility. A future adapter needs a clinical-content fingerprint and fresh availability; do not bind clinical review to price changes or promise that a suggestion is a bookable slot.

## Proposed authority

No new role is created. Reviewer designation is an explicit, root-managed capability on an existing active, verified doctor account, with a documented basis, permitted scope, start/expiry and revocation. Existing seeded doctors are synthetic and have **no designation by default**. A verification flag alone is not evidence that a real clinician reviewed a rule.

| Actor | Allowed | Denied |
| --- | --- | --- |
| Admin/root | Create/edit rule drafts, choose published targets, request a clinical review; publish only a currently valid approved exact version; retire/revoke publication | View patient health or match results through rule administration; treat editorial review as clinical review |
| Root only | Grant/revoke reviewer designation with ordinary current-authority/revision/audit controls | Fabricate clinical qualifications or approve a rule solely through the root role |
| Designated verified doctor | Read assigned rule/content/source snapshots; approve/reject/withdraw their exact review, within designation scope and validity | Review their own authored version; browse patient health; review unassigned rules or unrelated staff content |
| Other doctor | Existing doctor features | Rule authoring/review through doctor membership alone |
| Patient | Read their own current eligible recommendations/explanations and normal published targets | Other patients' results, rule/reviewer inventory, staff drafts, clinical files outside existing policies |

Approved reviewer model: **admin/root authors and publishes; explicitly designated verified doctors clinically review; author and reviewer must differ**. Publisher may equal author after independent clinical review. Actual clinician identity/qualification and medical criteria are supplied/verified by the operator, never invented by code or synthetic seed evidence. If there is no available qualified reviewer, build/test mechanics with synthetic fixtures and leave real personal matching inactive.

All authority is checked afresh at read/write/evaluation, including account/role/profile/designation changes. Revoked/expired designation or withdrawn/expired review immediately disqualifies dependent publications for future reads; historical rows remain. Root can stop a publication immediately with an audited action. It cannot create clinical approval on another person's behalf.

## Predicate protocol v1

`schema_version=1`, exact health catalog version, `include` tree, optional `exclude` tree. Groups use `all` or `any`; 1–8 children/group, maximum depth4 and64 total nodes across both trees. Leaves accept only documented fields/operators/units. No scripts, SQL, regex matching, remote URLs, arbitrary JSON paths, callbacks or client-supplied derived results.

| Field | Input and comparison |
| --- | --- |
| `age_years` | Derived from explicitly reported health birth date at the supplied evaluation date in Tehran; integer comparisons; registration fallback dates never participate |
| `gender` | Patient-reported male/female, exact equality only; never infer sex-at-birth, anatomy or reproductive status |
| `weight_kg`, `height_cm` | Selected same-owner observation, exact decimal quantity/unit, measurement date; bounded numeric comparisons |
| `bmi` | Recomputed from selected weight/height using exact integer-ratio comparisons; both dates/freshness and an explicitly declared maximum measurement-date gap required; displayed rounded BMI is not trusted for boundary decisions |
| `conditions`, `allergies` | `contains` one known active kind-correct stable code, or `reported_none`; no free text or inferred diagnoses |
| Smoking/alcohol/low activity/stress/family history | Equality to explicit self-report `yes`/`no`; unknown/declined never satisfy a negative |

Numeric operators: `eq`, `lt`, `lte`, `gt`, `gte`, inclusive `between`. Weight/height/BMI rule quantities are ASCII decimal **strings**, canonicalized to hundredths; age values are integers. Values and limits have broad technical representation caps, not medical eligibility thresholds. Freshness is an explicit integer `max_age_days` (0–3650); null is permitted only for stable birth-date-derived age/gender and must be selected deliberately by the reviewer. BMI additionally declares `max_measurement_gap_days` (0–3650). No default clinical freshness or diagnostic cutoff is supplied.

Every fact remains self-reported, including calculated values derived from self-reported observations. Intended population, exclusions, sources and limitations belong to the reviewed rule version; the evaluator does not establish a diagnosis or validate medical guidance. Pediatric, pregnancy/anatomy-specific and laboratory interpretations require their own supported/reviewed inputs; the current gender/profile fields do not establish those facts.

Three-valued leaf/group logic:

- `true`: the explicit, valid, sufficiently fresh fact satisfies the condition.
- `false`: an explicit usable fact contradicts it.
- `unknown`: missing/cleared/declined/unknown, stale/future/invalid/unreadable value, wrong provenance/unit/catalog, insufficient code coverage or unusable measurement pairing.
- `all`: any false => false; otherwise any unknown => unknown; otherwise true. `any`: any true => true; otherwise any unknown => unknown; otherwise false.
- A condition/allergy group reported `no` can disprove `contains` and satisfy `reported_none` as a **report of none known**. A group reported `yes` containing another code does not prove absence of the requested code: `contains` returns unknown. A `yes` group with no selected code is also unknown for a specific code. This prevents incomplete lists from bypassing exclusions.
- Inclusion must be true and exclusion false for `match`. A true exclusion gives `excluded`. False inclusion gives `no_match`. Remaining uncertainty gives `insufficient_data`. Absence of an exclusion tree means false, not unknown.

Unknowns are never converted to a negative, and arbitrary Boolean negation/`not_contains` are unsupported in v1. An unknown exclusion blocks a positive suggestion even when the inclusion matches. A false inclusion can return no-match without asking for irrelevant additional health data.

The pure evaluator accepts a minimal **server projection** (`health_catalog_version`, fact `provenance`, selected `measurements`) plus an explicit evaluation instant. It neither authorizes that projection nor establishes content/review eligibility. A later application service must obtain the projection from the current patient owner service and apply all publication/target/review gates. The HTTP API must never accept a health projection or a patient ID supplied by the client.

The predicate hash also binds `RuleCondition::EVALUATOR_VERSION`. An interpretation change requires a new evaluator version, tests and renewed acceptance; compiled caches and reviews cannot silently retain an older semantic binding. This hash covers only predicates. The implemented **full rule-version hash** additionally binds target snapshots, explanations, population/limitations, sources, priority and version author before clinical review/publication. Review/grant scope and time validity are separately recorded and checked on every eligibility read.

## Proposed persistence: six additive tables

One approved source migration, `2026_11_05_000001_create_recommendation_rule_tables.php`, with live execution still separate:

1. `recommendation_catalog_state`: singleton revision for coherent contexts and rule-catalog invalidation; no patient data.
2. `recommendation_rules`: public ULID/stable English slug, author FK, current working version, assigned reviewer FK, published version/review binding, retired timestamp. Published pointer is separate from working drafts.
3. `recommendation_rule_versions`: immutable per-rule version; schema/health-catalog/evaluator version; canonical definition and complete version hash; bilingual title/explanation; intended population/limitations; ordered HTTPS source references, priority and bounded targets. No patient values or successful-match history.
4. `recommendation_rule_version_targets`: immutable exact-version target references. First adapter binds accessible published article public ID + version ID/number + content hash, with restrictive same-owner FKs and matching manifest. No draft ID or arbitrary URL target.
5. `recommendation_rule_reviews`: append-only approve/reject/withdraw events, exact version/hash/target-manifest binding, designated reviewer/grant FK, source assessment and attestation, review expiry, and optional superseded review reference. Actual clinical approval is distinguishable from synthetic test data. Never mutate an old review to approve changed content.
6. `recommendation_reviewer_grants`: root designation of an existing verified doctor, scope, evidence reference, effective/expiry/revocation state and revision. Designation/revocation is atomically audited; immutable reviews retain their exact grant binding. Private qualification documents are not added to the general File Manager.

Current review validity must be bounded by explicit expiry no later than the grant's expiry; no hidden permanent approval default. Publication requires current independent approval and exact target snapshots. Editing conditions, explanation, population, sources, priorities or targets appends a new draft and invalidates working approval; previous valid publication remains until replaced/revoked. Review/publication use signed current contexts, fresh versions and atomic metadata-only audit. Retry/ambiguous delivery uses an action idempotency key bound to actor/action/version; it cannot duplicate a publication or resurrect a revoked one.

Future target kinds are rejected, not stored as dangling polymorphic IDs. Article archive/publication change/invalid manifest or retirement of a referenced clinical term withdraws eligibility until a compatible reviewed replacement is published. A working article draft alone has no effect. Unavailable image bytes give the library's established placeholder behavior; image availability does not rewrite clinical meaning or grant media access.

FKs/unique constraints protect owner/version/review/target binding; content/review history is append-only, and rollback refuses populated destructive down-migration. Application rollback disables recommendations and retains schema/history. No health schema extension, health backfill, existing-data rewrite or new dependency is proposed.

## Proposed URLs and retained screens

These exact canonical routes/navigation are covered by the source/design approval:

- `/panel/recommendation-rules`: existing Content submenu, staff list/filter/status cards; designated doctors see assigned review work only. Root-only Reviewer access tab on this page, not a new role/URL.
- `/panel/recommendation-rules/new`: retained article-add main/sidebar card grid, bilingual tabs and structured controls.
- `/panel/recommendation-rules/:ruleId`: retained card/grid detail with current/published comparison, sources, reviewer actions and immutable history; public ULID.
- Existing `/panel/my/articles/:articleId`: proposed personal-suggestion section in the accepted sidebar. No new patient panel route or changed article composition.

Wireframe:

```text
Rule editor: existing Velzon main/sidebar grid
+------------------------------------------------+--------------------------+
| EN / Farsi title and patient explanation        | State / current version  |
| Target: published article(s), exact snapshots   | Assigned clinician       |
|                                                | Save draft / Request review
| Show when: ALL / ANY                           | Publish (eligible only)  |
| [field] [comparison] [value] [freshness] [+]     | Stop publication         |
| Exclude when: ALL / ANY                        |                          |
| [field] [comparison] [value] [freshness] [+]     | Version / review history |
|                                                |                          |
| Population / limitations / evidence sources    | Root: reviewer access    |
| Synthetic case preview: match / no match / ?    |                          |
+------------------------------------------------+--------------------------+
| Save / Cancel share the same action row                                   |
+---------------------------------------------------------------------------+

Patient article page: retained author/sidebar beside article body
+---------------------------+-----------------------------------------------+
| Author                    | Published article body                        |
| Suggested for you         |                                               |
| Reviewed item             |                                               |
| Why this suggestion?      |                                               |
| Existing general reading  |                                               |
+---------------------------+-----------------------------------------------+
```

Use existing Bootstrap/forms/modals, flag-owned EN/Farsi/RTL, adjacent action buttons and normal loading/cancel/uncertain-delivery states. No raw JSON/HTML authoring. Condition rows express a sentence; no arbitrary script editor. Each selected numeric field supplies its unit rather than asking the author to type one. Empty/missing reviewer grants explain availability inline, not repeated alerts. Do not add password/reason/confirmation chains to ordinary Save/Publish; keep session/authority/revision/audit protections server-owned. Root reviewer grants/revocations use the established high-authority administrative controls and require separate concrete UX confirmation if their shape changes.

Preview uses server-defined, clearly synthetic cases only and has no patient selector or real-health lookup. It does not create clinical review. A clinician still reviews the rule/target/source meaning. Dashboard placement and additional authoring widgets remain later composition work.

## Proposed APIs and private evaluation

Patient: `GET /api/my/recommendations?language=en` with optional already-visible `article_id` to exclude the current article, plus a bounded server result limit. Only documented parameters; no patient IDs, health values, reasons or match traces in URLs. Active pure patient authority, private/no-store headers and no conditional/shared caching. Staff/support roles cannot obtain results for another actor. Feature unavailable state does not read/decrypt health data.

Proposed staff prefix: `/api/admin/recommendation-rules` for bounded list/detail/context/draft/assignment/editorial actions; `/api/doctor/recommendation-rules` for assigned list/read/review/withdraw only. Root reviewer-grant contexts/actions remain under the staff prefix with root-only fresh checks. These API endpoints are implemented source; default-off flags and the separate activation gate remain.

Evaluate one current owner snapshot in memory, against at most500 eligible current rule versions and at most20 exact targets per rule. Exceeding validated capacity fails closed, not a hidden partial evaluation. Cache only non-patient compiled rule definitions by catalog/schema version; never shared-cache personal results. Use a deterministic priority/public-ID tie-break, de-duplicate targets, and exclude the currently read article. Do not fetch evidence URLs, execute queries from conditions or iterate across patients.

Before returning any item, recheck current article publication/archive/review/actor/grant/term/catalog bindings coherently. A change during evaluation causes one fresh bounded retry or a safe unavailable result, never a result against mixed snapshots. Personal results are not persisted to profile meta, reports, analytics, operational logs, notifications, browser local/session storage or a marketing audience. Patient health changes, logout/account switch, rule revocation and content changes invalidate ephemeral client results; ordinary profile edits do not silently refresh old observation dates.

Persistence coordination takes recommendation catalog -> article catalog before authority/rule/grant/review/target rows. Staff/reviewer/attribution user reads share locks; recommendation writes serialize through the catalog. Patient owners take an exclusive user lock directly before the existing health/article readers, avoiding concurrent shared-to-exclusive owner upgrades. No claim of a globally sorted user-lock protocol across existing external writers is made; actual MySQL interleavings remain an activation prerequisite. Use current locking reads for eligibility under MySQL repeatable-read; do not combine a fresh pointer with an earlier consistent-read snapshot. Article publication must not acquire the recommendation catalog in reverse order: evaluate both catalog revisions/current target bindings instead. Do not nest owner-health and article-reader services in a conflicting lock order. Revocation is effective on the next current read, not delayed until a shared cache expires. Validate the order with real MySQL interleavings before activation.

Owner response states: `matched`, `no_matches`, `insufficient_information`, `unavailable`. Include only allowed published target resources, reviewed localized explanation, public rule-version identity and a minimal owner-only request for relevant missing fields. Never expose other rules' filters, staff review notes, qualification evidence or another patient's values. Unreadable/unsupported owner health data fails closed with a generic message; the general library remains usable. No automatic booking, payment, orders, diagnosis or treatment action occurs.

## Source file plan and verification

Already existing integration files remain intact during the independent foundation. Proposed new files:

| Slice | New/source files |
| --- | --- |
| Pure foundation, allowed now | `app/Services/Recommendations/RuleCondition.php`, `RulePredicateEvaluator.php`, `PredicateOutcome.php`; `tests/Unit/Recommendations/RulePredicateTest.php`; isolated source runner |
| Approved-schema persistence | Migration above; `RecommendationRule`, `RecommendationRuleVersion`, `RecommendationRuleReview`, `RecommendationReviewerGrant` models; `RecommendationAdministration`, `RecommendationContent`, `RecommendationAuthority` services |
| Owner service/target adapter | `PatientRecommendationService` (private owner projection), `RecommendationTargetPreview`, `SyntheticRecommendationCases`; `RecommendationController`; independently disabled authoring/matching config |
| Retained panel | `frontend/src/modules/checkupino/recommendations/`, staff rule pages, existing patient detail/sidebar, manifest/registry/menu and paired locales |
| Acceptance | Isolated predicate/privacy/API/lifecycle tests, disposable MySQL interleavings, frontend/native EN/Farsi desktop/mobile and separately authorized synthetic review/activation |

Meaningful tests: exact numeric/BMI boundaries without float rounding; birthdays/leap dates/Tehran day boundaries; wrong/future/stale units/dates/provenance/catalog; clear/unknown/declined vs explicit no; incomplete lists and unknown exclusions; bounded/canonical definitions and malicious fields/operators; duplicate IDs/targets; author/reviewer separation and revocation; target working/publication/version/archive changes; atomic audit rollback and duplicate/uncertain delivery; cross-owner and support denial; no sensitive response/exception/cache/log leakage. Use invented health values and inactive synthetic rules; no seeded clinical approval masquerades as actual review.

Source-schema tests precede disposable MySQL. Existing guarded database Compose ownership remains with the operator; do not reset/reseed the original laptop or consume its pending jobs. New panel builds/activation/migrations require their own concrete accepted packages. Historical other-PC workers/publisher authorizations do not authorize changing this laptop's runtime during recommendation planning.

## Design basis and remaining decisions

Per-request, default-deny access follows [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). Patient health/match payloads are excluded from operational logs in line with [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html). Versioned knowledge artifacts with lifecycle/evidence metadata are also described by [HL7's clinical knowledge-artifact guidance](https://hl7.org/fhir/clinicalreasoning-knowledge-artifact-representation.html); this project-specific JSON protocol does not claim FHIR implementation or clinical validation. Sources checked November5; they do not supply medical criteria or qualify a reviewer.

The user has approved the six-table source package, three panel routes/retained controls and existing-role reviewer designation model. Actual clinical reviewer identities, qualification, criteria, source assessment and time validity remain required before activation. The explicit source approval covers schema definitions and isolated tests, not a new role, live migration/grant/health read or personal-rule activation.
