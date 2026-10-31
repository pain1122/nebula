import { adminAuthAuthority } from "../../../modules/checkupino/auth/authority";
import type { LoginCredentials } from "../../../types/auth";
import type { AppDispatch } from "../../../store";

import {
    loginSuccess,
    logoutUserSuccess,
    apiError,
    reset_login_flag,
} from "./reducer";

type Navigate = (path: string) => void;

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
        return error.message;
    }

    return "Request failed.";
};

export const loginUser =
    (user: LoginCredentials, history: Navigate) =>
    async (dispatch: AppDispatch) => {
        try {
            const authUser = await adminAuthAuthority.login({
                email: user.email,
                password: user.password,
                remember: user.remember,
            });

            dispatch(loginSuccess(authUser));
            history(adminAuthAuthority.consumeRedirectIntent());
        } catch (error: unknown) {
            dispatch(apiError(getErrorMessage(error)));
        }
    };

export const logoutUser = () => async (dispatch: AppDispatch) => {
    try {
        await adminAuthAuthority.logout();
    } catch (error: unknown) {
        dispatch(apiError(getErrorMessage(error)));
    } finally {
        dispatch(logoutUserSuccess(true));
    }
};
export const resetLoginFlag = () => async (dispatch: any) => {
    try {
        const response = dispatch(reset_login_flag());
        return response;
    } catch (error) {
        dispatch(apiError(error));
    }
};
