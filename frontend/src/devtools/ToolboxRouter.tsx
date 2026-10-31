import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import {
  DEV_TOOLBOX_BASE_PATH,
  DEV_TOOLBOX_DEFAULT_PATH,
} from "./toolboxContract";
import { rootAdminToolboxRoutes } from "./toolboxRoutes";
import "./toolbox.scss";

const routeFallback = (
  <div className="d-flex justify-content-center align-items-center py-4">
    <div className="spinner-border text-primary" aria-hidden="true"></div>
  </div>
);

const relativeToolboxPath = (path: string) =>
  path === DEV_TOOLBOX_BASE_PATH ? "" : path.slice(`${DEV_TOOLBOX_BASE_PATH}/`.length);

const ToolboxRouter = () => (
  <Routes>
    {rootAdminToolboxRoutes.map((route) => {
      const path = relativeToolboxPath(route.path);

      return path ? (
        <Route
          key={route.path}
          path={path}
          element={<Suspense fallback={routeFallback}>{route.component}</Suspense>}
        />
      ) : (
        <Route key={route.path} index element={route.component} />
      );
    })}
    <Route path="*" element={<Navigate to={DEV_TOOLBOX_DEFAULT_PATH} replace />} />
  </Routes>
);

export default ToolboxRouter;
