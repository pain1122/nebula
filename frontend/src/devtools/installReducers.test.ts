import { describe, expect, it } from "vitest";

import { checkupinoApi } from "../modules/checkupino/query/api";
import { store } from "../store";
import { installDevtoolReducers } from "./installReducers";

const baseReducerKeys = [
  checkupinoApi.reducerPath,
  "Account",
  "ForgetPassword",
  "Layout",
  "Login",
  "Profile",
].sort();

describe("retained devtool reducer isolation", () => {
  it("keeps demo state out of startup and installs it only on explicit request", () => {
    expect(Object.keys(store.getState()).sort()).toEqual(baseReducerKeys);

    installDevtoolReducers();

    expect(Object.keys(store.getState())).toEqual(
      expect.arrayContaining(["Calendar", "DashboardAnalytics", "Ecommerce", "Jobs", "Todos"]),
    );

    installDevtoolReducers();
    expect(Object.keys(store.getState())).toEqual(
      expect.arrayContaining(["Calendar", "DashboardAnalytics", "Ecommerce", "Jobs", "Todos"]),
    );
  });
});
