import { Navigate } from "react-router-dom";

import { pageRoute } from "../Routes/routeHelpers";
import type { AppRoute } from "../Routes/routeTypes";
import { adminRoles } from "../Routes/routeTypes";

export const productAdminRoutes: AppRoute[] = [
  pageRoute("/dashboard", () => import("../pages/DashboardEcommerce"), adminRoles),
  pageRoute("/index", () => import("../pages/DashboardEcommerce"), adminRoles),
  pageRoute("/profile", () => import("../pages/Authentication/user-profile"), adminRoles),
  {
    path: "/",
    exact: true,
    component: <Navigate to="/dashboard" />,
    allowedRoles: adminRoles,
  },
];
