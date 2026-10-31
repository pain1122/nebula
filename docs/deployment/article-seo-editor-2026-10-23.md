# Article editor SEO and viewport follow-up

October23, Asia/Tehran. User explicitly requested removal of the Summary input, desktop400px/mobile250px CKEditor, and an accordion containing SEO Title, SEO Description, Keywords, Schema Script and Canonical link, with examples and colour counters. No new URL, dependency or database migration is needed.

## Behaviour and Google's guidance

The summary input is removed from article authoring. Existing summaries remain immutable/readable in historical records; new authoring does not require one for publication. The article-only editor viewport is400px from768px screen width and250px below768px, with internal vertical scrolling. Other CKEditors retain their existing sizes.

The closed-by-default retained Bootstrap accordion follows the article's English/Farsi language selection, with a language selector inside it. It has a keyboard-operable button, explicit expanded/controlled state, hidden collapsed fields, localized examples, correct text directions and preserved drafts. Review/older-version previews expose SEO as escaped data in a collapsible section.

| Field | Editorial colour guide | Storage bound |
| --- | --- | --- |
| SEO Title | Neutral below50; green50–60; red above60 |200 Unicode code points |
| SEO Description | Neutral below120; green120–160; red above160 |1,000 Unicode code points |
| Keywords | Comma-separated text, optional |1,000 Unicode code points |
| Schema Script | JSON-LD data without HTML/script wrappers, optional |20,000 Unicode code points; bounded depth/nodes |
| Canonical link | Absolute HTTPS URL without credentials/fragment, optional |2,048 Unicode code points |

Counters include Unicode code points consistently with the server. Neutral uses the normal body colour (dark in light mode, readable in dark mode). Red length advice alone does not block saving; the separate storage/security bounds do. Invalid JSON-LD/canonical input shows an explicit error and blocks save.

Google specifies **no fixed character limit** for either [title links](https://developers.google.com/search/docs/appearance/title-link) or [meta descriptions](https://developers.google.com/search/docs/appearance/snippet), and truncates according to available display width. The50–60/120–160 ranges are Checkupino editorial guidance, not numbers attributed to Google or a guarantee of search display. Google can generate different titles/snippets.

[Google ignores meta keywords for indexing and ranking](https://developers.google.com/search/docs/crawling-indexing/special-tags); the requested field is retained without a ranking claim. [Google recommends JSON-LD](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) where practical. The field stores bounded JSON data using `https://schema.org` (with optional trailing slash), rejects script/HTML wrappers, unsafe keys and foreign contexts, and never executes scripts or fetches context/canonical URLs. This is syntax/bounds validation, not Google Rich Results eligibility certification. [Canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) is retained for the future public renderer.

SEO metadata is optional per language and saved in the existing translations JSON as **article content schema2**. It participates in exact content hashes, signed revisions, review invalidation and immutable version recovery. Existing schema1 readers/hashes and copy lineage remain intact. New schema2 publication requires a title and meaningful body in one language, without the removed summary. No backfill, schema/table change, environment change or live content save is performed for this follow-up.

## Verification, limits and rollback

The focused isolated backend gate passes168 tests/1,255 assertions, including actual API save -> submit/review/publish -> SEO-only edit -> older-version copy, exact old publication retention, schema1 compatibility, invalid input refusal and metadata-only audit. A first test run exposed explicit-null SEO being normalized to empty; it now rejects null. Final pure SEO validation passes19/27 after accepting the official schema.org trailing-slash form. PHP style passes for the five changed PHP files.

Frontend article checks pass46, including both language payloads, absent summary, accessible accordion, Unicode colour boundaries, advisory rather than mandatory length ranges, unsafe JSON-LD/canonical refusal and unchanged authority/cancel/uncertain-delivery protections. Typecheck, governed/affected-page lint, format and unchanged quality ratchets pass. Full846 and prior11 MySQL contention receipts remain historical evidence for their recorded source; no claim that the earlier MySQL suite was rerun for the new SEO fields. No lock ordering, schema or transaction/audit policy changed.

Accepted static image is `sha256:99a2e775c8abedadd79788d36579ff472fbe6b07399525b02878588100bc9586`, retained as `checkupino-admin:article-seo-accepted-2026-10-23`. [Static acceptance](evidence/article-seo-static-1792776123789-2026-10-23.json) verifies45 served/container assets including the new lazy article stylesheet, compression/cache and routes. [Native acceptance](evidence/article-seo-browser-1792776030416-2026-10-23.json) passes eight admin/root ENFA1440/390 cohorts,16 groups,24 captures and110 requests: exact400/250px editor heights, no summary, accessible accordion, all counter boundaries, five localized examples, safe JSON and cancel. All30 business/protected fingerprints (including existing audits), zero health rows and two jobs are unchanged; nine normal services run and helpers remain stopped. The first static check encountered normal starting health immediately after recreation; it refused without acceptance, and the healthy check above passed.

The immutable source/verification summary is [article-seo-editor-2026-10-23.json](evidence/article-seo-editor-2026-10-23.json). Native browser acceptance uses ordinary real reads and unsaved drafts only; persisted SEO is tested in isolated SQLite, not a new live content save. Initial UI runs exposed the installed AccordionHeader's missing expanded state and a test selector matching both hidden languages; the native button now carries explicit accessible state and tests query visible controls. Failed checks never wrote live content.

Public blog/SEO rendering remains deferred. These fields are authoring metadata; no authenticated panel page emits the supplied JSON-LD, canonical or SEO tags into its document head. Patient library exact URLs/composition and reviewed recommendations remain the next demo stages.

Application rollback retains all content/version/reference/audit history. Restoring an older frontend/backend that understands only schema1 requires disabling article authoring first; never roll down populated tables or rewrite schema2 snapshots to pretend they are schema1. The retained prior `checkupino-admin:article-authoring-accepted-2026-10-23` image is a static fallback with authoring disabled; current code can still read and recover schema1. No scanner/parser/worker activation or processing of the two existing medical jobs is included.
