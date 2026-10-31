# Patient health information before personalized content

Status: **source migration, isolated tests, owner APIs and existing-profile controls approved October22**, with the user's correction: current conditions/allergies use controlled taxonomies instead of free text. Source implementation is recorded in [the implementation gate](patient-health-foundation-2026-10-22.md). Live schema/feature activation, saves and deployment remain separate. The user selected patient-entered information first with reviewed recommendation rules, and exactly male/female options for gender. No third gender option or additional sex-at-birth field is proposed. No option is preselected; an unanswered optional field remains unset.

## Demo sequence

1. Structured, private patient health information and measurement history on the existing profile.
2. Blog/article authoring and taxonomies, then patient article discovery, using retained Velzon blog widgets and the existing CKEditor/sanitizer foundations. Categories/topics and tags organize content; they are separate from a patient's medical facts. Draft/published/version and EN/Farsi behavior must be explicit. Use safe local cover placeholders until a real media-publication path is accepted.
3. One shared, reviewed recommendation layer targeting articles, checkups and self-care. Rules reference stable field codes, not translated labels or free text. A rule revision declares input meanings, units, eligibility, missing-data handling, measurement freshness, exclusions, reason text, content version and clinical review. Suggestions explain which patient-reported facts matched. Unknown inputs cannot silently match a negative answer. Unreviewed rules cannot publish; no automatic diagnosis, medicine advice, booking, billing or order is implied.
4. A small synthetic end-to-end demo with approved content/rules, then broader authoring and rule coverage. Several hundred articles should be content/rule data, not hundreds of hardcoded frontend conditionals. Public SEO/blog website delivery and a new content-manager role are still separate scopes; first discovery is inside the authenticated panel.

Only step1 is the requested implementation slice now. No blog/taxonomy/rule tables or new content routes are included in this migration approval. They follow with their own concrete contracts, using the same health field catalog.

## Proposed first fields

| Group | User input | Meaning and storage |
| --- | --- | --- |
| Personal | Birth date; calculated age | Explicit patient-confirmed calendar date. Derive age when read, never store a drifting age. Do not infer a real date from the registration fallback. Do not change identity/account fields in this slice. |
| Personal | Gender | Male/female only, patient-reported, no default. Optional unset is missing data, not a third option. This field does not assert clinical verification or inferred anatomy. |
| Biometrics | Weight in kg; height in cm; date measured for each | Exact canonical quantities with explicit units, separate measurement dates and server recording time. New measurements append history; editing another field does not refresh an old measurement date. |
| Calculated | BMI estimate | Computed server-side from the selected height/weight observation references, never trusted from the client. Show inputs/dates; no automatic healthy/unhealthy diagnosis. Adult interpretation and pediatric handling are separate reviewed rules. |
| Reported conditions | Controlled condition selection including high blood pressure, diabetes and high blood lipids | Stable server-owned IDs and bilingual labels. Group status is reported/none known/unknown/declined; missing stays distinct. These are patient reports, not measurements or doctor-confirmed diagnoses. The taxonomy replaces duplicate yes/no disease questions; no contradictory parallel disease flags. Blood pressure numbers or laboratory results would be different observation types later. |
| Lifestyle | Current smoking/hookah use, current alcohol use, low activity, stress | Yes/no/unknown/prefer not to answer, with questions explicitly about the patient's report. No inferred activity/stress diagnosis. Former use or detailed frequency can be added with a new catalog revision rather than misusing a boolean. |
| Family history | Known family/hereditary history | Yes/no/unknown/prefer not to answer. A generic yes does not infer a specific disease/relative. Future coded condition/relative details can extend the catalog; no free-text disease description in this slice. |
| Context | Current conditions and allergies | Searchable multi-select controlled vocabularies, with distinct condition/allergen IDs. No typed label, arbitrary code or free-text note is saved. No automatic copy/overwrite of legacy `user_profiles` notes. |

Each structured fact has a stable code, source and asserted/measurement time. No/unknown/unanswered/declined stay distinct. All fields are optional; only explicitly supplied changes are saved. Clearing a fact is explicit and retains prior history. Editing weight does not silently confirm the rest of the form. Existing names/contact/support fields are not copied into the health payload or made editable here.

