# Refund policy follow-up — open product decision

The user asked whether patient-initiated refunds incur a deduction and whether refunds are administrative, then instructed recording this and continuing general settings. No new refund policy was approved.

Current implementation:

- Patients may cancel eligible future reservations through the cancellation API. Cancellation changes reservation state and records its audit; it does not create or execute a refund.
- Only root admins may create pending refund/void requests. Ordinary admins cannot. Partial amounts are explicit root choices, not an automatically calculated fee.
- There is no automatic cancellation fee, percentage deduction or patient refund-request workflow. Payment-provider refund/void execution and its final outcome remain unimplemented.

Before adding patient refunds, decide eligibility/time windows, full versus partial amounts, any fixed/percentage deduction and exceptions, who reviews requests, and how the patient sees the amount/reason/status. Provider execution, idempotent outcome reconciliation and audit need their own bounded implementation. Do not infer a fee or enable automatic refunds from the existing root request control.

Source: `ReservationPolicy::cancel`, `ReservationLifecycleService::cancel`, `BookingApiController::cancelReservation`, `PaymentPolicy::requestAdjustment` and `PaymentAdjustmentService`. This note records an open decision only; no behavior or live data changes.
