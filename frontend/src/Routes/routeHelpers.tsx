import React from "react";
import type { AppRoute, LazyPageLoader } from "./routeTypes";
import type { RoleName } from "../types/auth";

export const lazyPage = (load: LazyPageLoader): React.ReactNode => {
  const Page = React.lazy(load);

  return <Page />;
};

export const pageRoute = (
  path: string,
  load: LazyPageLoader,
  allowedRoles?: readonly RoleName[],
): AppRoute => ({
  path,
  component: lazyPage(load),
  allowedRoles,
});
