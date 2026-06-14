import { useEffect, useState } from "react";
import { getCurrentUser } from "../../helpers/session_api";
import type { AuthUser } from "../../types/auth";

const useProfile = () => {
    const [loading, setLoading] = useState(true);
    const [userProfile, setUserProfile] = useState<AuthUser | null>(null);

    useEffect(() => {
        let isMounted = true;

        getCurrentUser()
            .then((user) => {
                if (isMounted) {
                    setUserProfile(user);
                }
            })
            .catch(() => {
                if (isMounted) {
                    setUserProfile(null);
                }
            })
            .finally(() => {
                if (isMounted) {
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    return {
        userProfile,
        loading,
        isAuthenticated: Boolean(userProfile),
    };
};

export { useProfile };