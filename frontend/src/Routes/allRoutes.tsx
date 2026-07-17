import { Navigate } from "react-router-dom";

import { rootAdminToolboxRoutes } from "../devtools/toolboxRoutes";
import { productAdminRoutes } from "../panel/routes";
import { pageRoute } from "./routeHelpers";
import type { AppRoute } from "./routeTypes";
import { adminRoles } from "./routeTypes";

const publicRoutes: AppRoute[] = [
  pageRoute("/logout", () => import("../pages/Authentication/Logout")),
  pageRoute("/login", () => import("../pages/Authentication/Login")),
  pageRoute("/forgot-password", () => import("../pages/Authentication/ForgetPassword")),
  pageRoute("/register", () => import("../pages/Authentication/Register")),
];

const authProtectedRoutes: AppRoute[] = [
  ...productAdminRoutes,
  ...rootAdminToolboxRoutes,
  { path: "*", component: <Navigate to="/dashboard" />, allowedRoles: adminRoles },
];

export { authProtectedRoutes, publicRoutes };
