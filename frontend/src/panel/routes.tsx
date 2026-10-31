import { lazyPage } from "../Routes/routeHelpers";
import type { AppRoute } from "../Routes/routeTypes";
import type { RoleName } from "../types/auth";
import { adminProductRegistry } from "./registry";

const isRoleName = (role: string): role is RoleName =>
  role === "admin" || role === "doctor" || role === "patient" || role === "root-admin";

const toAllowedRoles = (roles: readonly string[] | undefined): readonly RoleName[] | undefined =>
  roles?.map((role) => {
    if (!isRoleName(role)) {
      throw new TypeError(`Product route declared an unknown role: ${role}`);
    }
    return role;
  });

const toAppRoute = (route: (typeof adminProductRegistry.routes)[number]): AppRoute => ({
  allowedRoles: toAllowedRoles(route.access.roles),
  component: lazyPage(route.load),
  path: route.path,
});

export const productPublicRoutes: AppRoute[] = adminProductRegistry.routes
  .filter((route) => route.access.audience === "guest")
  .map(toAppRoute);

export const productAdminRoutes: AppRoute[] = adminProductRegistry.routes
  .filter((route) => route.access.audience === "authenticated")
  .map(toAppRoute);
