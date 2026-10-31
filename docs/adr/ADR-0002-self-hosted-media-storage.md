# ADR-0002: Self-Hosted Media Storage With AWS S3 Compatibility

Status: Accepted by the user

Decision date: 2026-10-05 (Asia/Tehran)

## Context

Checkupino and NebulaNV are fresh projects intended for long-term use. The user prioritizes maintenance over preserving the existing NebulaNV local MinIO setup. Supabase has been discarded, AWS hosting is currently unaffordable, and the original Velzon File Manager must be retained. The user intends to reuse this admin panel in NebulaNV.

SeaweedFS has an active release stream and an Apache-2.0 licensed S3-compatible interface. MinIO's community repository is archived and explicitly marked unmaintained. These were verified during the October 5 selection review; active development is evidence for the current choice, not a guarantee of future maintenance. [SeaweedFS repository](https://github.com/seaweedfs/seaweedfs), [releases](https://github.com/seaweedfs/seaweedfs/releases), [MinIO community status](https://github.com/minio/minio)

## Decision

- Select **SeaweedFS** as the self-hosted object-storage direction for Checkupino and NebulaNV. MinIO and Supabase are not the selected defaults for new implementation.
- Retain AWS S3 compatibility through standard client/adaptor operations and configurable endpoint, region, bucket and credentials. Verify the actual used operations, policies and encryption behavior against each deployment; do not promise a drop-in switch for every S3 feature.
- Keep storage behind application APIs. The reusable Velzon panel uses app-authorized metadata/list/upload/read actions and receives no storage administration credentials. Each project's backend retains its own authentication, role, ownership, quarantine, retention and audit policies.
- Keep public assets separate from private medical objects. Neither storage choice nor panel reuse changes medical authorization or permits public patient documents.
- Antivirus is a separate internal component. Following the user's instruction to follow the plan, ClamAV 1.5.4 is selected for a pinned isolated synthetic evaluation; [scanner source/design](../deployment/medical-scanner-2026-10-05.md) is implemented, while actual engine/worker acceptance and production safeguards remain open.

## Delivery And Maintenance

The provider choice is settled; do not repeatedly ask the user to select it. Next work is a concrete SeaweedFS/scanner integration design with pinned versions, narrow S3 permissions, private networking, protected temporary/storage space, capacity limits and verification. Plan updates and backup/restore rehearsals as part of operating the storage service.

The user subsequently resumes development toward this decision and completes the dependency install and isolated Compose startup. The [storage integration report](../deployment/seaweedfs-evaluation-2026-10-05.md) records passing 60/435 source tests and deployed synthetic CRUD, private access restrictions, scoped credentials, streaming/integrity and unavailable-endpoint checks. Docker builds/Compose remain user-run. Current private storage stays local; no NebulaNV migration, live activation or production/HIPAA readiness is established. Synthetic files remain the development input until the documented medical operational gates are satisfied.

This ADR records the user's direction for both projects in the Checkupino workspace. NebulaNV's repository and runtime have not been modified. Panel reuse still requires its own integration and ownership checks; it is not accepted portability evidence.

## Verification Before Storage Acceptance

1. Pinned artifact, update procedure and a recoverable rollback/restore plan.
2. Private object access and direct-access denial; separate scoped credentials and protected internal services.
3. Upload/read/delete integrity, partial-write/outage behavior and compatibility tests for the S3 operations used.
4. Real scanner clean/infected/error/timeout/stale-definition handling with exact byte identity and isolated worker execution.
5. Measured resource use and limits, encrypted storage/temp/backups, successful restore and applicable organizational/provider safeguards.

Implementation status and existing evidence: [first medical hardening slice](../deployment/demo-media-hardening-2026-10-05.md).
