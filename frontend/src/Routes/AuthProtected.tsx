import React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useProfile } from "../Components/Hooks/UserHooks";
import { panelLandingFor } from "../modules/checkupino/auth/panel";
import { adminCapabilitiesFor } from "../modules/checkupino/auth/capabilities";
import type { RoleName } from "../types/auth";

type AuthProtectedProps = {
  children: React.ReactNode;
  allowedRoles?: readonly RoleName[];
};

const hasAnyRole = (
  userRoles: readonly RoleName[] = [],
  allowedRoles: readonly RoleName[] = [],
) => {
  return userRoles.some((role) => allowedRoles.includes(role));
};

const AuthProtected = ({ children, allowedRoles }: AuthProtectedProps) => {
  const location = useLocation();
  const { userProfile, loading } = useProfile();

  if (loading) {
    return null;
  }

  if (!userProfile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles?.length && !hasAnyRole(userProfile.roles, allowedRoles)) {
    const landing = adminCapabilitiesFor(userProfile).accessAdminPanel
      ? "/"
      : panelLandingFor(userProfile);
    return <Navigate to={landing} replace />;
  }

  return <>{children}</>;
};

export default AuthProtected;
