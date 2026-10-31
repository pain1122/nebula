import type { ApiEnvelope } from "../api/types";
import { checkupinoTransport } from "../api/transport";
import type { AuthUser, LoginCredentials } from "./types";

export interface SessionAuthGateway {
  currentUser(): Promise<AuthUser>;
  login(credentials: LoginCredentials): Promise<AuthUser>;
  logout(): Promise<void>;
}

export const getCsrfCookie = async () => {
  await checkupinoTransport.request<void>({
    method: "GET",
    path: "/sanctum/csrf-cookie",
  });
};

export const getCurrentUser = async () => {
  const response = await checkupinoTransport.request<ApiEnvelope<AuthUser>>({
    method: "GET",
    path: "/api/auth/me",
  });

  return response.data.data;
};

export const loginWithSession = async (credentials: LoginCredentials) => {
  await getCsrfCookie();
  await checkupinoTransport.request({ body: credentials, method: "POST", path: "/login" });

  return getCurrentUser();
};

export const logoutSession = async () => {
  await checkupinoTransport.request({ method: "POST", path: "/logout" });
};

export const sessionAuthGateway: SessionAuthGateway = {
  currentUser: getCurrentUser,
  login: loginWithSession,
  logout: logoutSession,
};
