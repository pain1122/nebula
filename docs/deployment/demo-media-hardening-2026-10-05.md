# Medical Media Hardening: First Slice

Verified October 5, 2026 (Asia/Tehran). This closes the reproduced alternate-route and byte-integrity gaps from the [security review](../audits/media-security-readiness-2026-10-05.md). Actual antivirus integration, self-hosted object storage, medical presentation and production/HIPAA readiness remain open.

## Delivered Behavior

- Generic Laravel signed GET/PUT routes for the `local` alias of the private root are disabled. Public assets retain their separate existing storage contract.
- The trusted internal `recordScan` boundary now requires the scanner's SHA-256 identity. A mismatching digest is rejected; a clean result also requires the stored bytes to match their recorded checksum and size. Missing or changed blobs cannot become clean. This boundary does not itself run antivirus or prove scanner provenance.
- Downloads validate the private disk, canonical reservation/file namespace, generated safe filename, supported MIME/extension, SHA-256 and bounded size. They capture and verify one copy, then serve that same copy. Changing or deleting the underlying path afterward cannot replace the response bytes.
- Attachment responses explicitly use private/no-store/no-cache, nosniff, a restrictive content policy and no-referrer. Existing ownership, quarantine, publication, retention and fail-closed audit contracts remain enforced.
- Capture reads at most 64 KiB per iteration and enforces the existing 10 MiB file bound. The temporary stream spills beyond 1 MiB of memory and closes on failure/completion. It can write plaintext temporary bytes: production needs protected/encrypted temporary storage and crash/recovery handling. This is bounded snapshot verification, not durable object immutability or a concurrent-request capacity benchmark.

Source: `config/filesystems.php`, `app/Support/VerifiedPrivateFile.php`, `app/Services/ReservationFileService.php`, the reservation-file factory and affected medical tests. All known scan call sites are tests; they now supply the digest explicitly. No public scan callback or production scanner caller was introduced.

Canonical-path enforcement fails closed for legacy noncanonical metadata; it does not silently rewrite stored records. The read-only live probe found zero medical file rows, including archived rows, so this environment needs no data conversion. Test factories now generate the same namespace as uploads and download fixtures carry accurate content metadata.

## Verification And Deployment

| Check | Result |
| --- | --- |
| Initial regression run before fixes | Five tests failed, reproducing signed-route access, missing-blob clean acceptance, digest mismatch acceptance, changed-byte delivery and reopening a mutable path |
| Final focused backend coverage | 37 tests / 259 assertions pass in 18.93 seconds |
| New integrity regression coverage | Eight tests, including invalid metadata, oversized/growing content and a 2 MiB spilled snapshot surviving source deletion |
| PHP formatting | Pint passes all eight affected PHP files |
| Patch whitespace | `git diff --check` passes |
| Live readonly verification | Generic local GET/PUT routes absent; local/private temporary URLs disabled; zero live medical rows; both health endpoints 200; synthetic generic storage URL 404 |

Backend checks ran as www-data with APP_ENV=testing, SQLite `:memory:`, array cache/session, `--do-not-cache-result` and isolated www-data-owned temporary test storage. No live upload, scan, medical write, migration, reseed, cache clearing or permission repair occurred. The runtime probe was removed after evidence capture.

Focused filter: `MedicalFileIntegrityTest|ReservationFileServiceTest|ReservationMedicalFileApiTest|DoctorMedicalReviewApiTest|PatientMedicalOutcomeApiTest|PublicMediaServiceTest|FoundationFactorySmokeTest|ReservationMedicalRequestReportSchemaTest`.

Evidence: [source checks](evidence/demo-media-hardening-source-2026-10-05.json), [runtime checks](evidence/demo-media-hardening-runtime-2026-10-05.json). The existing backend source mount picks up these PHP changes; no Docker image rebuild is required. Frontend files and the deployed admin artifact are unchanged, so their previous acceptance is reused. These checks are not a real-scanner, S3 or full medical browser acceptance.

## Recorded Direction And Proposed Next Slice

The user explicitly retains the original Velzon File Manager, requests strong media security with HIPAA as a priority, selects self-hosted S3-compatible storage because AWS is unaffordable, and reports no known BAA. Keep synthetic documents during development. File Manager currently remains a root-only toolbox reference with demo data; role-specific product integration is still needed. Reuse its existing Velzon composition within the patient/doctor/admin panel, exposing only each role's server-authorized operations.

