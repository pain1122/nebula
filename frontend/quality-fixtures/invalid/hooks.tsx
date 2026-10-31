import { useState } from "react";

export const ConditionalHook = ({ enabled }: { enabled: boolean }) => {
  if (enabled) {
    useState(false);
  }

  return null;
};
