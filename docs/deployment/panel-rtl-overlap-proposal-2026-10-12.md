# Bounded Farsi panel overlap correction

## Demonstrated defect

On the accepted admin0e9fe3c8, the Farsi medical-request table overlaps the right sidebar. Real browser input cannot click the completed-request link: its measured box is x1001.39..1338.81, and hit testing returns the sidebar's `simplebar-content-wrapper`. No customizer panel/backdrop exists at that point. Failed read-only pointer evidence is preserved; medical/payment/questionnaire/audit/outbox/protected fingerprints remain unchanged.

The original English geometry is accepted. The retained customizer closes normally with its close button, Escape and backdrop; its opening transition must finish before the verifier tries to close it. The fixture home also has a distinct activity drawer that can be closed through its normal backdrop. Neither is proof of a persistent customizer-backdrop leak.

## Proposed source change

Add this narrowly scoped block after the existing imports in `frontend/src/assets/scss/themes.scss`, using existing Velzon variables. It covers only the deployed default vertical/detached/fluid/large-sidebar desktop shell; no template RTL bundle, redesigned markup, dependency or alternate layout behavior is introduced. Other customizer variants remain a separate geometry review.

```scss
@media (min-width: 1024.1px) {
  html[dir="rtl"][data-layout="vertical"][data-layout-style="detached"][data-layout-width="fluid"][data-sidebar-size="lg"] {
    #layout-wrapper {
      padding-left: 0;
      padding-right: $grid-gutter-width;
    }

    .main-content {
      margin-left: 0;
      margin-right: var(--#{$prefix}vertical-menu-width);
    }

    .navbar-header {
      padding-left: 0;
      padding-right: $grid-gutter-width;
    }
  }
}
```

These mirror the retained default offsets without changing English, colors, controls, card/table composition, typography, sidebar width, language ownership or medical/business rules. Responsive widths below this boundary retain their existing source; they still require acceptance and will not be claimed from desktop checks.

## Acceptance and rollback

The user explicitly approves this proposal on October12. The exact block is applied, compiled, source-checked and deployed through the delegated static-admin-only build/recreation. Disjoint English/Farsi desktop geometry, real-pointer controls,390px reservation cards and role refusal pass. [Acceptance, evidence and limits](panel-rtl-acceptance-2026-10-12.md). Additional geometry defects stay open rather than being hidden by a forced click or test-only style injection. No live business writes, downloads, scanner restart or queue processing.

Rollback removes this one block and rebuilds only the static admin, or restores the retained `checkupino-admin:medical-questionnaire-controls-accepted-2026-10-11` image; all data and backend contracts remain intact. Preserve unrelated dirty edits and the original failed/accepted evidence.

`AI_BOOT.md` explicitly requires demonstrated-defect and human approval for any visual correction, including RTL geometry CSS. `themes.scss` also records that broad template RTL imports stay excluded pending that review. Existing admin feature approval covers the pages; this proposal addresses the newly demonstrated shell geometry defect.
