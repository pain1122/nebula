import type { AuthIdentity } from "../../../core";

export const panelRoles = ["root-admin", "admin", "doctor", "patient"] as const;

export const hasPanelRole = (identity: AuthIdentity) =>
  panelRoles.some((role) => identity.roles.includes(role));

export const panelLandingFor = (identity: AuthIdentity | null): string => {
  if (!identity) return "/login";
  if (identity.roles.includes("root-admin") || identity.roles.includes("admin")) return "/";
  if (identity.roles.includes("doctor") || identity.roles.includes("patient")) return "/";
  return "/login";
};
