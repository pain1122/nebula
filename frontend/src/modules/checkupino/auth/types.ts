import type { AuthIdentity } from "../../../core";

export type RoleName = "admin" | "doctor" | "patient" | "root-admin";

export interface AuthUser extends AuthIdentity {
  readonly doctor_profile: Readonly<Record<string, unknown>> | null;
  readonly email: string;
  readonly id: number;
  readonly name: string;
  readonly public_id: string;
  readonly roles: readonly RoleName[];
}

export interface LoginCredentials {
  readonly email: string;
  readonly password: string;
  readonly remember?: boolean;
}
