# Patient published-article library

Accepted November 1, 2026, Asia/Tehran, on the fresh local instance. Source is an uncommitted worktree based on c4bd2c0. The user accepted the prepared proposal by instructing implementation to commence; the exact overview/author/sidebar reference was separately explicit.

## Delivered behavior

Patients have /panel/my/articles and /panel/my/articles/:articleId, entered from Content. The retained Velzon GridView and user-selected /panel/dev/pages-blog-overview supply the composition: cover/title/tags, author sidebar beside the article body, with categories/tags/sources below the author. Mobile stacks the original columns and English/Farsi retain selector-owned direction. The sidebar remains the future location for reviewed recommendations; none are fabricated or activated.

Search, bounded category/tag filters, server paging, query-preserving return links, refresh, unavailable states and image placeholders use real APIs. No health profile is required. The new patient controller/read service reuse existing snapshot validation, private media storage, release/freshness policy, shared query transport and account-change cache reset.

The four GET routes are /api/my/articles, /api/my/article-taxonomies, /api/my/articles/{articleId} and /api/my/articles/{articleId}/media/{assetId}. The reader selects only the published pointer; working drafts cannot change visible text, search, pinned taxonomies or media. Whole complete translations fall back with explicit language labeling. Retired terms retain their published labels. Images require the current publication/version, permitted language/reference, current release/policy evidence and exact bytes. Staff media inventory stays inaccessible to patients.

No migration, new dependency, role, feature flag, upload flow or medical-data operation was added. Existing article enablement gates remain. Public SEO/blog routes, broader media hardening and personalized rules are separate.

## Verification

- Guarded no-network, read-only-source UID33 SQLite memory/private temporary-storage gate: 65 tests, 668 assertions. Includes patient reads plus retained staff readers/editorial media contracts. Run scripts/content/test-patient-readers.ps1 against the installed local PHP image; it resolves that image to an immutable digest and never pulls.
- Affected frontend suite: 99 tests pass across PatientArticles, productRegistry, Articles and ArticleMedia. Final typecheck passes under the locked Node24 environment. Scoped lint, Prettier and PHP Pint checks pass.
- Quality ratchets pass from the frontend directory with host Node/Git: any=2515, ambient=10, legacyApex=40, undeclared=0. The new reader does not introduce backend-origin access outside the transport adapter.
- Four real patient browser cohorts pass: English/Farsi at1440/390px, native search/list/detail, exact real covers, retained author/body layout, refresh, query-preserving return and no JavaScript errors or horizontal overflow.
- Further English/Farsi native checks pass for page navigation, category selection/reset and logout/reload. Admin/root/doctor direct patient-page navigation mounts no reader and issues zero patient-library API requests; their direct APIs refuse403 and guest refuses401.
- MySQL EXPLAIN on this seven-article instance uses the composite article/version unique index for eq_ref lookup; article ordering uses a small filesort. No additional index or schema change is justified by this checkpoint. Larger-catalog performance is not certified.

## Owned synthetic transition and preservation

One new clearly named synthetic article was created through ordinary authenticated, CSRF-protected administrative HTTP services: Publish v1 -> Save draft v2 -> Archive with fresh password/context/reason/confirmation. No publication pointer or verdict was edited directly. Patient detail kept the exact v1 title/body/version while v2 was a draft, draft-title search returned zero, and archive removed both detail and discovery. This is an API lifecycle acceptance with native patient readers; it does not claim a newly exercised native admin editor mutation.

The owned article remains archived with its two versions and six new ordinary audit events. Existing rows in all content/media/schedule/audit tables match their before-operation fingerprints. Final totals:7 articles/11 versions/5 terms/5 term versions/20 article-term references/3 assets/8 media references/0 publication schedules/63 audits. Pending jobs0, failed jobs0 at closeout. These are dated evidence, not permanent guards for future work.

## Candidate and rollback

Served panel image: sha256:d4072441a673aa626c04f43fa8f260b370436bb37da53452ecd558ebca3ac137, tagged nebula-panel:clean. Only the static admin container was recreated; backend source is the existing development bind mount. Eleven normal services are running, with panel/scanner/background health checks healthy.

Previous panel retained as nebula-panel:before-patient-library-2026-11-01, image sha256:95773d1c600156ff566f5cb144917f469c866401b19801025cbb1a4111ba80ff. Re-tagging that image as nebula-panel:clean and recreating only admin rolls back the client; unused additive patient readers may remain until a compatible reviewed source rollback. No database down/reset, history deletion, private-object removal or worker change is required. Do not restore old staff-library permissions underneath the new patient client.

## Local evidence and corrected attempts

Generated evidence is ignored and remains on this machine under .local/planning/: patient-library-live-result.json, patient-library-ui-final.json, patient-library-extra-result.json, patient-library-baseline.json, library/detail EN/Farsi desktop/mobile captures, patient-reader-tests.log, patient-frontend-tests.log and patient-library-build.log. Source hashes are recorded separately in patient-library-source-bindings.json. Absent local artifacts on another clone do not authorize replaying the owned writer or bypassing its guard.

The lifecycle runner refuses a recorded owned fixture; do not replay it. Two earlier read-only extended-browser attempts stopped because the one-time customizer overlay intercepted a click and because the verifier inspected navigation before the React request/render completed. The corrected verifier closes the real customizer normally and waits for the exact API response and rendered page; application behavior was unchanged and no lifecycle writer was repeated.

Initial frontend failures exposed a nested-locale mismatch, PowerShell pipe loss of Farsi characters, missing new-route expectations and lint issues in the new code. These were corrected and the final99-test/typecheck/lint gates rerun. One memory-limited typecheck process was killed; the successful final run used an adequate bounded heap, and frontend tests ran serially. Container-only ratchets could not run Git checks; the unchanged gate passes on the host with real Git. No guard was weakened.

## Next

Stage4 is complete for this bounded authenticated library. Next is stage5's reviewed recommendation-rule contract, followed by actual reviewer authority/review and isolated evaluation tests. Do not activate personal matching without reviewed rules. Broader media/S3/orphan/folder/continuous-delivery/scheduled-publication acceptance and the integrated four-role release freeze remain separate open gates.