**Storage decision accepted October 5:** the user locks in **SeaweedFS** for Checkupino and NebulaNV, prioritizing long-term maintenance, retaining AWS S3 compatibility and dropping Supabase. The original Velzon File Manager is retained for panel reuse. See [ADR-0002](../adr/ADR-0002-self-hosted-media-storage.md). Selection is settled; pinned-version integration and deployment acceptance remain open. Its official repository documents Apache-2.0 licensing, an S3 interface and server-side encryption/key-provider support. Those capabilities must be configured and tested in our deployment; they are not proof of HIPAA compliance or workload performance. [SeaweedFS official repository](https://github.com/seaweedfs/seaweedfs)

The bounded evaluation should use synthetic files and an isolated private service, without moving existing data or replacing the current stack. Review exact host resources, ports, private networking, persistent volumes, image/version pinning, required Laravel S3 driver dependency and maintenance before deployment. Docker builds/Compose remain user-run. No storage software, scanner, credentials or new topology was installed in this slice.

Required design for that evaluation:

1. Private medical quarantine and accepted objects have no anonymous/public ACLs, listing, direct browser writes or general signed URL issuer. Separate upload, scanner and download permissions; keep object identity/digest bound through the verdict and delivery. Keep medical bytes out of public media entirely.
2. Encrypt storage, temporary space and backups; use authenticated protected transport, separate key/secrets management, rotation and recovery. Internal master/filer/volume/admin services must not be exposed publicly. Never use example/default credentials or an unauthenticated quickstart.
3. Add an internal isolated scanner with bounded execution, updated definitions and a recorded digest/engine result. Queue and connection failures, stale definitions, timeout, parse failure and infected verdicts fail closed. Do not send patient files to an external scanner by default. Decide supported PDF/image treatment, metadata removal and previews before UI exposure.
4. Set one measured HTTP/FPM/application/scanner size contract, account/file-count quotas, upload throttling and bounded concurrent reads/scans. Test storage outage, partial writes, audit failure, tampering, forbidden direct access and ownership across roles using synthetic content.
5. Measure upload/scan/download and peak temporary/storage use on the chosen host. A single local instance is suitable for evaluation; production availability needs a separately verified backup/restore and failure plan.

Public marketing assets remain separate. Public URLs inherently allow recipients to copy delivered bytes; hiding a download button is not access control. Strip metadata and validate/sanitize before public publication. Public upload wiring, asset revocation and SEO/subscription presentation remain outside this medical slice.

## HIPAA Operational Gates

Self-hosting does not automatically remove business-associate obligations. Where HIPAA applies, outside organizations that maintain ePHI may require a BAA, including storage/hosting arrangements; encrypted data alone does not remove that requirement. Identify all hosting, backup, support and scanning relationships before real patient use. [HHS cloud guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html)

Technical hardening is only part of readiness. Risk analysis, administrative/physical safeguards, access and audit controls, incident response and recovery require deployment and organizational evidence. This code change does not establish compliance. [HHS Security Rule overview](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html)

| Gate | Evidence still needed |
| --- | --- |
| Applicability and outside relationships | Responsible organization, applicable role, provider inventory and required executed agreements |
| Host and key security | Access controls, patching, encryption, key separation/rotation, protected temporary space and transport |
| Scan/content safety | Actual scanner integration; infected, malformed, encrypted, timeout, stale-definition and tamper tests |
| Capacity and availability | Measured concurrency/limits, quotas, monitoring, encrypted backups and successful restore rehearsal |
| Accountability and retention | Restricted audit access, no PHI in operational logs, retention/deletion policy, incident response and staff procedures |
| Product acceptance | Bilingual Velzon File Manager integration with patient/assigned-doctor isolation, publication rules and time-correct walkthrough |

The user resumes implementation after accepting SeaweedFS and completes installation/startup. The [first storage integration slice](seaweedfs-evaluation-2026-10-05.md) passes 60/435 source tests and deployed synthetic private CRUD, access restrictions, credential scope, streaming/integrity and unavailable-endpoint checks. The subsequent [scanner source slice](medical-scanner-2026-10-05.md) implements an internal ClamAV adapter/job and transactional dedicated queue; actual pinned engine/worker acceptance is pending. This report's initial "no production scanner caller" describes its original checkpoint. Private storage remains local and live scanning is disabled; content/limits, operational gates and the full golden flow remain open. Do not substitute manual clean flags for a scanner.
