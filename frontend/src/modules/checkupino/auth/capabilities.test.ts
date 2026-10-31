import { describe, expect, it } from "vitest";

import { adminCapabilitiesFor } from "./capabilities";
import type { RoleName } from "./types";

const identity = (...roles: RoleName[]) => ({ roles });

describe("admin presentation capabilities", () => {
  it("keeps every admin capability false for guests and non-admin roles", () => {
    for (const actor of [null, identity("doctor"), identity("patient")]) {
      expect(Object.values(adminCapabilitiesFor(actor))).not.toContain(true);
    }
  });

  it("gives normal admin product capabilities without root-only controls", () => {
    expect(adminCapabilitiesFor(identity("admin"))).toEqual({
      accessAdminPanel: true,
      accessDeveloperTools: false,
      accessSystemNavigation: false,
      changeAccountState: false,
      manageAdminIdentities: false,
      manageMarketplaceUsers: true,
      managePlatformConfiguration: false,
      manageQuestionnaires: true,
      manageRatingOptions: true,
      overrideReservationStatus: false,
      requestPaymentAdjustment: false,
      rescheduleReservations: true,
      verifyDoctors: true,
    });
  });

  it("exposes the separately governed root-only presentation capabilities", () => {
    expect(Object.values(adminCapabilitiesFor(identity("root-admin")))).not.toContain(false);
  });
});
