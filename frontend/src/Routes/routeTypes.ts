import type { ComponentType, ReactNode } from "react";
import type { RoleName } from "../types/auth";

export type AppRoute = {
  path: string;
  component: ReactNode;
  exact?: boolean;
  allowedRoles?: RoleName[];
};

export type LazyPageLoader = () => Promise<{ default: ComponentType<any> }>;

export const adminRoles: RoleName[] = ["admin", "root-admin"];
export const rootAdminOnly: RoleName[] = ["root-admin"];
