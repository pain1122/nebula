import { useEffect, useSyncExternalStore } from "react";

import { adminAuthAuthority } from "./authority";

export const useAdminAuth = () => {
  const snapshot = useSyncExternalStore(
    adminAuthAuthority.subscribe,
    adminAuthAuthority.getSnapshot,
    adminAuthAuthority.getSnapshot,
  );

  useEffect(() => {
    void adminAuthAuthority.bootstrap();
  }, []);

  return snapshot;
};
