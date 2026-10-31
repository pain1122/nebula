# Windows 10 transfer readiness — October 31, 2026

November1 operator sequence is now documented in [BUILD_AND_DEPLOY.md](BUILD_AND_DEPLOY.md), covering accepted-image export/load, source-build candidates, dependency/assets setup, independent local configuration, scanner/parser ordering, populated seeds, checks and recovery. Use its fresh-install path for the selected new PC; the old-state inventory below remains an optional restore alternative. The manual's commands/configurations were reviewed without executing a new-machine installation.

Target planned for November 1, 2026, Asia/Tehran: ASUS VivoBook, Windows10, reported16GB DDR4 and probably an11th-generation Intel i7. The operator reports WSL2 and Docker Desktop already work. Exact Windows edition/build, WSL/Docker versions, disk space and a target restore are not verified yet.

The reported hardware should accommodate the current development stack. All eight active runtime images are Linux/AMD64; no ASUS-specific dependency or demonstrated Windows11-only application requirement was found. This is a source/current-laptop audit, not certification that the other machine has passed installation.

The user subsequently chose a **fresh database with populated synthetic examples** for the new PC. The expanded package passes four tests/93 assertions and complete real-scanner/parser SQLite/MySQL installation/exact repeat; operator cleanup is verified. Actual target setup/acceptance remain open: see [the seed package and gates](fresh-demo-seed-readiness-2026-10-31.md). Old database/key/uploads/SeaweedFS-state transfer is optional. Image, dependency, host-toolchain and scanner-network findings still apply. Original findings about transferring old keys/objects below apply only to the existing-state alternative; an independent fresh target uses its own new credentials and empty stores.

## Findings and required handling

| Priority | Finding | Handling |
| --- | --- | --- |
| Blocking for clone-only demo | `docker-compose.content.yml`, the scan PHP runtime and producer overlay use local SHA-only image references with `pull_policy: never`. The parser Dockerfile also requires the locally accepted `checkupino-content-validation:2026-10-08` base and copies ignored `vendor/`. | Transfer the accepted images or complete a separately verified rebuild. A registry mirror cannot supply unpublished local images. Verify image identities after loading on the target; do not replace pins or bypass guards to make startup succeed. |
| Blocking for existing demo state | Git excludes the database, private files, `.env`, `.env.production`, storage credentials and local acceptance evidence. Encrypted rows/jobs depend on the original application key. | Use a coherent private database/files/config transfer. Preserve the original `APP_KEY` and other required secrets. Do not follow generic `key:generate`, seed or reset instructions against the transferred database. |
| Blocking for media service recreation | `.local/media-evaluation/s3.json` is a required bind mount but intentionally not in Git. Three SeaweedFS data volumes hold separate state. | Transfer the existing credential file privately and snapshot/restore the three project volumes consistently. Do not recreate credentials or transfer only one volume. |
| Blocking for dependency-free startup | Development PHP source is bind-mounted from the checkout. `vendor/` is ignored and the accepted app image does not install it into the new host checkout. | Transfer the matching vendor tree privately or run the locked Composer install in the approved PHP runtime. Dependencies are not recovered by `git clone` or by saving the app image alone. |
| Blocking for fresh scanner startup without network | `docker/medical-scan/start.sh` always runs official FreshClam before starting ClamAV, even with saved definitions. | The image bundle reduces registry downloads but does not make this scanner startup offline. Verify the target Docker VPN/TUN route and latest cooldown, then allow one supported official update/start. Keep freshness and fail-closed behavior intact. |
| Setup mismatch | The current setup combines development backend, static admin from the production Compose file, isolated parser/scanner and separate SeaweedFS services. | Do not run the full production Compose stack alongside the development backend. That creates another backend/database and competes for ports. Start only the intended services with their project files and socket overlays. |
| Toolchain mismatch | Root README's Node20.19+ minimum is insufficient for frontend tooling: `frontend/package.json` requires Node24.19.0 and npm11.17.0. | Use those versions for frontend development/tests, or use the transferred static admin image for the running panel. Native PHP/Composer on Windows is unnecessary for the container workflow. |
| Test-only portability | Browser verification scripts hardcode `C:/Program Files/Google/Chrome/Application/chrome.exe` and many historical guards require local receipts/current image pins. | Check Chrome's actual installation path. Transfer private evidence if continuing its recorded checkpoint. A missing receipt never permits relaxing a guard or replaying an accepted writer. |
| Environment mismatch | Example environments disable health/article/media capabilities and production examples use HTTPS sample domains. | Transfer the actual matching local environments securely and retain localhost3000/8080, session/CORS settings and feature flags. Do not enable new features or recreate secrets from examples. |
| Windows maintenance | Docker's current requirements list Windows10 22H2/build19045 and WSL2.1.5+; Docker also ties support to Microsoft's servicing lifecycle. Windows10 Home/Pro ordinary support ended October14,2025. | Inspect the exact installed edition/build and support status. An existing working Docker installation is not proof that every current update is supported. No OS upgrade or Docker replacement was performed by this audit. |

