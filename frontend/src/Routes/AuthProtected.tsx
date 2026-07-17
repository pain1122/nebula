import React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useProfile } from "../Components/Hooks/UserHooks";
import type { RoleName } from "../types/auth";

type AuthProtectedProps = {
    children: React.ReactNode;
    allowedRoles?: RoleName[];
};

const hasAnyRole = (userRoles: RoleName[] = [], allowedRoles: RoleName[] = []) => {
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
        const canAccessProductAdmin = hasAnyRole(userProfile.roles, ["admin", "root-admin"]);

        return <Navigate to={canAccessProductAdmin ? "/dashboard" : "/login"} replace />;
    }

    return <>{children}</>;
};

export default AuthProtected;
