import type { AuthIdentity } from "../../../core";

export interface AdminCapabilities {
  readonly accessAdminPanel: boolean;
  readonly accessDeveloperTools: boolean;
  readonly accessSystemNavigation: boolean;
  readonly changeAccountState: boolean;
  readonly manageAdminIdentities: boolean;
  readonly manageMarketplaceUsers: boolean;
  readonly managePlatformConfiguration: boolean;
  readonly manageQuestionnaires: boolean;
  readonly manageRatingOptions: boolean;
  readonly overrideReservationStatus: boolean;
  readonly requestPaymentAdjustment: boolean;
  readonly rescheduleReservations: boolean;
  readonly verifyDoctors: boolean;
}

const hasRole = (identity: AuthIdentity | null, role: string) =>
  identity?.roles.includes(role) ?? false;

export const adminCapabilitiesFor = (identity: AuthIdentity | null): AdminCapabilities => {
  const rootAdmin = hasRole(identity, "root-admin");
  const productAdmin = rootAdmin || hasRole(identity, "admin");

  return Object.freeze({
    accessAdminPanel: productAdmin,
    accessDeveloperTools: rootAdmin,
    accessSystemNavigation: rootAdmin,
    changeAccountState: rootAdmin,
    manageAdminIdentities: rootAdmin,
    manageMarketplaceUsers: productAdmin,
    managePlatformConfiguration: rootAdmin,
    manageQuestionnaires: productAdmin,
    manageRatingOptions: productAdmin,
    overrideReservationStatus: rootAdmin,
    requestPaymentAdjustment: rootAdmin,
    rescheduleReservations: productAdmin,
    verifyDoctors: productAdmin,
  });
};