Current runtime is Docker Engine29.8.2 with the containerd image store (`io.containerd.snapshotter.v1`). The new PC may use a different engine/image-store format. Docker save/load restores images/tags, but the exact local SHA and digest-qualified references must be checked on that target before using the pinned overlays. Compatibility of those identities has not been demonstrated by a second-machine load.

## Positive checks

- All45 tracked PowerShell scripts parse in the current PowerShell5.1 engine. No inspected PowerShell7-only command patterns were found; this is syntax inspection rather than running every script on Windows10.
- No case-colliding paths among3115 tracked files. `.gitattributes` enforces LF for Linux shell scripts, including scanner startup and qpdf build scripts.
- Current Compose source paths are relative to the project. Existing container inspections show absolute paths on this laptop because Docker resolved those mounts when creating the containers; recreate containers from the new checkout rather than copying their old bind-mount configuration.
- Runtime validation on October31 already passed HTTP, MySQL/Redis, storage response checks and real synthetic scanner/parser checks. No transfer or target-machine execution was part of that acceptance.

## Read-only preflight on the VivoBook

Run this in Windows PowerShell. It installs nothing, changes no settings and starts no services. Node/npm and the exact Chrome path are needed only for the host development/verification workflows that use them.

```powershell
Get-CimInstance Win32_OperatingSystem |
    Select-Object Caption, Version, BuildNumber, OSArchitecture
Get-CimInstance Win32_ComputerSystem |
    Select-Object Model, @{Name='RAM_GB'; Expression={[math]::Round($_.TotalPhysicalMemory / 1GB, 1)}}
Get-CimInstance Win32_Processor |
    Select-Object Name, VirtualizationFirmwareEnabled
$PSVersionTable.PSVersion
wsl --version
wsl --list --verbose
docker version
docker compose version
docker info --format '{{.OSType}} {{.Architecture}}'
docker info --format '{{json .DriverStatus}}'
Get-PSDrive C | Select-Object Name, Free, Used
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in 3000,8080,3307,6380 } |
    Select-Object LocalAddress, LocalPort, OwningProcess
Test-Path 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (Get-Command node -ErrorAction SilentlyContinue) { node --version }
if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { npm.cmd --version }
```

Expected Docker mode: Linux on x86_64/AMD64. Use Compose v2. Keep the existing WSL configuration until its actual limits are inspected; on a16GB laptop,6–8GB of WSL memory is a planning range for this stack, not an instruction to overwrite `.wslconfig`. Keep adequate free SSD space: around30GB of headroom is a conservative planning estimate for images, archives, WSL storage and dependencies, not a measured transfer size or Docker's formal minimum.

Use a short project path such as `C:\work\checkupino`, away from OneDrive synchronization. Docker recommends a Linux filesystem checkout for faster bind-mounted development, but the current browser/PowerShell acceptance workflow is Windows-hosted; switching that workflow into WSL needs its own path review. A Windows path can continue the current setup with a performance tradeoff.

## Image inventory and optional existing-state transfer

Git provides application source at commit `d481580c659754f201b20b06eb6b86a49f4b08b6`. Preserve unrelated projects; do not copy or restore the entire Docker Desktop VM as a substitute for a Checkupino-only transfer.

| Purpose | Installed image/tag or identity |
| --- | --- |
| Static admin | `checkupino-admin:local` and `checkupino-admin:velzon-file-row-accepted-2026-10-25`;66828d4d |
| PHP backend | `checkupino-app:latest`;18eb9257 |
| Isolated parser | `checkupino-content-isolation:2026-10-08`;c4809fae |
| Scanner | `clamav/clamav@sha256:7659dcb0db47941d3cf8336af84bbb63c7e70b76fc00601774358412b42ed186` |
| SeaweedFS | `chrislusf/seaweedfs@sha256:aba492e2a4e4c90bff795745e8e660affa1f09e7650f5981bd7bccd1a06cd931` |
| Core dependencies | Current `mysql:8.0`, `redis:7-alpine` and `nginx:alpine` images; retain their accepted identities rather than pulling newer mutable tags. |
| Optional source-verification/base image | `checkupino-content-validation:2026-10-08` / a48b0c0b is additionally required by parser-build preflight and several isolated source checks. It is not one of the eight running runtime images. |

