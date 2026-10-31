# General marketplace settings panel proposal

Status: explicitly approved October16: `/panel/settings/general`, root-only navigation and the stated retained cards/scope/save-reset controls. Backend save/reset and runtime preparation are accepted separately. Do not request this design approval again; successful live saves remain separate.

Use `/panel/settings/general`, one root-only **General settings** entry under Product Admin, next to the existing Upload limits entry. Ordinary admins, doctors and patients receive the existing role refusal/fallback; root authority is checked again by the API. Do not expose tenant settings, user preferences, credentials, operator infrastructure or refund-policy controls here.

Reuse existing Velzon/React18/Bootstrap cards, labelled fields, scope selector, refresh action and ActionDialog/recent-password flow. Keep English/Farsi, flag-owned direction and mobile card stacking; add no styles, dependencies or alternate editor. Keep adapters and domain guards separate for the client's expected UI refactor.

One card per setting:

| Setting | Input | Explanation shown before confirmation |
| --- | --- | --- |
| Pending booking hold | Whole minutes, 5–180 | Applies to new bookings. Existing expiry dates and booking replays stay unchanged. Without a stored override, the operator hold configuration remains the fallback. |
| Fallback timezone | Valid IANA timezone | Used only when a hospital timezone is missing; existing hospital timezones and saved appointment instants remain authoritative. |
| Default currency | Three uppercase letters | Used only when creating schedule occurrences with missing source currency. Saved checkup/rule/slot currencies and all reservation/payment money remain authoritative. This does not convert money or change an existing catalog default. |

The root selects Platform or Site; scope keys come from the server snapshot. Cards distinguish the selected override, inherited platform/registry default and actual runtime applicability. Fetch both scopes so a site override is visible when reviewing a platform change. Registry default60 and operator fallback hold can differ; do not present the registry default as the active hold without resolving the site/platform override and fallback.

Save and **Reset override** each show the reviewed scope/key, current value and proposed value/inheritance, require reason, explicit confirmation and recent password, and repeat fresh signed reads before delivery. Reset removes only the selected override; disable it when no override exists. Same-value saves are disabled. Preserve drafts during password confirmation; scope/actor/session changes abort the active action. Cancel/unmount abort reads. Never automatically retry a mutation after an uncertain response; require explicit refresh/review. Server conflict or authority change closes stale confirmation and requires a new snapshot.

Use the existing GET `/api/admin/settings/general?scope_type=platform|site` and guarded PUT `/api/admin/settings/{settingKey}`. A reset sends `operation:reset` and no value. Writes require the actor/scope/state-bound revision, confirmed, reason and server-issued scope key. Successful controls remain subject to separate guarded synthetic live-save/reset acceptance; do not replay existing settings or completed demo writers while verifying the served page.

After approval, implement in small source-tested slices, then use the already delegated static-admin-only rebuild and accept actual EN/FA/root/non-root/mobile/read-only behavior. Keep the accepted payment artifact/tag and rollback. No backend/scanner/worker Compose, migration, environment edit, provider execution or live business write is part of this proposal.

`AI_BOOT.md` explicitly reserves approval for “canonical `/panel/*` URLs” and “navigation, page composition, component UX, Persian/RTL behavior, and visual direction.” This proposal requests that approval only for the route, entry and controls described above.