The health birth date is an explicitly reported health fact and does not overwrite the protected account birth date. Existing registration currently supplies an18-year-old date when absent; it must not become evidence for age-based recommendations. Existing legacy allergy/chronic-disease strings remain intact and are not automatically classified.

## Exact page and controls

Reuse **`/panel/profile`**, patient owner only, with a bilingual “My health information” section and an existing-profile quick-access anchor. No new canonical panel route, separate dashboard or sidebar item.

Use the existing Velzon cards/grid, segmented radio controls and form components. The screenshot informs the groupings: personal details, biometrics, reported conditions, lifestyle/family history. On desktop, an8-column form and4-column summary; stack on mobile. Summary shows entered facts, measurement dates, calculated age/BMI when usable, and last update; no fabricated scores or article matches before rules/content exist. A read-only summary opens an explicit edit state within this section. Save/Cancel share the same responsive action row; cancel discards the draft. Existing display-name editing remains its separate modal.

English/Farsi labels, flag-owned direction, RTL arrows and accessible keyboard radio/label behavior are required. Numeric input normalizes supported Persian/Arabic digits before validation. Dates are stored as calendar dates without timezone conversion, with explicit calendar labels and localized summaries; never guess Jalali/Gregorian from ambiguous text. Reuse existing localization/dependencies; a Jalali input adapter must receive bounded date/leap tests if needed, not a new date-picker dependency.

The component does not mount/fetch on support profiles or doctor/admin/root self pages. Existing support summaries remain metadata-only. Do not deploy an active save form before the source/schema activation gate is fulfilled.

## Bounded persistence contract: two new tables

Add one source-only migration, provisionally `2026_10_22_000001_create_patient_health_foundation_tables.php`:

1. **`patient_biometric_observations`**: internal ID, public ULID, patient/actor user FKs, metric code, source, encrypted typed payload (canonical quantity/unit and measurement date), server recording timestamp and optional same-owner/same-metric correction reference. Only height and weight are enabled initially. Measurements append; they do not rewrite earlier observations.
2. **`patient_health_snapshots`**: internal ID, public ULID, patient/actor user FKs, monotonically increasing patient version, field-catalog/schema version, encrypted structured payload, server recording timestamp. Payload includes the demographics/coded-condition/allergen/lifestyle answers, their provenance/times and server-owned references to that patient's selected observations. Unique patient/version and a latest-version lookup index. Every accepted save appends a snapshot; old snapshots remain immutable. No mutable user-meta blob or migration of old medical data.

### Controlled taxonomy contract

`HealthCatalog` initially owns a small versioned bilingual vocabulary in source, shared by API and UI. IDs such as `condition.diabetes` and `allergy.latex` are immutable product vocabulary IDs, not claims of ICD/SNOMED coding or clinical review. Article eligibility/tags can reference these IDs later, without matching translated labels. Catalog management/storage and larger clinically reviewed coverage belong to the following blog/taxonomy slice; this approval introduces no third table.

Selections contain `{status, codes}`. Reported/yes may have zero codes when a needed term is unavailable; that is explicitly different from none known. Unknown/declined/none cannot carry positive codes. Duplicate/unknown/inactive/wrong-kind codes and extra fields are rejected server-side. Retiring a term must retain its ID/label for historical rendering; never delete/reuse IDs. Any catalog/schema revision requires a backward reader before activation; unsupported recorded versions fail closed. No rule may infer a disease, disease absence or allergy severity from a missing term. Patient content does not automatically add taxonomy terms.

Use the existing application's encryption facilities and key; no replacement key/dependency. Encrypted values are never queryable patient-directory filters or audit content. Current recommendations can load/decrypt one patient's latest snapshot and evaluate a reviewed catalog in memory; no database-wide medical targeting is introduced. This is not a FHIR server or a compliance/readiness claim.

No fields are added to `users`/`user_profiles` or existing medical request/report tables. No live migration/backfill/reseed or protected-account write is covered by source approval. Existing clients ignore the additive tables. Rollback retains populated health tables/history; migration down refuses nonempty data rather than silently deleting it. Any live activation needs a separately concrete, operator-controlled step after isolated acceptance.

