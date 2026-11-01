# Full-length article seed and recommended reading

November 1, 2026. User requested visible recommendations and at least one full-length seeded post demonstrating the supported typography and image layouts. This follows the accepted [patient library](patient-article-library-2026-11-01.md).

## Delivered behavior

- `ArticleDemoSeeder` now calls the additive `ArticleShowcaseSeeder`. Its bilingual fixture is in `database/seeders/Support/DemoArticleShowcase.php`, slug `demo-seed-complete-visit-guide`.
- The published guide demonstrates h2/h3/h4, bold/italic/underline, paragraphs, nested unordered lists, ordered lists, blockquotes and a labelled link. Browser text counts are 1,278 English and 1,246 Farsi words including captions.
- The explicit verified-media stage adds a cover and four body images using the existing three genuinely released synthetic PNGs: wide block, side image with wrapping text, inline image and another captioned block. Metadata-only seeding never manufactures image eligibility.
- Server and both staff/patient render sanitizers preserve only the approved `image-style-side` class alongside `image`; arbitrary classes, styles and event handlers remain stripped. Existing default image canonicalization is preserved. The article editor exposes its existing inline/block/side image controls.
- The detail sidebar now renders **Recommended reading** immediately below the author. It requests other published articles sharing the first tag/category, falling back to the general published library when no other shared-topic match exists. It excludes the current article and shows at most three links with available cover thumbnails.
- These are explicitly labelled general reading suggestions. No health-profile reads or personal clinical matching were added. Reviewed personal recommendation rules remain CURRENT_TASK stage 5.

## Seeding and preservation

Fresh metadata profile: 7 articles / 8 versions. Fresh verified-media profile: 7 articles / 11 versions / 3 assets / 16 immutable media references. The complete verified-media seeder retains its owned-account/reservation/article/file/job guards; it is unsuitable for a database containing extra user-created articles.

The current populated demo used only the targeted showcase seeder, with verified media enabled for that process. It added one article and two ordinary published versions through `ArticleDraftWrite`; it did not run the full seed graph, reset data, replace any original article, edit publication pointers directly, revalidate assets or consume jobs. On a repeat, all captured rows remained exactly identical. Later user edits are preserved; an unrecognised metadata-only showcase is refused before upgrade.

Current inventory after this addition: 8 articles / 13 versions / 5 terms / 24 term references / 3 assets / 16 media references / 71 audits / 0 schedules / 0 pending or failed jobs. This includes the pre-existing archived library-acceptance article. Fingerprints verify preservation of every pre-existing content/media/audit, appointment, medical-file/report, health-snapshot and biometric row captured before the targeted operation.

Live showcase: `http://localhost:3000/panel/my/articles/01m6bpee2w5cdmr6vmns3a9zbv` (patient login required).

## Verification and candidate

- Guarded UID33, network-isolated SQLite reader/media/administration/seeder tests: **70 tests / 799 assertions**. Covers bilingual formatting, sanitizer idempotence, hostile class/style rejection and repeat-safe seed inventory; validator doubles in these tests are not engine acceptance.
- Separate fresh tmpfs/SQLite full migration/seed/exact-repeat run used the real scanner (official database 28171) and remote parser. All three images and both synthetic medical PDFs were processed through ordinary services; only its two exact owned temporary jobs were delivered. No live database or private storage was mounted. Receipt: `evidence/fresh-populated-seeds-sqlite-1793541455877.json`.
- Five affected frontend suites: **102 tests**. TypeScript, scoped lint, Prettier, PHP Pint and host quality ratchets passed; no dependencies or migrations added.
- Four served browser cohorts (EN/Farsi, 1440/390): both complete translations, all typography, cover/body/recommendation image loading, two non-self published recommendation links, linked article navigation, author/sidebar order, desktop side-image wrapping and mobile stacking. No page errors or horizontal overflow. Desktop side image floats right in English and left in Farsi; inline illustrations remain smaller than block images.
- Served admin image: `nebula-panel:clean`, `sha256:4cf3c8d5297484d81a57ab9e3f4e291359b68095c1f34f3c137e195a0731a5be`. Only admin was recreated. Existing background processes remain running; no general queue delivery was invoked by this work.
- Supplemental UI screenshots, original-row baseline, final state, test/build logs and adapted isolated runner are retained under ignored `.local/planning/article-showcase-*`, `showcase-*` and `verify-showcase-seeds.ps1`. That local runner pins the currently installed app/parser images; historical pinned runners were not weakened.

## Rollback and limits

Previous admin image is retained as `nebula-panel:before-showcase-2026-11-01` (`d4072441a673aa626c04f43fa8f260b370436bb37da53452ecd558ebca3ac137`). Reverting the frontend removes the new sidebar/style controls but must retain all existing article/version/media/audit records. Keep server side-style support when reverting, because published immutable showcase snapshots now contain that approved class. Restore visibility through ordinary editorial actions if desired; never delete or rewrite published history.

Illustrations are the existing synthetic fixture assets. New-PC installation, broad media hardening, automatic schedules and personal recommendation rules retain their separate acceptance requirements. No commit, push or external publication was requested.
