# Ordinary appointment completion control

Approved October11: operator says “proceed but always expect a refactor from the client for the UI design.” Keep presentation in the separate AppointmentCompletion component and transport adapter; eligibility, canonical payment, authorization, transaction/audit/outbox remain server-owned. Presentation may be revised without copying lifecycle rules into the client. [Implemented scope and remaining live gate](demo-appointment-completion-2026-10-11.md).

Final rehearsal inspection finds an existing assigned-doctor completion API and guarded lifecycle service, but no corresponding action on the retained doctor reservation table. Publishing a medical report completes its medical request; it does not complete the appointment.

Proposed approved scope: add one **Complete appointment** action in the existing Actions cell on `/panel/doctor/reservations`, beside Medical, and one retained Bootstrap confirmation modal. No new URL, sidebar, dependency, stylesheet, schema or patient/admin action.

Expose additive read-only completion availability from the server for the assigned doctor's own reservation, based on the existing confirmed/started/paid/canonical successful-attempt requirements. Before POST, freshly read the same reservation and require server availability, explicit confirmation and unchanged identity/status/payment facts. Send no owner/status/time/payment fields; the existing lifecycle service remains authoritative under lock. Show definitive rejections and block duplicate/ambiguous replay. Success refreshes doctor and patient reservation views.

Translate labels, confirmation, unavailable/pending/success and errors in English/Farsi using the existing flag-owned direction and formatting. Preserve the retained table columns, spacing, row links and modal composition.

Verify isolated source clock/ownership/payment/idempotence/audit rollback contracts and frontend refusal/duplicate/unmount/ambiguous/ENFA cases. Reuse the delegated static-admin build after source gates, then verify deployed controls and denial before the appointment starts. One ordinary live completion for the existing synthetic reservation8 is allowed only once server eligibility is established at or after October11 **08:00 Tehran**; preserve its original payment/medical/file/policy/report history and expected new lifecycle audit/outbox intents. Never backdate or drain unrelated notification jobs.

This control was outside the medical-page and questionnaire compositions. AI_BOOT.md's named composition approval is now satisfied for this proposal; do not ask again for this same control.

Rollback restores the prior retained static image and keeps all completed lifecycle/audit/outbox history. No inverse status edit, migration, reseed or deletion.
