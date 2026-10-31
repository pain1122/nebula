# Article content source foundation — October22

Current pointer (October23): all four approved administration screens are now static-deployed; see [panel delivery and honest fixture/live limits](article-panel-2026-10-23.md). Full frontend78/835 plus final article37 and current draft44/346 pass;39 served assets. Article remains disabled/six tables absent. Next focused disposable MySQL, then separate exact activation/ordinary writes. The recorded source acceptance below remains historical evidence.

The user approved the [six-table/four-route administration proposal](article-taxonomy-proposal-2026-10-22.md). The first bounded source slice is implemented and verified. No live migration, flag, route wiring, build, content save/publication or media/worker operation occurred; the accepted health panel remains deployed.

Before this slice, the project had retained Velzon blog templates, CKEditor, the existing server sanitizer and the fixed medical vocabulary, with no production article schema. After this slice:

- One additive migration defines the shared catalog lock row, article terms/term versions, article identities/content versions and exact-version taxonomy references. Restrictive foreign keys prevent cascading content/history deletion. A composite FK rejects references binding one term to another term's version. Slugs remain reserved after archive/retirement; version numbers remain unique within their owner.
- Rollback inspects the complete schema and all business tables before dropping anything, then permits only an unused coordination row. Populated history, a changed coordination revision or partial schema refuses. This is tested on SQLite, including a complete empty down/up preserving unrelated users/roles/jobs and both health tables. MySQL DDL/locking acceptance remains separate; do not infer it from SQLite.
- `ArticleContent` prepares bounded EN/Farsi drafts using the unchanged installed `QuestionnaireRichTextSanitizer`. It strips active markup, requires valid UTF-8, enforces the editor's20,000 UTF-16-unit/80,000-byte body limit before and after sanitization, and refuses malformed/null/unknown fields without reflecting them in errors. Titles/summaries have their own bounds; incomplete drafts remain distinguishable from publication-eligible translations. Invisible-only titles/summaries and empty/sanitizer-removed bodies cannot qualify as a complete translation.
- Medical reference IDs resolve only against the current fixed source catalog and capture server-owned bilingual labels/kinds/version. Unknown/duplicate/forged references refuse; the service reads no patient information. Editorial HTTPS source links are validated/bounded, credentials and duplicate/unsafe URLs refuse, and no remote requests occur. Canonical hashes bind sanitized content and the caller's server-resolved taxonomy snapshots while ignoring JSON object key order.

`publishableLanguages` reports content completeness only. It neither authorizes review/publication nor implements the editorial lifecycle. Future writers must resolve taxonomy snapshots, enforce active references/parent rules and fresh authority, lock the catalog/target rows, compare revisions and record atomic audits. Current SQL tables are not a substitute for those application-level guards.

The isolated gate passes **35 tests/121 assertions**:8 schema/integrity/rollback cases plus27 content cases. It uses the existing pinned PHP8.3.35 image, UID33, network disabled, read-only source/root, masked private storage, empty test environment, memory-only SQLite and isolated storage/cache. PHP syntax/style checks pass; no dependencies were installed. Repeat only the current source gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/content/test-source.ps1
if ($LASTEXITCODE -ne 0) { throw 'Article source gate failed.' }
```

A test-bootstrap extraction initially retained a three-level relative path after moving into `tests/Support`, producing30 bootstrap errors before application setup. The path was corrected to two levels; an intermediate30/114 gate passed, then explicit-null/invisible-text/output-expansion hardening produced the final35/121 gate. No disposable MySQL or live database recreation was needed. Failed and intermediate outcomes remain recorded in the immutable foundation receipt.

Read-only runtime comparison confirms all30 prior business/protected fingerprints and both pending jobs match the accepted health checkpoint; health rows/runtime/images are unchanged. The six new tables and migration record remain absent from the live database. Nine normal services run, scanner/parser/checker/worker helpers stay stopped. No protected-account login or credential/key change.

Historical next step at this foundation checkpoint: protected readers, then taxonomy/article writers and editorial transitions. Protected readers and taxonomy writers have since passed; use the current pointer above rather than restarting them. The four administrative URLs, six-table source schema and described controls are already approved. Medical-term editing, patient library routes, positive health/profile saves and recommendations remain separate. Historical medical-catalog readers must precede any future managed medical-term mutations.

Source evidence: [immutable foundation receipt](evidence/article-content-foundation-2026-10-22.json). Current order: [CURRENT_TASK](../../CURRENT_TASK.md). Source schema approval does not authorize broad live migrate/reset/seed commands; no reset is required for this additive design.
