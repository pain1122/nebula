import React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useProfile } from "../Components/Hooks/UserHooks";

type AuthProtectedProps = {
    children: React.ReactNode;
};

const AuthProtected = ({ children }: AuthProtectedProps) => {
    const location = useLocation();
    const { userProfile, loading } = useProfile();

    if (loading) {
        return null;
    }

    if (!userProfile) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};

export default AuthProtected;