Use Docker image save/load for an image archive, not container export/import. Prepare an exact-image manifest and archive checksum, then verify the loaded images and required tags on the target. No image archive was exported by this audit. A runtime-only archive does not include Docker build caches, npm registries or intermediate frontend build stages; later offline rebuilds require additional preparation.

The following private data/config inventory applies only if preserving the existing database later becomes necessary. For the selected fresh setup, configure the new instance independently and create new owned media storage; do not copy old rows or files into it without their matching state.

- Original `.env` and local `.env.production`, including the original encryption/signing keys; `.local/media-evaluation/s3.json`; required existing local acceptance receipts.
- A consistent logical MySQL backup of `checkupino` with every table, including immutable history, audit rows, protected accounts and the two encrypted queued jobs. Coordinate the backup with file writes; do not tar a live MySQL data directory as an assumed consistent backup.
- `storage/app/private`, `storage/app/article-media` and any used `storage/app/public` content, with database references and permissions preserved. Source tree `vendor/` if avoiding another locked Composer download.
- SeaweedFS volumes `checkupino_media_media_master`, `checkupino_media_media_volume`, `checkupino_media_media_filer`, captured consistently with their configuration.
- Scanner definitions volume `checkupino_scan_scan_definitions`, with updater state retained. Official access and freshness still require verification at the new location.
- Current jobs are database-backed. Redis cache/session/lease state must be reviewed separately; do not assume its anonymous volume is the medical queue. Do not transfer active Unix socket files or source-machine container identities; initializers recreate sockets and ownership.

Keep this material private and checksum it outside the Git repository. The original laptop is the rollback source; no backup, restore, stop, reset, new migration, reseed, key generation or credential replacement was executed during this audit.

## Fresh-target order — pending seed-readiness acceptance

1. Run the host preflight, clone the intended revision, load/verify the project images and install or copy matching dependencies.
2. Verify that the target database and project volumes are new/empty; do not reuse or erase an existing target installation. Configure new local environment/key/storage credentials for that independent instance. Preserve all source-laptop keys and data.
3. Create the target schema and run the complete, verified local demo seed graph. This is not ready to recommend until the linked seeder gaps and isolated/disposable-MySQL gates pass. Do not enable ordinary workers or treat fixture status rows as real scan/payment proof.
4. Recreate parser/scanner socket ownership, verify supported definition access and actual synthetic processing, then start the app/Nginx with their overlays and only the static admin service from the production file. Enable only accepted local capabilities after their dependencies pass.
5. Accept all implemented active-role journeys on the new instance, including legitimate empty states. Existing-state fingerprints from the other laptop are historical and must not be rewritten to manufacture acceptance of a different fresh dataset.

## Existing-state restore alternative — not executed

1. Run the target preflight, clone into the chosen short path, and verify the intended commit. Inspect ports, Docker/WSL versions and available disk space before changes.
2. Load the project-only image archive and verify its identities/tags. Restore the matching private environment, vendor tree and file snapshot through a controlled transfer.
3. Create only the intended backend DB/Redis services and network. Restore the database into the verified new target without reseeding or replaying migrations against the copied state. Restore matching private/SeaweedFS data before serving users.
4. Create the parser's initializer/socket/runtime. Restore scanner definitions, verify Docker's actual VPN route and cooldown, then initialize/start the scanner once. Recreate both socket volumes on the target; never copy old sockets.
5. Create only the app and Nginx using the existing content-client and scan-producer overlays and explicit `checkupino` project name. Backend creation must wait for both external socket volumes. Use `checkupino_media`, `checkupino_content`, `checkupino_scan` and `checkupino_prod` consistently with their existing network/volume names.
6. Start only `admin` from the production Compose file with its existing accepted image. Keep checker, general workers, medical workers and schedulers stopped. Verify HTTP/auth, MySQL/Redis, parser/scanner synthetic checks, private-media access, protected/current fingerprints and both unchanged jobs before any writes or release rehearsal.

Exact export/restore commands and a restore rehearsal remain the next operational package. This audit does not authorize silently creating a new key, empty replacement data, publishing private transfer material, relaxing image/receipt guards or enabling job consumers.

## Official references checked October31

- [Docker Desktop Windows requirements](https://docs.docker.com/desktop/setup/install/windows-install/)
- [Docker WSL2 best practices](https://docs.docker.com/desktop/features/wsl/best-practices/)
- [Microsoft Windows10 Home/Pro lifecycle](https://learn.microsoft.com/en-us/lifecycle/products/windows-10-home-and-pro)
- [Docker image save](https://docs.docker.com/reference/cli/docker/image/save/) and [load](https://docs.docker.com/reference/cli/docker/image/load/)
