import { Navigate } from "react-router-dom";

import { productAdminRoutes, productPublicRoutes } from "../panel/routes";
import { DEV_TOOLBOX_BASE_PATH } from "./devtoolEntryContract";
import { pageRoute } from "./routeHelpers";
import type { AppRoute } from "./routeTypes";
import { rootAdminOnly } from "./routeTypes";
import { panelRoles } from "../modules/checkupino/auth/panel";

const publicRoutes: AppRoute[] = [...productPublicRoutes];

const authProtectedRoutes: AppRoute[] = [
  ...productAdminRoutes,
  pageRoute(
    `${DEV_TOOLBOX_BASE_PATH.slice(1)}/*`,
    () => import("../devtools/ToolboxRouter"),
    rootAdminOnly,
  ),
  { path: "*", component: <Navigate to="/" replace />, allowedRoles: panelRoles },
];

export { authProtectedRoutes, publicRoutes };
