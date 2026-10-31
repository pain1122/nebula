# Medical content validation slice

October 8, 2026, Asia/Tehran. The user authorizes implementation using current safeguard guidance and explicitly approves qpdf/GD runtime definitions; the user retains Docker builds/Compose operations. No independent human expert audit is claimed. The design uses the current expert-authored OWASP upload guidance and parser-maintainer documentation listed below.

## Implemented behavior

`config/medical_content.php` and `MedicalContentPolicy` define strict, server-owned v1 rules with a deterministic SHA-256 revision. Unknown keys, unsupported versions, invalid types and out-of-range resources fail closed. Configuration changes produce a new revision; there is no validation-disable flag. These rules complement the existing issued attachment rules and current upload ceilings without altering their schema or authority.

`ReservationFileService::recordScan` now requires content validation of the checksum-verified private copy before saving a clean verdict. Failure rolls back the transition/audit, leaves access blocked and follows the existing dedicated job retry/failure path. Infected/failed antivirus results remain blocked and do not invoke a content parser. Successful scan audits add only `content_policy_revision` and `content_validator`, without parser output, document text, paths, metadata or filenames. No HTTP scan callback or manual live clean shortcut is introduced.

- **PDF:** pinned qpdf 12.4.2, reject encryption including empty-password documents, require `--check` exit 0 (reject warning/repaired PDFs), inspect bounded JSON v2 with canonical names and object-stream resolution. Defaults: at most 200 pages/20,000 objects; deny actions, JavaScript, forms/XFA, external links, embedded attachments and rich media. Unsupported binary names fail closed. This intentionally excludes interactive/signed AcroForm documents in v1; future support requires a reviewed policy/validator change.
- **JPEG/PNG:** detected MIME must match; dimension preflight followed by full GD decoding in a child process, with at most 8192 per dimension and 16 million pixels. Truncated/decoder-warning files and trailing bytes after the expected image terminator are rejected. Original bytes, checksum and clinical metadata are retained privately. No image rewriting, metadata stripping, preview generation or inline rendering is delivered.
- **Resources:** total parser wall deadline 10 seconds, per-child CPU 8 seconds/address space 256 MiB, PHP helper memory 128 MiB, combined stdout/stderr limit 4 MiB, no core dumps or output files. `prlimit` and shell-free argument arrays are mandatory. Child environment removes inherited OS/Dotenv/server variables; the PHP helper limits file access to its input and script and disables URL opens. A mode-0600 private spool is removed in `finally`; cleanup failure cannot yield an accepted result.
- **Dependencies:** development and production PHP Dockerfiles build qpdf from the official 12.4.2 source, SHA-256 `8a58af5b6141319287c1883bec8bd1bd545b7567b7fc5e6ce5d25a1c85f36397`, and enable GD JPEG/PNG support. Compilation dependencies and `prlimit` support are part of those build definitions. No Composer/npm dependency or lockfile change. Future qpdf upgrades require updating and verifying both source pin and adapter version.

## Verification status

The initial isolated www-data/testing/SQLite `:memory:` source run on the existing app image passes **22 tests / 80 assertions**, with **10 real-parser cases skipped** because that image lacks qpdf/GD. It covers policy revisions/invalid configuration, parser-contract failures, MIME/unsupported files, environment isolation, output/deadline limits, cleanup, prevention of clean release, retry-to-failed behavior and unchanged quarantined bytes. Pint passes all 15 touched PHP files across the focused checks. Existing scan/integrity/outcome fixtures now use actual synthetic PDF objects/xref rather than header-only placeholders, preserving their original security assertions.

The user-run isolated image build succeeds: `sha256:a48b0c0b60fc1e5b59685dd0d6a6fece0aec8119b9b5f854dbd1f3f2497b3094`. Prerequisites verify qpdf 12.4.2, PHP 8.3.35, bundled GD (2.1.0 compatible), JPEG/PNG and `/usr/bin/prlimit`. Final real-parser/regression acceptance passes **179 tests / 977 assertions**, no skips, **48.477 seconds / 62.50 MiB**. `CHECKUPINO_CONTENT_PARSER_ACCEPTANCE=1` makes missing tools a failure. Synthetic cases cover clean PDF/PNG/JPEG; malformed/repaired/encrypted PDFs; escaped names and compressed object-stream actions; embedded content/forms; page/object/pixel/dimension limits; and image truncation/trailing data including malformed content with a valid terminator. The broader gate retains checksum/tamper/ownership/current policy/history/audit/isolated queue behavior. Both generic and request-linked medical scan audit tests verify the safe validator/revision fields; their explicit allowlists admit those two fields and retain privacy filtering. [Source/runtime evidence](evidence/medical-content-validation-2026-10-08.json) binds the verified files/image and records the unchanged live quarantine/history check.