## API, privacy and concurrency

- Owner-only **`GET /api/my/health-profile`** and **`PUT /api/my/health-profile`**, current active patient role required. No target user ID, foreign observation reference, arbitrary extra field, client BMI, source/actor/verification flag or ownership override is accepted.
- One atomic transaction: lock/reload the current patient and roles, compare the expected snapshot revision, validate allowlisted fields/units/dates/measurement ownership, append changed observations and the next snapshot, then write a safe audit event. Duplicate/stale delivery refuses; no-op refuses. No other patient's latest snapshot can be selected.
- Reuse ordinary recent-password controls for sensitive saves, explicit confirmation and existing session/abort/ambiguous-delivery behavior. A new owner health save is distinct from the personally deferred name/profile rehearsal; this proposal does not authorize a live write of either.
- Audit metadata contains only safe snapshot/revision identifiers, schema version and counts, not medical values, DOB, gender, BMI, notes or condition-specific changed-field names. General activity feeds must not reveal patient answers.
- No automatic doctor/admin/root access to these new health contents. Any later clinician access needs an explicit purpose/ownership/consent contract. Editorial users can manage field/rule definitions without browsing patient records.
- `private, no-store`; current-session/owner-bound caches, immediate invalidation on logout/account change and the retained history-restoration guard. No health payload in localStorage, sessionStorage, URLs, analytics, public asset storage or raw logs. No rule matching based on the absence of a health record.

## Focused verification and acceptance

Source migration fresh/rollback/nonempty-retention tests run only in isolated storage/database. Test encrypted-at-rest round trips and unreadable-key failure without overwriting history; optional/unset/no/unknown/declined semantics; numeric/unit/date/leap handling; no birthday rollover/timezone drift; missing/default birth-date behavior; height/weight history; clear/correction ownership; changed-field timing; server BMI; no-op/stale/duplicate/atomic-audit failure; and guest/other-role/foreign-owner/privacy/session refusals. No adult BMI category is applied to an unknown-age or child profile. Avoid inventing clinical thresholds or freshness periods; those belong to reviewed rules.

Then reuse the disposable MySQL admission guard for relevant simultaneous health saves, followed by bounded patient ENFA desktop/mobile and admin/doctor/support refusal checks. Test9/31/19 existing writer gates remain immutable evidence; do not rerun790 frontend tests for every incremental health edit. Full release regression follows the integrated candidate, not each small source change.

Synthetic data only; no live profile save, schema activation, scanner retry, queue consumption or current-history replay. Existing two medical jobs and protected accounts7/8 stay untouched. Latest accepted panel2f7bc492 remains until the new slice is properly accepted/activated.

## Design references and limits

The proposed source/date/missing-value distinctions draw on [HL7 FHIR R4 Observation definitions](https://www.hl7.org/fhir/R4/observation-definitions.html), which describe measurements/simple assertions, effective time and absent-result reasons. This is design guidance, not an implementation of FHIR.

Gender semantics are intentionally limited to the user's two-option self-report request. No separate identity/sex-at-birth fields or clinical verification are inferred; [HL7 Gender Harmony guidance](https://hl7.org/xprod/ig/uv/gender-harmony/fhirgenderharmony.html) explains why a generic gender field should not silently stand in for every clinical concept.

[CDC's adult BMI guidance](https://www.cdc.gov/bmi/adult-calculator/) applies its adult categories to age20+ and treats BMI as a screening indicator. The first slice therefore does not copy the screenshot's blanket “normal weight” conclusion or activate BMI-based recommendations. Published clinical rules and their intended populations need actual review; no independent clinical expert review is claimed.

## Approval boundary

The user approved the two-table **source migration**, isolated tests, owner APIs and described existing-profile controls, adding the controlled-taxonomy requirement. No live migration, backfill, deployment activation, clinical rule publication, new dependency or doctor/admin clinical-read permission is included. Source approval satisfies the named migration/page-composition gates in `AI_BOOT.md` and the medical-schema extension gate; do not ask for it again. Operator-controlled activation is a later concrete step after the remaining acceptance gates.
