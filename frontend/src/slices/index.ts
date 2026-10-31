import { combineReducers } from "redux";
import type { Reducer } from "redux";

// Front
import LayoutReducer from "./layouts/reducer";

// Authentication
import LoginReducer from "./auth/login/reducer";
import AccountReducer from "./auth/register/reducer";
import ForgetPasswordReducer from "./auth/forgetpwd/reducer";
import ProfileReducer from "./auth/profile/reducer";

import { checkupinoApi } from "../modules/checkupino/query/api";

export type InjectedReducerMap = Record<string, Reducer>;

const baseReducers = {
  [checkupinoApi.reducerPath]: checkupinoApi.reducer,
  Layout: LayoutReducer,
  Login: LoginReducer,
  Account: AccountReducer,
  ForgetPassword: ForgetPasswordReducer,
  Profile: ProfileReducer,
};

export const createRootReducer = (injectedReducers: InjectedReducerMap = {}) =>
  combineReducers({
    ...baseReducers,
    ...injectedReducers,
  });

const rootReducer = combineReducers({
  ...baseReducers,
});

export default rootReducer;
