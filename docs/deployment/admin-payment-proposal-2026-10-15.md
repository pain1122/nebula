# Payment administration — proposed panel routes and controls

**Approved October16:** the user selected “Approve the proposed payment routes and controls,” covering both URLs/navigation/retained read pages and the subsequent root-only request modal across the stated verified slices. Do not request this approval again. Provider execution and successful live saves remain excluded.

The user instructs continuing payment administration after the accepted schedule controls and asks what it provides. This proposal supplies the exact canonical URLs/composition reserved by the approved feature-coverage plan. The approval recorded above supersedes the original pending proposal; the authorized backend read foundation was accepted independently.

| Surface | Proposed URL | Retained composition |
| --- | --- | --- |
| Payments | `/panel/payments` | Admin/root Product Admin sidebar entry; existing server table, search, quick status/attention presets, composed filters, refresh/reset and stable paging/sorting. |
| Payment details | `/panel/payments/:paymentId` | Payment public ULID; reservation-style card/grid summary, linked reservation and safe patient/doctor support profiles; independently paged attempts, adjustment requests and provider-event metadata. Back preserves list filters. |

Use the existing React18/Bootstrap/Velzon shell, cards/DetailBox, server tables, form fields and ActionDialog. Keep English/Farsi and flag-owned direction. No new CSS, dependency, provider SDK, schema, separate design system or real-provider activation. Adapters and domain rules remain separate from presentation for the client's later UI refactor.

The list offers exact payment/reservation public-ID or literal safe display-name/booked-service/hospital search, payment and reservation states, doctor-profile/patient/workplace/service identities, currency, provider/attempt-state and adjustment-state filters, and bounded payment-creation dates in Tehran. Provider plus attempt status must match the same attempt. Quick presets translate to visible server filters; they do not filter only the current page. Amounts stay exact strings and retain their currency. No combined-currency revenue or booked-value-as-revenue claim.

Details keep payment status, reservation status, canonical attempt consistency, reconciliation counts and pending adjustment requests distinct. Attempts expose public identity, provider, exact money, state, timestamps, canonical/binding flags and failure presence. Events expose only safe internal public IDs, recognized event type, verification/processing facts and timestamps. Adjustment history exposes type, money/state, timestamps and whether a reason was recorded. Provider references, external event IDs, idempotency keys, callback/metadata bodies, failure messages, raw reasons and private identity/credential fields stay hidden. Other privileged users' reservation relationships retain existing privacy boundaries; historical archived doctor profiles remain readable where authorized.

The following root-only control uses the existing **request refund / request void** boundary, after server hardening: exact eligible canonical payment and remaining unadjusted money preview, current actor-bound revision, positive bounded amount, explicit reason/confirmation/recent password, fresh locked authority, consistent canonical attempt, payment-row serialization and fail-closed atomic audit. A void requests the whole remaining amount. No manual paid/refunded/completed switch, provider execution or automatic retry after an ambiguous result. Pending requests are always labelled as requests. All other admins receive read access without adjustment authority.

First wire read-only lists/details after approval. Then deliver the hardened request modal in a separate verified slice under the same stated composition approval. Existing writer contracts/legacy callers must be reviewed before tightening them; no caller or lifecycle bypass is inferred. Positive live actions remain a separately guarded synthetic acceptance; no replay of the completed demo or existing financial writers.

The proposal excludes payment methods, receipts/invoices, disputes/chargebacks, settlement/payout/accounting tools, real-provider execution and callback integration, manual balance correction, bulk mutations/exports and scheduler/outbox draining. Those require their own concrete scope if requested.

`AI_BOOT.md` reserves approval for canonical `/panel/*` URLs, navigation and page/control composition; the earlier broad administration authorization does not finalize these two URLs. No repeated approval is needed for the already authorized private backend reader and isolated/read-only verification.
