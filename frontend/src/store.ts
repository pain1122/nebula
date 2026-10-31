import { configureStore } from "@reduxjs/toolkit";
import rootReducer, { createRootReducer, type InjectedReducerMap } from "./slices";
import { checkupinoApi } from "./modules/checkupino/query/api";
import { adminAuthAuthority } from "./modules/checkupino/auth/authority";

const injectedReducers: InjectedReducerMap = {};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(checkupinoApi.middleware),
  devTools: true,
});

const authenticatedQueryScope = () => {
  const identity = adminAuthAuthority.getSnapshot().identity;
  return identity ? JSON.stringify([identity.public_id, [...identity.roles].sort()]) : null;
};

let queryScope = authenticatedQueryScope();
adminAuthAuthority.subscribe(() => {
  const nextScope = authenticatedQueryScope();
  if (nextScope !== queryScope) {
    queryScope = nextScope;
    store.dispatch(checkupinoApi.util.resetApiState());
  }
});

export const injectReducers = (reducers: InjectedReducerMap) => {
  let changed = false;

  for (const [key, reducer] of Object.entries(reducers)) {
    if (injectedReducers[key] !== reducer) {
      injectedReducers[key] = reducer;
      changed = true;
    }
  }

  if (changed) {
    store.replaceReducer(createRootReducer(injectedReducers) as typeof rootReducer);
  }
};

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
