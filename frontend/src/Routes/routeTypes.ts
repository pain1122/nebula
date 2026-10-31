import type { ReactNode } from "react";
import type { RouteLoader } from "../core";
import type { RoleName } from "../types/auth";

export type AppRoute = {
  path: string;
  component: ReactNode;
  exact?: boolean;
  allowedRoles?: readonly RoleName[];
};

export type LazyPageLoader = RouteLoader;

export const adminRoles: readonly RoleName[] = ["admin", "root-admin"];
export const rootAdminOnly: readonly RoleName[] = ["root-admin"];
