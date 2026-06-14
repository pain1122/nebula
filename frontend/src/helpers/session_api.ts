import type { ApiEnvelope } from "../types/api";
import type { AuthUser, LoginCredentials } from "../types/auth";
import axios from "axios";

const withoutTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const backendUrl = withoutTrailingSlash(
    import.meta.env.VITE_BACKEND_URL || "http://localhost:8080",
);

const apiBaseUrl = withoutTrailingSlash(
    import.meta.env.VITE_API_BASE_URL || `${backendUrl}/api`,
);

const webClient = axios.create({
    baseURL: backendUrl,
    withCredentials: true,
    withXSRFToken: true,
    headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
    },
});

const apiReadClient = axios.create({
    baseURL: apiBaseUrl,
    withCredentials: true,
    withXSRFToken: false,
    headers: {
        Accept: "application/json",
    },
});

export const getCsrfCookie = () => {
    return webClient.get("/sanctum/csrf-cookie");
};

let currentUserRequest: Promise<AuthUser> | null = null;

export const getCurrentUser = async (forceRefresh = false) => {
    if (currentUserRequest && !forceRefresh) {
        return currentUserRequest;
    }

    currentUserRequest = apiReadClient
        .get<ApiEnvelope<AuthUser>>("/auth/me")
        .then((response) => response.data.data)
        .catch((error: unknown) => {
            currentUserRequest = null;
            throw error;
        });

    return currentUserRequest;
};
export const loginWithSession = async (credentials: LoginCredentials) => {
    await getCsrfCookie();
    await webClient.post("/login", credentials);

    return getCurrentUser(true);
};

export const logoutSession = async () => {
    await webClient.post("/logout");
    currentUserRequest = null;
};
