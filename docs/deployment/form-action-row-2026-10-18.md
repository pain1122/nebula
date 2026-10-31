# Form action alignment — October 18, 2026

Before: hospital edits, profile names, doctor practice/location forms, shared administration dialogs and reservation controls placed their primary action inside a block fieldset and Cancel/Close after it. The actions stacked vertically.

After: these six components use the existing Bootstrap flex/wrap/gap utilities to group both actions in one row, following the page direction. Warning messages stay above the row. Separate directory navigation remains separate.

The row sits outside disabled fieldsets so cancellation remains available when saving is blocked by stale or uncertain delivery. Save explicitly retains every inherited busy/blocked/uncertain guard. Reservation “Stop waiting and close” remains available during delivery. The doctor location submit button uses a React-generated form ID to target the correct save form, rather than its separate search form. No CSS, dependency, URL, schema or backend change.

Validation: type checking, affected-file lint/format and unchanged quality ratchets pass. Existing focused behavior suites pass (115 source tests and 44 additional guard tests; overlapping suites are not a full-suite total). Static verification checks 70 served/container-identical assets. Native read-only acceptance exercises 36 action rows at 1440/390px in English/Farsi, checks equal top positions, viewport containment, enabled Cancel, disabled unconfirmed Save and form association, then cancels each draft. Login/logout and GET are the only allowed requests; database/protected/catalog/finance fingerprints and the two pending jobs remain unchanged. No successful live save is inferred.

Evidence: `evidence/form-action-row-{source,guards,static,browser,acceptance}-2026-10-18.json`; screenshots are bound by the final acceptance receipt. Historical clinical-onboarding evidence remains unchanged.

Static image: `sha256:2f7bc492869f107f55fac878b320ca01b5b10838a3f9e6b295900dee8a31c182`, retained as `checkupino-admin:form-actions-accepted-2026-10-18` after acceptance. Previous accepted image/tag `checkupino-admin:clinical-onboarding-accepted-2026-10-18` (`c1173c97`) is the static-only rollback. Backend image, services, read-only sockets and environment stay unchanged; scanner/parser/worker remain stopped.

The source/static/browser evidence writers refuse to overwrite accepted receipts. Inspect them rather than replaying completed acceptance. Any later change needs fresh evidence names. Positive live saves and scanner/media recovery remain separate existing gates.
