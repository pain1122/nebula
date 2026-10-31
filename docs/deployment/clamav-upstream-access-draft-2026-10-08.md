# FreshClam definition access: upstream support draft

Prepared October 8, 2026. **Draft only; this session has sent no ticket, email or public comment.** The operator says [existing report #1851](https://github.com/Cisco-Talos/clamav/issues/1851) is probably from a previous chat. Prefer an update to that existing thread after confirming ownership, rather than opening a duplicate. This contains scanner/runtime facts only. It excludes credentials, application data, files and public IP addresses.

## Existing thread / suggested follow-up subject

Operator follow-through on October 9: the single bounded Docker-network metadata lookup succeeds. The operator has the current address locally; it is deliberately omitted from these project files. No definition request, scanner/worker startup or support reply has occurred in this session. Next send the current observation through an agreed support channel, with its date and the historical Docker CF-Ray/time distinguished.

### October 9 activity verification

The issue HTML did not expose comments. A readonly GitHub REST request to `/repos/Cisco-Talos/clamav/issues/1851/comments` verifies an upstream contributor reply from October 7 at 19:04:27 UTC (22:34:27 Tehran) asking for the public IP used to download signatures. [Contributor reply](https://github.com/Cisco-Talos/clamav/issues/1851#issuecomment-6044846090). This is a diagnostic request, not confirmation of the denial rule or restored access.

The operator has explicitly accepted scanner Compose validation on October 9. The next diagnostic action is to view current Docker-network egress locally with one bounded metadata-only request, then respond through an agreed channel; do not paste the address into chat or project evidence. Label a newly observed address as current Docker egress, since it does not establish the October 7 failure's address. Include the existing Docker CF-Ray/time separately. No IP has been collected by this session and no reply has been sent. Do not restart FreshClam merely because a contributor requested information.

Official FreshClam 1.5.4 receives repeated daily update HTTP 403 after cooldown

## Suggested follow-up body

Host environment, clarified and verified October 9: a local Windows 11 laptop running Docker Desktop (`desktop-linux`) on WSL 2, WSL package 2.7.11.0 and kernel `6.18.33.2-microsoft-standard-WSL2`. Active adapters are Wi-Fi and WSL virtual Ethernet. Windows user proxy/PAC and host HTTP/HTTPS/ALL_PROXY environment indicators are absent; these checks do not establish every upstream route or Docker Desktop proxy setting. The current IP observed by the operator is Docker-network egress from this laptop. No remote application server/provider account is assumed, and no settings/restart/network changes were made.

Additional Docker-specific evidence for the existing access problem: we are evaluating the official linux/amd64 ClamAV 1.5.4 image pinned to `sha256:7659dcb0db47941d3cf8336af84bbb63c7e70b76fc00601774358412b42ed186`. FreshClam uses `DatabaseMirror database.clamav.net`, ordinary scripted updates and database testing. This Docker evaluation has not substituted curl/wget signature downloads, third-party signature sources or a private mirror.

On October 7, 2026 at 17:07:31–17:07:34 UTC, one controlled startup after the previous cooldown attempted the incremental daily update and then FreshClam's full-daily fallback. Both failed with HTTP 403. The local daily version was 28136; the advertised version was 28146. The failed incremental file was `daily-28137.cdiff`. The CDN correlation ID printed by FreshClam was `a46e7f8d3e72dcc2-FRA`.

FreshClam recorded another cooldown through October 8 at 17:07:34 UTC (20:37:34 Asia/Tehran). We preserved its state and the existing definitions volume. Automatic scanner restarts are disabled; the current container has zero restarts and remains stopped with exit 17. We have not made another definition request after this failure.

One separate metadata-only HTTPS request from the same Docker network on October 8 reported egress country IR and Cloudflare colo FRA. This request did not access a ClamAV definition endpoint. The route is unchanged according to the operator, who cannot identify whether an upstream VPN/proxy is involved. Docker Desktop's internal proxy host names alone do not establish the external path. The metadata observation does not establish the precise rule behind the October 7 403.

The official support matrix checked October 8 still lists 1.5.4 as the latest supported 1.5 patch. Please help determine which CDN access rule produced this correlation ID, whether access from this network is supported, and what supported resolution is available. If source-IP/ASN details are needed, please identify an appropriate private channel; these details are deliberately omitted from this draft.

## Evidence and references

- Historical failure: `evidence/media-recovery-runtime-2026-10-07.json`; the scanner's retained logs contain the correlation and cooldown.
- Bounded metadata observation: `evidence/scanner-egress-diagnosis-2026-10-08.json`. Do not rerun the egress script just to reproduce this already-recorded result.
- [Official FreshClam troubleshooting](https://docs.clamav.net/faq/faq-freshclam.html): supported download clients and unresolved update failure escalation.
- [Official support matrix](https://docs.clamav.net/faq/faq-eol.html): supported 1.5 patch version, checked October 8.
- [Official issue tracker](https://github.com/Cisco-Talos/clamav/issues): destination identified by the FreshClam diagnostic and documentation.
- Related open reports inspected October 8: [#1844](https://github.com/Cisco-Talos/clamav/issues/1844) describes 1.5.4/IR metadata and repeated post-cooldown 403; [#1851](https://github.com/Cisco-Talos/clamav/issues/1851) describes Windows 1.5.4 and two networks and is probably this operator's earlier thread. Their retrieved bodies do not provide a maintainer-confirmed cause. Windows/cvdupdate/two-network observations from that report are not independently reverified facts about this Docker evaluation.

## Recovery decision

October 9 operator direction: use their existing VPN as the next network-recovery route; they are a solo developer on a local Windows 11/WSL 2 laptop in Iran, with no established personal upstream contact. Readonly Docker info confirms the configured Docker Hub registry mirrors are active. Registry mirrors affect image pulls, not FreshClam definition downloads; no image pull/build or registry change is needed for this recovery. The exact 403 cause, including any geographic restriction, is still unconfirmed.

First the operator connects the VPN with Docker Desktop outbound traffic covered. Then perform one bounded metadata-only request from the scanner network, withholding the public IP and preserving the earlier evidence. A changed metadata observation alone does not prove definition access. Once the route is verified, prepare one operator-run scanner/check startup with existing pinned images and definition/socket volumes, verify fresh loaded definitions and real engine cases, and stop on another failure while preserving its new cooldown. Cooldown expiry alone does not justify repeated retries. No VPN connection, external probe, signature request or startup occurred in this documentation slice. The upstream draft remains optional; no message was sent.

For later isolation, ClamAV supports a private definition mirror maintained by FreshClam or a caching proxy. That is separate from a Docker registry mirror and still requires regular upstream updates; keep signature integrity and the current freshness gate. No new mirror/dependency deployment is included now. References: [Docker registry mirrors](https://docs.docker.com/docker-hub/image-library/mirror/) and [ClamAV private database mirrors](https://docs.clamav.net/appendix/CvdPrivateMirror.html).
