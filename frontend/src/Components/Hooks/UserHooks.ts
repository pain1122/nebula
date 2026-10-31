import { useAdminAuth } from "../../modules/checkupino/auth/useAdminAuth";
import { adminCapabilitiesFor } from "../../modules/checkupino/auth/capabilities";

const useProfile = () => {
    const snapshot = useAdminAuth();

    return {
        authError: snapshot.error,
        capabilities: adminCapabilitiesFor(snapshot.identity),
        denial: snapshot.denial,
        userProfile: snapshot.identity,
        loading: snapshot.status === "loading",
        isAuthenticated: snapshot.status === "authenticated",
    };
};

export { useProfile };
