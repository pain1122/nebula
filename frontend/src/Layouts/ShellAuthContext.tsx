import React, { createContext, useContext } from "react";

import { useProfile } from "../Components/Hooks/UserHooks";

type ShellAuthSnapshot = ReturnType<typeof useProfile>;

const ShellAuthContext = createContext<ShellAuthSnapshot | null>(null);

export const ShellAuthProvider = ({ children }: React.PropsWithChildren) => {
  const auth = useProfile();

  return <ShellAuthContext.Provider value={auth}>{children}</ShellAuthContext.Provider>;
};

export const useShellAuth = () => {
  const auth = useContext(ShellAuthContext);

  if (!auth) {
    throw new Error("useShellAuth must be used inside ShellAuthProvider.");
  }

  return auth;
};