The first image run safely rejected two positive fixtures: bundled GD reports a compatibility label rather than a standalone version, and PHP spilled `php://temp` can leave EOF unset after a successful copy. The adapter now identifies bundled GD by its PHP patch version and explicitly probes EOF after the bounded copy; no parser checks were disabled. JPEG warnings are explicitly enabled (`gd.jpeg_ignore_warning=0`). Real parser runs use unchanged original bytes; invalid content remains blocked.

Build only; do not replace the running app:

```powershell
docker build --file docker/php/Dockerfile --tag checkupino-content-validation:2026-10-08 .
```

After the user reports success, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/verify-content-parser.ps1 -PrerequisitesOnly
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/verify-content-parser.ps1
node scripts/media/verify-attachment-api.mjs --verify-existing
```

The verifier resolves the image digest and creates only a temporary non-root, read-only, network-none test container with SQLite in memory, array cache/session, isolated tmpfs storage and no scanner socket. It does not start a worker or reach the live DB. The running app image and scan-worker image pins remain unchanged. The existing live synthetic attachment remains quarantined/unscanned; no live settings/file/medical writes, migrations, scanner retry, requeue or storage switch occurs.

Windows disables script-file execution in this session. The commands above allow only the reviewed verifier in a new PowerShell process; no persistent execution-policy setting is changed.

## Limits and next gates

qpdf explicitly warns that syntactically valid PDF can still contain invalid stream content or nonconforming constructs. These checks are neither a complete PDF security proof nor content disarm/reconstruction. Image decoding does not establish that arbitrary metadata is safe to render. Fresh antivirus acceptance and safe preview delivery remain separate requirements.

Subprocess resource limits and environment removal do not establish a separate filesystem/network security boundary for native parser exploitation. The isolated tests have no network; the existing app/worker deployment is not a dedicated parser sandbox. Production parity, least-privilege parser isolation, encrypted temporary storage/backups and real-patient release gates remain open. No actual clean/EICAR engine or worker acceptance is inferred from these tests.

This slice gates new clean transitions using the existing scan state/audit; it adds no separate persistent content state. Previously clean historical records would need an explicit compatibility/revalidation decision before real-patient activation. Policy revisions identify successful processing; tightening policy does not silently mutate originals or historical verdicts. A future validation-state/reprocessing schema is a separate approved slice.

Retain the stronger release gate during rollback: restore compatible parser dependencies/pins rather than disabling validation or reverting the gate. No schema rollback is involved. If older code cannot enforce it, pause medical processing/release until a reviewed compatibility path exists. Upload size defaults stay 10/5 MiB, transport 10/12 MiB, private storage local and scanning disabled. Keep the documented FreshClam cooldown through October 8 20:37:34 Tehran; definition access and engine/worker acceptance remain unestablished. Quotas/throttling/concurrency, targeted recovery, durable orphan/retention cleanup, large-file multipart and Velzon wiring remain open.

## Sources reviewed October 8

- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html): defense in depth, bounded processing, private storage, updated/sandboxed parsers and metadata treatment. It cautions about leakage to public scanning services; this implementation sends no medical content to such services.
- [qpdf 12.4.2 release notes](https://qpdf.readthedocs.io/en/stable/release-notes.html) and [official release assets](https://github.com/qpdf/qpdf/releases/expanded_assets/v12.4.2): current release/source digest and recent recursion/structure robustness work.
- [qpdf CLI](https://qpdf.readthedocs.io/en/stable/cli.html) and [JSON contract](https://qpdf.readthedocs.io/en/stable/json.html): encryption exit semantics, warning rejection, structural-check limits and canonical decoded names/object inspection.
- [PHP GD decoding](https://www.php.net/manual/en/function.imagecreatefromstring.php) and [getimagesize caveat](https://www.php.net/manual/en/function.getimagesize.php): dimension inspection alone is not image validation.
- [ClamAV maintainer guidance](https://docs.clamav.net/manual/Usage/Scanning.html): current definitions and restricted daemon access remain necessary; preserve the existing local Unix-socket design.
