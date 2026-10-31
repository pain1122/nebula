# Demo Release Plan

Recalibrated by the user on 2026-10-02. This brings the demo-relevant parts of Phase 2 items 1, 2, 4, 5 and 8 back into the delivery queue. It changes priorities and acceptance, not the completed backend contracts or the full product backlog.

## Release Focus

Deliver a stable, clean and responsive presentation using the existing React 18/Bootstrap panel and Docker topology. Add a feature only when the selected walkthrough needs it or it fixes an observed security, data-integrity, validation or usability blocker. Reuse delivered primitives and APIs.

October 4 presentation decision: authenticated patients, doctors and admins use role-specific versions of the existing Velzon panel with specific access. Relevant Blade/resources workflows migrate into the established React/Bootstrap framework. Public SEO/subscription pages and a separate client UI stack are excluded from this demo.

The presently verified baseline is login/logout, role-aware navigation, the user directory and create/edit with confirmation/audit. On October 4 the user approved the minimum preconfigured booking/payment/medical/questionnaire golden flow as the next delivery priority, ahead of broader admin and full Phase 3 expansion. The [approved golden-flow plan](demo-golden-flow-2026-10-04.md) defines its sequence, bounded slices and remaining integration boundaries. Approval is not implementation or acceptance; the full Phase 3 requirements stay visible.

## Phase 2 Work Required For The Demo

| Item | Demo requirement | Existing evidence | Remaining release check |
| --- | --- | --- | --- |
| 1: quality/build | Passing local typecheck, meaningful tests, governed lint/format/ratchets and production build | October 2 latest: all quality checks, 47 files/237 tests; 5.40-second build after directory-only debounce tuning | Demo-local item complete; recheck affected gates after later source changes; CI remains separate |
| 2: routing/delivery | One /panel namespace, correct origin/redirects/refresh/assets/404s, root-only toolbox | October 1–2 deployed browser/static acceptance passes | Recheck affected routes and final presentation paths after changes |
| 4: API/auth | One credentialed transport, CSRF/session lifecycle, structured errors, confirmation and session-owned data | Delivered user create/edit and root/admin policy/audit flow passes | Exercise failure/cancellation/session changes on selected new flows; add no duplicate client or store |
| 5: registry/navigation | Manifest-driven, role-aware links/titles/breadcrumbs; no dead optional entries | F14/F28 and real users route/menu accepted | Verify each presentation link and language/role combination on the release candidate |
| 8: startup/performance | Keep toolbox code/assets and external template calls out of product startup; real API data on product flows | Final artifact verified; JS/CSS transfer 78.4% smaller; search 461.3/1,718 ms; user accepts warm-me local exception and warm-up requirement | Demo scope complete; retain 1,551.3 versus 1,500 ms target miss/cold-login limitation; recheck affected gates for future candidates |

CI/provider work, minimal-manifest/external-consumer portability, package extraction, F27I quarantine/deletion and optional system dashboards remain deferred. No dependency reinstall/update or asset deletion is justified merely by this plan.

## Execution Order

1. Establish one dated release baseline for the current presentation paths. Use existing source/runtime evidence where still applicable; measure missing performance data. Record gaps against items 1/2/4/5/8 and rank observed defects by impact on the walkthrough.
2. Fix one measured blocker per slice: runtime writeability/session errors, broken delivery/navigation, product fake/external calls, repeated requests, unnecessary eager assets or an interaction bottleneck. Verify the affected contract; preserve topology/design and document any remaining limitations.
3. Deliver the minimum business golden flow approved October 4, starting with existing patient-booking readiness, then only its required missing steps. Reuse shared services and preconfigured data; broader admin/full Phase 3 expansion follows. Account-state controls remain queued unless the flow requires them.
4. Review English/Farsi copy and keyboard/RTL behavior on the actual presentation surfaces. Translation stays mandatory throughout. Record demonstrated visual defects; use the existing approval boundary before changing frozen Velzon geometry or choosing an RTL stylesheet strategy.
5. Build the release candidate, perform the user-run scoped admin rebuild, and verify the served artifact and complete selected walkthrough. Record repeatability, remaining limitations and pass/fail evidence separately from container health.

## Performance Measurement And Acceptance

October 2 baseline, fixed budgets and final deployed evidence are recorded in [the readiness checkpoint](demo-readiness-2026-10-02.md). Demo items 1/2/4/5/8 are complete; the user explicitly accepts the local warm-me target exception and login/users warm-up requirement. Broader business/visual/platform release checks remain separate.

- Measure the deployed artifact against the actual localhost backend; record browser/device, cache conditions, idle period, payload/data size and warm-up procedure. Vite/HMR timing is not release evidence.
- Record at least three cold starts and ten warm samples for the selected routes/API operations. Report median and maximum with sample counts, rather than a misleading percentile from a tiny sample.
- Measure login/me, first directory load, search/filter/page changes and first editor open; extend only to agreed walkthrough steps. Separate backend time from asset download, JavaScript/render time and any long main-thread tasks.
- Record initial compressed JS/CSS, lazy toolbox reachability and repeated/unnecessary requests. Prior CSS/font/bundle numbers are historical baselines; do not assume the current graph is identical.
- Set concrete release budgets from the measured baseline and presentation needs before optimization. Record the rationale and check the final candidate against those budgets. Performance acceptance remains open until measurements, budgets and final results exist.
- Fix the dominant measured cause first. Do not weaken auth/policy/cache ownership, preload every screen, change Docker topology, add dependencies or undertake a whole-template rewrite to meet a speculative target. Broad performance work remains deferred.

## Demo Release Gate

- Existing local quality/build gates pass for the exact candidate, with no new unaccepted type/lint/dependency debt.
- Actual API origin, runtime writeability, session/CSRF/login/me/logout, role visibility, deep links and required assets pass. No unexpected failing requests or uncaught errors occur during the walkthrough; intentional validation/authorization failures remain explicit and recoverable.
- Product flows use real APIs with no fake fallback or external template backend. The fixture-based home and root-only toolbox are reference surfaces and never counted as Checkupino reporting.
- The selected walkthrough completes repeatedly, preserves optional data and confirms writes before success feedback; role changes/logout clear session-owned data. Sensitive operations retain backend policy, reason, confirmation and safe audit evidence.
- Current startup/interaction measurements meet recorded release budgets, and product startup does not eagerly load toolbox pages/reducers/styles/media.
- Presentation controls, feedback and labels are usable in both English and Farsi; final approved-surface keyboard/RTL review passes.
- The served artifact matches the tested candidate; a short walkthrough and exact environment/limitations are recorded. CI, cross-project reuse and the unimplemented full roadmap are not claimed complete.

## Runtime And Scope Guardrails

Preserve development project checkupino, standalone admin project checkupino_prod and the separate hazelnut stack/port 18080. Use localhost consistently. Docker builds/Compose and genuinely long commands remain user-run. Run backend checks as www-data, with explicit testing/SQLite :memory: for database tests. No live migration/reset/reseed, volume deletion, cache clearing or credential replacement is part of this plan.

Existing acceptance: demo-runtime-acceptance-2026-10-01.md and demo-user-mutations-acceptance-2026-10-01.md. Historical feature-by-feature Phase 2 evidence remains in docs/ai-context/archive/CURRENT_TASK_phase_2_2026-09-11.md; its original full closeout requirements stay open unless explicitly fulfilled.
